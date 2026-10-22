import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { OrgSeminar, OrgRegistration, ScanLedgerEntry } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { getOrgLifecycle } from '../seminarStatus';

const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));

function getAttendance(roster: OrgRegistration[], ledger: ScanLedgerEntry[], seminar: OrgSeminar) {
  const minutes = (studentId: string) => {
    const entries = ledger.filter((entry) => entry.studentId === studentId && entry.kind !== 'correction').sort((a, b) => a.at.localeCompare(b.at));
    let lastIn: number | null = null; let total = 0;
    for (const entry of entries) {
      if (entry.kind === 'time_in') lastIn = Date.parse(entry.at);
      if (entry.kind === 'time_out' && lastIn !== null) { total += Math.max(0, Date.parse(entry.at) - lastIn); lastIn = null; }
    }
    if (lastIn !== null) total += Math.max(0, Math.min(Date.now(), Date.parse(seminar.endsAt)) - lastIn);
    return Math.floor(total / 60_000);
  };
  const valid = roster.filter((student) => !student.removal);
  const rows = valid.map((student) => ({ student, minutes: minutes(student.studentId) }));
  const timeIn = new Set(ledger.filter((entry) => entry.kind === 'time_in').map((entry) => entry.studentId)).size;
  const completed = new Set(ledger.filter((entry) => entry.kind === 'time_out').map((entry) => entry.studentId)).size;
  const duration = Math.max(1, (Date.parse(seminar.endsAt) - Date.parse(seminar.startsAt)) / 60_000);
  const required = Math.ceil(duration * seminar.requiredAttendancePercent / 100);
  return { rows, registered: valid.length, timeIn, completed, meets: rows.filter((row) => row.minutes >= required).length, required };
}

function RegistrationRows({ rows }: { rows: OrgRegistration[] }) {
  return <div className="overflow-x-auto rounded-lg border border-border-subtle"><table className="w-full min-w-[680px] border-collapse text-left"><thead className="bg-surface-container-low font-caption text-caption text-text-secondary"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Student ID</th><th className="px-4 py-3 font-semibold">Program &amp; block</th><th className="px-4 py-3 font-semibold">Registered</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-border-subtle">{rows.map((row) => <tr key={row.id} className="font-body-sm text-body-sm text-on-surface"><td className="px-4 py-3">{row.firstName} {row.middleInitial} {row.lastName}</td><td className="px-4 py-3">{row.studentId}</td><td className="px-4 py-3">{row.program} · {row.yearLevel}-{row.block}</td><td className="px-4 py-3">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(row.registeredAt))}</td><td className="px-4 py-3">{row.removal ? 'Removed' : 'Registered'}</td></tr>)}</tbody></table></div>;
}

export default function OrgSeminarDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const now = useNow();
  const listing = useResource(() => api.listOrgSeminars(), `org-seminar-${id}`);
  const seminar = listing.state.status === 'success' ? listing.state.data.seminars.find((item) => item.id === id) : null;
  const roster = useResource(() => api.listOrgRoster(id), `org-roster-${id}`, (items) => items.length === 0);
  const ledger = useResource(() => api.listLedger(id), `org-ledger-${id}`, (items) => items.length === 0);

  if (listing.state.status === 'loading') return <PageContainer><LoadingRegion label="Loading seminar details"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></LoadingRegion></PageContainer>;
  if (listing.state.status === 'error') return <PageContainer><StateMessage role="alert" icon="info" title="Seminar details could not be loaded" action={<RetryButton onClick={listing.reload} />}>Try again when your connection is available.</StateMessage></PageContainer>;
  if (!seminar) return <PageContainer><StateMessage role="status" icon="event_busy" title="Seminar not found" action={<Link to="/org/my-seminars" className={actionPrimary}>Back to My Seminars</Link>}>This seminar is not available in your organization workspace.</StateMessage></PageContainer>;

  const status = seminar.cancellation ? 'Cancelled' : getOrgLifecycle(seminar, now);
  const attendees = roster.state.status === 'success' ? roster.state.data : [];
  const ledgerEntries = ledger.state.status === 'success' ? ledger.state.data : [];
  const attendance = getAttendance(attendees, ledgerEntries, seminar);
  const ratio = attendance.registered ? Math.round(attendance.timeIn / attendance.registered * 100) : 0;

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-caption text-caption text-text-secondary"><Link to="/org/my-seminars" className="hover:text-primary">My Seminars</Link><Icon name="chevron_right" size={16} /><span>{seminar.reference}</span></nav>
      <header className="flex flex-col justify-between gap-space-lg md:flex-row md:items-end">
        <div className="max-w-3xl"><div className="flex flex-wrap items-center gap-space-sm"><span className="rounded-full bg-surface-container-low px-3 py-1 font-caption text-caption capitalize text-text-secondary">{status}</span><span className="font-caption text-caption text-text-subtle">{seminar.reference}</span></div><h1 className="mt-space-sm font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">{seminar.title}</h1><p className="mt-space-xs font-body-base text-body-base text-text-secondary">{seminar.organizationId} · {seminar.department}</p></div>
        <div className="flex flex-wrap gap-space-sm"><button type="button" disabled={editing || status === 'finished' || status === 'cancelled'} onClick={async () => { setEditing(true); const result = await api.createOrgEditDraft(seminar.id); setEditing(false); if (result.ok) navigate(`/org/seminars/${result.data.id}/edit`); }} className={actionTonal}><Icon name="edit" size={18} />{editing ? 'Opening editor…' : 'Edit seminar'}</button><Link to={`/org/my-seminars/${seminar.id}/scanner`} className={actionPrimary}><Icon name="qr_code_scanner" size={20} />Launch check-in scanner</Link></div>
      </header>

      <nav aria-label="Seminar sections" className="flex flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface-card p-space-sm shadow-card"><a className={actionTonal} href="#details">Details</a><a className={actionTonal} href="#registrations">Registrations ({attendance.registered})</a><a className={actionTonal} href="#attendance">Attendance &amp; scanner</a></nav>

      <section id="details" className="grid gap-space-lg lg:grid-cols-[1.4fr_1fr]">
        <article className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card">
          <h2 className="font-title-lg text-title-lg text-on-surface">Seminar details</h2>
          <p className="whitespace-pre-wrap font-body-base text-body-base leading-relaxed text-text-secondary">{seminar.description}</p>
          <dl className="grid gap-space-md border-t border-border-subtle pt-space-md sm:grid-cols-2"><div><dt className="font-caption text-caption text-text-secondary">Speaker</dt><dd className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.speaker.name}<span className="block font-body-sm text-body-sm text-text-secondary">{seminar.speaker.role}</span></dd></div><div><dt className="font-caption text-caption text-text-secondary">Venue</dt><dd className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.venue}</dd></div><div><dt className="font-caption text-caption text-text-secondary">Schedule</dt><dd className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{dateTime(seminar.startsAt)}<span className="block font-body-sm text-body-sm text-text-secondary">Ends {dateTime(seminar.endsAt)}</span></dd></div><div><dt className="font-caption text-caption text-text-secondary">Attendance rule</dt><dd className="mt-1 font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.requiredAttendancePercent}% of seminar duration</dd></div></dl>
        </article>
        <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="attendance-summary">
          <div className="flex items-center justify-between gap-3"><h2 id="attendance-summary" className="font-title-lg text-title-lg text-on-surface">Attendance &amp; scanner</h2><Link to={`/org/my-seminars/${seminar.id}/scanner`} className="font-body-sm-medium text-body-sm-medium text-primary hover:underline">Open scanner</Link></div>
          <div className="grid grid-cols-2 gap-space-sm"><div className="rounded-lg bg-surface-container-low p-space-md"><p className="font-caption text-caption text-text-secondary">Timed in</p><p className="mt-1 font-headline-md text-headline-md text-on-surface">{attendance.timeIn} <span className="font-body-sm text-body-sm">/ {attendance.registered}</span></p><p className="font-caption text-caption text-text-secondary">{ratio}% of registered</p></div><div className="rounded-lg bg-surface-container-low p-space-md"><p className="font-caption text-caption text-text-secondary">Timed out</p><p className="mt-1 font-headline-md text-headline-md text-on-surface">{attendance.completed}</p><p className="font-caption text-caption text-text-secondary">Completed check-outs</p></div><div className="col-span-2 rounded-lg bg-status-available-container p-space-md"><p className="font-caption text-caption text-status-available">Meets minimum attendance</p><p className="mt-1 font-headline-md text-headline-md text-status-available">{attendance.meets} students</p><p className="font-caption text-caption text-text-secondary">Requirement: {seminar.requiredAttendancePercent}% · {attendance.required} minutes</p></div></div>
          <p className="font-caption text-caption text-text-secondary">Attendance is based on the saved check-in and check-out ledger.</p>
        </section>
      </section>

      <section id="registrations" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="roster-heading">
        <div className="flex flex-wrap items-end justify-between gap-space-sm"><div><h2 id="roster-heading" className="font-title-lg text-title-lg text-on-surface">Registered students</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">{attendance.registered} active registrations · capacity {seminar.capacity}</p></div><span className="rounded-full bg-surface-container-low px-3 py-1 font-caption text-caption text-text-secondary">{Math.max(0, seminar.capacity - seminar.registeredCount)} slots remaining</span></div>
        {roster.state.status === 'loading' && <LoadingRegion label="Loading registered students"><Skeleton className="h-44 rounded-lg" /></LoadingRegion>}
        {roster.state.status === 'error' && <StateMessage role="alert" icon="info" title="Roster could not be loaded" action={<RetryButton onClick={roster.reload} />}>Registration details are temporarily unavailable.</StateMessage>}
        {roster.state.status === 'empty' && <StateMessage icon="group_off" title="No registrations yet">Student registrations will appear here.</StateMessage>}
        {roster.state.status === 'success' && <RegistrationRows rows={roster.state.data} />}
      </section>

      <section id="attendance" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="ledger-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="ledger-heading" className="font-title-lg text-title-lg text-on-surface">Live attendance ledger</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Check-in and check-out records attached to this seminar.</p></div><Link to={`/org/my-seminars/${seminar.id}/scanner`} className={actionTonal}><Icon name="qr_code_scanner" size={18} />Open scanner</Link></div>
        {ledger.state.status === 'loading' && <LoadingRegion label="Loading attendance ledger"><Skeleton className="h-36 rounded-lg" /></LoadingRegion>}
        {ledger.state.status === 'error' && <StateMessage role="alert" icon="sync_problem" title="Attendance ledger could not be loaded" action={<RetryButton onClick={ledger.reload} />}>Try again when connected.</StateMessage>}
        {ledger.state.status === 'empty' && <StateMessage icon="fact_check" title="No attendance scans recorded">Use the scanner to record student time-in and time-out events.</StateMessage>}
        {ledger.state.status === 'success' && <div className="overflow-x-auto rounded-lg border border-border-subtle"><table className="w-full min-w-[700px] border-collapse text-left"><thead className="bg-surface-container-low font-caption text-caption text-text-secondary"><tr><th className="px-4 py-3 font-semibold">Student ID</th><th className="px-4 py-3 font-semibold">Action</th><th className="px-4 py-3 font-semibold">Time</th><th className="px-4 py-3 font-semibold">Method</th><th className="px-4 py-3 font-semibold">Sync status</th></tr></thead><tbody className="divide-y divide-border-subtle">{ledger.state.data.slice(0, 20).map((entry) => <tr key={entry.id} className="font-body-sm text-body-sm"><td className="px-4 py-3">{entry.studentId}</td><td className="px-4 py-3 capitalize">{entry.kind.replace('_', ' ')}</td><td className="px-4 py-3">{dateTime(entry.at)}</td><td className="px-4 py-3 capitalize">{entry.method}</td><td className="px-4 py-3">{entry.synced ? 'Synced' : 'Pending sync'}</td></tr>)}</tbody></table></div>}
      </section>
    </PageContainer>
  );
}
