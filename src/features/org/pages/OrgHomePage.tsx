import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type OrgSeminar, type SeminarDraft } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { useOrgIdentity } from '../../../session/OrgIdentityProvider';
import { getDraftReadiness } from '../readiness';
import { getOrgLifecycle, isOrgRecentlyFinished } from '../seminarStatus';

function dateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function SeminarCard({ seminar, now }: { seminar: OrgSeminar; now: number }) {
  const status = getOrgLifecycle(seminar, now);
  const percent = seminar.capacity > 0 ? Math.min(100, Math.round(seminar.registeredCount / seminar.capacity * 100)) : 0;
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-card transition hover:shadow-overlay">
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-surface-container-low via-surface-container to-primary-fixed/60">
        {seminar.imageUrl ? <img src={seminar.imageUrl} alt="" className="h-full w-full object-cover" /> : <Icon name="school" size={32} className="text-primary/70" />}
        <span className="absolute left-3 top-3 rounded-md bg-surface-card/95 px-2.5 py-1 font-label-sm text-label-sm capitalize text-primary shadow-card">{status}</span>
      </div>
      <div className="flex flex-1 flex-col gap-space-md p-space-lg">
        <div className="flex-1">
          <p className="font-caption text-caption text-text-secondary">{seminar.department}</p>
          <h3 className="mt-1 font-title-lg text-title-lg text-on-surface group-hover:text-primary">{seminar.title}</h3>
          <div className="mt-space-sm flex flex-col gap-1.5 font-body-sm text-body-sm text-text-secondary">
            <p className="flex items-start gap-2"><Icon name="schedule" size={16} className="mt-0.5 shrink-0" />{dateTime(seminar.startsAt)}</p>
            <p className="flex items-start gap-2"><Icon name="location_on" size={16} className="mt-0.5 shrink-0" />{seminar.venue}</p>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 font-caption text-caption"><span className="text-text-secondary">Slots reserved</span><span className="font-semibold text-on-surface">{seminar.registeredCount} / {seminar.capacity}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-primary-container" style={{ width: `${percent}%` }} /></div>
        </div>
        <div className="flex gap-space-sm">
          <Link to={`/org/my-seminars/${seminar.id}`} className={`${actionTonal} flex-1 justify-center`}>Open seminar<Icon name="arrow_forward" size={16} /></Link>
          {status === 'ongoing' && <Link aria-label={`Open scanner for ${seminar.title}`} to={`/org/my-seminars/${seminar.id}/scanner`} className={actionPrimary}><Icon name="qr_code_scanner" size={18} /></Link>}
        </div>
      </div>
    </article>
  );
}

function AttentionDraft({ draft }: { draft: SeminarDraft }) {
  const readiness = getDraftReadiness(draft);
  return (
    <Link to={`/org/seminars/${draft.id}/edit`} className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md transition hover:bg-surface-container sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-space-md">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest text-primary"><Icon name={readiness.ready ? 'publish' : 'edit'} size={20} /></span>
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="rounded bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-text-secondary">Draft</span><span className="font-body-sm-medium text-body-sm-medium text-on-surface">{draft.details.title || 'Untitled seminar'}</span></span><span className="mt-1 block font-body-sm text-body-sm text-text-secondary">{readiness.firstBlockingReason || 'Setup is complete. Review and publish this seminar.'}</span></span>
      </div>
      <span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-surface-card px-4 font-body-sm-medium text-body-sm-medium text-primary">{readiness.ready ? 'Review draft' : 'Continue editing'}<Icon name="arrow_forward" size={16} /></span>
    </Link>
  );
}

export default function OrgHomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const now = useNow();
  const { state: identity } = useOrgIdentity();
  const listing = useResource(() => api.listOrgSeminars(), 'org-home');
  const seminars = listing.state.status === 'success' ? listing.state.data.seminars : [];
  const drafts = listing.state.status === 'success' ? listing.state.data.drafts : [];
  const active = seminars.filter((item) => ['upcoming', 'ongoing'].includes(getOrgLifecycle(item, now))).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const ongoing = active.filter((item) => getOrgLifecycle(item, now) === 'ongoing');
  const recentlyFinished = seminars.filter((item) => isOrgRecentlyFinished(item, now)).sort((a, b) => b.endsAt.localeCompare(a.endsAt));
  const registered = active.reduce((total, item) => total + item.registeredCount, 0);
  const organizationName = identity.status === 'success' ? identity.data.organization.name : 'Organization workspace';
  const metrics = [
    { label: 'Active seminars', value: active.length, detail: `${ongoing.length} ongoing now`, icon: 'event_note', to: '/org/my-seminars' },
    { label: 'Registered', value: registered, detail: 'Across active seminars', icon: 'group', to: '/org/my-seminars' },
    { label: 'Drafts', value: drafts.length, detail: 'Not published yet', icon: 'draft', to: '/org/my-seminars' },
    { label: 'Recently finished', value: recentlyFinished.length, detail: 'Ready for attendance review', icon: 'history', to: '/org/history' },
  ] as const;

  async function createSeminar() {
    if (creating) return;
    setCreating(true);
    setCreateError(false);
    const result = await api.createOrgDraft();
    setCreating(false);
    if (result.ok) navigate(`/org/seminars/${result.data.id}/edit`);
    else setCreateError(true);
  }

  return (
    <PageContainer>
      <header className="flex flex-col justify-between gap-space-lg md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 font-label-sm text-label-sm uppercase tracking-widest text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Workspace overview</p>
          <h1 className="mt-space-xs font-headline-xl text-headline-xl-mobile tracking-tight text-on-surface md:text-headline-xl">Welcome back{identity.status === 'success' ? `, ${identity.data.firstName}` : ''}</h1>
          <p className="mt-space-xs font-body-base text-body-base text-text-secondary">{organizationName} · {new Date(now).getFullYear()}–{new Date(now).getFullYear() + 1}</p>
        </div>
        <button type="button" onClick={() => void createSeminar()} disabled={creating} className={actionPrimary}><Icon name="add" size={20} />{creating ? 'Creating draft…' : 'Create seminar'}</button>
      </header>

      {createError && <p role="alert" className="rounded-lg border border-danger-soft bg-danger-surface p-space-md text-danger-ink">Could not create a seminar draft. Please try again.</p>}

      {listing.state.status === 'loading' && <LoadingRegion label="Loading organization dashboard" className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">{[0,1,2,3].map((key) => <Skeleton key={key} className="h-40 rounded-xl" />)}</LoadingRegion>}
      {listing.state.status === 'error' && <StateMessage role="alert" icon="info" title="Organization seminars could not be loaded" action={<RetryButton onClick={listing.reload} />}>Check your connection and try again.</StateMessage>}
      {listing.state.status === 'empty' && <StateMessage icon="event_note" title="Your organization workspace is ready" action={<button type="button" onClick={() => void createSeminar()} className={actionPrimary}><Icon name="add" size={18} />Create your first seminar</button>}>Create a seminar to start managing registrations and attendance.</StateMessage>}

      {listing.state.status === 'success' && <>
        <section aria-label="Organization metrics" className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <Link key={metric.label} to={metric.to} className="flex min-h-40 flex-col justify-between rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card transition hover:border-primary">
            <span className="flex items-start justify-between gap-3"><span className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary">{metric.label}</span><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-low text-primary"><Icon name={metric.icon} size={18} /></span></span>
            <span><span className="block font-headline-xl text-headline-xl text-on-surface">{metric.value}</span><span className="mt-1 block font-caption text-caption text-text-secondary">{metric.detail}</span></span>
            <span className="inline-flex items-center gap-1 font-body-sm-medium text-body-sm-medium text-primary">View details<Icon name="arrow_forward" size={16} /></span>
          </Link>)}
        </section>

        <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="attention-heading">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-space-md"><div className="flex items-center gap-space-sm"><span className="h-3 w-3 rounded-full bg-secondary" /><h2 id="attention-heading" className="font-title-lg text-title-lg text-on-surface">Needs attention</h2><span className="rounded-full bg-secondary-fixed px-2.5 py-1 font-caption text-caption text-on-secondary-fixed">{drafts.length + ongoing.length} items</span></div><span className="font-caption text-caption text-text-secondary">Based on your current seminars</span></div>
          <div className="flex flex-col gap-space-sm">
            {drafts.map((draft) => <AttentionDraft key={draft.id} draft={draft} />)}
            {ongoing.map((seminar) => <Link key={seminar.id} to={`/org/my-seminars/${seminar.id}/scanner`} className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md transition hover:bg-surface-container sm:flex-row sm:items-center"><div className="flex items-start gap-space-md"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-secondary"><Icon name="qr_code_scanner" size={20} /></span><span><span className="flex flex-wrap items-center gap-2"><span className="rounded bg-secondary-fixed px-2 py-0.5 font-label-sm text-label-sm text-on-secondary-fixed">Ongoing</span><span className="font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.title}</span></span><span className="mt-1 block font-body-sm text-body-sm text-text-secondary">{dateTime(seminar.startsAt)} · {seminar.venue}</span></span></div><span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 font-body-sm-medium text-body-sm-medium text-on-primary">Prepare scanner<Icon name="arrow_forward" size={16} /></span></Link>)}
            {!drafts.length && !ongoing.length && <p className="rounded-lg bg-surface-container-low p-space-md font-body-sm text-body-sm text-text-secondary">Nothing needs attention right now. New drafts and ongoing seminars will appear here.</p>}
          </div>
        </section>

        {ongoing.length > 0 && <section className="flex flex-col gap-space-md" aria-labelledby="checkin-heading"><div><p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Live session</p><h2 id="checkin-heading" className="mt-1 font-title-lg text-title-lg text-on-surface">Quick attendance check-in</h2></div><div className="grid gap-space-md md:grid-cols-2">{ongoing.map((seminar) => <article key={seminar.id} className="flex flex-col justify-between gap-space-md rounded-xl bg-primary-container p-space-lg text-on-primary sm:flex-row sm:items-center"><div><h3 className="font-title-lg text-title-lg">{seminar.title}</h3><p className="mt-1 font-body-sm text-body-sm text-on-primary/80">{seminar.registeredCount} registered · {seminar.venue}</p></div><Link to={`/org/my-seminars/${seminar.id}/scanner`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-surface-card px-4 font-body-sm-medium text-body-sm-medium text-primary"><Icon name="qr_code_scanner" size={18} />Open scanner</Link></article>)}</div></section>}

        <section className="flex flex-col gap-space-md" aria-labelledby="active-seminars-heading">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="active-seminars-heading" className="font-title-lg text-title-lg text-on-surface">Active &amp; upcoming seminars</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Your scheduled academic sessions and live events.</p></div><Link to="/org/my-seminars" className={actionTonal}>View all<Icon name="arrow_forward" size={16} /></Link></div>
          {active.length ? <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-3">{active.slice(0, 3).map((seminar) => <SeminarCard key={seminar.id} seminar={seminar} now={now} />)}</div> : <StateMessage icon="event_busy" title="No active seminars">Create a draft seminar to plan your next session.</StateMessage>}
        </section>

        {recentlyFinished.length > 0 && <section className="flex flex-col gap-space-md" aria-labelledby="recent-heading"><div className="flex items-center justify-between gap-2"><div><h2 id="recent-heading" className="font-title-lg text-title-lg text-on-surface">Recently finished</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Review attendance and seminar details.</p></div><Link to="/org/history" className={actionTonal}>Open history<Icon name="arrow_forward" size={16} /></Link></div><div className="grid gap-space-sm md:grid-cols-2">{recentlyFinished.map((seminar) => <Link key={seminar.id} to={`/org/my-seminars/${seminar.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-card hover:border-primary"><span className="min-w-0"><span className="block truncate font-body-sm-medium text-body-sm-medium text-on-surface">{seminar.title}</span><span className="mt-1 block font-caption text-caption text-text-secondary">Finished {dateTime(seminar.endsAt)}</span></span><Icon name="arrow_forward" size={18} className="shrink-0 text-primary" /></Link>)}</div></section>}
      </>}
    </PageContainer>
  );
}
