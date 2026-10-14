import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import type { SeminarListItem, SubmitEvaluationResult } from '../../../api/types';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary } from '../../../components/ui/actionStyles';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { EvaluationLocked } from '../../seminars/components/EvaluationLocked';
import { formatDate } from '../../seminars/format';
import { getEvaluationAccess } from '../../seminars/seminarTabs';
import { buildHistoryRecords, type HistoryRecord } from '../../history/records';
import { EvaluationForm } from '../components/EvaluationForm';
import { SeminarContextCard } from '../components/SeminarContextCard';
import { SubmittedDialog } from '../components/SubmittedDialog';
import { questionCount } from '../surveyText';

type HeadingRef = RefObject<HTMLHeadingElement | null>;

function SubmittedPanel({ submittedAt }: { submittedAt: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-surface-card px-space-xl py-16 text-center shadow-card">
      <div
        aria-hidden="true"
        className="mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-status-available-container text-status-available"
      >
        <Icon name="check_circle" size={32} />
      </div>
      <h2 className="font-headline-md text-headline-md text-on-surface">Evaluation submitted</h2>
      <p className="mt-space-xs max-w-md font-body-base text-body-base text-text-secondary">
        You submitted your evaluation on {formatDate(submittedAt)}. Your responses are saved and cannot be edited. Your
        certificate appears in History when it is ready.
      </p>
      <Link to="/history" className={`${actionPrimary} mt-space-lg`}>
        <span>Go to History</span>
        <Icon name="arrow_forward" size={18} />
      </Link>
    </div>
  );
}

interface UnlockedProps {
  item: SeminarListItem;
  record: HistoryRecord | null;
  headingRef: HeadingRef;
  onSubmitted: (result: SubmitEvaluationResult) => void;
}

/** Loads the survey the Org Member set, then shows the form. Only mounted when the evaluation is open. */
function UnlockedEvaluation({ item, record, headingRef, onSubmitted }: UnlockedProps) {
  const survey = useResource(
    () => api.getEvaluationSurvey(item.seminar.id),
    `evaluation-survey-${item.seminar.id}`,
    (data) => questionCount(data) === 0,
  );
  const count = survey.state.status === 'success' ? questionCount(survey.state.data) : undefined;

  return (
    <>
      <SeminarContextCard item={item} record={record} questionCount={count} headingRef={headingRef} />

      {survey.state.status === 'loading' && (
        <LoadingRegion label="Loading the evaluation" className="flex flex-col gap-space-lg">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </LoadingRegion>
      )}
      {survey.state.status === 'error' && (
        <StateMessage
          role="alert"
          icon="info"
          title="The evaluation could not be loaded"
          action={<RetryButton onClick={survey.reload} />}
        >
          {errorText(survey.state.code)}
        </StateMessage>
      )}
      {survey.state.status === 'empty' && (
        <StateMessage role="status" icon="info" title="This evaluation has no questions yet">
          The organizers have not added questions. Check back later.
        </StateMessage>
      )}
      {survey.state.status === 'success' && (
        <EvaluationForm item={item} survey={survey.state.data} onSubmitted={onSubmitted} />
      )}
    </>
  );
}

export default function EvaluationPage() {
  const { id = '' } = useParams();
  const now = useNow();
  const seminar = useResource(() => api.getSeminar(id), `evaluation-seminar-${id}`);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [submitted, setSubmitted] = useState<{ at: string; result: SubmitEvaluationResult } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    document.title = 'Evaluation - Seminex';
  }, []);

  const item = seminar.state.status === 'success' ? seminar.state.data : null;
  const record = item ? (buildHistoryRecords([item], now)[0] ?? null) : null;
  const access = item ? getEvaluationAccess(item, now) : null;

  function handleSubmitted(result: SubmitEvaluationResult) {
    setSubmitted({ at: new Date().toISOString(), result });
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    headingRef.current?.focus();
  }

  return (
    <PageContainer width="narrow">
      <div className="flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-space-xs font-caption text-caption text-text-secondary">
            <li>
              <Link to="/my-seminars" className="rounded underline-offset-2 hover:text-primary hover:underline">
                My seminars
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" size={14} />
            </li>
            <li aria-current="page" className="font-body-sm-medium text-secondary">
              Evaluation clearance
            </li>
          </ol>
        </nav>
        <span className="inline-flex w-fit items-center gap-space-xs rounded-full bg-status-finished-container px-3 py-1 font-label-sm text-label-sm uppercase text-status-finished">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-status-finished" />
          Mandatory clearance
        </span>
      </div>

      {seminar.state.status === 'loading' && (
        <LoadingRegion label="Loading the evaluation" className="flex flex-col gap-space-lg">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </LoadingRegion>
      )}

      {seminar.state.status === 'error' && (
        <StateMessage
          role="alert"
          icon="info"
          title={seminar.state.code === 'not_found' ? 'Seminar not found' : 'The evaluation could not be loaded'}
          action={
            seminar.state.code === 'not_found' ? (
              <Link to="/seminars" className={actionPrimary}>
                Browse available seminars
              </Link>
            ) : (
              <RetryButton onClick={seminar.reload} />
            )
          }
        >
          {seminar.state.code === 'not_found'
            ? 'This seminar does not exist or was removed. Check the link, or find the seminar in your list.'
            : errorText(seminar.state.code)}
        </StateMessage>
      )}

      {item && !item.registration && (
        <StateMessage
          icon="info"
          title="You are not registered for this seminar"
          action={
            <Link to="/seminars" className={actionPrimary}>
              Browse available seminars
            </Link>
          }
        >
          Only registered students can submit an evaluation.
        </StateMessage>
      )}

      {item && item.registration && access && (
        <>
          {submitted ? (
            <>
              <SeminarContextCard item={item} record={record} headingRef={headingRef} />
              <SubmittedPanel submittedAt={submitted.at} />
            </>
          ) : access.state === 'locked' ? (
            <>
              <SeminarContextCard item={item} record={record} headingRef={headingRef} />
              <EvaluationLocked reason={access.reason} endsAt={item.seminar.endsAt} />
            </>
          ) : access.state === 'submitted' ? (
            <>
              <SeminarContextCard item={item} record={record} headingRef={headingRef} />
              <SubmittedPanel submittedAt={access.submittedAt} />
            </>
          ) : (
            <UnlockedEvaluation item={item} record={record} headingRef={headingRef} onSubmitted={handleSubmitted} />
          )}
        </>
      )}

      {item && (
        <SubmittedDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          seminarTitle={item.seminar.title}
          certificateSerial={submitted?.result.certificateSerial}
        />
      )}
    </PageContainer>
  );
}