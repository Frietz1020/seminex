import type { NavItem } from '../navItems';

export const ORG_NAV_ITEMS: readonly NavItem[] = [
  { to: '/org', label: 'Home', icon: 'home', end: true },
  { to: '/org/my-seminars', label: 'My Seminars', shortLabel: 'Seminars', icon: 'event_note', alsoActiveFor: ['/org/seminars'] },
  { to: '/org/history', label: 'History', icon: 'history' },
  { to: '/org/profile', label: 'Profile', icon: 'person' },
];

export const ADVISER_NAV_ITEMS: readonly NavItem[] = [
  { to: '/org/adviser/members', label: 'Members', icon: 'group' },
  { to: '/org/adviser/requests', label: 'Requests', icon: 'how_to_reg' },
  { to: '/org/adviser/seminars', label: 'Seminars', icon: 'event_note' },
  { to: '/org/adviser/audit-log', label: 'Audit Log', icon: 'fact_check' },
  { to: '/org/adviser/profile', label: 'Profile', icon: 'person' },
];
