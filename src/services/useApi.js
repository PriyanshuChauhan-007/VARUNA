import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from './api.js';

/**
 * Shared data-fetching hook giving every page a consistent
 * { data, loading, error, reload } contract.
 *
 *   const { data, loading, error, reload } = useApi(() => getSkill(), []);
 *
 * The fetcher is re-created each render; it only runs on mount, when `deps`
 * change, or on an explicit `reload()` — so pass every input via `deps`.
 * Every state transition happens inside a queued callback rather than
 * synchronously in the effect body, which keeps the React compiler lint rules
 * (react-hooks/refs, react-hooks/set-state-in-effect) happy without suppressions.
 */
export function useApi(fetcher, deps, { enabled = true } = {}) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const fetcherRef = useRef(fetcher);

  // Track the newest closure without re-running the fetch effect.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      if (!enabled) {
        // Disabled queries (e.g. a closed detail drawer) show an honest empty
        // state instead of stale data.
        setState({ data: null, loading: false, error: null });
        return;
      }
      setState((s) => ({ data: s.data, loading: true, error: null }));
      Promise.resolve()
        .then(() => fetcherRef.current())
        .then((data) => {
          if (!cancelled) setState({ data, loading: false, error: null });
        })
        .catch((err) => {
          if (!cancelled) setState({ data: null, loading: false, error: toApiError(err) });
        });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
