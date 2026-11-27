import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, type OrgAccessStatusResult } from '../../../api/client';
import { BrandMark } from '../../../components/shell/BrandMark';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import type { IconName } from '../../../components/ui/icons';
import { InlineError, LoadingRegion, Skeleton } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';
import { useSession } from '../../../session/useSession';

function dateLabel(value?: string): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const STATUS_DETAILS: Record<
  OrgAccessStatusResult['status'],
  { title: string; description: string; icon: IconName; tone: string }
> = {
  pending: {
    title: 'Officer Request Pending Adviser Review',
    description:
      'Your request is in the review queue. Participant portal access remains available while the adviser reviews your appointment.',
    icon: 'schedule',
    tone: 'border-warning-soft bg-warning-surface text-warning-ink',
  },
  approved: {
    title: 'Officer Access Approved',
    description: 'Your appointment is approved. You can now enter the organization workspace.',
    icon: 'verified',
    tone: 'border-status-available/30 bg-status-available-container text-status-available',
  },
  rejected: {
    title: 'Officer Request Not Approved',
    description:
      'Your request was reviewed. Read the adviser’s note below, then contact the adviser or submit a new request.',
    icon: 'close',
    tone: 'border-danger-soft bg-danger-surface text-danger-ink',
  },
  removed: {
    title: 'Organization Officer Access Concluded',
    description:
      'Your organization appointment has ended or been removed. Standard participant access is still available.',
    icon: 'archive',
    tone: 'border-border-subtle bg-surface-container-low text-on-surface',
  },
  none: {
    title: 'No Officer Request Found',
    description: 'You can request access to a recognized student organization when you are ready.',
    icon: 'info',
    tone: 'border-border-subtle bg-surface-card text-on-surface',
  },
};

export default function OrganizationRequestStatusPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, reload } = useResource(
    () => api.getMyOrgAccessStatus(),
    `my-org-access-${session?.studentId ?? ''}`,
  );
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Organization request status - Seminex';
  }, []);

  if (session?.role === 'adviser') return <Navigate to="/org/adviser" replace />;
  if (session?.role === 'org_member') return <Navigate to="/org" replace />;

  async function withdraw() {
    setWorking(true);
    setActionError(null);
    const result = await api.withdrawMyOrgRequest();
    setWorking(false);
    setConfirmWithdrawOpen(false);
    if (result.ok) {
      reload();
    } else {
      setActionError(
        result.error.code === 'network'
          ? 'The request could not be withdrawn while offline. Try again.'
          : 'The request could not be withdrawn. Refresh the status and try again.',
      );
    }
  }

  const data: OrgAccessStatusResult =
    state.status === 'success'
      ? state.data
      : { status: 'none', request: null, organization: null, membership: null, adviser: null };
  const details = STATUS_DETAILS[data.status];
  const organization = data.organization?.name ?? 'CCS Student Council';
  const position = data.request?.position ?? data.membership?.position ?? 'Officer';
  const submitted = (location.state as { submitted?: unknown } | null)?.submitted === true;

  return (
    <div className="min-h-dvh bg-surface-light">
      <header className="border-b border-border-subtle bg-surface-card">
        <div className="flex min-h-16 w-full items-center justify-between px-gutter md:px-margin">
          <Link to="/" className="flex items-center gap-3">
            <BrandMark size={36} />
            <span>
              <strong className="block font-heading text-base text-on-surface">Seminex CCS</strong>
              <small className="text-xs text-text-secondary">Organization access center</small>
            </span>
          </Link>
          <Link
            to="/home"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-charcoal-700 hover:text-maroon"
          >
            <Icon name="arrow_back" size={16} />
            Participant portal
          </Link>
        </div>
      </header>

      <main className="w-full px-gutter py-space-xl md:px-margin">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-on-surface">
              Organization Access Status
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Check adviser review, appointment details, and access to your organization workspace.
            </p>
          </div>
          {data && (
            <Button
              variant="secondary"
              disabled={state.status === 'loading'}
              loading={state.status === 'loading'}
              icon={<Icon name="refresh" size={16} />}
              onClick={reload}
            >
              Refresh status
            </Button>
          )}
        </div>

        {submitted && data.status === 'pending' && (
          <div className="mb-5">
            <Alert variant="neutral" icon="check" title="Officer request submitted">
              Your request is saved in Seminex and is now pending adviser review.
            </Alert>
          </div>
        )}
        {actionError && (
          <div className="mb-5">
            <Alert variant="error" icon="warning" title="Action not completed">
              {actionError}
            </Alert>
          </div>
        )}

        {state.status === 'loading' && (
          <LoadingRegion label="Loading organization request status">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="mt-5 h-64 w-full" />
          </LoadingRegion>
        )}
        {state.status === 'error' && (
          <InlineError onRetry={reload}>The request status could not be loaded.</InlineError>
        )}
        {state.status === 'success' && (
          <>
            <section className={`rounded-2xl border p-6 sm:p-8 ${details.tone}`}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-card/80">
                    <Icon name={details.icon} size={24} />
                  </span>
                  <div>
                    <p className="font-caption text-caption font-semibold capitalize opacity-80">
                      {data.status === 'none' ? 'Status' : `Request ${data.status}`}
                    </p>
                    <h2 className="mt-1 font-heading text-xl font-bold sm:text-2xl">
                      {details.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed opacity-90">
                      {details.description}
                    </p>
                  </div>
                </div>
                <span className="self-start rounded-full bg-surface-card/80 px-3 py-1 font-caption text-caption font-semibold tabular-nums">
                  {data.request?.id ?? data.membership?.id ?? 'No reference yet'}
                </span>
              </div>

              {data.status !== 'none' && (
                <div className="mt-6 grid gap-4 border-t border-current/15 pt-5 sm:grid-cols-2">
                  <div>
                    <p className="font-caption text-caption opacity-75">Organization</p>
                    <p className="mt-1 font-semibold">{organization}</p>
                  </div>
                  <div>
                    <p className="font-caption text-caption opacity-75">Appointed role</p>
                    <p className="mt-1 font-semibold">{position}</p>
                  </div>
                  <div>
                    <p className="font-caption text-caption opacity-75">Submitted</p>
                    <p className="mt-1 font-medium tabular-nums">
                      {dateLabel(data.request?.requestedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="font-caption text-caption opacity-75">Reviewer</p>
                    <p className="mt-1 font-medium">
                      {data.adviser
                        ? `${data.adviser.firstName} ${data.adviser.lastName} · Faculty Adviser`
                        : 'CCS Faculty Adviser'}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {data.status !== 'none' && (
              <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                <section className="rounded-2xl border border-border-subtle bg-surface-card p-6 sm:p-7">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-lg font-bold text-on-surface">
                      Review lifecycle
                    </h3>
                    <span className="text-xs text-text-subtle">
                      {data.status === 'pending' ? 'Usually 1–2 work days' : 'Request record'}
                    </span>
                  </div>
                  <ol className="mt-6 space-y-0">
                    <li className="relative flex gap-4 pb-7">
                      <span className="absolute left-3.5 top-8 h-full w-px bg-status-available/30" />
                      <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-available-container text-status-available">
                        <Icon name="check" size={16} />
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">Request submitted</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          Appointment details were recorded in Seminex.
                        </p>
                        <p className="mt-1 text-xs text-text-subtle tabular-nums">
                          {dateLabel(data.request?.requestedAt)}
                        </p>
                      </div>
                    </li>

                    <li className="relative flex gap-4 pb-7">
                      <span
                        className={`absolute left-3.5 top-8 h-full w-px ${
                          data.status === 'approved' || data.status === 'removed'
                            ? 'bg-status-available/30'
                            : 'bg-border-subtle'
                        }`}
                      />
                      <span
                        className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          data.status === 'pending'
                            ? 'bg-warning-surface text-warning-ink'
                            : data.status === 'approved' || data.status === 'removed'
                              ? 'bg-status-available-container text-status-available'
                              : data.status === 'rejected'
                                ? 'bg-danger-surface text-danger-ink'
                                : 'bg-surface-container-low text-text-subtle'
                        }`}
                      >
                        {data.status === 'approved' || data.status === 'removed' ? (
                          <Icon name="check" size={16} />
                        ) : data.status === 'rejected' ? (
                          <Icon name="close" size={16} />
                        ) : (
                          <span>2</span>
                        )}
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">Faculty adviser review</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {data.status === 'pending'
                            ? 'Your appointment is under review.'
                            : data.status === 'approved' || data.status === 'removed'
                              ? `Reviewed by ${
                                  data.adviser
                                    ? `${data.adviser.firstName} ${data.adviser.lastName}`
                                    : 'the faculty adviser'
                                }.`
                              : data.status === 'rejected'
                                ? 'The adviser recorded a decision for this request.'
                                : 'Waiting for adviser review.'}
                        </p>
                        {data.request?.decidedAt && (
                          <p className="mt-1 text-xs text-text-subtle tabular-nums">
                            {dateLabel(data.request.decidedAt)}
                          </p>
                        )}
                        {data.request?.decisionNote && (
                          <blockquote className="mt-3 rounded-lg bg-danger-surface p-3 text-sm italic text-danger-ink">
                            “{data.request.decisionNote}”
                          </blockquote>
                        )}
                      </div>
                    </li>

                    <li className="flex gap-4">
                      <span
                        className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          data.status === 'approved'
                            ? 'bg-status-available-container text-status-available'
                            : data.status === 'removed'
                              ? 'bg-surface-container-low text-text-secondary'
                              : 'bg-surface-container-low text-text-subtle'
                        }`}
                      >
                        {data.status === 'approved' ? (
                          <Icon name="verified_user" size={16} />
                        ) : data.status === 'removed' ? (
                          <Icon name="archive" size={16} />
                        ) : (
                          <span>3</span>
                        )}
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">Workspace access</p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {data.status === 'approved'
                            ? 'Organization workspace access is enabled.'
                            : data.status === 'removed'
                              ? 'Officer permissions have ended; participant access remains.'
                              : 'Workspace tools unlock after approval.'}
                        </p>
                      </div>
                    </li>
                  </ol>
                </section>

                <aside className="space-y-4">
                  <section className="rounded-2xl border border-border-subtle bg-surface-card p-5">
                    <h3 className="font-heading font-bold text-on-surface">Access summary</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-text-secondary">Current privileges</span>
                        <strong className="text-right text-on-surface">
                          {data.status === 'approved' ? 'Organization officer' : 'Participant'}
                        </strong>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-text-secondary">Request status</span>
                        <strong className="capitalize text-on-surface">{data.status}</strong>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-text-secondary">Academic cycle</span>
                        <strong className="text-right text-on-surface">Current cycle</strong>
                      </div>
                    </div>
                  </section>

                  <div className="rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface">
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon name="info" size={16} className="text-primary" />
                      Notice for appointee
                    </p>
                    <p className="mt-2 text-text-secondary">
                      You can continue using the Participant Portal normally. Status updates appear
                      here when the adviser’s decision is recorded.
                    </p>
                  </div>
                </aside>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {data.status === 'pending' && (
                <Button
                  variant="secondary"
                  disabled={working}
                  icon={<Icon name="close" size={16} />}
                  onClick={() => setConfirmWithdrawOpen(true)}
                >
                  Withdraw request
                </Button>
              )}
              {data.status === 'approved' && (
                <Button
                  icon={<Icon name="arrow_forward" size={16} />}
                  onClick={() => navigate('/organization/sign-in')}
                >
                  Sign in to organization portal
                </Button>
              )}
              {(data.status === 'none' ||
                data.status === 'rejected' ||
                data.status === 'removed') && (
                <Button
                  icon={<Icon name="arrow_forward" size={16} />}
                  onClick={() => navigate('/organization/request-access')}
                >
                  {data.status === 'none'
                    ? 'Request organization access'
                    : data.status === 'removed'
                      ? 'Request re-appointment'
                      : 'Submit a new request'}
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate('/home')}>
                Continue as participant
              </Button>
            </div>
          </>
        )}
      </main>

      <Dialog
        open={confirmWithdrawOpen}
        onClose={() => {
          if (!working) setConfirmWithdrawOpen(false);
        }}
        title="Withdraw organization access request"
      >
        <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">
          Withdraw your pending organization access request? You can submit a new request later if
          needed.
        </p>
        <div className="mt-space-lg flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={working}
            onClick={() => setConfirmWithdrawOpen(false)}
          >
            Cancel
          </Button>
          <Button loading={working} loadingLabel="Withdrawing..." onClick={withdraw}>
            Confirm withdraw
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
