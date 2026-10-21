import { useSyncExternalStore } from 'react';
import { countQueuedScans, subscribeOrgCache } from '../api/orgOfflineCache';
import { useSession } from '../session/useSession';

/** Number of scans recorded on this device and not yet sent to the server. */
export function useUnsyncedScanCount(): number {
  const accountId = useSession()?.studentId ?? null;
  return useSyncExternalStore(
    subscribeOrgCache,
    () => (accountId ? countQueuedScans(accountId) : 0),
    () => 0,
  );
}