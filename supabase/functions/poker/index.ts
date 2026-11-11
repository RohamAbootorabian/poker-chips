// Online poker referee. Deals cards, applies actions and keeps hole cards private.
//
// POST { op, code, playerId, secret, ... }
//   create { name, settings }  -> { ok }
//   act    { action }          -> { state, version } | { error }
//   hole                       -> { handNumber, cards }
//
// Game-rule failures come back as 200 { error: <code> } so the client can show them.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createTable, emptyPrivate, GameError, onlineStep } from '../_shared/engine.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Uniform integer in [0, n) from the platform's cryptographic generator. */
function rand(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{8,40}$/.test(v);
const isSecret = (v: unknown): v is string => typeof v === 'string' && v.length >= 16 && v.length <= 80;
const isCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z0-9]{4,8}$/.test(v);

async function load(code: string) {
  const { data, error } = await db.from('poker_tables').select('state, private, version').eq('code', code).maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const { op, code, playerId, secret } = body;
    if (!isCode(code) || !isId(playerId) || !isSecret(secret)) return json({ error: 'badRequest' });

    if (op === 'create') {
      const state = { ...createTable(code, playerId, String(body.name ?? ''), body.settings), mode: 'online' };
      const priv = { ...emptyPrivate(), keys: { [playerId]: secret } };
      const { error } = await db.from('poker_tables').insert({ code, state, private: priv });
      return json({ ok: !error });
    }

    if (op === 'hole') {
      const row = await load(code);
      if (!row || row.state.mode !== 'online') return json({ error: 'notFound' });
      if (row.private.keys[playerId] !== secret) return json({ error: 'notAllowed' });
      return json({ handNumber: row.state.handNumber, cards: row.private.holes[playerId] ?? [] });
    }

    if (op === 'act') {
      const action = body.action;
      for (let attempt = 0; attempt < 6; attempt++) {
        const row = await load(code);
        if (!row || row.state.mode !== 'online') return json({ error: 'notFound' });
        const priv = row.private;
        const known = priv.keys[playerId];
        if (known ? known !== secret : !(action?.type === 'join' && action.playerId === playerId)) {
          return json({ error: 'notAllowed' });
        }
        // Everyone needs their own device to see their cards: no seats without a phone.
        if (action?.type === 'join' && action.playerId !== playerId) return json({ error: 'notAllowed' });

        const next = onlineStep(row.state, priv, action, playerId, rand);
        if (!known) next.priv = { ...next.priv, keys: { ...next.priv.keys, [playerId]: secret } };
        const { data, error } = await db
          .from('poker_tables')
          .update({ state: next.state, private: next.priv, version: row.version + 1, updated_at: new Date().toISOString() })
          .eq('code', code)
          .eq('version', row.version)
          .select('version');
        if (error) throw error;
        if (data.length === 1) return json({ state: next.state, version: row.version + 1 });
      }
      return json({ error: 'conflict' });
    }

    return json({ error: 'badRequest' });
  } catch (e) {
    if (e instanceof GameError) return json({ error: e.code });
    console.error(e);
    return json({ error: 'server' }, 500);
  }
});
