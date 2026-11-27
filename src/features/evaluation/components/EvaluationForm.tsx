import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { api } from '../../../api/client';
import type { EvaluationAnswers, SeminarListItem, SubmitEvaluationResult, Survey } from '../../../api/types';
import { Alert } from '../../../components/ui/Alert';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { cx } from '../../../components/ui/cx';
import { ErrorSummary } from '../../../components/ui/ErrorSummary';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';
import { useToast } from '../../../components/ui/Toast';
import { expireSession } from '../../../session/storage';
import { loadEvaluationDraft, removeEvaluationDraft, saveEvaluationDraft } from '../draftStore';
import { numberQuestions } from '../surveyText';
import { isAnswered, validateSurvey } from '../validation';
import { questionElementId } from './QuestionFrame';
import { SurveyForm } from './SurveyForm';

interface EvaluationFormProps {
  item: SeminarListItem;
  survey: Survey;
  onSubmitted: (result: SubmitEvaluationResult) => void;
}

/**
 * Holds the answers, the saved draft, validation, and submission. Nothing is selected at the
 * start: a saved draft is the only source of answers.
 */
export function EvaluationForm({ item, survey, onSubmitted }: EvaluationFormProps) {
  const { seminar } = item;
  const { showToast } = useToast();
  const summaryRef = useRef<HTMLDivElement>(null);
  const initialDraft = useMemo(() => loadEvaluationDraft(seminar.id, survey), [seminar.id, survey]);

  const [answers, setAnswers] = useState<EvaluationAnswers>(initialDraft ?? {});
  const [restored, setRestored] = useState(initialDraft !== null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);

  const numbered = useMemo(() => numberQuestions(survey), [survey]);
  const totalSections = survey.sections.length;
  const isMultiSection = totalSections > 1;
  const safeSectionIndex = Math.min(sectionIndex, Math.max(0, totalSections - 1));
  const isLastSection = safeSectionIndex >= totalSections - 1;

  useEffect(() => {
    if (failedAttempts > 0) summaryRef.current?.focus();
  }, [failedAttempts]);

  function handleAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
    const question = numbered.find((entry) => entry.question.id === questionId)?.question;
    if (question && errors[questionId] && isAnswered(question, { [questionId]: value })) {
      setErrors((previous) => {
        const next = { ...previous };
        delete next[questionId];
        return next;
      });
    }
  }

  function handleSaveDraft() {
    const saved = saveEvaluationDraft(seminar.id, survey, answers);
    setRestored(false);
    showToast(
      saved
        ? {
            title: 'Draft saved on this device',
            message: 'Only this device has it. It is removed when you submit or sign out.',
          }
        : {
            tone: 'error',
            title: 'Draft not saved',
            message: 'This device could not store your draft. Your answers are still on this page.',
          },
    );
  }

  function handleNextSection(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    const currentSection = survey.sections[safeSectionIndex];
    if (!currentSection) return;
    const sectionErrors = validateSurvey({ ...survey, sections: [currentSection] }, answers);
    if (Object.keys(sectionErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...sectionErrors }));
      setFailedAttempts((count) => count + 1);
      return;
    }
    setSectionIndex((idx) => Math.min(totalSections - 1, idx + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePreviousSection() {
    setSectionIndex((idx) => Math.max(0, idx - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (isMultiSection && !isLastSection) {
      handleNextSection();
      return;
    }

    const found = validateSurvey(survey, answers);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      if (isMultiSection) {
        const firstErrorSection = survey.sections.findIndex((sec) =>
          sec.questions.some((q) => Boolean(found[q.id])),
        );
        if (firstErrorSection >= 0) setSectionIndex(firstErrorSection);
      }
      setFailedAttempts((count) => count + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const result = await api.submitEvaluation(seminar.id, survey.id, survey.version, answers);
    setSubmitting(false);

    if (!result.ok) {
      if (result.error.code === 'session_expired') {
        expireSession();
        return;
      }
      setSubmitError(
        result.error.code === 'not_available'
          ? 'Your evaluation was not submitted. It may already be submitted, or the evaluation is no longer open.'
          : `Your evaluation was not submitted. ${errorText(result.error.code)} Your answers are still here.`,
      );
      return;
    }
    removeEvaluationDraft(seminar.id);
    onSubmitted(result.data);
  }

  const summaryItems = numbered
    .filter(({ question }) => errors[question.id])
    .map(({ question, number }) => ({
      targetId: questionElementId(question.id),
      message: `Question ${number}: ${errors[question.id]}`,
    }));

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} aria-busy={submitting} className="flex flex-col gap-space-xl">
      {summaryItems.length > 0 && (
        <ErrorSummary
          ref={summaryRef}
          title={`Answer ${summaryItems.length} ${summaryItems.length === 1 ? 'question' : 'questions'} to submit`}
          items={summaryItems}
        />
      )}

      {restored && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary">
          <Icon name="info" size={18} />
          Your saved draft was restored from this device.
        </p>
      )}

      <fieldset disabled={submitting} className="m-0 flex min-w-0 flex-col gap-space-xl border-0 p-0">
        {isMultiSection && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between font-caption text-caption text-text-secondary tabular-nums">
              <span>
                Page {safeSectionIndex + 1} of {totalSections}
              </span>
              <span>{Math.round(((safeSectionIndex + 1) / totalSections) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${((safeSectionIndex + 1) / totalSections) * 100}%` }}
              />
            </div>
          </div>
        )}
        <SurveyForm
          survey={survey}
          speaker={seminar.speaker.name}
          answers={answers}
          errors={errors}
          onAnswer={handleAnswer}
          activeSectionIndex={isMultiSection ? safeSectionIndex : undefined}
        />
      </fieldset>

      <div className="flex flex-col gap-space-md rounded-xl bg-surface-card p-space-lg shadow-card">
        {submitError && (
          <Alert variant="error" title="Evaluation not submitted" icon="error">
            {submitError}
          </Alert>
        )}
        <div className="flex flex-col items-start justify-between gap-space-lg md:flex-row md:items-center">
          <p className="flex max-w-lg items-start gap-space-sm font-caption text-caption text-text-secondary">
            <Icon name="info" size={20} className="mt-0.5 shrink-0 text-primary" />
            <span>Once you submit, your responses cannot be edited.</span>
          </p>
          <div className="flex w-full flex-col-reverse gap-space-sm sm:flex-row sm:justify-end md:w-auto">
            <button type="button" onClick={handleSaveDraft} disabled={submitting} className={actionTonal}>
              <Icon name="save" size={18} />
              <span>Save draft</span>
            </button>
            {isMultiSection && safeSectionIndex > 0 && (
              <button type="button" onClick={handlePreviousSection} disabled={submitting} className={actionTonal}>
                <Icon name="arrow_back" size={18} />
                <span>Back</span>
              </button>
            )}
            {isMultiSection && !isLastSection ? (
              <button
                key="next-section"
                type="button"
                onClick={handleNextSection}
                disabled={submitting}
                className={actionPrimary}
              >
                <span>Next</span>
                <Icon name="arrow_forward" size={18} />
              </button>
            ) : (
              <button
                key="submit-evaluation"
                type="submit"
                aria-disabled={submitting || undefined}
                aria-busy={submitting || undefined}
                className={cx(actionPrimary, submitting && 'cursor-wait opacity-90')}
              >
                {submitting ? <Spinner /> : <Icon name="send" size={18} />}
                <span>{submitting ? 'Submitting evaluation' : 'Submit evaluation'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
