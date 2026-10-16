import type { IconName } from '../ui/icons';

export interface NavItem {
  to: string;
  label: string;
  /** Shorter visible label for the bottom bar; the full label stays the accessible name. */
  shortLabel?: string;
  icon: IconName;
  end?: boolean;
  /** Other paths that keep this item marked as the current page, for example a page that belongs to it. */
  alsoActiveFor?: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/home', label: 'Home', icon: 'home', end: true },
  {
    to: '/seminars',
    label: 'Available seminars',
    shortLabel: 'Available',
    icon: 'event_available',
    alsoActiveFor: ['/guidelines'],
  },
  { to: '/my-seminars', label: 'My seminars', icon: 'bookmark' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/profile', label: 'Profile', icon: 'person' },
];

/** True when the current path is the item's page or any page nested under it. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to;
  return [item.to, ...(item.alsoActiveFor ?? [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
