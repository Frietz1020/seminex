import type { SurveyQuestion } from '../../../api/types';
import { Icon } from '../../../components/ui/Icon';

type Rating = Extract<SurveyQuestion, { type: 'rating' }>;

interface RatingQuestionProps {
  question: Rating;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Stars are a radio group: one tab stop, and the arrow keys change the rating. Nothing is
 * selected until the student chooses.
 */
export function RatingQuestion({ question, value, onChange }: RatingQuestionProps) {
  const current = Number(value) || 0;
  const stars = Array.from({ length: question.max }, (_, index) => index + 1);

  return (
    <div className="flex flex-wrap items-center gap-space-sm">
      <div className="flex items-center gap-1">
        {stars.map((star) => (
          <label key={star} className="cursor-pointer">
            <input
              type="radio"
              name={question.id}
              value={star}
              checked={current === star}
              onChange={() => onChange(String(star))}
              className="peer sr-only"
            />
            <span className="flex h-11 w-11 items-center justify-center rounded-lg text-secondary-accent transition-colors hover:bg-surface-container peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-container">
              <Icon name={star <= current ? 'star_fill' : 'star'} size={32} />
            </span>
            <span className="sr-only">
              {star} of {question.max} stars: {question.descriptors[star - 1]}
            </span>
          </label>
        ))}
      </div>
      <span className="font-body-sm-medium text-body-sm-medium text-secondary">
        {current ? `${current} - ${question.descriptors[current - 1]}` : 'Select a rating'}
      </span>
    </div>
  );
}