/**
 * Selectors that decide where a registered seminar belongs on the active lists.
 * Home, My Seminars, and History use the same placement rule for finished seminars.
 *
 * The one-hour cutoff is a locked project decision. My Seminars keeps an evaluation-due seminar visible
 * after that cutoff so the student can still submit the evaluation.
 */
import type { Seminar, SeminarListItem } from '../api/types';
import { isEvaluationDue } from '../features/seminars/status';
import { getLifecycle } from './seminarLifecycle';

export const RECENTLY_FINISHED_WINDOW_MS = 60 * 60 * 1000;

export type StudentSeminarPlacement = 'upcoming' | 'home' | 'history';

/** One shared rule for where a seminar belongs as its end time moves through the one-hour window. */
export function getStudentSeminarPlacement(seminar: Seminar, now: number): StudentSeminarPlacement {
  const lifecycle = getLifecycle(seminar, now);
  if (lifecycle === 'upcoming') return 'upcoming';
  if (lifecycle === 'ongoing') return 'home';
  const endedAt = Date.parse(seminar.endsAt);
  return now >= endedAt && now - endedAt < RECENTLY_FINISHED_WINDOW_MS ? 'home' : 'history';
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
  return getStudentSeminarPlacement(item.seminar, now) === 'home' ? 'ongoing' : null;
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
  return [seminar.title, seminar.speaker.name, seminar.venue, seminar.department, ...seminar.topics]
    .join(' ')
    .toLowerCase()
    .includes(query);
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
