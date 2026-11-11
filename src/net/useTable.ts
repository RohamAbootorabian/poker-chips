import { useCallback, useEffect, useRef, useState } from 'react';

import { reduce } from '@/engine/engine';
import { Action, TableState } from '@/engine/types';

import { Snapshot, store } from './store';

export type LoadStatus = 'loading' | 'ready' | 'notFound' | 'error';

/**
 * Live view of one table plus a `dispatch` that applies an action through the
 * engine and writes the result. Throws GameError for illegal actions and a
 * plain Error for network problems.
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
      for (let attempt = 0; attempt < 5; attempt++) {
        const cur = ref.current ?? (await store.fetch(code));
        if (!cur) throw new Error('notFound');
        const next = reduce(cur.state, action, meId);
        if (await store.update(code, cur.version, next)) {
          accept({ state: next, version: cur.version + 1 });
          return next;
        }
        // Someone else wrote first: reload and re-validate against the new state.
        const fresh = await store.fetch(code);
        if (fresh) accept(fresh);
      }
      throw new Error('conflict');
    },
    [code, meId, accept],
  );

  return { state: snap?.state ?? null, status, dispatch, refresh };
}
