import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, type OrgIdentity } from '../../../api/client';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { cx } from '../../ui/cx';
import { orgActionPrimary, orgActionTonal } from '../../../features/org/orgActionStyles';
import { Spinner } from '../../ui/Spinner';
import { BrandMark } from '../BrandMark';
import { isNavItemActive, type NavItem } from '../navItems';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

/** Desktop sidebar (lg and up) for the organization portal. */
export function OrgSidebar({ items, identity }: { items: readonly NavItem[]; identity: OrgIdentity | null }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const adviser = identity?.role === 'adviser';

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
          onClick={() => setConfirmingSignOut(true)}
          className="flex min-h-11 w-full items-center gap-space-sm rounded-lg px-space-md py-2.5 font-body-base text-on-surface-variant transition-colors hover:bg-danger-ink hover:text-on-error"
        >
          <Icon name="logout" size={20} />
          <span>Sign out</span>
        </button>
      </div>

      <Dialog
        open={confirmingSignOut}
        onClose={() => setConfirmingSignOut(false)}
        title="Sign out of Seminex?"
      >
        <div className="mt-space-md flex flex-col gap-space-md">
          <p className="font-body-sm text-body-sm text-text-secondary">Signing out ends this organization session on this device.</p>
          <div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmingSignOut(false)} className={orgActionTonal}>Cancel</button>
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className={orgActionPrimary}>{signingOut && <Spinner />}{signingOut ? 'Signing out…' : 'Sign out'}</button>
          </div>
        </div>
      </Dialog>
    </aside>
  );
}
