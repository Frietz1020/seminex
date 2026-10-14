import { useId } from 'react';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import {
  FILTER_LABELS,
  SORT_OPTIONS,
  type HistoryFilter,
  type HistorySort,
} from '../historyView';

interface HistoryToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: HistoryFilter;
  onFilterChange: (value: HistoryFilter) => void;
  counts: Record<HistoryFilter, number>;
  sort: HistorySort;
  onSortChange: (value: HistorySort) => void;
}

const FILTERS: readonly HistoryFilter[] = ['all', 'ready', 'pending'];

export function HistoryToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  sort,
  onSortChange,
}: HistoryToolbarProps) {
  const searchId = useId();
  const sortId = useId();

  return (
    <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative w-full lg:w-96">
        <label htmlFor={searchId} className="sr-only">
          Search history by title, speaker, or venue
        </label>
        <Icon
          name="search"
          size={20}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by title, speaker, or venue"
          className="h-11 w-full rounded-lg border border-charcoal-300 bg-surface-card pl-10 pr-4 font-body-sm text-body-sm text-on-surface shadow-card placeholder:text-text-subtle focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container/30"
        />
      </form>

      <div className="flex flex-wrap items-center gap-space-md">
        <div role="group" aria-label="Filter seminars" className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-container p-1">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
              className={cx(
                'min-h-11 rounded-md px-3 font-body-sm-medium text-body-sm-medium transition-colors',
                filter === value
                  ? 'bg-surface-card text-on-surface shadow-card'
                  : 'text-text-secondary hover:text-on-surface',
              )}
            >
              {FILTER_LABELS[value]} ({counts[value]})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-space-sm">
          <label htmlFor={sortId} className="font-body-sm text-body-sm text-text-secondary">
            Sort by
          </label>
          <div className="relative">
            <select
              id={sortId}
              value={sort}
              onChange={(event) => onSortChange(event.target.value as HistorySort)}
              className="h-11 cursor-pointer appearance-none rounded-lg border border-charcoal-300 bg-surface-card pl-3 pr-9 font-body-sm text-body-sm text-on-surface shadow-card focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container/30"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon
              name="keyboard_arrow_down"
              size={18}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
            />
          </div>
        </div>
      </div>
    </div>
  );
}