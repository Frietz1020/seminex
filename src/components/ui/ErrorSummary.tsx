import { forwardRef, useId } from 'react';
import { Icon } from './Icon';

export interface ErrorSummaryItem {
  /** Id of the element (such as a fieldset) the message is about. */
  targetId: string;
  message: string;
}

interface ErrorSummaryProps {
  title: string;
  items: ErrorSummaryItem[];
}

/**
 * Lists every problem at the top of a form. The page moves focus here after a failed submit, so
 * the title and list are read out. Each link moves focus to the first control in its question.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, ErrorSummaryProps>(function ErrorSummary(
  { title, items },
  ref,
) {
  const titleId = useId();

  function focusTarget(targetId: string) {
    const target = document.getElementById(targetId);
    const control = target?.querySelector<HTMLElement>('input, textarea, select, button');
    (control ?? target)?.focus();
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="rounded-xl border-2 border-error bg-error-container p-space-md text-on-error-container"
    >
      <h2 id={titleId} className="flex items-center gap-space-sm font-title-md text-title-md">
        <Icon name="info" size={20} />
        {title}
      </h2>
      <ul className="mt-space-sm flex list-disc flex-col gap-1 pl-space-lg font-body-sm text-body-sm">
        {items.map((item) => (
          <li key={item.targetId}>
            <a
              href={`#${item.targetId}`}
              onClick={(event) => {
                event.preventDefault();
                focusTarget(item.targetId);
              }}
              className="font-body-sm-medium underline"
            >
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
});