import type { ReactNode } from 'react';
import { Icon } from '../../../components/ui/Icon';

interface ReadOnlyFieldProps {
  label: string;
  children: ReactNode;
  /** Adds a lock icon and "Read only" for screen readers: the student cannot change this value. */
  locked?: boolean;
  /** Layout classes for the grid cell; they sit on the same element as the term and definition. */
  className?: string;
}

/**
 * A value shown as a term and its definition inside a <dl>, with the same box as TextField and
 * SelectField so nothing shifts when edit mode swaps in the inputs. Full-contrast text, not a
 * dimmed disabled input.
 */
export function ReadOnlyField({ label, children, locked = false, className }: ReadOnlyFieldProps) {
  return (
    <div className={className}>
      <dt className="mb-2 block text-sm font-semibold text-charcoal-900">{label}</dt>
      <dd className="flex items-center gap-2 rounded-control border border-charcoal-200 bg-surface-light px-3.5 py-3 text-base text-on-surface">
        <span className="min-w-0 flex-1 break-words">{children}</span>
        {locked && (
          <>
            <Icon name="lock" size={16} className="text-text-subtle" />
            <span className="sr-only">Read only</span>
          </>
        )}
      </dd>
    </div>
  );
}