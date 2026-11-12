import type { SurveyQuestion } from '../../../api/types';
import { Icon } from '../../../components/ui/Icon';
import { isIconName } from '../../../components/ui/icons';
import { cx } from '../../../components/ui/cx';

type Checkbox = Extract<SurveyQuestion, { type: 'checkbox' }>;

interface CheckboxQuestionProps {
  question: Checkbox;
  value: string;
  onChange: (value: string) => void;
}

function parseSelected(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Multi-select option cards. Selected values are stored as a JSON array in the answer string. */
export function CheckboxQuestion({ question, value, onChange }: CheckboxQuestionProps) {
  const selected = parseSelected(value);

  function toggle(optionValue: string) {
    const next = selected.includes(optionValue)
      ? selected.filter((item) => item !== optionValue)
      : [...selected, optionValue];
    onChange(JSON.stringify(next));
  }

  return (
    <div className={cx('grid grid-cols-1 gap-space-sm', question.columns === 2 && 'md:grid-cols-2')}>
      {question.options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <label
            key={option.value}
            className="relative flex min-h-11 cursor-pointer items-start gap-space-sm rounded-lg border-2 border-transparent bg-surface-container p-space-md transition-colors hover:bg-surface-container-high has-[:checked]:border-primary-container has-[:checked]:bg-maroon-container has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container"
          >
            <input
              type="checkbox"
              name={`${question.id}[]`}
              value={option.value}
              checked={checked}
              onChange={() => toggle(option.value)}
              className="peer sr-only"
            />
            <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-charcoal-300 bg-white peer-checked:border-primary-container peer-checked:bg-primary-container">
              {checked && <Icon name="check" size={14} className="text-on-primary" />}
            </span>
            {option.icon && isIconName(option.icon) && <Icon name={option.icon} size={20} className="mt-0.5 text-on-surface" />}
            <span className="flex min-w-0 flex-col">
              <span className="font-body-base-medium text-body-base-medium text-on-surface">{option.label}</span>
              {option.description && <span className="font-caption text-caption text-text-secondary">{option.description}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
