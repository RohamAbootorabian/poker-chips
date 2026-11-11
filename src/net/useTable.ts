import { useCallback, useEffect, useRef, useState } from 'react';

import { Action, TableState } from '@/engine/types';

import { Snapshot, store } from './store';

export type LoadStatus = 'loading' | 'ready' | 'notFound' | 'error';

/**
 * Live view of one table plus a `dispatch` that applies an action and saves
 * it. Rejects with GameError for illegal actions and a plain Error for
 * network problems.
 */
export function useTable(code: string, meId: string) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const ref = useRef<Snapshot | null>(null);

  const accept = useCallback((next: Snapshot) => {
    if (ref.current && next.version <= ref.current.version) return;
    ref.current = next;
    setSnap(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await store.fetch(code);
      if (next) {
        accept(next);
        setStatus('ready');
      } else if (!ref.current) {
        setStatus('notFound');
      }
    } catch {
      if (!ref.current) setStatus('error');
    }
  }, [code, accept]);

  useEffect(() => {
    ref.current = null;
    setSnap(null);
    setStatus('loading');
    void refresh();
    return store.subscribe(code, () => void refresh());
  }, [code, refresh]);

  const dispatch = useCallback(
    async (action: Action): Promise<TableState> => {
      const snap = await store.act(code, action, meId);
      accept(snap);
      return snap.state;
    },
    [code, meId, accept],
  );

  return { state: snap?.state ?? null, status, dispatch, refresh };
}
