import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';

export function PolicyBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-labelledby="policy-heading" className="flex items-start gap-space-md rounded-lg bg-surface-container p-space-lg">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-card text-primary shadow-card">
        <Icon name="verified" size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <h2 id="policy-heading" className="font-body-base-medium text-body-base-medium text-on-surface">
            Certificate policy
          </h2>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="certificate-policy-details"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex min-h-10 items-center gap-1 rounded-md font-body-sm-medium text-body-sm-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {expanded ? 'Hide details' : 'Show details'}
            <Icon name="keyboard_arrow_down" size={18} className={expanded ? 'rotate-180' : undefined} />
          </button>
        </div>
        {expanded && (
          <p id="certificate-policy-details" className="mt-0.5 font-body-sm text-body-sm text-text-secondary">
            Certificate eligibility depends on the attendance requirement for each seminar. Your Time-In and Time-Out
            must be validated, and you must submit the seminar evaluation.
          </p>
        )}
      </div>
    </section>
  );
}
