import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiErrorCode, ApiResult } from '../api/client';
import { expireSession } from '../session/storage';

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; code: ApiErrorCode }
  | { status: 'success'; data: T; fromCache: boolean };

/**
 * Loads data and exposes loading, empty, error, and success states.
 * "key" restarts the load when it changes. A session_expired error ends the session,
 * and the route guard then sends the student to sign in.
 */
export function useResource<T>(
  load: () => Promise<ApiResult<T>>,
  key: string,
  isEmpty?: (data: T) => boolean,
) {
  const loadRef = useRef(load);
  const isEmptyRef = useRef(isEmpty);
  useEffect(() => {
    loadRef.current = load;
    isEmptyRef.current = isEmpty;
  });

  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    void loadRef.current().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        if (result.error.code === 'session_expired') expireSession();
        setState({ status: 'error', code: result.error.code });
        return;
      }
      setState(
        isEmptyRef.current?.(result.data)
          ? { status: 'empty' }
          : { status: 'success', data: result.data, fromCache: result.fromCache === true },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, reload };
}