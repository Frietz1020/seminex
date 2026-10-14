import { Icon } from '../../../components/ui/Icon';
import { REQUIRED_ATTENDANCE_PERCENT } from '../../../config';

/** The percentage comes from config, so this text and the eligibility rule cannot drift apart. */
export function PolicyBanner() {
  return (
    <section aria-labelledby="policy-heading" className="flex items-start gap-space-md rounded-lg bg-surface-container p-space-lg">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-card text-primary shadow-card">
        <Icon name="verified" size={20} />
      </span>
      <div className="flex flex-col">
        <h2 id="policy-heading" className="font-body-base-medium text-body-base-medium text-on-surface">
          Certificate policy
        </h2>
        <p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">
          Certificates unlock when you attend at least {REQUIRED_ATTENDANCE_PERCENT}% of a seminar, with your Time-In
          and Time-Out validated, and submit the evaluation.
        </p>
      </div>
    </section>
  );
}