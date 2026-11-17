import { useEffect, useState } from 'react';
import { api } from '../api/client';
/** Current lifecycle time. Remains unavailable until the database returns a valid sample. */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const result = await api.getServerTime();
      if (!active) return;
      const timestamp = result.ok ? Date.parse(result.data.now) : Number.NaN;
      setNow(Number.isFinite(timestamp) ? timestamp : null);
    };
    void refresh();
    const id = window.setInterval(() => { void refresh(); }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
