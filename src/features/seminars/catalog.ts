import type { SeminarListItem } from '../../api/types';
import { getLifecycle, slotsLeft } from './status';

export type SortKey = 'nearest' | 'latest' | 'title' | 'title-desc' | 'slots' | 'fewest-slots' | 'shortest' | 'longest';

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

export function filterAndSort(openItems: SeminarListItem[], options: FilterOptions): SeminarListItem[] {
  const query = options.query.trim().toLowerCase();
  const matches = openItems.filter(({ seminar }) => {
    if (options.department && seminar.department !== options.department) return false;
    if (!query) return true;
    return [seminar.title, seminar.speaker.name, seminar.venue, seminar.department, ...seminar.topics]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const byDate = (a: SeminarListItem, b: SeminarListItem) =>
    Date.parse(a.seminar.startsAt) - Date.parse(b.seminar.startsAt);

  return [...matches].sort((a, b) => {
    if (options.sort === 'title') return a.seminar.title.localeCompare(b.seminar.title);
    if (options.sort === 'title-desc') return b.seminar.title.localeCompare(a.seminar.title);
    if (options.sort === 'slots') return slotsLeft(b.seminar) - slotsLeft(a.seminar) || byDate(a, b);
    if (options.sort === 'fewest-slots') return slotsLeft(a.seminar) - slotsLeft(b.seminar) || byDate(a, b);
    const duration = (item: SeminarListItem) => Date.parse(item.seminar.endsAt) - Date.parse(item.seminar.startsAt);
    if (options.sort === 'shortest') return duration(a) - duration(b) || byDate(a, b);
    if (options.sort === 'longest') return duration(b) - duration(a) || byDate(a, b);
    if (options.sort === 'latest') return byDate(b, a);
    return byDate(a, b);
  });
}
