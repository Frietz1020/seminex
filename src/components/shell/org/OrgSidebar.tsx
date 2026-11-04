import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, type OrgIdentity } from '../../../api/client';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useUnsyncedScanCount } from '../../../hooks/useUnsyncedScanCount';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { cx } from '../../ui/cx';
import { orgActionPrimary, orgActionSecondary, orgActionTonal } from '../../../features/org/orgActionStyles';
import { Spinner } from '../../ui/Spinner';
import { BrandMark } from '../BrandMark';
import { isNavItemActive, type NavItem } from '../navItems';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

/** Desktop sidebar (lg and up) for the organization portal. */
export function OrgSidebar({ items, identity }: { items: readonly NavItem[]; identity: OrgIdentity | null }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const pendingCount = useUnsyncedScanCount();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const adviser = identity?.role === 'adviser';

  async function syncScans() {
    if (syncing || !online || pendingCount === 0) return;
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(false);
    const result = await api.syncQueuedScans();
    setSyncing(false);
    if (result.ok) setSyncMessage(`${result.data.synced} ${result.data.synced === 1 ? 'scan' : 'scans'} synced.`);
    else setSyncError(true);
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await api.signOut();
    navigate('/organization/sign-in', { replace: true });
  }

  return (
    <aside className={`fixed left-0 top-0 z-50 hidden h-dvh ${adviser ? 'w-72' : 'w-64'} flex-col bg-surface-container-low pb-space-lg pt-space-lg shadow-shell lg:flex`}>
      <div className="mb-space-xl flex items-center gap-space-sm px-space-lg">
        <BrandMark size={40} />
        <div className="flex flex-col">
          <span className="font-title-md text-title-md tracking-tight text-primary">Seminex</span>
          <span className="font-caption text-caption tracking-wider text-text-subtle">{adviser ? 'ADMIN PORTAL' : 'Organization portal'}</span>
        </div>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-space-xs px-space-md">
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex min-h-11 items-center gap-space-sm rounded-lg px-space-md py-2.5 transition-colors',
                active
                  ? 'bg-primary-container font-body-base-medium text-on-primary shadow-card'
                  : 'font-body-base text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
              )}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-space-md">
        {adviser ? <div className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-md"><span className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary">Adviser workspace</span><span className="font-body-sm-medium text-body-sm-medium text-on-surface">{identity?.organization.department ?? 'Gordon College · CCS'}</span></div> : <WorkspaceSwitcher identity={identity} variant="menu" />}
      </div>

      <div className="mx-space-md mt-space-md border-t border-outline-variant/50 pt-space-md">
        <button
          type="button"
          onClick={() => { setSyncMessage(null); setSyncError(false); setConfirmingSignOut(true); }}
          className="flex min-h-11 w-full items-center gap-space-sm rounded-lg px-space-md py-2.5 font-body-base text-on-surface-variant transition-colors hover:bg-danger-ink hover:text-on-error"
        >
          <Icon name="logout" size={20} />
          <span>Sign out</span>
        </button>
      </div>

      <Dialog
        open={confirmingSignOut}
        onClose={() => setConfirmingSignOut(false)}
        title={pendingCount > 0 ? 'Sign out with unsynced scans?' : 'Sign out of Seminex?'}
      >
        <div className="mt-space-md flex flex-col gap-space-md">
          {pendingCount > 0 ? (
            <div className="flex items-start gap-space-sm rounded-xl border border-outline-variant/50 bg-surface-container-low p-space-md">
              <Icon name={online ? 'sync' : 'cloud_off'} size={20} className="mt-0.5 shrink-0 text-secondary" />
              <div>
                <p className="font-body-sm-medium text-body-sm-medium text-on-surface">{pendingCount} attendance {pendingCount === 1 ? 'scan has' : 'scans have'} not synced.</p>
                <p className="mt-1 font-caption text-caption text-text-secondary">{online ? 'Sync them before signing out to preserve the records on the server.' : 'Reconnect and sync before signing out. Signing out anyway clears the queued scans from this device.'}</p>
              </div>
            </div>
          ) : (
            <p className="font-body-sm text-body-sm text-text-secondary">Signing out clears the organization session and its offline cache from this device.</p>
          )}
          {syncMessage && <p role="status" className="rounded-lg bg-[#E8F5EC] p-space-sm font-caption text-caption text-[#1E6B37]">{syncMessage}</p>}
          {syncError && <p role="alert" className="rounded-lg bg-danger-surface p-space-sm font-caption text-caption text-danger-ink">Could not sync the queued scans. Check your connection and try again.</p>}
          <div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmingSignOut(false)} className={orgActionTonal}>Cancel</button>
            {pendingCount > 0 && <button type="button" onClick={() => void syncScans()} disabled={!online || syncing} className={orgActionSecondary}><Icon name="sync" size={18} />{syncing ? 'Syncing…' : online ? 'Sync now' : 'Offline'}</button>}
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className={pendingCount > 0 ? `${orgActionPrimary} bg-danger text-on-error hover:bg-danger-ink` : orgActionPrimary}>{signingOut && <Spinner />}{pendingCount > 0 ? (signingOut ? 'Signing out…' : 'Sign out anyway') : (signingOut ? 'Signing out…' : 'Sign out')}</button>
          </div>
        </div>
      </Dialog>
    </aside>
  );
}
