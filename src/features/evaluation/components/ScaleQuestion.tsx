import { useId } from 'react';
import type { SurveyQuestion } from '../../../api/types';

type Scale = Extract<SurveyQuestion, { type: 'scale' }>;

interface ScaleQuestionProps {
  question: Scale;
  value: string;
  onChange: (value: string) => void;
}

/** Numbered buttons from min to max. They are radios, so the arrow keys move between them. */
export function ScaleQuestion({ question, value, onChange }: ScaleQuestionProps) {
  const startId = useId();
  const endId = useId();
  const numbers = Array.from({ length: question.max - question.min + 1 }, (_, index) => question.min + index);

  return (
    <div className="flex max-w-xl flex-col gap-space-xs">
      <div className="grid gap-space-xs sm:gap-space-sm" style={{ gridTemplateColumns: `repeat(${numbers.length}, minmax(0, 1fr))` }}>
        {numbers.map((number) => (
          <label key={number} className="cursor-pointer">
            <input
              type="radio"
              name={question.id}
              value={number}
              checked={value === String(number)}
              onChange={() => onChange(String(number))}
              aria-describedby={number === question.min ? startId : number === question.max ? endId : undefined}
              className="peer sr-only"
            />
            <span className="flex h-12 items-center justify-center rounded-lg bg-surface-container font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-container-high peer-checked:bg-primary-container peer-checked:text-on-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-container">
              {number}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-between gap-space-sm px-1 font-caption text-caption text-text-secondary">
        <span id={startId}>{question.startLabel}</span>
        <span id={endId} className="text-right">
          {question.endLabel}
        </span>
      </div>
    </div>
  );
}