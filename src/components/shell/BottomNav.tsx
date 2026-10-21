import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { cx } from '../ui/cx';
import { isNavItemActive, NAV_ITEMS, type NavItem } from './navItems';

/** Mobile bottom navigation (below lg). Not in the Stitch exports. */
export function BottomNav({ items = NAV_ITEMS }: { items?: readonly NavItem[] }) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex bg-surface-container-low pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-shell lg:hidden"
    >
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5"
          >
            <span
              className={cx(
                'flex h-7 w-14 items-center justify-center rounded-full transition-colors',
                active ? 'bg-maroon-container text-primary-container' : 'text-on-surface-variant',
              )}
            >
              <Icon name={item.icon} size={22} />
            </span>
            <span
              className={cx(
                'text-center font-caption text-caption',
                active ? 'font-semibold text-primary-container' : 'text-on-surface-variant',
              )}
            >
              {item.shortLabel ?? item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}