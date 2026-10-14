import { useId, type ReactNode } from 'react';
import { Icon } from '../../../components/ui/Icon';

export const questionElementId = (questionId: string) => `question-${questionId}`;
export const questionLegendId = (questionId: string) => `legend-${questionId}`;

interface QuestionFrameProps {
  questionId: string;
  number: number;
  prompt: string;
  help?: string;
  required: boolean;
  error?: string;
  children: ReactNode;
}

/** A question is a fieldset with a legend, so assistive technology reads the prompt with every answer. */
export function QuestionFrame({ questionId, number, prompt, help, required, error, children }: QuestionFrameProps) {
  const helpId = useId();
  const errorId = useId();
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset id={questionElementId(questionId)} aria-describedby={describedBy} className="m-0 min-w-0 border-0 p-0">
      <legend id={questionLegendId(questionId)} className="p-0 font-body-base-medium text-body-base-medium text-on-surface">
        {number}. {prompt}
        {required && <span className="ml-2 font-caption text-caption font-normal text-text-secondary">(required)</span>}
      </legend>
      {help && (
        <p id={helpId} className="mt-1 font-caption text-caption text-text-secondary">
          {help}
        </p>
      )}
      <div className="pt-space-sm">{children}</div>
      {error && (
        <p id={errorId} className="mt-space-sm flex items-start gap-1.5 font-body-sm-medium text-body-sm-medium text-error">
          <Icon name="info" size={16} className="mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}