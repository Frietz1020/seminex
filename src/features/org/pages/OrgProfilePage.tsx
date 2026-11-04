import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type OrgIdentity } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { WorkspaceSwitcher } from '../../../components/shell/org/WorkspaceSwitcher';
import { Avatar } from '../../../components/ui/Avatar';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useUnsyncedScanCount } from '../../../hooks/useUnsyncedScanCount';
import { useOrgIdentity } from '../../../session/OrgIdentityProvider';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><dt className="font-caption text-caption text-text-secondary">{label}</dt><dd className="break-words font-body-sm-medium text-body-sm-medium text-on-surface">{children}</dd></div>;
}

function IdentityDetails({ identity }: { identity: OrgIdentity }) {
  const identityLabel = identity.role === 'adviser' ? 'Faculty adviser' : 'Organization officer';
  return <section className="flex flex-col items-center gap-space-md overflow-hidden rounded-xl border border-outline-variant/45 bg-surface-card p-space-lg text-center shadow-card sm:p-space-xl">
      <Avatar src={identity.avatarUrl} firstName={identity.firstName} lastName={identity.lastName} size="xl" />
      <div><h2 className="font-headline-lg text-headline-lg text-on-surface">{identity.firstName} {identity.lastName}</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">{identityLabel} · {identity.organization.department}</p></div>
      <div className="inline-flex max-w-full items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm-medium text-body-sm-medium text-on-surface"><Icon name="badge" size={18} /><span className="break-all">{identity.studentId ?? identity.email}</span></div>
      <span className="rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary">{identity.position} · {identity.organization.name}</span>
  </section>;
}

function InstitutionalDetails({ identity }: { identity: OrgIdentity }) {
  return (
    <section className="flex flex-col gap-space-md rounded-xl border border-outline-variant/45 bg-surface-card p-space-lg shadow-card" aria-labelledby="records-heading">
      <div className="flex items-center gap-space-sm"><Icon name="verified_user" size={20} className="text-primary" /><div><h2 id="records-heading" className="font-title-lg text-title-lg text-on-surface">Institutional identity</h2><p className="mt-0.5 font-caption text-caption text-text-secondary">Read-only details from approved organization access.</p></div></div>
      <dl className="grid gap-space-lg border-t border-outline-variant/50 pt-space-md sm:grid-cols-2">
        {identity.studentId && <Detail label="Student ID">{identity.studentId}</Detail>}
        <Detail label="Institutional email">{identity.email}</Detail>
        <Detail label="College / department">{identity.organization.department}</Detail>
        <Detail label="Organization">{identity.organization.name}</Detail>
      </dl>
      <p className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-md font-caption text-caption text-text-secondary"><Icon name="info" size={16} className="mt-0.5 shrink-0 text-primary" />Institutional and academic attributes are provisioned through the campus identity system and can’t be edited here.</p>
    </section>
  );
}

function AppointmentCard({ identity }: { identity: OrgIdentity }) {
  const appointed = identity.membership?.appointedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(identity.membership.appointedAt))
    : null;
  const active = identity.membership?.status !== 'removed';
  return <section className="flex flex-col gap-space-md rounded-xl border border-outline-variant/45 bg-surface-card p-space-lg shadow-card" aria-labelledby="appointment-heading">
    <div className="flex items-center gap-space-sm"><Icon name="assignment_ind" size={20} className="text-primary" /><div><h2 id="appointment-heading" className="font-title-lg text-title-lg text-on-surface">Organization appointment</h2><p className="mt-0.5 font-caption text-caption text-text-secondary">Approved access and adviser details.</p></div></div>
    <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-low p-space-md sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{identity.position}</p><p className="mt-1 font-caption text-caption text-text-secondary">{identity.organization.name}</p></div>
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 font-label-sm text-label-sm ${active ? 'bg-[#E8F5EC] text-[#1E6B37]' : 'bg-[#FEF2F2] text-[#BA1A1A]'}`}><Icon name={active ? 'check_circle' : 'close'} size={16} />{active ? 'Active appointment' : 'Appointment removed'}</span>
    </div>
    <dl className="grid gap-space-lg border-t border-outline-variant/50 pt-space-md sm:grid-cols-2"><Detail label="Faculty adviser">{identity.adviser.title}</Detail><Detail label="Appointed since">{appointed ?? 'Appointment on record'}</Detail><Detail label="Appointment status">{identity.membership?.status ?? 'Active'}</Detail><Detail label="Official access">Seminar and attendance management</Detail></dl>
    {identity.membership?.appointmentLetterUrl && <a href={identity.membership.appointmentLetterUrl} target="_blank" rel="noreferrer" className={`${actionTonal} w-fit`}><Icon name="description" size={18} />View appointment letter</a>}
  </section>;
}

export default function OrgProfilePage() {
  const { state } = useOrgIdentity();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const pendingCount = useUnsyncedScanCount();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  useEffect(() => { document.title = 'Organization profile - Seminex'; }, []);

  async function syncScans() {
    if (syncing || !online || pendingCount === 0) return;
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(false);
    const result = await api.syncQueuedScans();
    setSyncing(false);
    if (result.ok) setSyncMessage(`${result.data.synced} ${result.data.synced === 1 ? 'scan' : 'scans'} synced. You can sign out when ready.`);
    else setSyncError(true);
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await api.signOut();
    setSigningOut(false);
    navigate('/organization/sign-in', { replace: true });
  }

  if (state.status === 'loading') return <PageContainer><div role="status" className="rounded-xl border border-outline-variant/45 bg-surface-card p-space-xl">Loading your organization credentials…</div></PageContainer>;
  if (state.status === 'error') return <PageContainer><div role="alert" className="rounded-xl border border-danger-soft bg-danger-surface p-space-lg text-danger-ink">Your organization profile could not be loaded. Please refresh and try again.</div></PageContainer>;
  if (state.status === 'empty') return <PageContainer><div role="status" className="rounded-xl border border-outline-variant/45 bg-surface-card p-space-xl">No organization profile is available for this account.</div></PageContainer>;

  const identity = state.data;

  return <PageContainer>
    <header>
      <h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Profile</h1>
    </header>

    <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
      <div className="flex flex-col gap-space-lg lg:col-span-4">
        <IdentityDetails identity={identity} />
        <AppointmentCard identity={identity} />
      </div>
      <div className="flex flex-col gap-space-lg lg:col-span-8">
        <InstitutionalDetails identity={identity} />
        <section className="flex flex-col gap-space-md rounded-xl border border-outline-variant/45 bg-surface-card p-space-lg shadow-card" aria-labelledby="security-heading">
          <div className="flex items-center gap-space-sm"><Icon name="verified_user" size={20} className="text-primary" /><div><h2 id="security-heading" className="font-title-lg text-title-lg text-on-surface">Account &amp; security</h2><p className="mt-0.5 font-caption text-caption text-text-secondary">Switch workspace or end this session.</p></div></div>
          <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md"><p className="font-body-sm-medium text-body-sm-medium text-on-surface">Active workspace</p><p className="font-caption text-caption text-text-secondary">Your credentials stay the same when you switch portals.</p><WorkspaceSwitcher identity={identity} variant="menu" /></div>
          <div className="flex flex-col gap-space-md border-t border-outline-variant/50 pt-space-md sm:flex-row sm:items-center sm:justify-between"><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">Sign out of Seminex</p><p className="mt-1 font-caption text-caption text-text-secondary">Queued attendance scans need syncing before the local cache is cleared.</p></div><button type="button" onClick={() => { setSyncMessage(null); setSyncError(false); setConfirming(true); }} className={actionPrimary}><Icon name="logout" size={18} />Sign out</button></div>
        </section>
      </div>
    </div>

    <Dialog open={confirming} onClose={() => setConfirming(false)} title={pendingCount > 0 ? 'Sign out with unsynced scans?' : 'Sign out of Seminex?'}>
      <div className="mt-space-md flex flex-col gap-space-md">
        {pendingCount > 0 ? <div className="flex items-start gap-space-sm rounded-xl border border-outline-variant/50 bg-surface-container-low p-space-md"><Icon name={online ? 'sync' : 'cloud_off'} size={20} className="mt-0.5 shrink-0 text-secondary" /><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{pendingCount} attendance {pendingCount === 1 ? 'scan has' : 'scans have'} not synced.</p><p className="mt-1 font-caption text-caption text-text-secondary">{online ? 'Sync them before signing out to preserve the records on the server.' : 'Reconnect and sync before signing out. Signing out anyway clears the queued scans from this device.'}</p></div></div> : <p className="font-body-sm text-body-sm text-text-secondary">Signing out clears the organization session and its offline cache from this device.</p>}
        {syncMessage && <p role="status" className="rounded-lg bg-[#E8F5EC] p-space-sm font-caption text-caption text-[#1E6B37]">{syncMessage}</p>}
        {syncError && <p role="alert" className="rounded-lg bg-danger-surface p-space-sm font-caption text-caption text-danger-ink">Could not sync the queued scans. Check your connection and try again.</p>}
        <div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirming(false)} className={actionTonal}>Cancel</button>
          {pendingCount > 0 && <button type="button" onClick={() => void syncScans()} disabled={!online || syncing} className={actionTonal}><Icon name="sync" size={18} />{syncing ? 'Syncing…' : online ? 'Sync now' : 'Offline'}</button>}
          <button type="button" onClick={() => void signOut()} disabled={signingOut} className={pendingCount > 0 ? `${actionPrimary} bg-danger text-on-error hover:bg-danger-ink` : actionPrimary}>{pendingCount > 0 ? (signingOut ? 'Signing out…' : 'Sign out anyway') : (signingOut ? 'Signing out…' : 'Sign out')}</button>
        </div>
      </div>
    </Dialog>
  </PageContainer>;
}
