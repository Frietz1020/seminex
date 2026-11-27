import type { EvaluationAnswers, Survey } from '../../../api/types';
import { formatQuestionCount, localizeQuestion, numberQuestions } from '../surveyText';
import { ChoiceQuestion } from './ChoiceQuestion';
import { CheckboxQuestion } from './CheckboxQuestion';
import { ParagraphQuestion } from './ParagraphQuestion';
import { QuestionFrame } from './QuestionFrame';
import { RatingQuestion } from './RatingQuestion';
import { ScaleQuestion } from './ScaleQuestion';
import { FormattedText } from './FormattedText';

interface SurveyFormProps {
  survey: Survey;
  speaker: string;
  answers: EvaluationAnswers;
  errors: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  /** When provided, renders only that section (GForms multi-page pagination). */
  activeSectionIndex?: number;
}

/** Renders whatever survey the Org Member defined. Nothing about the questions is hardcoded here. */
export function SurveyForm({ survey, speaker, answers, errors, onAnswer, activeSectionIndex }: SurveyFormProps) {
  const numbers = new Map(numberQuestions(survey).map(({ question, number }) => [question.id, number]));
  const visibleSections =
    activeSectionIndex !== undefined && survey.sections[activeSectionIndex]
      ? [{ section: survey.sections[activeSectionIndex]!, index: activeSectionIndex }]
      : survey.sections.map((section, index) => ({ section, index }));

  return (
    <>
      {visibleSections.map(({ section, index }) => (
        <section
          key={section.id}
          aria-labelledby={`section-${section.id}`}
          className="flex flex-col gap-space-xl rounded-xl border border-border-subtle bg-surface-card p-space-lg"
        >
          <div className="flex items-start justify-between gap-space-md">
            <div className="flex flex-col gap-0.5">
              <p className="font-caption text-caption tabular-nums text-secondary">
                Section {index + 1} of {survey.sections.length}
              </p>
              <h2 id={`section-${section.id}`} className="font-title-md text-title-md text-on-surface">
                {section.title}
              </h2>
              {section.description && (
                <p className="mt-1 font-body-sm text-body-sm text-text-secondary">{section.description}</p>
              )}
            </div>
            <span className="shrink-0 font-caption text-caption tabular-nums text-text-secondary">
              {formatQuestionCount(section.questions.length)}
            </span>
          </div>

          {section.questions.map((raw) => {
            const question = localizeQuestion(raw, speaker);
            const value = answers[question.id] ?? '';
            const error = errors[question.id];
            const change = (next: string) => onAnswer(question.id, next);
            return (
              <QuestionFrame
                key={question.id}
                questionId={question.id}
                number={numbers.get(question.id) ?? 0}
                prompt={<FormattedText text={question.prompt} />}
                help={question.description || question.help}
                required={question.required}
                error={error}
              >
                {question.type === 'scale' && <ScaleQuestion question={question} value={value} onChange={change} />}
                {question.type === 'rating' && <RatingQuestion question={question} value={value} onChange={change} />}
                {question.type === 'choice' && <ChoiceQuestion question={question} value={value} onChange={change} />}
                {question.type === 'checkbox' && <CheckboxQuestion question={question} value={value} onChange={change} />}
                {question.type === 'paragraph' && (
                  <ParagraphQuestion question={question} value={value} onChange={change} hasError={Boolean(error)} />
                )}
              </QuestionFrame>
            );
          })}
        </section>
      ))}
    </>
  );
}
