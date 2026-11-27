import { useEffect, useState } from 'react';
import { checkServerClock, getEstimatedServerNow, subscribeServerClock } from './serverClock';

/** Current lifecycle time. Remains unavailable until the database returns a valid sample. */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(() => getEstimatedServerNow());

  useEffect(() => {
    let active = true;
    const syncState = () => {
      if (active) setNow(checkServerClock());
    };
    const unsubscribe = subscribeServerClock(syncState);
    queueMicrotask(syncState);
    const id = window.setInterval(syncState, intervalMs);
    return () => {
      active = false;
      window.clearInterval(id);
      unsubscribe();
    };
  }, [intervalMs]);

  return now;
}
