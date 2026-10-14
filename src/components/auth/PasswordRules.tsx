import { Check, Circle } from 'lucide-react';
import { cx } from '../ui/cx';
import { PASSWORD_RULES } from '../../features/auth/validation';

/** Live checklist. Each rule is shown by icon and by text that assistive technology reads. */
export function PasswordRules({ password }: { password: string }) {
  return (
    <div className="mt-3 rounded-control border border-charcoal-200 bg-white p-3 md:bg-cream-50/70 md:p-3.5">
      <p className="mb-2 text-xs font-semibold text-charcoal-700">Password must contain:</p>
      <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2 md:gap-2">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.id}
              className={cx(
                'flex items-center gap-2 text-xs md:text-sm',
                met ? 'font-medium text-success' : 'text-charcoal-700',
              )}
            >
              {met ? (
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              ) : (
                <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-charcoal-500" />
              )}
              <span>
                {rule.label}
                <span className="sr-only">{met ? ': met' : ': not met yet'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}