import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CERTIFICATE_CANVAS_HEIGHT, CERTIFICATE_CANVAS_WIDTH } from '../../../api/orgTypes';
import type {
  OrgSeminar,
  OrgRegistration,
  ScanLedgerEntry,
  OrgSeminarEvaluationData,
  OrgSeminarCertificateData,
  CertificateRecord,
  SurveyResponse,
  AuthoredSurvey,
} from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { ExportMenu } from '../../../components/ui/ExportMenu';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';
import { Icon } from '../../../components/ui/Icon';
import { exportTable, type ExportFormat } from '../../../shared/exportTable';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { getOrgLifecycle } from '../seminarStatus';
import { OrgStatusBadge } from '../components/OrgStatusBadge';
import { FormattedText } from '../../evaluation/components/FormattedText';
import { richTextToPlainText } from '../../evaluation/richText';
import { WebinarProofReview } from '../components/WebinarProofReview';
import { saveBlob } from '../../history/saveBlob';

type SeminarTab = 'details' | 'registrations' | 'attendance' | 'evaluation' | 'certificates';
type RegistrationFilter = 'all' | 'registered' | 'removed';
const REGISTRATION_FILTERS: Array<{ value: RegistrationFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'registered', label: 'Registered' },
  { value: 'removed', label: 'Removed' },
];
const dateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
const registrationDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

function initialTab(): SeminarTab {
  if (typeof window === 'undefined') return 'details';
  const tab = window.location.hash.slice(1);
  return tab === 'registrations' || tab === 'attendance' || tab === 'evaluation' || tab === 'certificates' ? tab : 'details';
}

function getAttendance(roster: OrgRegistration[], ledger: ScanLedgerEntry[], seminar: OrgSeminar, now: number) {
  const minutes = (studentId: string) => {
    const entries = ledger
      .filter((entry) => entry.studentId === studentId && entry.kind !== 'correction')
      .sort((a, b) => a.at.localeCompare(b.at));
    let lastIn: number | null = null;
    let total = 0;
    for (const entry of entries) {
      if (entry.kind === 'time_in') lastIn = Date.parse(entry.at);
      if (entry.kind === 'time_out' && lastIn !== null) {
        total += Math.max(0, Date.parse(entry.at) - lastIn);
        lastIn = null;
      }
    }
    if (lastIn !== null) total += Math.max(0, Math.min(now, Date.parse(seminar.endsAt)) - lastIn);
    return Math.floor(total / 60_000);
  };
  const valid = roster.filter((student) => !student.removal && student.status !== 'released' && student.status !== 'cancelled');
  const rows = valid.map((student) => ({ student, minutes: minutes(student.studentId) }));
  const timeIn = new Set(ledger.filter((entry) => entry.kind === 'time_in').map((entry) => entry.studentId)).size;
  const completed = new Set(ledger.filter((entry) => entry.kind === 'time_out').map((entry) => entry.studentId)).size;
  const duration = Math.max(1, (Date.parse(seminar.endsAt) - Date.parse(seminar.startsAt)) / 60_000);
  const required = Math.ceil((duration * seminar.requiredAttendancePercent) / 100);
  return {
    rows,
    registered: valid.length,
    timeIn,
    completed,
    meets: rows.filter((row) => row.minutes >= required).length,
    required,
  };
}

function exportRegistrations(seminar: OrgSeminar, rows: OrgRegistration[], format: ExportFormat) {
  exportTable(
    `${seminar.reference}-registrations`,
    [
      ['Student name', 'Student ID', 'Email', 'Program', 'Year level', 'Block', 'Registered on', 'Status'],
      ...rows.map((row) => [
        `${row.firstName} ${row.middleInitial ? `${row.middleInitial}. ` : ''}${row.lastName}`,
        row.studentId,
        row.email,
        row.program,
        row.yearLevel,
        row.block,
        row.registeredAt,
        row.removal ? 'Removed' : 'Registered',
      ]),
    ],
    format,
    'Registrations',
  );
}

async function exportEvaluationResponses(seminar: OrgSeminar, seminarId: string, format: ExportFormat) {
  const firstPage = await api.getOrgSeminarEvaluation(seminarId, { pageSize: 100 });
  if (!firstPage.ok) return;
  const data = firstPage.data;
  const responses = [...data.responses.items];
  let cursor = data.responses.nextCursor;
  while (cursor) {
    const result = await api.getOrgSeminarEvaluation(seminarId, { cursor, pageSize: 100 });
    if (!result.ok) return;
    responses.push(...result.data.responses.items);
    cursor = result.data.responses.nextCursor;
  }
  const questions = data.surveyVersions.flatMap((survey) =>
    survey.sections.flatMap((section) => section.questions.map((question) => ({ survey, question }))),
  );
  const questionLabel = (survey: AuthoredSurvey, question: { id: string; prompt: string }) =>
    `v${survey.version}: ${richTextToPlainText(question.prompt)}`;
  exportTable(
    `${seminar.reference}-evaluation-responses`,
    [
      ['Response', ...questions.map(({ survey, question }) => questionLabel(survey, question))],
      ...responses.map((response) => [
        'Anonymous response',
        ...questions.map(({ survey, question }) =>
          survey.id === response.surveyId && survey.version === response.surveyVersion ? response.answers[question.id] ?? '' : '',
        ),
      ]),
    ],
    format,
    'Evaluation Responses',
  );
}

function exportCertificateRecords(
  seminar: OrgSeminar,
  records: OrgSeminarCertificateData,
  roster: OrgRegistration[],
  format: ExportFormat,
) {
  const names = new Map(roster.map((student) => [student.studentId, `${student.firstName} ${student.lastName}`]));
  exportTable(
    `${seminar.reference}-certificate-eligibility`,
    [
      ['Student name', 'Student ID', 'Eligibility', 'Reason', 'Certificate serial', 'Issued on'],
      ...records.records.map((record) => [
        names.get(record.studentId) ?? 'Participant',
        record.studentId,
        record.state,
        record.reason,
        record.serial ?? '',
        record.issuedAt ?? '',
      ]),
    ],
    format,
    'Certificates',
  );
}

function RegistrationRows({ rows, ledger }: { rows: OrgRegistration[]; ledger: ScanLedgerEntry[] }) {
  const registrationLabel = (row: OrgRegistration) =>
    row.removal ? 'Removed' : row.status === 'released' ? 'Released' : row.status === 'confirmed' || row.confirmedAt ? 'Confirmed' : 'Unconfirmed';
  const attendanceLabel = (studentId: string) => {
    const latest = ledger
      .filter((entry) => entry.studentId === studentId && entry.kind !== 'correction')
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    return latest?.kind === 'time_out' ? 'Time-out recorded' : latest?.kind === 'time_in' ? 'Time-in recorded' : 'No scan yet';
  };
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border-subtle md:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-surface-container-low font-caption text-caption text-text-secondary">
            <tr>
              <th className="px-space-md py-space-md font-semibold">Student</th>
              <th className="px-space-md py-space-md font-semibold">Student ID</th>
              <th className="px-space-md py-space-md font-semibold">Program &amp; block</th>
              <th className="px-space-md py-space-md font-semibold">Registered</th>
              <th className="px-space-md py-space-md font-semibold">Attendance</th>
              <th className="px-space-md py-space-md font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => {
              const name = `${row.firstName} ${row.middleInitial ? `${row.middleInitial}. ` : ''}${row.lastName}`;
              const scanStatus = attendanceLabel(row.studentId);
              const registrationStatus = registrationLabel(row);
              return (
                <tr key={row.id} className="font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low/60">
                  <td className="px-space-md py-space-md">
                    <span className="block font-body-sm-medium text-body-sm-medium">{name}</span>
                    <span className="block font-caption text-caption text-text-secondary">{row.email}</span>
                  </td>
                  <td className="px-space-md py-space-md font-mono tabular-nums">{row.studentId}</td>
                  <td className="px-space-md py-space-md">
                    {row.program ?? 'Program not provided'} · {row.yearLevel ?? 'Year not provided'}-{row.block ?? 'Block not provided'}
                  </td>
                  <td className="px-space-md py-space-md tabular-nums">{registrationDate(row.registeredAt)}</td>
                  <td className="px-space-md py-space-md">
                    <span
                      className={`inline-flex items-center gap-1.5 font-label-sm text-label-sm ${
                        scanStatus === 'No scan yet' ? 'text-text-secondary' : 'text-status-available'
                      }`}
                    >
                      <Icon name={scanStatus === 'No scan yet' ? 'schedule' : 'verified'} size={16} />
                      {scanStatus}
                    </span>
                  </td>
                  <td className="px-space-md py-space-md">
                    <span
                      className={`rounded-md px-2.5 py-1 font-label-sm text-label-sm ${
                        registrationStatus === 'Released' || registrationStatus === 'Removed'
                          ? 'bg-danger-surface text-danger'
                          : 'bg-status-available-container text-status-available'
                      }`}
                    >
                      {registrationStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-space-sm md:hidden">
        {rows.map((row) => {
          const name = `${row.firstName} ${row.middleInitial ? `${row.middleInitial}. ` : ''}${row.lastName}`;
          const initials = `${row.firstName[0] ?? ''}${row.lastName[0] ?? ''}`.toUpperCase();
          const scanStatus = attendanceLabel(row.studentId);
          const registrationStatus = registrationLabel(row);
          return (
            <article key={row.id} className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <div className="flex items-start justify-between gap-space-sm">
                <div className="flex min-w-0 items-center gap-space-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container font-body-sm-medium text-body-sm-medium text-on-primary">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">{name}</h3>
                    <p className="truncate font-caption text-caption tabular-nums text-text-secondary">
                      {row.studentId} · {row.email}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 font-label-sm text-label-sm ${
                    registrationStatus === 'Released' || registrationStatus === 'Removed'
                      ? 'bg-danger-surface text-danger'
                      : 'bg-status-available-container text-status-available'
                  }`}
                >
                  {registrationStatus}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-space-md gap-y-space-sm border-t border-border-subtle pt-space-sm">
                <div>
                  <dt className="font-caption text-caption text-text-secondary">Program &amp; block</dt>
                  <dd className="font-body-sm-medium text-body-sm-medium text-on-surface">
                    {row.program ?? 'Program not provided'} · {row.yearLevel ?? 'Year not provided'}-{row.block ?? 'Block not provided'}
                  </dd>
                </div>
                <div>
                  <dt className="font-caption text-caption text-text-secondary">Registered</dt>
                  <dd className="font-body-sm-medium text-body-sm-medium tabular-nums text-on-surface">
                    {registrationDate(row.registeredAt)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-caption text-caption text-text-secondary">Attendance</dt>
                  <dd
                    className={`inline-flex items-center gap-1.5 font-body-sm-medium text-body-sm-medium ${
                      scanStatus === 'No scan yet' ? 'text-text-secondary' : 'text-status-available'
                    }`}
                  >
                    <Icon name={scanStatus === 'No scan yet' ? 'schedule' : 'verified'} size={16} />
                    {scanStatus}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}

export default function OrgSeminarDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState(false);
  const [activeTab, setActiveTab] = useState<SeminarTab>(initialTab);
  const [rosterQuery, setRosterQuery] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>('all');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(false);
  const [evaluationView, setEvaluationView] = useState<'overview' | 'responses'>('overview');
  const [additionalEvaluationResponses, setAdditionalEvaluationResponses] = useState<{
    seminarId: string;
    items: SurveyResponse[];
    nextCursor: string | null;
    error: boolean;
  } | null>(null);
  const [loadingMoreEvaluationResponses, setLoadingMoreEvaluationResponses] = useState(false);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState<string | null>(null);
  const [certificateDownloadError, setCertificateDownloadError] = useState(false);
  const [regenerationTarget, setRegenerationTarget] = useState<CertificateRecord | null>(null);
  const [regeneratingCertificateId, setRegeneratingCertificateId] = useState<string | null>(null);
  const [regenerationResult, setRegenerationResult] = useState<'success' | 'error' | null>(null);
  const regenerationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const now = useNow();
  const listing = useResource(() => api.listOrgSeminars({ seminars: { pageSize: 999 }, drafts: { pageSize: 1 } }), `org-seminar-${id}`);
  const seminar = listing.state.status === 'success' ? listing.state.data.seminars.items.find((item) => item.id === id) : null;
  const roster = useResource(() => api.listOrgRoster(id), `org-roster-${id}`, (items) => items.length === 0);
  const ledger = useResource(() => api.listLedger(id), `org-ledger-${id}`, (items) => items.length === 0);
  const evaluationData = useResource<OrgSeminarEvaluationData>(() => api.getOrgSeminarEvaluation(id), `org-evaluation-${id}`);
  const certificateData = useResource<OrgSeminarCertificateData>(() => api.getOrgSeminarCertificates(id), `org-certificates-${id}`);

  useEffect(() => {
    if (!regenerationTarget && !regenerationResult) regenerationTriggerRef.current?.focus();
  }, [regenerationTarget, regenerationResult]);

  async function downloadCertificate(record: CertificateRecord) {
    if (record.state !== 'issued' || downloadingCertificateId) return;
    setCertificateDownloadError(false);
    setDownloadingCertificateId(record.id);
    try {
      const result = await api.getOrgCertificate(id, record.id);
      if (result.ok) {
        saveBlob(result.data, `${seminar?.reference ?? id}-${record.serial ?? 'certificate'}.pdf`);
        return;
      }
      setCertificateDownloadError(true);
    } catch {
      setCertificateDownloadError(true);
    } finally {
      setDownloadingCertificateId(null);
    }
  }

  async function regenerateCertificate() {
    const target = regenerationTarget;
    if (!target || target.state !== 'issued' || regeneratingCertificateId) return;
    setRegenerationResult(null);
    setRegeneratingCertificateId(target.id);
    try {
      const result = await api.regenerateOrgCertificate(target.id);
      setRegenerationTarget(null);
      if (result.ok) {
        certificateData.reload();
        setRegenerationResult('success');
      } else {
        setRegenerationResult('error');
      }
    } catch {
      setRegenerationTarget(null);
      setRegenerationResult('error');
    } finally {
      setRegeneratingCertificateId(null);
    }
  }

  if (listing.state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingRegion label="Loading seminar details">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </LoadingRegion>
      </PageContainer>
    );
  }
  if (listing.state.status === 'error') {
    return (
      <PageContainer>
        <StateMessage
          role="alert"
          icon="info"
          title="Seminar details could not be loaded"
          action={<RetryButton onClick={listing.reload} />}
        >
          Try again when your connection is available.
        </StateMessage>
      </PageContainer>
    );
  }
  if (!seminar) {
    return (
      <PageContainer>
        <StateMessage
          role="status"
          icon="event_busy"
          title="Seminar not found"
          action={
            <Link to="/org/my-seminars" className={actionPrimary}>
              Back to My Seminars
            </Link>
          }
        >
          This seminar is not available in your organization workspace.
        </StateMessage>
      </PageContainer>
    );
  }
  if (now === null) {
    return (
      <PageContainer>
        <p role="status" className="font-body-sm text-body-sm text-text-secondary">
          Loading current seminar times…
        </p>
      </PageContainer>
    );
  }

  const status = getOrgLifecycle(seminar, now);
  const attendees = roster.state.status === 'success' ? roster.state.data : [];
  const ledgerEntries = ledger.state.status === 'success' ? ledger.state.data : [];
  const attendance = getAttendance(attendees, ledgerEntries, seminar, now);
  const activeRows = roster.state.status === 'success' ? roster.state.data : [];
  const filteredRows = activeRows.filter((row) => {
    const removed = Boolean(row.removal);
    const statusMatch = registrationFilter === 'all' || (registrationFilter === 'removed' ? removed : !removed);
    const textMatch = `${row.firstName} ${row.middleInitial} ${row.lastName} ${row.studentId} ${row.email} ${row.program} ${row.yearLevel} ${row.block}`
      .toLowerCase()
      .includes(rosterQuery.trim().toLowerCase());
    return statusMatch && textMatch;
  });
  const removedCount = activeRows.filter((row) => Boolean(row.removal)).length;
  const confirmedCount = activeRows.filter(
    (row) => !row.removal && (row.status === 'confirmed' || Boolean(row.confirmedAt) || row.status === undefined),
  ).length;
  const unconfirmedCount = activeRows.filter((row) => !row.removal && row.status === 'registered' && !row.confirmedAt).length;
  const releasedCount = activeRows.filter((row) => !row.removal && row.status === 'released').length;
  const registrationCounts: Record<RegistrationFilter, number> = {
    all: activeRows.length,
    registered: activeRows.length - removedCount,
    removed: removedCount,
  };
  const evaluationPayload: OrgSeminarEvaluationData =
    evaluationData.state.status === 'success'
      ? evaluationData.state.data
      : { survey: null, surveyVersions: [], aggregates: [], responses: { items: [], nextCursor: null } };
  const extraEvaluationResponses = additionalEvaluationResponses?.seminarId === id ? additionalEvaluationResponses : null;
  const evaluationResponses = [...evaluationPayload.responses.items, ...(extraEvaluationResponses?.items ?? [])];
  const evaluationCursor = extraEvaluationResponses ? extraEvaluationResponses.nextCursor : evaluationPayload.responses.nextCursor;
  const evaluationTotalCount = evaluationPayload.aggregates.reduce((total, aggregate) => total + aggregate.responseCount, 0);
  const currentEvaluationAggregate = evaluationPayload.survey
    ? evaluationPayload.aggregates.find(
        (aggregate) =>
          aggregate.surveyId === evaluationPayload.survey?.id && aggregate.surveyVersion === evaluationPayload.survey?.version,
      )
    : undefined;

  async function openEditor() {
    if (editing || status === 'finished' || status === 'cancelled' || seminar?.publicationStatus === 'archived') return;
    setEditing(true);
    setEditError(false);
    const result = await api.createOrgEditDraft(seminar!.id);
    setEditing(false);
    if (result.ok) navigate(`/org/seminars/${result.data.id}/edit`);
    else setEditError(true);
  }

  async function archiveSeminar() {
    if (archiving || !seminar || seminar.publicationStatus !== 'published') return;
    setArchiving(true);
    setArchiveError(false);
    const result = await api.archiveOrgSeminar(seminar.id);
    setArchiving(false);
    if (!result.ok) {
      setArchiveError(true);
      return;
    }
    navigate('/org/my-seminars', { replace: true });
  }

  function selectTab(tab: SeminarTab) {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  }

  async function loadMoreEvaluationResponses() {
    if (!id || !evaluationCursor || loadingMoreEvaluationResponses) return;
    setLoadingMoreEvaluationResponses(true);
    setAdditionalEvaluationResponses((current) => (current?.seminarId === id ? { ...current, error: false } : current));
    const result = await api.getOrgSeminarEvaluation(id, { cursor: evaluationCursor, pageSize: 20 });
    setLoadingMoreEvaluationResponses(false);
    if (!result.ok) {
      setAdditionalEvaluationResponses((current) => ({
        seminarId: id,
        items: current?.seminarId === id ? current.items : [],
        nextCursor: evaluationCursor,
        error: true,
      }));
      return;
    }
    setAdditionalEvaluationResponses((current) => ({
      seminarId: id,
      items: [...(current?.seminarId === id ? current.items : []), ...result.data.responses.items],
      nextCursor: result.data.responses.nextCursor,
      error: false,
    }));
  }

  return (
    <PageContainer>
      {archiveError && (
        <p role="alert" className="mb-space-md rounded-lg border border-danger-soft bg-danger-surface p-space-md text-danger-ink">
          Seminar could not be archived. Your participant and certificate records are unchanged.
        </p>
      )}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-caption text-caption text-text-secondary">
        <Link to="/org/my-seminars" className="hover:text-primary">
          My Seminars
        </Link>
        <Icon name="chevron_right" size={16} />
        <span className="tabular-nums">{seminar.reference}</span>
      </nav>

      <header className="flex flex-col gap-space-md sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline-xl text-headline-xl-mobile text-primary md:text-headline-xl">{seminar.title}</h1>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((open) => !open)}
            className={actionTonal}
          >
            <Icon name="more_vert" size={18} />
            Actions
            <Icon name="unfold_more" size={16} />
          </button>
          {actionsOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 flex w-60 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-1 shadow-overlay"
            >
              <button
                type="button"
                role="menuitem"
                disabled={editing || status === 'finished' || status === 'cancelled' || seminar.publicationStatus === 'archived'}
                onClick={() => {
                  setActionsOpen(false);
                  void openEditor();
                }}
                className="flex min-h-11 items-center gap-2 rounded-lg px-space-md text-left font-body-sm-medium text-body-sm-medium text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="edit" size={18} />
                {editing ? 'Opening editor…' : 'Edit seminar'}
              </button>
              {seminar.publicationStatus === 'published' && (
                <>
                  <div className="my-1 border-t border-border-subtle" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsOpen(false);
                      setConfirmArchive(true);
                      setArchiveError(false);
                    }}
                    className="flex min-h-11 items-center gap-2 rounded-lg px-space-md text-left font-body-sm-medium text-body-sm-medium text-danger hover:bg-danger-surface"
                  >
                    <Icon name="history" size={18} />
                    Archive seminar
                  </button>
                </>
              )}
              <div className="my-1 border-t border-border-subtle" />
              {[
                { icon: 'event' as const, label: 'Duplicate seminar' },
                { icon: 'lock' as const, label: 'Close registration' },
                { icon: 'event_busy' as const, label: 'End seminar now' },
                { icon: 'close' as const, label: 'Cancel seminar' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled
                  title="This action will be available when the organization backend supports it."
                  className="flex min-h-11 items-center gap-2 rounded-lg px-space-md text-left font-body-sm text-body-sm text-text-subtle disabled:cursor-not-allowed"
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                  <span className="ml-auto font-caption text-caption">Unavailable</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      {editError && (
        <p role="alert" className="rounded-xl border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">
          The seminar editor could not be opened. Try again.
        </p>
      )}

      <section
        aria-label="Seminar cover"
        className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-sm lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-inverse-surface">
          {seminar.imageUrl ? (
            <img src={seminar.imageUrl} alt={seminar.title} className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="flex h-full w-full items-center justify-center">
              <Icon name="event_available" size={56} className="text-white/25" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between gap-space-md p-space-lg md:p-space-xl">
          <div className="flex flex-col gap-space-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <OrgStatusBadge status={status} />
              <span className="rounded-md bg-surface-container-low px-2.5 py-1 font-caption text-caption tabular-nums text-text-secondary">
                {seminar.reference}
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{seminar.title}</h2>
            <p className="font-body-sm text-body-sm text-text-secondary">
              {seminar.speaker.role ? `${seminar.speaker.name} · ${seminar.speaker.role}` : seminar.speaker.name}
            </p>
            {(seminar.department || seminar.topics.length > 0) && (
              <div className="mt-1 flex flex-wrap gap-2">
                {seminar.department && (
                  <span className="rounded-md bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-text-secondary">
                    {seminar.department}
                  </span>
                )}
                {seminar.topics.slice(0, 3).map((topic) => (
                  <span key={topic} className="rounded-md bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-text-secondary">
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
          {seminar.seminarType !== 'webinar' && (
            <div className="flex flex-wrap items-center gap-space-sm pt-2">
              <Link to={`/org/my-seminars/${seminar.id}/scanner`} className={actionPrimary}>
                <Icon name="qr_code_scanner" size={20} />
                Launch check-in scanner
              </Link>
            </div>
          )}
        </div>
      </section>

      <section aria-label="Seminar summary" className="grid gap-space-sm tabular-nums sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex items-center gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Icon name="calendar_today" size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-caption text-caption text-text-secondary">Date</p>
            <p className="font-body-sm-medium text-body-sm-medium text-on-surface">
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(seminar.startsAt))}
            </p>
          </div>
        </article>
        <article className="flex items-center gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Icon name="schedule" size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-caption text-caption text-text-secondary">Time</p>
            <p className="font-body-sm-medium text-body-sm-medium text-on-surface">
              {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(seminar.startsAt))} –{' '}
              {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(seminar.endsAt))}
            </p>
          </div>
        </article>
        <article className="flex items-center gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-primary">
            <Icon name="meeting_room" size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-caption text-caption text-text-secondary">Venue</p>
            <p className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.venue}</p>
          </div>
        </article>
        <article className="flex flex-col justify-center gap-1 rounded-xl border border-border-subtle bg-surface-card p-space-md">
          <div className="flex items-center justify-between gap-2">
            <p className="font-caption text-caption text-text-secondary">Registrations</p>
            <p className="font-body-sm-medium text-body-sm-medium text-primary">
              {seminar.registeredCount} of {seminar.capacity}{' '}
              <span className="text-text-secondary">
                ({seminar.capacity ? Math.round((seminar.registeredCount / seminar.capacity) * 100) : 0}%)
              </span>
            </p>
          </div>
          <ProgressBar
            value={seminar.registeredCount}
            max={seminar.capacity}
            label={`${seminar.title}: ${seminar.registeredCount} of ${seminar.capacity} registrations`}
          />
          <div className="flex justify-between gap-2 font-caption text-caption text-text-secondary">
            <span>{Math.max(0, seminar.capacity - seminar.registeredCount)} slots remaining</span>
            <span>{roster.state.status === 'success' ? 'Roster ready' : 'Roster loading'}</span>
          </div>
        </article>
      </section>

      <div
        role="tablist"
        aria-label="Seminar sections"
        className="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-surface-container-high p-1.5"
      >
        {(
          [
            { value: 'details', label: 'Details', icon: 'info' },
            { value: 'registrations', label: `Registrations (${attendance.registered})`, icon: 'group' },
            {
              value: 'attendance',
              label: seminar.seminarType === 'webinar' ? 'Attendance & proof' : 'Attendance & scanner',
              icon: seminar.seminarType === 'webinar' ? 'fact_check' : 'qr_code_scanner',
            },
            {
              value: 'evaluation',
              label: `Evaluation${evaluationData.state.status === 'success' ? ` (${evaluationTotalCount})` : ''}`,
              icon: 'rate_review',
            },
            { value: 'certificates', label: 'Certificates', icon: 'workspace_premium' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={activeTab === tab.value}
            aria-controls={`panel-${tab.value}`}
            onClick={() => selectTab(tab.value)}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-space-md font-body-sm-medium text-body-sm-medium tabular-nums transition ${
              activeTab === tab.value
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-text-secondary hover:bg-surface-container-highest'
            }`}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div
          id="panel-details"
          role="tabpanel"
          aria-labelledby="tab-details"
          className="grid items-start gap-space-lg lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]"
        >
          <section
            className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg"
            aria-labelledby="description-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="description-heading" className="font-headline-sm text-headline-sm text-on-surface">
                Collegiate syllabus &amp; description
              </h2>
              <span className="rounded-md bg-surface-container-low px-2.5 py-1 font-caption text-caption tabular-nums text-text-secondary">
                {seminar.reference}
              </span>
            </div>
            <p className="whitespace-pre-wrap font-body-base text-body-base leading-relaxed text-text-secondary">
              {seminar.overview || seminar.description}
            </p>
            {seminar.objectives && seminar.objectives.length > 0 && (
              <div className="border-t border-border-subtle pt-space-md">
                <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Learning objectives</h3>
                <ul className="mt-space-sm flex flex-col gap-space-sm">
                  {seminar.objectives.map((objective, index) => (
                    <li key={`${index}-${objective}`} className="flex items-start gap-space-sm font-body-sm text-body-sm text-text-secondary">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-low font-label-sm text-label-sm tabular-nums text-primary">
                        {index + 1}
                      </span>
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-space-sm border-t border-border-subtle pt-space-md tabular-nums sm:grid-cols-2">
              {[
                { label: 'Target participants', value: 'Not specified in seminar data' },
                { label: 'Attendance requirement', value: `${seminar.requiredAttendancePercent}% minimum` },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-space-md">
                  <span className="font-caption text-caption text-text-secondary">{item.label}</span>
                  <span className="font-body-sm-medium text-body-sm-medium text-on-surface">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-space-sm sm:grid-cols-2">
              <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                  <Icon name="record_voice_over" size={22} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Resource speaker</h3>
                  <p className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.speaker.name}</p>
                  {seminar.speaker.role && (
                    <p className="font-caption text-caption text-text-secondary">{seminar.speaker.role}</p>
                  )}
                  {seminar.speaker.bio && (
                    <p className="mt-1 font-caption text-caption text-text-secondary">{seminar.speaker.bio}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                  <Icon name="assignment_turned_in" size={22} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-body-sm-medium text-body-sm-medium text-on-surface">Evaluation framework</h3>
                    <span className="rounded bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-text-secondary">
                      {evaluationData.state.status === 'success' && evaluationPayload.survey ? 'Configured' : 'Unavailable'}
                    </span>
                  </div>
                  <p className="mt-1 font-body-sm text-body-sm tabular-nums text-text-secondary">
                    {evaluationData.state.status === 'success' && evaluationPayload.survey
                      ? `${evaluationPayload.survey.sections.reduce((total, section) => total + section.questions.length, 0)} questions configured · ${evaluationTotalCount} responses received.`
                      : 'Evaluation configuration will appear here when available.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-space-lg">
            <section
              className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg"
              aria-labelledby="requirements-heading"
            >
              <div className="flex items-center gap-space-sm">
                <Icon name="verified_user" size={20} className="text-primary" />
                <h2 id="requirements-heading" className="font-title-md text-title-md text-on-surface">
                  Attendance &amp; certificate requirements
                </h2>
              </div>
              <p className="font-body-sm text-body-sm text-text-secondary">
                Participants must meet the attendance threshold and have their time-in and time-out recorded.
              </p>
              <div className="rounded-xl bg-surface-container-low p-space-md">
                <p className="font-caption text-caption text-text-secondary">Required attendance</p>
                <p className="mt-1 font-headline-sm text-headline-sm tabular-nums text-primary">
                  {seminar.requiredAttendancePercent}% of seminar duration
                </p>
              </div>
              {seminar.certificateEligibility && (
                <p className="font-caption text-caption text-text-secondary">{seminar.certificateEligibility}</p>
              )}
            </section>

            {seminar.venueGuidelines && (
              <section
                className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg"
                aria-labelledby="venue-guidelines-heading"
              >
                <div className="flex items-center gap-space-sm">
                  <Icon name="location_on" size={20} className="text-primary" />
                  <h2 id="venue-guidelines-heading" className="font-title-md text-title-md text-on-surface">
                    Venue guidelines
                  </h2>
                </div>
                <p className="font-body-sm text-body-sm text-text-secondary">{seminar.venueGuidelines}</p>
              </section>
            )}

            <section
              className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg"
              aria-labelledby="credential-preview-heading"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id="credential-preview-heading" className="font-title-md text-title-md text-on-surface">
                  Certificate preview
                </h2>
                <Icon name="workspace_premium" size={22} className="text-primary" />
              </div>
              {(() => {
                const tpl = certificateData.state.status === 'success' ? certificateData.state.data.template : null;
                if (!tpl) {
                  return (
                    <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-border-subtle bg-surface-container-low p-space-md text-center">
                      <p className="font-body-sm text-body-sm text-text-secondary">No certificate template configured yet.</p>
                    </div>
                  );
                }
                const cw = tpl.canvasWidth ?? CERTIFICATE_CANVAS_WIDTH;
                const ch = tpl.canvasHeight ?? CERTIFICATE_CANVAS_HEIGHT;
                const nb = tpl.nameBox;
                const sampleBase = 'Ana Cruz';
                const sampleName =
                  nb.textTransform === 'uppercase'
                    ? sampleBase.toLocaleUpperCase()
                    : nb.textTransform === 'lowercase'
                      ? sampleBase.toLocaleLowerCase()
                      : nb.textTransform === 'capitalize'
                        ? sampleBase.replace(/\b\p{L}/gu, (l) => l.toLocaleUpperCase())
                        : sampleBase;
                const lineHeightPx = nb.lineHeight ?? Math.round(nb.fontSize * 1.25);
                return (
                  <div
                    className="relative w-full overflow-hidden rounded-xl border border-border-subtle bg-surface-card [container-type:inline-size]"
                    style={{
                      aspectRatio: `${cw} / ${ch}`,
                      backgroundImage: `url("${tpl.backgroundUrl}")`,
                      backgroundSize: '100% 100%',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div
                      className="pointer-events-none absolute flex items-center justify-center"
                      style={{
                        left: `${(nb.x / cw) * 100}%`,
                        top: `${(nb.y / ch) * 100}%`,
                        width: `${(nb.width / cw) * 100}%`,
                        height: `${(nb.height / ch) * 100}%`,
                        fontFamily: `"${nb.fontFamily}", sans-serif`,
                        fontSize: `max(6px, ${(nb.fontSize / cw) * 100}cqw)`,
                        lineHeight: `${(lineHeightPx / cw) * 100}cqw`,
                        fontWeight: nb.fontWeight,
                        fontStyle: nb.italic ? 'italic' : 'normal',
                        textDecoration: nb.underline ? 'underline' : 'none',
                        textAlign: nb.align,
                        color: nb.color,
                      }}
                    >
                      <span className="w-full break-words px-1 tracking-tight" style={{ opacity: (nb.opacity ?? 100) / 100 }}>
                        {sampleName}
                      </span>
                    </div>
                    {tpl.qrCodeBox && (
                      <div
                        className="pointer-events-none absolute bg-white p-0.5"
                        style={{
                          left: `${(tpl.qrCodeBox.x / cw) * 100}%`,
                          top: `${(tpl.qrCodeBox.y / ch) * 100}%`,
                          width: `${(tpl.qrCodeBox.width / cw) * 100}%`,
                          height: `${(tpl.qrCodeBox.height / ch) * 100}%`,
                        }}
                      >
                        <QRCodeSVG
                          value={`Seminex certificate: ${seminar.reference}`}
                          size={Math.max(24, Math.round(Math.min(tpl.qrCodeBox.width, tpl.qrCodeBox.height)))}
                          level="M"
                          marginSize={2}
                          className="h-full w-full"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
              <p className="font-caption text-caption text-text-secondary">
                Sample preview rendered from your configured certificate template. Issue status is available in the Certificates tab.
              </p>
            </section>
          </div>
        </div>
      )}

      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-seminar-title"
            aria-describedby="archive-seminar-copy"
            className="w-full max-w-md rounded-2xl bg-surface-card p-space-lg shadow-overlay"
          >
            <h2 id="archive-seminar-title" className="font-title-md text-title-md text-on-surface">
              Archive {seminar.title}?
            </h2>
            <p id="archive-seminar-copy" className="mt-space-sm font-body-sm text-body-sm text-text-secondary">
              This removes the seminar from the participant catalog and your active seminar list. Registrations, attendance, evaluation responses, certificate serials, and issued PDFs remain available in History.
            </p>
            <div className="mt-space-lg flex justify-end gap-space-sm">
              <button type="button" autoFocus disabled={archiving} onClick={() => setConfirmArchive(false)} className={actionTonal}>
                Keep seminar
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={() => void archiveSeminar()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger px-4 font-body-sm-medium text-body-sm-medium text-white disabled:opacity-60"
              >
                {archiving ? 'Archiving…' : 'Archive seminar'}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'registrations' && (
        <section
          id="panel-registrations"
          role="tabpanel"
          aria-labelledby="tab-registrations"
          className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg"
        >
          <div className="flex flex-wrap items-end justify-between gap-space-sm">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Registrations</h2>
              <p className="mt-1 font-body-sm text-body-sm tabular-nums text-text-secondary">
                {attendance.registered} active registrations · capacity {seminar.capacity}
              </p>
            </div>
            <ExportMenu
              label="Export visible"
              disabled={!filteredRows.length}
              onExport={(format) => exportRegistrations(seminar, filteredRows, format)}
            />
          </div>
          <div className="grid gap-space-sm rounded-xl bg-surface-container-low p-space-md tabular-nums sm:grid-cols-3">
            <div>
              <p className="font-caption text-caption text-text-secondary">Confirmed</p>
              <p className="mt-1 font-headline-md text-headline-md text-status-available">{confirmedCount}</p>
            </div>
            <div>
              <p className="font-caption text-caption text-text-secondary">Unconfirmed</p>
              <p className="mt-1 font-headline-md text-headline-md text-on-surface">{unconfirmedCount}</p>
            </div>
            <div>
              <p className="font-caption text-caption text-text-secondary">Released</p>
              <p className="mt-1 font-headline-md text-headline-md text-danger">{releasedCount}</p>
            </div>
          </div>
          <div className="grid gap-space-md rounded-xl bg-surface-container-low p-space-md tabular-nums sm:grid-cols-3">
            <div>
              <p className="font-caption text-caption text-text-secondary">Active registrations</p>
              <p className="mt-1 font-headline-md text-headline-md text-on-surface">{attendance.registered}</p>
            </div>
            <div>
              <p className="font-caption text-caption text-text-secondary">Removed</p>
              <p className="mt-1 font-headline-md text-headline-md text-on-surface">{removedCount}</p>
            </div>
            <div>
              <p className="font-caption text-caption text-text-secondary">Seats available</p>
              <p className="mt-1 font-headline-md text-headline-md text-primary">
                {Math.max(0, seminar.capacity - seminar.registeredCount)}
              </p>
            </div>
          </div>
          {seminar.registrationClosed && (
            <aside role="status" className="flex items-start gap-space-sm rounded-xl bg-surface-container-highest p-space-md">
              <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-secondary" />
              <p className="font-body-sm text-body-sm text-text-secondary">
                Registration for this seminar is closed. Existing records are still available for review.
              </p>
            </aside>
          )}
          <div className="flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
            <form role="search" onSubmit={(event) => event.preventDefault()} className="relative min-w-0 flex-1 lg:max-w-md">
              <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                aria-label="Search registrations"
                type="search"
                value={rosterQuery}
                onChange={(event) => setRosterQuery(event.target.value)}
                placeholder="Search name, student ID, email, or program…"
                className="h-12 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest pl-10 pr-3 font-body-sm text-body-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </form>
            <div
              role="group"
              aria-label="Filter registrations"
              className="flex items-center gap-1 overflow-x-auto rounded-xl bg-surface-container-high p-1.5"
            >
              {REGISTRATION_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={registrationFilter === item.value}
                  onClick={() => setRegistrationFilter(item.value)}
                  className={`min-h-11 shrink-0 rounded-xl px-space-md font-body-sm-medium text-body-sm-medium tabular-nums ${
                    registrationFilter === item.value
                      ? 'bg-surface-container-lowest text-primary shadow-sm'
                      : 'text-text-secondary hover:bg-surface-container-highest'
                  }`}
                >
                  {item.label} ({registrationCounts[item.value]})
                </button>
              ))}
            </div>
          </div>
          {roster.state.status === 'loading' && (
            <LoadingRegion label="Loading registered students">
              <Skeleton className="h-44 rounded-lg" />
            </LoadingRegion>
          )}
          {roster.state.status === 'error' && (
            <StateMessage role="alert" icon="info" title="Roster could not be loaded" action={<RetryButton onClick={roster.reload} />}>
              Registration details are temporarily unavailable.
            </StateMessage>
          )}
          {roster.state.status === 'empty' && (
            <StateMessage icon="group_off" title="No registrations yet">
              Student registrations will appear here.
            </StateMessage>
          )}
          {roster.state.status === 'success' &&
            (filteredRows.length ? (
              <>
                <p className="font-caption text-caption tabular-nums text-text-secondary">
                  Showing {filteredRows.length} of {activeRows.length} registration records
                </p>
                <RegistrationRows rows={filteredRows} ledger={ledgerEntries} />
              </>
            ) : (
              <StateMessage icon="search_off" title="No registrations match these filters">
                Try a different search or status.
              </StateMessage>
            ))}
        </section>
      )}

      {activeTab === 'attendance' && (
        <div id="panel-attendance" role="tabpanel" aria-labelledby="tab-attendance" className="flex flex-col gap-space-lg">
          <section
            className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg"
            aria-labelledby="attendance-summary"
          >
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div>
                <h2 id="attendance-summary" className="font-headline-sm text-headline-sm text-on-surface">
                  Attendance &amp; scanner
                </h2>
              </div>
              {seminar.seminarType !== 'webinar' && (
                <Link to={`/org/my-seminars/${seminar.id}/scanner`} className={actionPrimary}>
                  <Icon name="qr_code_scanner" size={18} />
                  Open scanner
                </Link>
              )}
            </div>
            <div className="grid divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface-card tabular-nums sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
              <article className="p-space-md">
                <p className="font-caption text-caption text-text-secondary">Timed in</p>
                <p className="mt-1 font-headline-md text-headline-md text-on-surface">
                  {attendance.timeIn}
                  <span className="font-body-sm text-body-sm text-text-secondary"> / {attendance.registered}</span>
                </p>
                <p className="font-caption text-caption text-text-secondary">
                  {attendance.registered ? Math.round((attendance.timeIn / attendance.registered) * 100) : 0}% of registered
                </p>
              </article>
              <article className="p-space-md">
                <p className="font-caption text-caption text-text-secondary">Timed out</p>
                <p className="mt-1 font-headline-md text-headline-md text-on-surface">{attendance.completed}</p>
                <p className="font-caption text-caption text-text-secondary">Recorded check-outs</p>
              </article>
              <article className="p-space-md">
                <p className="font-caption text-caption text-status-available">Meets minimum attendance</p>
                <p className="mt-1 font-headline-md text-headline-md text-status-available">{attendance.meets} students</p>
                <p className="font-caption text-caption text-text-secondary">
                  Requirement: {seminar.requiredAttendancePercent}% · {attendance.required} minutes
                </p>
              </article>
            </div>
            <ProgressBar
              value={attendance.timeIn}
              max={attendance.registered}
              label={`${attendance.timeIn} of ${attendance.registered} registered students have a time-in record`}
            />
          </section>

          {seminar.seminarType === 'webinar' && (
            <WebinarProofReview seminarId={seminar.id} roster={attendees} onReviewed={() => ledger.reload()} />
          )}

          <div className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section
            className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg"
            aria-labelledby="attendance-roster-heading"
          >
            <div className="flex flex-wrap items-end justify-between gap-space-sm">
              <div>
                <h2 id="attendance-roster-heading" className="font-headline-sm text-headline-sm text-on-surface">
                  Attendance verification
                </h2>
                <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
                  Attendance time is calculated from saved time-in and time-out ledger entries.
                </p>
              </div>
              <span className="rounded-lg bg-surface-container-low px-3 py-1 font-label-sm text-label-sm tabular-nums text-text-secondary">
                Minimum: {seminar.requiredAttendancePercent}%
              </span>
            </div>
            {roster.state.status === 'success' && roster.state.data.filter((student) => !student.removal).length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-surface-container-low font-caption text-caption text-text-secondary">
                    <tr>
                      <th className="px-space-md py-space-md">Participant</th>
                      <th className="px-space-md py-space-md">Time-in/out</th>
                      <th className="px-space-md py-space-md">Attendance time</th>
                      <th className="px-space-md py-space-md">Requirement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {attendance.rows.slice(0, 100).map(({ student, minutes }) => {
                      const duration = Math.max(1, (Date.parse(seminar.endsAt) - Date.parse(seminar.startsAt)) / 60000);
                      const percent = Math.min(100, Math.round((minutes / duration) * 100));
                      const last = ledgerEntries
                        .filter((entry) => entry.studentId === student.studentId && entry.kind !== 'correction')
                        .sort((a, b) => b.at.localeCompare(a.at))[0];
                      const qualifies = minutes >= attendance.required;
                      return (
                        <tr key={student.id}>
                          <td className="px-space-md py-space-md">
                            <p className="font-body-sm-medium text-body-sm-medium text-on-surface">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="font-caption text-caption tabular-nums text-text-secondary">{student.studentId}</p>
                          </td>
                          <td className="px-space-md py-space-md">
                            <span
                              className={`inline-flex items-center gap-1.5 font-label-sm text-label-sm ${
                                last ? 'text-status-available' : 'text-text-secondary'
                              }`}
                            >
                              <Icon name={last?.kind === 'time_out' ? 'check_circle' : 'schedule'} size={16} />
                              {last?.kind === 'time_out'
                                ? 'Time-out recorded'
                                : last?.kind === 'time_in'
                                  ? 'Time-in recorded'
                                  : 'No scan yet'}
                            </span>
                          </td>
                          <td className="px-space-md py-space-md tabular-nums">
                            <p className="font-body-sm-medium text-body-sm-medium text-on-surface">
                              {Math.floor(minutes / 60)}h {minutes % 60}m
                            </p>
                            <div className="mt-1 w-40">
                              <ProgressBar
                                value={percent}
                                max={100}
                                label={`${percent}% attendance for ${student.firstName} ${student.lastName}`}
                              />
                            </div>
                          </td>
                          <td className="px-space-md py-space-md">
                            <span
                              className={`rounded-md px-2.5 py-1 font-label-sm text-label-sm ${
                                qualifies
                                  ? 'bg-status-available-container text-status-available'
                                  : 'bg-surface-container-high text-text-secondary'
                              }`}
                            >
                              {qualifies ? 'Attendance met' : 'Below threshold'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : roster.state.status === 'loading' ? (
              <LoadingRegion label="Loading attendance roster">
                <Skeleton className="h-40 rounded-lg" />
              </LoadingRegion>
            ) : (
              <StateMessage icon="group_off" title="No attendance roster available">
                Registered participants will appear here.
              </StateMessage>
            )}
          </section>

          <section
            className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg"
            aria-labelledby="ledger-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="ledger-heading" className="font-headline-sm text-headline-sm text-on-surface">
                  Collegiate attendance ledger
                </h2>
                <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
                  Saved check-in, check-out, correction, and sync details for this seminar.
                </p>
              </div>
              {seminar.seminarType !== 'webinar' && (
                <Link to={`/org/my-seminars/${seminar.id}/scanner`} className={actionTonal}>
                  <Icon name="qr_code_scanner" size={18} />
                  Launch scanner
                </Link>
              )}
            </div>
            {ledger.state.status === 'loading' && (
              <LoadingRegion label="Loading attendance ledger">
                <Skeleton className="h-36 rounded-lg" />
              </LoadingRegion>
            )}
            {ledger.state.status === 'error' && (
              <StateMessage
                role="alert"
                icon="sync_problem"
                title="Attendance ledger could not be loaded"
                action={<RetryButton onClick={ledger.reload} />}
              >
                Try again when connected.
              </StateMessage>
            )}
            {ledger.state.status === 'empty' && (
              <StateMessage icon="fact_check" title="No attendance scans recorded">
                Use the scanner to record student time-in and time-out events.
              </StateMessage>
            )}
            {ledger.state.status === 'success' && (
              <div className="flex flex-col gap-space-sm">
                {ledger.state.data.slice(0, 100).map((entry) => (
                  <article
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md"
                  >
                    <div className="min-w-0">
                      <p className="font-body-sm-medium text-body-sm-medium tabular-nums text-on-surface">
                        {entry.studentId} · <span className="capitalize">{entry.kind.replace('_', ' ')}</span>
                      </p>
                      <p className="mt-1 font-caption text-caption tabular-nums text-text-secondary">
                        {dateTime(entry.at)} · {entry.method}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-status-available">
                      <Icon name="verified" size={16} />
                      Recorded
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
          </div>
        </div>
      )}

      {activeTab === 'evaluation' && (
        <div id="panel-evaluation" role="tabpanel" aria-labelledby="tab-evaluation" className="flex flex-col gap-space-lg">
          <section className="flex flex-col gap-space-md rounded-2xl border border-border-subtle bg-surface-card p-space-lg">
            <div className="flex flex-wrap items-end justify-between gap-space-md">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Evaluation overview</h2>
                <p className="mt-1 max-w-2xl font-body-sm text-body-sm text-text-secondary">
                  Anonymous responses and question summaries for this seminar.
                </p>
              </div>
              <div className="flex gap-space-sm">
                <ExportMenu
                  label="Export responses"
                  disabled={evaluationData.state.status !== 'success' || !evaluationTotalCount}
                  onExport={(format) =>
                    evaluationData.state.status === 'success' && void exportEvaluationResponses(seminar, id, format)
                  }
                />
                <button
                  type="button"
                  disabled={editing || status === 'finished' || status === 'cancelled'}
                  onClick={() => void openEditor()}
                  className={actionPrimary}
                >
                  <Icon name="edit" size={18} />
                  Edit evaluation
                </button>
              </div>
            </div>
            {evaluationData.state.status === 'loading' && (
              <LoadingRegion label="Loading evaluation data">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-52 rounded-xl" />
              </LoadingRegion>
            )}
            {evaluationData.state.status === 'error' && (
              <StateMessage
                role="alert"
                icon="sync_problem"
                title="Evaluation data could not be loaded"
                action={<RetryButton onClick={evaluationData.reload} />}
              >
                Reconnect and try again.
              </StateMessage>
            )}
            {evaluationData.state.status === 'success' && (
              <>
                <div className="grid divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface-card tabular-nums sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                  <article className="p-space-md">
                    <p className="font-caption text-caption text-text-secondary">Responses submitted</p>
                    <p className="mt-1 font-headline-md text-headline-md text-primary">{evaluationTotalCount}</p>
                  </article>
                  <article className="p-space-md">
                    <p className="font-caption text-caption text-text-secondary">Questions configured</p>
                    <p className="mt-1 font-headline-md text-headline-md text-on-surface">
                      {evaluationPayload.survey?.sections.reduce((sum, section) => sum + section.questions.length, 0) ?? 0}
                    </p>
                  </article>
                  <article className="p-space-md">
                    <p className="font-caption text-caption text-text-secondary">Completion rate</p>
                    <p className="mt-1 font-headline-md text-headline-md text-on-surface">
                      {currentEvaluationAggregate?.completionRate ?? 0}%
                    </p>
                    <p className="font-caption text-caption text-text-secondary">
                      {currentEvaluationAggregate?.responseCount ?? 0} responses from {currentEvaluationAggregate?.eligibleCount ?? 0} eligible participants
                    </p>
                  </article>
                </div>
                <div className="flex w-fit gap-1 rounded-xl bg-surface-container-high p-1.5" role="group" aria-label="Evaluation views">
                  <button
                    type="button"
                    aria-pressed={evaluationView === 'overview'}
                    onClick={() => setEvaluationView('overview')}
                    className={`min-h-10 rounded-lg px-space-md font-body-sm-medium text-body-sm-medium ${
                      evaluationView === 'overview' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-text-secondary'
                    }`}
                  >
                    Analytics overview
                  </button>
                  <button
                    type="button"
                    aria-pressed={evaluationView === 'responses'}
                    onClick={() => setEvaluationView('responses')}
                    className={`min-h-10 rounded-lg px-space-md font-body-sm-medium text-body-sm-medium tabular-nums ${
                      evaluationView === 'responses' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-text-secondary'
                    }`}
                  >
                    Submission list ({evaluationTotalCount})
                  </button>
                </div>
                {!evaluationPayload.survey ? (
                  <StateMessage icon="rate_review" title="No evaluation form configured">
                    Use Edit evaluation to add a survey in the seminar editor.
                  </StateMessage>
                ) : evaluationView === 'overview' ? (
                  <div className="grid gap-space-md xl:grid-cols-2">
                    <article className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg">
                      <div>
                        <h3 className="font-title-md text-title-md text-on-surface">{evaluationPayload.survey.title}</h3>
                        <p className="mt-1 font-body-sm text-body-sm text-text-secondary">
                          {evaluationPayload.survey.instructions || 'No additional instructions.'}
                        </p>
                      </div>
                      {evaluationPayload.survey.sections.map((section) => (
                        <div key={section.id} className="border-t border-border-subtle pt-space-md">
                          <h4 className="font-body-sm-medium text-body-sm-medium text-on-surface">{section.title}</h4>
                          <ol className="mt-space-sm flex flex-col gap-space-sm">
                            {section.questions.map((question, index) => {
                              const questionAggregate = currentEvaluationAggregate?.questions.find(
                                (item) => item.questionId === question.id,
                              );
                              const answerCount = questionAggregate?.responseCount ?? 0;
                              const average = questionAggregate?.mean ?? null;
                              const options = 'options' in question ? question.options : [];
                              const distribution = questionAggregate?.distribution ?? [];
                              const comments = questionAggregate?.comments ?? [];
                              return (
                                <li key={question.id} className="rounded-xl bg-surface-container-low p-space-md">
                                  <div className="flex items-start justify-between gap-space-sm">
                                    <div>
                                      <p className="font-body-sm-medium text-body-sm-medium text-on-surface">
                                        {index + 1}. <FormattedText text={question.prompt} />
                                      </p>
                                      <p className="mt-1 font-caption text-caption tabular-nums text-text-secondary">
                                        {question.type} · {answerCount} responses
                                      </p>
                                    </div>
                                    {average !== null && (
                                      <span className="rounded-lg bg-surface-card px-2.5 py-1 font-label-sm text-label-sm tabular-nums text-primary">
                                        Average {average.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                  {options.length > 0 && (
                                    <div className="mt-space-sm flex flex-col gap-2">
                                      {distribution.map((option) => {
                                        const count = option.count;
                                        const percent = option.percent;
                                        return (
                                          <div key={option.value}>
                                            <div className="mb-1 flex justify-between gap-2 font-caption text-caption tabular-nums text-text-secondary">
                                              <span>{option.label}</span>
                                              <span>
                                                {count} · {percent}%
                                              </span>
                                            </div>
                                            <ProgressBar
                                              value={count}
                                              max={Math.max(answerCount, 1)}
                                              label={`${option.label}: ${count} responses`}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {question.type === 'paragraph' && comments.length > 0 && (
                                    <ul className="mt-space-sm flex flex-col gap-2">
                                      {comments.map((answer, i) => (
                                        <li
                                          key={`${question.id}-${i}`}
                                          className="rounded-lg bg-surface-card p-space-sm font-caption text-caption text-text-secondary"
                                        >
                                          {answer}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ))}
                    </article>
                    <aside className="flex flex-col gap-space-md">
                      <div className="rounded-xl border border-border-subtle bg-surface-card p-space-lg">
                        <div className="flex items-center gap-space-sm">
                          <Icon name="rate_review" size={22} className="text-primary" />
                          <div>
                            <h3 className="font-title-md text-title-md text-on-surface">Response status</h3>
                            <p className="font-caption text-caption text-text-secondary">
                              Survey submissions are anonymous in this view.
                            </p>
                          </div>
                        </div>
                        <p className="mt-space-md font-headline-lg text-headline-lg tabular-nums text-primary">
                          {evaluationTotalCount}
                        </p>
                        <p className="font-body-sm text-body-sm text-text-secondary">responses received</p>
                      </div>
                    </aside>
                  </div>
                ) : (
                  <section className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-lg">
                    <h3 className="font-title-md text-title-md text-on-surface">Anonymous submissions</h3>
                    {evaluationTotalCount === 0 ? (
                      <StateMessage icon="rate_review" title="No responses received">
                        Submitted evaluations will appear here.
                      </StateMessage>
                    ) : (
                      evaluationResponses.map((response) => {
                        const responseSurvey = evaluationPayload.surveyVersions.find(
                          (survey) => survey.id === response.surveyId && survey.version === response.surveyVersion,
                        );
                        const questions = responseSurvey?.sections.flatMap((section) => section.questions) ?? [];
                        return (
                          <article key={response.id} className="rounded-xl bg-surface-container-low p-space-md">
                            <div className="mb-space-sm">
                              <span className="rounded-md bg-surface-card px-2.5 py-1 font-label-sm text-label-sm text-text-secondary">
                                Anonymous response
                              </span>
                            </div>
                            <dl className="grid gap-space-sm sm:grid-cols-2">
                              {questions.map((question) => (
                                <div key={question.id} className="rounded-lg bg-surface-card p-space-sm">
                                  <dt className="font-caption text-caption text-text-secondary">
                                    <FormattedText text={question.prompt} />
                                  </dt>
                                  <dd className="mt-1 font-body-sm text-body-sm text-on-surface">
                                    {response.answers[question.id] || 'No response'}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </article>
                        );
                      })
                    )}
                    <p role="status" aria-live="polite" className="font-caption text-caption tabular-nums text-text-secondary">
                      Showing {evaluationResponses.length} of {evaluationTotalCount} responses.
                    </p>
                    {extraEvaluationResponses?.error && (
                      <p role="alert" className="font-body-sm text-body-sm text-danger">
                        Responses could not be loaded. Try again.
                      </p>
                    )}
                    {evaluationCursor && (
                      <button
                        type="button"
                        disabled={loadingMoreEvaluationResponses}
                        onClick={() => void loadMoreEvaluationResponses()}
                        className={actionTonal}
                      >
                        {loadingMoreEvaluationResponses ? 'Loading responses...' : 'Load more responses'}
                      </button>
                    )}
                  </section>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div id="panel-certificates" role="tabpanel" aria-labelledby="tab-certificates" className="flex flex-col gap-space-lg">
          <section className="flex flex-col gap-space-md rounded-2xl border border-border-subtle bg-surface-card p-space-lg">
            <div className="flex flex-wrap items-end justify-between gap-space-md">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Certificate eligibility &amp; issuance</h2>
                <p className="mt-1 max-w-2xl font-body-sm text-body-sm text-text-secondary">
                  Eligibility records are based on the seminar’s attendance and evaluation requirements.
                </p>
              </div>
              <ExportMenu
                label="Export eligibility"
                disabled={
                  certificateData.state.status !== 'success' ||
                  !certificateData.state.data.records.length ||
                  roster.state.status !== 'success'
                }
                onExport={(format) =>
                  certificateData.state.status === 'success' &&
                  roster.state.status === 'success' &&
                  exportCertificateRecords(seminar, certificateData.state.data, roster.state.data, format)
                }
              />
            </div>
            {certificateData.state.status === 'loading' && (
              <LoadingRegion label="Loading certificate records">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-52 rounded-xl" />
              </LoadingRegion>
            )}
            {certificateData.state.status === 'error' && (
              <StateMessage
                role="alert"
                icon="sync_problem"
                title="Certificate records could not be loaded"
                action={<RetryButton onClick={certificateData.reload} />}
              >
                Reconnect and try again.
              </StateMessage>
            )}
            {certificateData.state.status === 'success' && (
              <>
                <div className="grid divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface-card tabular-nums sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
                  <article className="p-space-md">
                    <p className="font-caption text-caption text-text-secondary">Issued</p>
                    <p className="mt-1 font-headline-md text-headline-md text-status-available">
                      {certificateData.state.data.records.filter((record) => record.state === 'issued').length}
                    </p>
                  </article>
                  <article className="p-space-md">
                    <p className="font-caption text-caption text-text-secondary">Waiting</p>
                    <p className="mt-1 font-headline-md text-headline-md text-secondary">
                      {certificateData.state.data.records.filter((record) => record.state === 'waiting').length}
                    </p>
                  </article>
                  <article className="p-space-md">
                    <p className="font-caption text-caption text-text-secondary">Blocked</p>
                    <p className="mt-1 font-headline-md text-headline-md text-danger">
                      {certificateData.state.data.records.filter((record) => record.state === 'blocked').length}
                    </p>
                  </article>
                </div>
                {certificateData.state.data.template && (
                  <div className="grid items-center gap-space-md rounded-xl bg-surface-container-low p-space-md sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <p className="font-body-sm-medium text-body-sm-medium text-on-surface">Certificate template configured</p>
                      <p className="mt-1 font-caption text-caption tabular-nums text-text-secondary">
                        Last updated{' '}
                        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                          new Date(certificateData.state.data.template.updatedAt),
                        )}
                        . The student name uses the saved template position.
                      </p>
                    </div>
                    <span className="rounded-lg bg-status-available-container px-3 py-1.5 font-label-sm text-label-sm text-status-available">
                      Template ready
                    </span>
                  </div>
                )}
                {certificateDownloadError && (
                  <p role="alert" className="font-body-sm text-body-sm text-danger">
                    Certificate download failed. Reconnect and try again.
                  </p>
                )}
                <div className="overflow-x-auto rounded-xl border border-border-subtle">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-surface-container-low font-caption text-caption text-text-secondary">
                      <tr>
                        <th className="px-space-md py-space-md">Student</th>
                        <th className="px-space-md py-space-md">Attendance</th>
                        <th className="px-space-md py-space-md">Certificate status</th>
                        <th className="px-space-md py-space-md">Record details</th>
                        <th className="px-space-md py-space-md">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {certificateData.state.data.records.map((record) => {
                        const student = attendees.find((row) => row.studentId === record.studentId);
                        const name = student ? `${student.firstName} ${student.lastName}` : 'Participant';
                        const minutes = attendance.rows.find((row) => row.student.studentId === record.studentId)?.minutes ?? 0;
                        const duration = Math.max(1, (Date.parse(seminar.endsAt) - Date.parse(seminar.startsAt)) / 60000);
                        const percent = Math.min(100, Math.round((minutes / duration) * 100));
                        return (
                          <tr key={record.id}>
                            <td className="px-space-md py-space-md">
                              <p className="font-body-sm-medium text-body-sm-medium text-on-surface">{name}</p>
                              <p className="font-caption text-caption tabular-nums text-text-secondary">{record.studentId}</p>
                            </td>
                            <td className="px-space-md py-space-md">
                              <div className="w-36">
                                <p className="mb-1 font-caption text-caption tabular-nums text-text-secondary">
                                  {percent}% / {seminar.requiredAttendancePercent}%
                                </p>
                                <ProgressBar value={percent} max={100} label={`${percent}% attendance for ${name}`} />
                              </div>
                            </td>
                            <td className="px-space-md py-space-md">
                              <span
                                className={`rounded-md px-2.5 py-1 font-label-sm text-label-sm ${
                                  record.state === 'issued'
                                    ? 'bg-status-available-container text-status-available'
                                    : record.state === 'blocked'
                                      ? 'bg-danger-surface text-danger'
                                      : 'bg-surface-container-high text-text-secondary'
                                }`}
                              >
                                {record.state === 'issued' ? 'Issued' : record.state === 'blocked' ? 'Blocked' : 'Waiting'}
                              </span>
                            </td>
                            <td className="max-w-sm px-space-md py-space-md">
                              <p className="font-caption text-caption text-text-secondary">{record.reason}</p>
                              {record.serial && (
                                <p className="mt-1 font-mono text-caption tabular-nums text-text-secondary">{record.serial}</p>
                              )}
                              {record.issuedAt && (
                                <p className="mt-1 font-caption text-caption tabular-nums text-text-secondary">
                                  {dateTime(record.issuedAt)}
                                </p>
                              )}
                            </td>
                            <td className="px-space-md py-space-md">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    record.state !== 'issued' ||
                                    downloadingCertificateId !== null ||
                                    regeneratingCertificateId !== null
                                  }
                                  onClick={() => void downloadCertificate(record)}
                                  title={
                                    record.state === 'issued' ? 'Download this issued certificate' : 'Certificate is not issued yet.'
                                  }
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-outline-variant/50 px-3 font-label-sm text-label-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Icon name="download" size={16} />
                                  {downloadingCertificateId === record.id ? 'Downloading…' : 'Download certificate'}
                                </button>
                                {record.state === 'issued' && (
                                  <button
                                    type="button"
                                    disabled={regeneratingCertificateId !== null || downloadingCertificateId !== null}
                                    onClick={(event) => {
                                      regenerationTriggerRef.current = event.currentTarget;
                                      setRegenerationResult(null);
                                      setRegenerationTarget(record);
                                    }}
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-outline-variant/50 px-3 font-label-sm text-label-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Icon name="refresh" size={16} />
                                    Regenerate certificate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {certificateData.state.data.records.length === 0 && (
                  <StateMessage icon="workspace_premium" title="No certificate records yet">
                    Eligibility and issue records will appear when this seminar reaches its certificate release stage.
                  </StateMessage>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {regenerationTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-space-md"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && regeneratingCertificateId === null) setRegenerationTarget(null);
            if (event.key === 'Tab') {
              const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
              const first = buttons[0];
              const last = buttons.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="certificate-regeneration-heading"
            aria-describedby="certificate-regeneration-description"
            className="w-full max-w-lg rounded-2xl bg-surface-card p-space-lg shadow-overlay"
          >
            <h2 id="certificate-regeneration-heading" className="font-title-md text-title-md text-on-surface">
              Replace this issued certificate?
            </h2>
            <p id="certificate-regeneration-description" className="mt-space-sm font-body-sm text-body-sm text-text-secondary">
              A new PDF will be generated for student <span className="tabular-nums">{regenerationTarget.studentId}</span>. The certificate serial will stay the same.
            </p>
            <div className="mt-space-lg flex justify-end gap-space-sm">
              <button
                type="button"
                disabled={regeneratingCertificateId !== null}
                onClick={() => setRegenerationTarget(null)}
                className={actionTonal}
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                disabled={regeneratingCertificateId !== null}
                onClick={() => void regenerateCertificate()}
                className={actionPrimary}
              >
                {regeneratingCertificateId === regenerationTarget.id ? 'Regenerating…' : 'Replace certificate'}
              </button>
            </div>
          </section>
        </div>
      )}

      {regenerationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-space-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-regeneration-result-heading"
            className="w-full max-w-lg rounded-2xl bg-surface-card p-space-lg shadow-overlay"
          >
            <h2 id="certificate-regeneration-result-heading" className="font-title-md text-title-md text-on-surface">
              {regenerationResult === 'success' ? 'Certificate replaced' : 'Certificate replacement failed'}
            </h2>
            <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">
              {regenerationResult === 'success'
                ? 'The new PDF is ready. The existing certificate serial is unchanged.'
                : 'The current certificate is still available. Reconnect and try again.'}
            </p>
            <div className="mt-space-lg flex justify-end">
              <button type="button" autoFocus onClick={() => setRegenerationResult(null)} className={actionPrimary}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
