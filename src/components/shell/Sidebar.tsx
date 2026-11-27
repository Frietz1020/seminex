import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, type OrgIdentity } from '../../api/client';
import { actionPrimary, actionTonal } from '../ui/actionStyles';
import { Icon } from '../ui/Icon';
import { cx } from '../ui/cx';
import { Dialog } from '../ui/Dialog';
import { Spinner } from '../ui/Spinner';
import { WorkspaceSwitcher } from './org/WorkspaceSwitcher';
import { BrandMark } from './BrandMark';
import { isNavItemActive, NAV_ITEMS } from './navItems';

/** Collapsible desktop sidebar (lg and up). */
export function Sidebar({
  workspaceIdentity,
  collapsed,
  onToggleCollapse,
}: {
  workspaceIdentity: OrgIdentity | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { pathname } = useLocation();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    await api.signOut();
  }

  return (
    <aside
      className={cx(
        'fixed left-0 top-0 z-50 hidden h-dvh flex-col border-r border-border-subtle bg-surface-card pb-space-lg pt-space-md transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-64',
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
              <span className="truncate font-caption text-caption text-text-subtle">Student portal</span>
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
        {NAV_ITEMS.map((item) => {
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

      {workspaceIdentity?.role === 'org_member' && !collapsed && (
        <div className="px-space-sm">
          <WorkspaceSwitcher identity={workspaceIdentity} variant="menu" />
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

      <Dialog open={confirmingSignOut} onClose={() => setConfirmingSignOut(false)} title="Sign out of Seminex?">
        <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">
          Tickets and drafts saved on this device are removed. You need an internet connection to sign in again and
          get your tickets back.
        </p>
        <div className="mt-space-lg flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirmingSignOut(false)} className={actionTonal}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            aria-disabled={signingOut || undefined}
            aria-busy={signingOut || undefined}
            className={cx(actionPrimary, signingOut && 'cursor-wait opacity-90')}
          >
            {signingOut && <Spinner />}
            <span>{signingOut ? 'Signing out' : 'Sign out'}</span>
          </button>
        </div>
      </Dialog>
    </aside>
  );
}
