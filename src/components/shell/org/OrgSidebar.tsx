import { Link, useLocation } from 'react-router-dom';
import type { OrgIdentity } from '../../../api/client';
import { Icon } from '../../ui/Icon';
import { cx } from '../../ui/cx';
import { BrandMark } from '../BrandMark';
import { isNavItemActive, type NavItem } from '../navItems';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

/** Desktop sidebar (lg and up) for the organization portal. */
export function OrgSidebar({ items, identity }: { items: readonly NavItem[]; identity: OrgIdentity | null }) {
  const { pathname } = useLocation();
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-dvh w-64 flex-col bg-surface-container-low pb-space-lg pt-space-lg shadow-shell lg:flex">
      <div className="mb-space-xl flex items-center gap-space-sm px-space-lg">
        <BrandMark size={40} />
        <div className="flex flex-col">
          <span className="font-title-md text-title-md tracking-tight text-primary">Seminex</span>
          <span className="font-caption text-caption tracking-wider text-text-subtle">Organization portal</span>
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
        <WorkspaceSwitcher identity={identity} variant="menu" />
      </div>
    </aside>
  );
}