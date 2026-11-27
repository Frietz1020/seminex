import { useCallback, useState } from 'react';

const STORAGE_KEY = 'seminex.sidebar.collapsed';

function readInitial(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persists desktop sidebar collapsed state across reloads and portals. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(readInitial);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors in restricted browsing modes.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
