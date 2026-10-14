import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/Icon';

interface DepartmentFilterProps {
  departments: string[];
  /** null means all departments. */
  value: string | null;
  onChange: (department: string | null) => void;
}

/**
 * A button that opens a list of radio options. Native radios give arrow-key behavior for free.
 * Escape, a click outside, or tabbing away closes it.
 */
export function DepartmentFilter({ departments, value, onChange }: DepartmentFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-charcoal-300 bg-surface-light px-4 font-body-sm-medium text-body-sm-medium text-on-surface transition-colors hover:bg-surface-container md:w-auto"
      >
        <Icon name="filter_list" size={18} />
        <span>Department: {value ?? 'All'}</span>
      </button>

      {open && (
        <fieldset
          id={panelId}
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-border-subtle bg-surface-card p-space-sm shadow-overlay"
        >
          <legend className="sr-only">Department</legend>
          {[null, ...departments].map((department) => (
            <label
              key={department ?? 'all'}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-surface-container"
            >
              <input
                type="radio"
                name="department"
                checked={value === department}
                onChange={() => onChange(department)}
                className="h-4 w-4 accent-primary-container"
              />
              <span className="font-body-sm text-body-sm text-on-surface">{department ?? 'All'}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}