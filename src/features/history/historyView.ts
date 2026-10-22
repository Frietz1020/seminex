import type { HistoryRecord } from './records';

export type HistoryFilter = 'all' | 'ready' | 'pending';
export type HistorySort = 'recent' | 'alpha' | 'attendance';

export const FILTER_LABELS: Record<HistoryFilter, string> = {
  all: 'All completed',
  ready: 'Certificates ready',
  pending: 'Pending action',
};

export const SORT_OPTIONS: readonly { value: HistorySort; label: string }[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'alpha', label: 'A to Z' },
  { value: 'attendance', label: 'Attendance rate' },
];

export function countByFilter(records: readonly HistoryRecord[]): Record<HistoryFilter, number> {
  const ready = records.filter((record) => record.status === 'ready').length;
  return { all: records.length, ready, pending: records.length - ready };
}

export function matchesFilter(record: HistoryRecord, filter: HistoryFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'ready' ? record.status === 'ready' : record.status !== 'ready';
}

/** Searches the title, speaker, and venue only, not the rest of the card text. */
export function matchesQuery(record: HistoryRecord, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { title, speaker, venue } = record.seminar;
  return [title, speaker.name, venue].some((field) => field.toLowerCase().includes(needle));
}

const byRecent = (a: HistoryRecord, b: HistoryRecord) =>
  Date.parse(b.seminar.endsAt) - Date.parse(a.seminar.endsAt);

/** Returns a new array. Records without an attendance percentage sort last for "Attendance rate". */
export function sortRecords(records: readonly HistoryRecord[], sort: HistorySort): HistoryRecord[] {
  const copy = [...records];
  switch (sort) {
    case 'alpha':
      return copy.sort((a, b) => a.seminar.title.localeCompare(b.seminar.title) || byRecent(a, b));
    case 'attendance':
      return copy.sort((a, b) => {
        const left = a.attendancePercent ?? -1;
        const right = b.attendancePercent ?? -1;
        return right - left || byRecent(a, b);
      });
    default:
      return copy.sort(byRecent);
  }
}

export function viewRecords(
  records: readonly HistoryRecord[],
  filter: HistoryFilter,
  query: string,
  sort: HistorySort,
): HistoryRecord[] {
  return sortRecords(records.filter((record) => matchesFilter(record, filter) && matchesQuery(record, query)), sort);
}
