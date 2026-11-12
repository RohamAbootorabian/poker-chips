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
    const cur = ref.current;
    if (cur && cur.state.code === next.state.code && next.version <= cur.version) return;
    ref.current = next;
    setSnap(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await store.fetch(code);
      if (next) {
        accept(next);
        setStatus('ready');
      } else if (ref.current?.state.code !== code) {
        setStatus('notFound');
      }
    } catch {
      if (ref.current?.state.code !== code) setStatus('error');
    }
  }, [code, accept]);

  useEffect(() => {
    // Initial load. `refresh` only sets state after its network request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return store.subscribe(code, () => void refresh());
  }, [code, refresh]);

  // A snapshot of another table (the code in the URL changed) is not this table's state.
  const current = snap?.state.code === code ? snap.state : null;

  const dispatch = useCallback(
    async (action: Action): Promise<TableState> => {
      const snap = await store.act(code, action, meId);
      accept(snap);
      return snap.state;
    },
    [code, meId, accept],
  );

  return { state: current, status: current ? 'ready' : status === 'ready' ? 'loading' : status, dispatch, refresh };
}
