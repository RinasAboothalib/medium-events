import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api';

// Loads data for a page and reloads it on demand; a failure becomes a message to show.
// data is undefined until the first load finishes (null can be a real answer, e.g. nothing published yet).
export function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[], fallback = "This page couldn't be loaded. Refresh to try again.") {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(fetcher, deps);

  const reload = useCallback(async () => {
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 500 ? e.message : fallback);
    }
  }, [run, fallback]);

  useEffect(() => {
    let cancelled = false;
    run().then(
      (value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      },
      (e) => !cancelled && setError(e instanceof ApiError && e.status !== 500 ? e.message : fallback),
    );
    return () => {
      cancelled = true;
    };
  }, [run, fallback]);

  return { data, error, reload, setData };
}
