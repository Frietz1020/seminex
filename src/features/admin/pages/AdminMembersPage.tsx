import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AdviserDirectoryMember } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useResource } from '../../../hooks/useResource';

type DirectoryFilter = 'all' | 'member' | 'adviser';
type StatusFilter = 'active' | 'removed';
const POSITIONS = ['President', 'Executive President', 'Vice President', 'Event Director', 'Secretary', 'Committee Head', 'Technical Lead', 'General Member'];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function date(value: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Faculty adviser';
}

function MemberAvatar({ member }: { member: AdviserDirectoryMember }) {
  return <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-title-md text-title-md font-semibold ${member.category === 'adviser' ? 'bg-primary-container text-on-primary' : 'bg-primary-fixed text-on-primary-fixed'}`}>{initials(member.fullName)}</span>;
}

function StatusPill({ status }: { status: AdviserDirectoryMember['status'] }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-sm text-label-sm ${status === 'active' ? 'bg-status-available-container text-status-available' : 'bg-surface-container-high text-text-secondary'}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-status-available' : 'bg-text-subtle'}`} />{status === 'active' ? 'Active' : 'Removed'}</span>;
}

export default function AdminMembersPage() {
  const { state, reload } = useResource(() => api.listAdviserOrgMembers(), 'admin-members', (items) => items.length === 0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DirectoryFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [editing, setEditing] = useState<AdviserDirectoryMember | null>(null);
  const [removing, setRemoving] = useState<AdviserDirectoryMember | null>(null);
  const [position, setPosition] = useState('');
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState('');
  const members = state.status === 'success' ? state.data : [];
  const activeMembers = members.filter((member) => member.status === 'active');
  const shown = useMemo(() => members.filter((member) => {
    const matchesCategory = category === 'all' || member.category === category;
    const matchesStatus = member.status === status;
    const text = `${member.fullName} ${member.email} ${member.studentId ?? ''} ${member.position}`.toLowerCase();
    return matchesCategory && matchesStatus && text.includes(query.trim().toLowerCase());
  }), [members, category, status, query]);

  async function savePosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || working) return;
    setWorking(true);
    setFailure('');
    const result = await api.updateAdviserMemberPosition(editing.id, position);
    setWorking(false);
    if (!result.ok) { setFailure('Could not update this member’s position. Try again.'); return; }
    setEditing(null);
    reload();
  }

  async function confirmRemoval() {
    if (!removing || working) return;
    setWorking(true);
    setFailure('');
    const result = await api.removeAdviserMember(removing.id);
    setWorking(false);
    if (!result.ok) { setFailure('Could not remove this member. Try again.'); return; }
    setRemoving(null);
    reload();
  }

  function openEdit(member: AdviserDirectoryMember) {
    setPosition(member.position);
    setFailure('');
    setEditing(member);
  }

  return (
    <PageContainer>
      <header className="flex flex-col justify-between gap-space-lg lg:flex-row lg:items-end">
        <div className="max-w-2xl"><p className="flex items-center gap-2 font-label-sm text-label-sm uppercase tracking-widest text-primary"><Icon name="verified_user" size={18} />Accredited unit governance</p><h1 className="mt-space-xs font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Organization Members</h1><p className="mt-1 font-body-base text-body-base text-text-secondary">Manage active student officers and faculty advisers for your organization.</p></div>
        <div className="flex flex-wrap gap-space-sm">
          <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm shadow-card"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-highest text-primary"><Icon name="how_to_reg" size={20} /></span><span><span className="block font-label-sm text-label-sm uppercase tracking-wide text-text-secondary">Active roster</span><span className="font-title-md text-title-md text-on-surface">{activeMembers.length} people</span></span></div>
          <Link to="/org/adviser/requests" className={actionPrimary}><Icon name="person_add" size={18} />Review requests</Link>
        </div>
      </header>

      {failure && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md font-body-sm text-body-sm text-danger-ink">{failure}</p>}

      <section aria-label="Member search and filters" className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md"><span className="sr-only">Search members</span><Icon name="search" size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by student number, name, or role…" className="h-11 w-full rounded-xl border border-border-subtle bg-surface-container-lowest pl-11 pr-4 font-body-sm text-body-sm text-on-surface placeholder:text-text-subtle outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
        <div className="flex flex-wrap items-center justify-between gap-space-sm lg:justify-end">
          <div role="group" aria-label="Directory category" className="flex rounded-xl bg-surface-container p-1">
            {([['all', 'All'], ['member', 'Members'], ['adviser', 'Advisers']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`flex min-h-9 items-center gap-2 rounded-lg px-space-sm font-body-sm-medium text-body-sm-medium ${category === value ? 'bg-surface-card text-primary shadow-card' : 'text-text-secondary hover:text-on-surface'}`}>{label}<span className="rounded-full bg-surface-container-high px-1.5 py-0.5 font-caption text-caption">{members.filter((member) => value === 'all' || member.category === value).length}</span></button>)}
          </div>
          <label className="sr-only" htmlFor="member-status">Member status</label><select id="member-status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-11 rounded-lg border border-border-subtle bg-surface-container-lowest px-3 font-body-sm-medium text-body-sm-medium text-on-surface outline-none focus:border-primary"><option value="active">Active members</option><option value="removed">Removed members</option></select>
        </div>
      </section>

      {state.status === 'loading' && <LoadingRegion label="Loading organization members"><Skeleton className="h-80 rounded-xl" /></LoadingRegion>}
      {state.status === 'error' && <StateMessage role="alert" icon="sync_problem" title="Unable to load organization roster" action={<RetryButton onClick={reload} />}>Try again when the roster service is available.</StateMessage>}
      {state.status === 'empty' && <StateMessage icon="group_off" title="No organization members found">Approved officers and faculty advisers will appear here.</StateMessage>}
      {state.status === 'success' && shown.length === 0 && <StateMessage icon="search_off" title="No members match these filters" action={<button type="button" onClick={() => { setQuery(''); setCategory('all'); setStatus('active'); }} className={actionTonal}>Reset filters</button>}>Clear your search or change the selected category and status.</StateMessage>}

      {state.status === 'success' && shown.length > 0 && <>
        <div className="hidden overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-card md:block">
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left"><thead className="bg-surface-container-low text-text-secondary"><tr>{['Member / student', 'Student ID', 'Position', 'Member since', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-space-md py-space-md font-label-sm text-label-sm uppercase tracking-wider first:pl-space-lg last:pr-space-lg">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{shown.map((member) => <tr key={member.id} className="transition-colors hover:bg-surface-container-lowest">
            <td className="px-space-lg py-space-md"><div className="flex items-center gap-space-md"><MemberAvatar member={member} /><div className="min-w-0"><p className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">{member.fullName}</p><p className="truncate font-caption text-caption text-text-secondary">{member.email}</p></div></div></td>
            <td className="px-space-md py-space-md font-body-sm-medium text-body-sm-medium text-text-secondary">{member.studentId ?? '—'}</td><td className="px-space-md py-space-md"><span className="block font-body-sm-medium text-body-sm-medium text-primary">{member.position}</span><span className="font-caption text-caption capitalize text-text-secondary">{member.category === 'adviser' ? 'Faculty adviser' : 'Student officer'}</span></td><td className="px-space-md py-space-md font-body-sm text-body-sm text-text-secondary">{date(member.appointedAt)}</td><td className="px-space-md py-space-md"><StatusPill status={member.status} /></td><td className="px-space-lg py-space-md text-right">{member.category === 'member' && <div className="inline-flex items-center gap-space-xs"><button type="button" disabled={member.status !== 'active'} onClick={() => openEdit(member)} className="min-h-10 rounded-lg bg-surface-container px-3 font-body-sm-medium text-body-sm-medium text-primary hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-50">Change position</button>{member.status === 'active' && <button type="button" aria-label={`Remove ${member.fullName}`} onClick={() => { setFailure(''); setRemoving(member); }} className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-surface hover:text-danger-ink"><Icon name="group_off" size={18} /></button>}</div>}</td>
          </tr>)}</tbody></table></div>
        </div>
        <div className="flex flex-col gap-space-md md:hidden">{shown.map((member) => <article key={member.id} className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card"><div className="flex items-start gap-space-sm"><MemberAvatar member={member} /><div className="min-w-0 flex-1"><h2 className="truncate font-title-md text-title-md text-on-surface">{member.fullName}</h2><p className="truncate font-body-sm text-body-sm text-text-secondary">{member.studentId ? `${member.studentId} · ` : ''}{member.email}</p><span className="mt-1 inline-flex max-w-full truncate rounded-md bg-secondary-fixed/50 px-2 py-0.5 font-label-sm text-label-sm text-on-secondary-fixed">{member.position}</span></div></div><div className="flex items-center justify-between border-t border-border-subtle pt-space-sm font-caption text-caption text-text-secondary"><span>Member since: {date(member.appointedAt)}</span><StatusPill status={member.status} /></div>{member.category === 'member' && <div className="flex gap-space-sm pt-1"><button type="button" disabled={member.status !== 'active'} onClick={() => openEdit(member)} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container font-body-sm-medium text-body-sm-medium text-primary disabled:opacity-50"><Icon name="manage_accounts" size={18} />Change position</button>{member.status === 'active' && <button type="button" onClick={() => { setFailure(''); setRemoving(member); }} className="flex min-h-11 items-center justify-center gap-1 rounded-lg px-3 font-body-sm-medium text-body-sm-medium text-danger-ink hover:bg-danger-surface"><Icon name="group_off" size={18} />Remove</button>}</div>}</article>)}</div>
      </>}

      <Dialog open={editing !== null} onClose={() => { if (!working) setEditing(null); }} title="Update member position">
        {editing && <form onSubmit={(event) => void savePosition(event)} className="mt-space-md flex flex-col gap-space-md"><div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-md"><MemberAvatar member={editing} /><div className="min-w-0"><p className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">{editing.fullName}</p><p className="font-caption text-caption text-text-secondary">Student ID: {editing.studentId}</p></div></div><label className="flex flex-col gap-1.5 font-label-sm text-label-sm font-semibold text-text-secondary" htmlFor="member-position">Organizational role<select id="member-position" value={position} onChange={(event) => setPosition(event.target.value)} className="h-11 rounded-lg border border-border-subtle bg-surface-container-lowest px-3 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary">{!POSITIONS.includes(position) && <option value={position}>{position}</option>}{POSITIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><p className="font-caption text-caption text-text-secondary">Position changes are saved in this browser’s mock directory.</p><div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end"><button type="button" disabled={working} onClick={() => setEditing(null)} className={actionTonal}>Cancel</button><button type="submit" disabled={working || !position.trim()} className={actionPrimary}><Icon name="check" size={18} />{working ? 'Saving…' : 'Save position'}</button></div></form>}
      </Dialog>

      <Dialog open={removing !== null} onClose={() => { if (!working) setRemoving(null); }} title={`Remove ${removing?.fullName ?? 'member'}?`}>
        {removing && <div className="mt-space-md flex flex-col gap-space-md"><div className="flex items-start gap-space-md"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger-surface text-danger-ink"><Icon name="group_off" size={24} /></span><p className="font-body-sm text-body-sm leading-relaxed text-text-secondary">Removing this member revokes organization officer access. They will keep standard participant portal access.</p></div><p className="rounded-lg bg-surface-container-low p-space-sm font-caption text-caption text-text-secondary">This action is recorded in the local mock directory.</p><div className="flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end"><button type="button" disabled={working} onClick={() => setRemoving(null)} className={actionTonal}>Cancel</button><button type="button" disabled={working} onClick={() => void confirmRemoval()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-danger px-4 font-body-sm-medium text-body-sm-medium text-on-error disabled:opacity-60">{working ? 'Removing…' : 'Confirm removal'}</button></div></div>}
      </Dialog>
    </PageContainer>
  );
}
