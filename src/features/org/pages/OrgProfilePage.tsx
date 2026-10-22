import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type OrgIdentity } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { WorkspaceSwitcher } from '../../../components/shell/org/WorkspaceSwitcher';
import { Avatar } from '../../../components/ui/Avatar';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { useOrgIdentity } from '../../../session/OrgIdentityProvider';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-1"><dt className="font-caption text-caption text-text-secondary">{label}</dt><dd className="font-body-sm-medium text-body-sm-medium text-on-surface">{children}</dd></div>;
}

function ProfileSections({ identity }: { identity: OrgIdentity }) {
  const appointed = identity.membership?.appointedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(identity.membership.appointedAt))
    : null;
  return (
    <>
      <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="credentials-heading">
        <div className="flex items-center gap-space-sm"><Icon name="verified_user" size={20} className="text-primary" /><h2 id="credentials-heading" className="font-title-lg text-title-lg text-on-surface">Registrar institutional records</h2></div>
        <p className="font-body-sm text-body-sm text-text-secondary">These account identifiers are supplied by your approved organization access.</p>
        <dl className="grid gap-space-lg border-t border-border-subtle pt-space-md sm:grid-cols-2">
          {identity.studentId && <Detail label="Student ID">{identity.studentId}</Detail>}
          <Detail label="Institutional email">{identity.email}</Detail>
          <Detail label="College">{identity.organization.department}</Detail>
          <Detail label="Organization">{identity.organization.name}</Detail>
        </dl>
      </section>

      <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="appointment-heading">
        <div className="flex items-center gap-space-sm"><Icon name="assignment_ind" size={20} className="text-primary" /><h2 id="appointment-heading" className="font-title-lg text-title-lg text-on-surface">Collegiate organization appointment</h2></div>
        <div className="flex flex-col gap-space-md rounded-lg bg-surface-container-low p-space-md sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{identity.position}</p><p className="mt-1 font-caption text-caption text-text-secondary">{identity.organization.name}</p></div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-status-available-container px-3 py-1 font-caption text-caption text-status-available"><Icon name="check_circle" size={16} />Active appointment</span>
        </div>
        <dl className="grid gap-space-lg sm:grid-cols-2"><Detail label="Faculty adviser">{identity.adviser.title}</Detail><Detail label="Appointed since">{appointed ?? 'Appointment on record'}</Detail><Detail label="Appointment status">{identity.membership?.status ?? 'Active'}</Detail><Detail label="Official access">Seminar and attendance management</Detail></dl>
        {identity.membership?.appointmentLetterUrl && <a href={identity.membership.appointmentLetterUrl} target="_blank" rel="noreferrer" className={actionTonal}><Icon name="description" size={18} />View appointment letter</a>}
      </section>

      <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card lg:col-span-2" aria-labelledby="workspace-heading">
        <div className="flex items-center gap-space-sm"><Icon name="swap_horiz" size={20} className="text-primary" /><h2 id="workspace-heading" className="font-title-lg text-title-lg text-on-surface">Active workspace</h2></div>
        <p className="font-body-sm text-body-sm text-text-secondary">Switch between organization tools and your participant portal. Your account credentials remain the same.</p>
        <div className="max-w-sm"><WorkspaceSwitcher identity={identity} variant="menu" /></div>
      </section>
    </>
  );
}

export default function OrgProfilePage() {
  const { state } = useOrgIdentity();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => { document.title = 'Organization profile - Seminex'; }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await api.signOut();
    setSigningOut(false);
    navigate('/organization/sign-in', { replace: true });
  }

  if (state.status === 'loading') return <PageContainer><div role="status" className="rounded-xl border border-border-subtle bg-surface-card p-space-xl">Loading your organization credentials…</div></PageContainer>;
  if (state.status === 'error') return <PageContainer><div role="alert" className="rounded-xl border border-danger-soft bg-danger-surface p-space-lg text-danger-ink">Your organization profile could not be loaded. Please refresh and try again.</div></PageContainer>;
  if (state.status === 'empty') return <PageContainer><div role="status" className="rounded-xl border border-border-subtle bg-surface-card p-space-xl">No organization profile is available for this account.</div></PageContainer>;

  const identity = state.data;
  const initials = `${identity.firstName[0] ?? ''}${identity.lastName[0] ?? ''}`.toUpperCase();

  return (
    <PageContainer>
      <header className="flex flex-col gap-space-xs">
        <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Workspace / Organization</p>
        <h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Organization Profile</h1>
        <p className="max-w-3xl font-body-base text-body-base text-text-secondary">Manage your institutional profile, collegiate officer credentials, and active workspace preferences.</p>
      </header>

      <section className="relative flex flex-col items-center gap-space-md overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-space-lg pt-space-xl text-center shadow-card sm:p-space-xl">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2 bg-primary" />
        <Avatar src={identity.avatarUrl} firstName={identity.firstName} lastName={identity.lastName} size="xl" />
        <div><h2 className="font-headline-lg text-headline-lg text-on-surface">{identity.firstName} {identity.lastName}</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Institutional officer · {identity.organization.department}</p></div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm-medium text-body-sm-medium text-on-surface"><Icon name="badge" size={18} />{initials} · {identity.studentId ?? identity.email}</div>
        <p className="rounded-lg bg-surface-light px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary">{identity.position} · {identity.organization.name}</p>
      </section>

      <div className="grid gap-space-lg lg:grid-cols-2"><ProfileSections identity={identity} /></div>

      <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card sm:flex-row sm:items-center sm:justify-between" aria-labelledby="signout-heading">
        <div><h2 id="signout-heading" className="font-body-base-medium text-body-base-medium text-on-surface">Session authentication & security</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">End this session and remove organization data saved on this device.</p></div>
        <button type="button" onClick={() => setConfirming(true)} className={actionPrimary}><Icon name="logout" size={18} />Sign out</button>
      </section>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Sign out of Seminex?">
        <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">Your session and offline organization cache will be cleared from this device.</p>
        <div className="mt-space-lg flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end"><button type="button" onClick={() => setConfirming(false)} className={actionTonal}>Cancel</button><button type="button" onClick={() => void signOut()} disabled={signingOut} className={actionPrimary}>{signingOut ? 'Signing out…' : 'Sign out'}</button></div>
      </Dialog>
    </PageContainer>
  );
}
