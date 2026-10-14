import type { SurveyQuestion } from '../../../api/types';
import { cx } from '../../../components/ui/cx';
import { Icon } from '../../../components/ui/Icon';
import { isIconName } from '../../../components/ui/icons';

type Choice = Extract<SurveyQuestion, { type: 'choice' }>;

interface ChoiceQuestionProps {
  question: Choice;
  value: string;
  onChange: (value: string) => void;
}

/** Option cards in one or two columns. The radio is hidden, so the card draws its own focus ring. */
export function ChoiceQuestion({ question, value, onChange }: ChoiceQuestionProps) {
  return (
    <div className={cx('grid grid-cols-1 gap-space-sm', question.columns === 2 && 'md:grid-cols-2')}>
      {question.options.map((option) => (
        <label
          key={option.value}
          className="relative flex cursor-pointer items-start gap-space-sm rounded-lg border-2 border-transparent bg-surface-container p-space-md transition-colors hover:bg-surface-container-high has-[:checked]:border-primary-container has-[:checked]:bg-maroon-container has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container"
        >
          <input
            type="radio"
            name={question.id}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-charcoal-300 bg-white peer-checked:border-[6px] peer-checked:border-primary-container"
          />
          {option.icon && isIconName(option.icon) && <Icon name={option.icon} size={20} className="mt-0.5 text-on-surface" />}
          <span className="flex min-w-0 flex-col">
            <span className="font-body-base-medium text-body-base-medium text-on-surface">{option.label}</span>
            {option.description && (
              <span className="font-caption text-caption text-text-secondary">{option.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}