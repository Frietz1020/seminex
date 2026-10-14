import { useCallback, useEffect, useState } from 'react';

/**
 * Counts down whole seconds. Starts running on mount by default, because the
 * verification email has just been sent when the person arrives.
 */
export function useCooldown(durationSeconds: number, startActive = true) {
  const [endsAt, setEndsAt] = useState<number | null>(() =>
    startActive ? Date.now() + durationSeconds * 1000 : null,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) setEndsAt(null);
    }, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const start = useCallback(() => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + durationSeconds * 1000);
  }, [durationSeconds]);

  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

  return { remaining, start };
}