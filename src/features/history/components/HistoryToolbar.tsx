import { useId } from 'react';
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
  const sortId = 'history-sort';

  return (
    <section
      aria-label="History filters"
      className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-md lg:flex-row lg:items-center lg:justify-between"
    >
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative w-full lg:max-w-md">
        <label htmlFor={searchId} className="sr-only">
          Search history by title, speaker, or venue
        </label>
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search title, speaker, or venue…"
          className="h-12 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest pl-10 pr-3 font-body-sm text-body-sm text-on-surface outline-none placeholder:text-text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </form>

      <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center">
        <label htmlFor={sortId} className="sr-only">
          Sort by
        </label>
        <select
          id={sortId}
          aria-label="Sort by"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as HistorySort)}
          className="h-12 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 font-body-sm-medium text-body-sm-medium text-on-surface outline-none focus:border-primary"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div
          role="group"
          aria-label="Filter seminars"
          className="flex items-center gap-1 overflow-x-auto rounded-xl bg-surface-container-high p-1.5"
        >
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
              className={`min-h-11 shrink-0 rounded-xl px-3 font-body-sm-medium text-body-sm-medium tabular-nums transition-colors ${
                filter === value
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-text-secondary hover:bg-surface-container-highest'
              }`}
            >
              {FILTER_LABELS[value]} ({counts[value]})
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
