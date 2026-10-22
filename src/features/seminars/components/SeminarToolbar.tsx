import { useRef } from 'react';
import { Icon } from '../../../components/ui/Icon';
import type { SortKey } from '../catalog';
import { DepartmentFilter } from './DepartmentFilter';

interface SeminarToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  departments: string[];
  department: string | null;
  onDepartmentChange: (department: string | null) => void;
}

export function SeminarToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  departments,
  department,
  onDepartmentChange,
}: SeminarToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-stretch justify-between gap-space-md rounded-xl bg-surface-card p-space-md shadow-card md:flex-row md:items-center">
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative flex-1">
        <label htmlFor="seminar-search" className="sr-only">
          Search seminars by title, speaker, or topic
        </label>
        <Icon name="search" size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
        <input
          ref={inputRef}
          id="seminar-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by title, speaker, or topic"
          className="h-11 w-full rounded-lg border border-charcoal-300 bg-surface-light pl-10 pr-11 font-body-sm text-body-sm text-on-surface outline-none transition-all placeholder:text-text-subtle focus:border-primary-container focus:bg-surface-card focus:ring-2 focus:ring-primary-container/30"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => { onQueryChange(''); inputRef.current?.focus(); }} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-text-subtle transition-colors hover:text-on-surface">
            <Icon name="close" size={18} />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-space-sm">
        <div className="relative min-w-[220px] flex-1 md:flex-none">
          <label htmlFor="seminar-sort" className="sr-only">
            Sort seminars
          </label>
          <Icon
            name="swap_vert"
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          <select
            id="seminar-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortKey)}
            className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-charcoal-300 bg-surface-light pl-9 pr-9 font-body-sm-medium text-body-sm-medium text-on-surface outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/30"
          >
            <option value="nearest">Sort by: Date (nearest first)</option>
            <option value="title">Sort by: Title (A to Z)</option>
            <option value="slots">Sort by: Available slots (most first)</option>
          </select>
          <Icon
            name="keyboard_arrow_down"
            size={18}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle"
          />
        </div>

        <DepartmentFilter departments={departments} value={department} onChange={onDepartmentChange} />
      </div>
    </div>
  );
}
