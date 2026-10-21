import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { Icon } from '../../ui/Icon';

/** Shown while the device has no connection. Saved seminars stay available; changes need a connection. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="flex items-start gap-space-sm rounded-xl bg-secondary-fixed px-space-md py-space-sm text-on-secondary-fixed shadow-card">
      <Icon name="cloud_off" size={20} className="mt-0.5 text-secondary" />
      <p className="font-body-sm-medium text-body-sm-medium">You are offline. Showing saved seminars. Changes need a connection.</p>
    </div>
  );
}