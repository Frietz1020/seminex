import { Icon } from './Icon';

/** "Academic year 2026-2027" tag shared by the pages that show it. */
export function AcademicYearPill({ academicYear }: { academicYear: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary-container px-2.5 py-1 font-label-sm text-label-sm uppercase tracking-wider text-secondary">
      <Icon name="school" size={14} />
      Academic year {academicYear}
    </span>
  );
}