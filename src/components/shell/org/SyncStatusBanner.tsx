import { useEffect, useRef, useState } from 'react';
import { api } from '../../../api/client';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useUnsyncedScanCount } from '../../../hooks/useUnsyncedScanCount';
import { Icon } from '../../ui/Icon';

type Outcome = { kind: 'idle' } | { kind: 'syncing' } | { kind: 'failed' } | { kind: 'done'; synced: number };

/**
 * Shows scans recorded on this device that the server does not have yet. It tries once when the device is
 * online and whenever the connection returns, and "Sync now" tries again. Scans are never dropped on failure.
 */
export function SyncStatusBanner() {
  const count = useUnsyncedScanCount();
  const online = useOnlineStatus();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const attemptedRef = useRef(false);

  async function sync() {
    setOutcome({ kind: 'syncing' });
    const result = await api.syncQueuedScans();
    setOutcome(result.ok ? { kind: 'done', synced: result.data.synced } : { kind: 'failed' });
  }

  useEffect(() => {
    if (!online) {
      attemptedRef.current = false;
      return;
    }
    if (count > 0 && !attemptedRef.current) {
      attemptedRef.current = true;
      void sync();
    }
    // sync only reads stable setters and the API client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, count]);

  const syncing = outcome.kind === 'syncing';
  const announcement =
    count > 0
      ? `${count} ${count === 1 ? 'scan' : 'scans'} waiting to sync.`
      : outcome.kind === 'done' && outcome.synced > 0
        ? `${outcome.synced} ${outcome.synced === 1 ? 'scan' : 'scans'} synced.`
        : '';

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {count > 0 && (
        <div className="flex flex-col gap-space-sm rounded-xl border border-secondary/20 bg-secondary-fixed/60 px-space-md py-space-sm shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-space-sm">
            <Icon name="sync" size={20} className={`mt-0.5 text-secondary ${syncing ? 'motion-safe:animate-spin' : ''}`} />
            <p className="font-body-sm text-body-sm text-on-secondary-fixed">
              <span className="font-body-sm-medium text-body-sm-medium">
                {count} {count === 1 ? 'scan' : 'scans'} waiting to sync.
              </span>{' '}
              {outcome.kind === 'failed'
                ? 'The last try did not work. Select Sync now to try again.'
                : !online
                  ? 'You are offline. They sync when you are back online.'
                  : syncing
                    ? 'Syncing now.'
                    : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void sync()}
            disabled={!online || syncing}
            aria-describedby={!online ? 'sync-offline-reason' : undefined}
            className="inline-flex min-h-11 items-center justify-center gap-space-xs rounded-lg bg-secondary px-space-md font-body-sm-medium text-body-sm-medium text-on-secondary transition-colors hover:bg-on-secondary-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sync now
          </button>
          {!online && (
            <span id="sync-offline-reason" className="sr-only">
              Sync now needs a connection.
            </span>
          )}
        </div>
      )}
    </>
  );
}