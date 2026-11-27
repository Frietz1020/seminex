import { useEffect, useRef, useState } from 'react';
import type { ExportFormat } from '../../shared/exportTable';
import { Icon } from './Icon';
import type { IconName } from './icons';

const FORMAT_OPTIONS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: 'csv', label: 'CSV (.csv)', hint: 'Comma-separated values' },
  { format: 'xlsx', label: 'Excel (.xlsx)', hint: 'Spreadsheet workbook' },
  { format: 'md', label: 'Markdown (.md)', hint: 'Formatted Markdown table' },
];

interface ExportMenuProps {
  label?: string;
  icon?: IconName;
  disabled?: boolean;
  variant?: 'tonal' | 'primary';
  align?: 'left' | 'right';
  onExport: (format: ExportFormat) => void;
}

export function ExportMenu({
  label = 'Export',
  icon = 'download',
  disabled = false,
  variant = 'tonal',
  align = 'right',
  onExport,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const buttonStyle =
    variant === 'primary'
      ? 'inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-body-sm-medium text-body-sm-medium text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50'
      : 'inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-4 font-body-sm-medium text-body-sm-medium text-on-surface shadow-xs transition-colors hover:bg-surface-container-low disabled:opacity-50';

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={buttonStyle}
      >
        <Icon name={icon} size={18} />
        <span>{label}</span>
        <Icon name="keyboard_arrow_down" size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`${label} format`}
          className={`absolute top-full z-40 mt-1.5 w-52 overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-1 shadow-card ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(option.format);
              }}
              className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
            >
              <span className="font-body-sm-medium text-body-sm-medium text-on-surface">{option.label}</span>
              <span className="font-caption text-caption text-text-secondary">{option.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
