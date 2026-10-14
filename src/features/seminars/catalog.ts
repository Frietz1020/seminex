import type { SeminarListItem } from '../../api/types';
import { getLifecycle, slotsLeft } from './status';

export type SortKey = 'nearest' | 'title' | 'slots';

/** The page lists seminars that have not finished. */
export function getOpenItems(items: SeminarListItem[], now: number): SeminarListItem[] {
  return items.filter((item) => getLifecycle(item.seminar, now) !== 'finished');
}

export function getDepartments(items: SeminarListItem[]): string[] {
  return [...new Set(items.map((item) => item.seminar.department))].sort((a, b) => a.localeCompare(b));
}

/** Active sessions and open seats, computed from the data. */
export function getMetrics(openItems: SeminarListItem[]) {
  return {
    sessions: openItems.length,
    openSeats: openItems.reduce((total, item) => total + slotsLeft(item.seminar), 0),
  };
}

interface FilterOptions {
  query: string;
  department: string | null;
  sort: SortKey;
}

/** Search matches the title, the speaker name, or a topic. */
export function filterAndSort(openItems: SeminarListItem[], options: FilterOptions): SeminarListItem[] {
  const query = options.query.trim().toLowerCase();

  const matches = openItems.filter(({ seminar }) => {
    if (options.department && seminar.department !== options.department) return false;
    if (!query) return true;
    return [seminar.title, seminar.speaker.name, ...seminar.topics].join(' ').toLowerCase().includes(query);
  });

  const byDate = (a: SeminarListItem, b: SeminarListItem) =>
    Date.parse(a.seminar.startsAt) - Date.parse(b.seminar.startsAt);

  return [...matches].sort((a, b) => {
    if (options.sort === 'title') return a.seminar.title.localeCompare(b.seminar.title);
    if (options.sort === 'slots') return slotsLeft(b.seminar) - slotsLeft(a.seminar) || byDate(a, b);
    return byDate(a, b);
  });
}