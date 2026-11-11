import 'expo-sqlite/localStorage/install';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { reduce } from '@/engine/engine';
import { Action, GameError, Settings, TableState } from '@/engine/types';
import { getSecret } from '@/lib/identity';

export interface Snapshot {
  state: TableState;
  version: number;
}

/** Where table state lives. Writes are compare-and-swap on `version`. */
export interface TableStore {
  /** true when devices are really connected through a server. */
  readonly online: boolean;
  create(state: TableState): Promise<boolean>;
  fetch(code: string): Promise<Snapshot | null>;
  /** Apply `action` as `actorId` and save. Throws GameError for illegal moves. */
  act(code: string, action: Action, actorId: string): Promise<Snapshot>;
  /** Online poker (server deals the cards). Only available with a server. */
  createOnline(code: string, hostId: string, hostName: string, settings: Settings): Promise<boolean>;
  /** This device's own two cards for the current hand of an online table. */
  holeCards(code: string, playerId: string): Promise<{ handNumber: number; cards: string[] }>;
  subscribe(code: string, onChange: () => void): () => void;
}

/**
 * Chip-tracking tables: the client applies the rules and writes the result
 * with compare-and-swap, retrying when another device wrote first.
 */
async function actWithRetry(
  fetch: (code: string) => Promise<Snapshot | null>,
  update: (code: string, expectedVersion: number, state: TableState) => Promise<boolean>,
  code: string,
  action: Action,
  actorId: string,
): Promise<Snapshot> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await fetch(code);
    if (!cur) throw new Error('notFound');
    const next = reduce(cur.state, action, actorId);
    if (await update(code, cur.version, next)) return { state: next, version: cur.version + 1 };
  }
  throw new Error('conflict');
}

// ---------- Supabase: tables shared between devices ----------

const POLL_MS = 5000;

class SupabaseStore implements TableStore {
  readonly online = true;
  private channels = new Map<string, RealtimeChannel>();

  constructor(private sb: SupabaseClient) {}

  async create(state: TableState) {
    const { data, error } = await this.sb.rpc('poker_create', { p_code: state.code, p_state: state });
    if (error) throw error;
    return data === true;
  }

  async fetch(code: string) {
    const { data, error } = await this.sb.rpc('poker_get', { p_code: code });
    if (error) throw error;
    const row = (data as Snapshot[] | null)?.[0];
    return row ? { state: row.state, version: row.version } : null;
  }

  private async update(code: string, expectedVersion: number, state: TableState) {
    const { data, error } = await this.sb.rpc('poker_update', {
      p_code: code,
      p_version: expectedVersion,
      p_state: state,
    });
    if (error) throw error;
    return data === true;
  }

  /** Call the referee function that runs online tables. */
  private async referee<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.functions.invoke('poker', { body: { ...body, secret: getSecret() } });
    if (error) throw error;
    if (data?.error) {
      if (data.error === 'notFound' || data.error === 'conflict') throw new Error(data.error);
      throw new GameError(data.error);
    }
    return data as T;
  }

  async act(code: string, action: Action, actorId: string) {
    const cur = await this.fetch(code);
    if (!cur) throw new Error('notFound');
    const snap =
      cur.state.mode === 'online'
        ? await this.referee<Snapshot>({ op: 'act', code, playerId: actorId, action })
        : await actWithRetry(this.fetch.bind(this), this.update.bind(this), code, action, actorId);
    // Tell the other devices to refetch. Polling covers a missed message.
    void this.channels.get(code)?.send({ type: 'broadcast', event: 'changed', payload: {} });
    return snap;
  }

  async createOnline(code: string, hostId: string, hostName: string, settings: Settings) {
    const res = await this.referee<{ ok: boolean }>({ op: 'create', code, playerId: hostId, name: hostName, settings });
    return res.ok;
  }

  holeCards(code: string, playerId: string) {
    return this.referee<{ handNumber: number; cards: string[] }>({ op: 'hole', code, playerId });
  }

  subscribe(code: string, onChange: () => void) {
    const channel = this.sb.channel(`table:${code}`);
    channel.on('broadcast', { event: 'changed' }, onChange).subscribe();
    this.channels.set(code, channel);
    const timer = setInterval(onChange, POLL_MS);
    return () => {
      clearInterval(timer);
      this.channels.delete(code);
      void this.sb.removeChannel(channel);
    };
  }
}

// ---------- Local: single device (or several tabs of one browser) ----------

class LocalStore implements TableStore {
  readonly online = false;
  private listeners = new Map<string, Set<() => void>>();

  private key(code: string) {
    return `pc.table.${code}`;
  }

  private read(code: string): Snapshot | null {
    const raw = localStorage.getItem(this.key(code));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  }

  private write(code: string, snap: Snapshot) {
    localStorage.setItem(this.key(code), JSON.stringify(snap));
    this.listeners.get(code)?.forEach((fn) => fn());
  }

  async create(state: TableState) {
    if (this.read(state.code)) return false;
    this.write(state.code, { state, version: 1 });
    return true;
  }

  async fetch(code: string) {
    return this.read(code);
  }

  private async update(code: string, expectedVersion: number, state: TableState) {
    const cur = this.read(code);
    if (!cur || cur.version !== expectedVersion) return false;
    this.write(code, { state, version: expectedVersion + 1 });
    return true;
  }

  act(code: string, action: Action, actorId: string) {
    return actWithRetry(this.fetch.bind(this), this.update.bind(this), code, action, actorId);
  }

  // Hidden cards need a referee, so there is no online poker without a server.
  async createOnline(): Promise<boolean> {
    return false;
  }

  async holeCards() {
    return { handNumber: 0, cards: [] };
  }

  subscribe(code: string, onChange: () => void) {
    const set = this.listeners.get(code) ?? new Set();
    set.add(onChange);
    this.listeners.set(code, set);
    // On web, other tabs of the same browser share localStorage.
    const canListen = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    const onStorage = (e: StorageEvent) => {
      if (e.key === this.key(code)) onChange();
    };
    if (canListen) window.addEventListener('storage', onStorage);
    return () => {
      set.delete(onChange);
      if (canListen) window.removeEventListener('storage', onStorage);
    };
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const store: TableStore =
  url && key
    ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }))
    : new LocalStore();
