/**
 * Selectors that decide where a registered seminar belongs on the active lists.
 * My seminars uses these. Home and History keep their own rules for now.
 *
 * Business rules (need confirmation):
 * - A finished seminar stays on the active lists for one hour, so a student can still show the QR
 *   code for the Time-Out scan. After that it moves to History.
 * - After that hour it stays only if its evaluation is due, because that needs an action.
 */
import type { Seminar, SeminarListItem } from '../api/types';
import { getLifecycle, isEvaluationDue } from '../features/seminars/status';

export const RECENTLY_FINISHED_WINDOW_MS = 60 * 60 * 1000;

/** True from the moment a seminar ends until one hour later. */
export function isRecentlyFinished(seminar: Seminar, now: number): boolean {
  const endedAt = Date.parse(seminar.endsAt);
  return now >= endedAt && now - endedAt < RECENTLY_FINISHED_WINDOW_MS;
}

export type MySeminarGroup = 'ongoing' | 'upcoming' | 'evaluation';

/** Display order when the filter is "All". */
export const MY_SEMINAR_GROUPS: readonly MySeminarGroup[] = ['ongoing', 'upcoming', 'evaluation'];

/**
 * The group a registered seminar belongs to, or null when it belongs in History only.
 * Precedence for a finished seminar: evaluation due, then recently finished (kept with "ongoing").
 */
export function getMySeminarGroup(item: SeminarListItem, now: number): MySeminarGroup | null {
  if (!item.registration) return null;
  const lifecycle = getLifecycle(item.seminar, now);
  if (lifecycle === 'ongoing') return 'ongoing';
  if (lifecycle === 'upcoming') return 'upcoming';
  if (isEvaluationDue(item, now)) return 'evaluation';
  return isRecentlyFinished(item.seminar, now) ? 'ongoing' : null;
}

export type MySeminarFilter = 'all' | 'ongoing' | 'upcoming';
export type MySeminarSort = 'nearest' | 'title';

export interface MySeminarQuery {
  query: string;
  filter: MySeminarFilter;
  sort: MySeminarSort;
}

export interface MySeminarGroupResult {
  group: MySeminarGroup;
  items: SeminarListItem[];
}

export interface MySeminarView {
  /** Groups with at least one seminar, in display order. */
  groups: MySeminarGroupResult[];
  /** Seminars on the active lists before search and filter. */
  activeCount: number;
  /** Seminars the student is registered for, finished or not. */
  registeredCount: number;
}

function matchesQuery(seminar: Seminar, query: string): boolean {
  if (!query) return true;
  return [seminar.title, seminar.speaker.name, ...seminar.topics].join(' ').toLowerCase().includes(query);
}

/** Search, filter, group, and sort. "Nearest date" means closest to now, whether past or future. */
export function buildMySeminarView(items: readonly SeminarListItem[], options: MySeminarQuery, now: number): MySeminarView {
  const query = options.query.trim().toLowerCase();
  const buckets = new Map<MySeminarGroup, SeminarListItem[]>();
  let activeCount = 0;
  let registeredCount = 0;

  for (const item of items) {
    if (!item.registration) continue;
    registeredCount += 1;
    const group = getMySeminarGroup(item, now);
    if (!group) continue;
    activeCount += 1;
    // The "Evaluation due" group appears only under "All".
    if (options.filter !== 'all' && group !== options.filter) continue;
    if (!matchesQuery(item.seminar, query)) continue;
    buckets.set(group, [...(buckets.get(group) ?? []), item]);
  }

  const distance = (item: SeminarListItem) => Math.abs(Date.parse(item.seminar.startsAt) - now);
  const compare = (a: SeminarListItem, b: SeminarListItem) =>
    options.sort === 'title'
      ? a.seminar.title.localeCompare(b.seminar.title)
      : distance(a) - distance(b) || a.seminar.title.localeCompare(b.seminar.title);

  const groups = MY_SEMINAR_GROUPS.flatMap((group) => {
    const list = buckets.get(group);
    return list && list.length > 0 ? [{ group, items: [...list].sort(compare) }] : [];
  });

  return { groups, activeCount, registeredCount };
}