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

/** Collapsible desktop sidebar (lg and up) for the organization portal. */
export function OrgSidebar({
  items,
  identity,
  collapsed,
  onToggleCollapse,
}: {
  items: readonly NavItem[];
  identity: OrgIdentity | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
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
    <aside
      className={cx(
        'fixed left-0 top-0 z-50 hidden h-dvh flex-col border-r border-border-subtle bg-surface-card pb-space-lg pt-space-md transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : adviser ? 'w-72' : 'w-64',
      )}
    >
      <div
        className={cx(
          'mb-space-lg flex items-center',
          collapsed ? 'flex-col gap-2 px-2' : 'justify-between gap-space-sm px-space-md',
        )}
      >
        <div className={cx('flex min-w-0 items-center gap-space-sm', collapsed && 'justify-center')}>
          <BrandMark size={collapsed ? 34 : 38} />
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-title-md text-title-md tracking-tight text-primary">Seminex</span>
              <span className="truncate font-caption text-caption text-text-subtle">
                {adviser ? 'Faculty adviser portal' : 'Organization portal'}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        >
          <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} size={20} />
        </button>
      </div>

      <nav aria-label="Main" className={cx('flex flex-1 flex-col gap-space-xs', collapsed ? 'px-2' : 'px-space-sm')}>
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={cx(
                'flex min-h-11 items-center rounded-lg py-2.5 transition-colors',
                collapsed ? 'justify-center px-0' : 'gap-space-sm px-space-md',
                active
                  ? 'bg-primary-container font-body-base-medium text-on-primary'
                  : 'font-body-base text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
              )}
            >
              <Icon name={item.icon} size={20} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-space-sm">
          {adviser ? (
            <div className="flex flex-col gap-0.5 rounded-xl bg-surface-container p-space-md">
              <span className="font-body-sm-medium text-body-sm-medium text-on-surface">
                {identity?.organization.department ?? 'Gordon College · CCS'}
              </span>
              <span className="font-caption text-caption text-text-secondary">Faculty adviser</span>
            </div>
          ) : (
            <WorkspaceSwitcher identity={identity} variant="menu" />
          )}
        </div>
      )}

      <div className={cx('mt-space-md border-t border-border-subtle pt-space-md', collapsed ? 'mx-2' : 'mx-space-sm')}>
        <button
          type="button"
          onClick={() => setConfirmingSignOut(true)}
          aria-label={collapsed ? 'Sign out' : undefined}
          title={collapsed ? 'Sign out' : undefined}
          className={cx(
            'flex min-h-11 w-full items-center rounded-lg py-2.5 font-body-base text-on-surface-variant transition-colors hover:bg-danger-surface hover:text-danger-ink',
            collapsed ? 'justify-center px-0' : 'gap-space-sm px-space-md',
          )}
        >
          <Icon name="logout" size={20} />
          {!collapsed && <span>Sign out</span>}
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
