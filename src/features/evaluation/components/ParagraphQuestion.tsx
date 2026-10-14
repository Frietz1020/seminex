import { useId } from 'react';
import type { SurveyQuestion } from '../../../api/types';
import { cx } from '../../../components/ui/cx';
import { questionLegendId } from './QuestionFrame';

type Paragraph = Extract<SurveyQuestion, { type: 'paragraph' }>;

interface ParagraphQuestionProps {
  question: Paragraph;
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
}

/**
 * The limit is enforced by maxLength. The running count is for sighted users only, so a screen
 * reader is not interrupted on every keystroke; the limit is read once, with the field.
 */
export function ParagraphQuestion({ question, value, onChange, hasError }: ParagraphQuestionProps) {
  const limitId = useId();
  return (
    <div>
      <textarea
        name={question.id}
        rows={5}
        maxLength={question.maxLength}
        value={value}
        placeholder={question.placeholder}
        aria-labelledby={questionLegendId(question.id)}
        aria-describedby={limitId}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          'w-full rounded-lg border bg-surface-card p-space-md font-body-base text-body-base text-on-surface placeholder:text-text-subtle',
          hasError ? 'border-error' : 'border-charcoal-300',
        )}
      />
      <span id={limitId} className="sr-only">
        Maximum {question.maxLength} characters
      </span>
      <div aria-hidden="true" className="mt-1 text-right font-caption text-caption text-text-secondary">
        {value.length} / {question.maxLength} characters
      </div>
    </div>
  );
}