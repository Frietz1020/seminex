import { useState } from 'react';
import { api, type OrgRegistration } from '../../../api/client';
import { useResource } from '../../../hooks/useResource';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';

export function WebinarProofReview({ seminarId, roster, onReviewed }: { seminarId: string; roster: OrgRegistration[]; onReviewed: () => void }) {
  const proofs = useResource(() => api.listWebinarProofs(seminarId), `webinar-proofs-${seminarId}`, (items) => items.length === 0);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function review(proofId: string, approve: boolean) {
    const reason = reasons[proofId]?.trim();
    if (!approve && !reason) { setMessage('Enter a reason before rejecting this proof.'); return; }
    setPendingId(proofId);
    const result = await api.reviewWebinarProof(proofId, approve, reason);
    setPendingId(null);
    if (!result.ok) { setMessage('The proof review could not be saved. Connect and try again.'); return; }
    setMessage(null);
    proofs.reload();
    onReviewed();
  }

  if (proofs.state.status === 'loading') return <LoadingRegion label="Loading webinar proofs"><Skeleton className="h-36 rounded-xl" /></LoadingRegion>;
  if (proofs.state.status === 'error') return <StateMessage role="alert" icon="info" title="Webinar proofs could not be loaded" action={<RetryButton onClick={proofs.reload} />}>Reconnect and try again.</StateMessage>;
  const rows = proofs.state.status === 'success' ? proofs.state.data : [];
  if (rows.length === 0) return <StateMessage icon="fact_check" title="No attendance proofs submitted">Student webinar time-in and time-out screenshots will appear here.</StateMessage>;

  return <section className="flex flex-col gap-space-md"><div><h3 className="font-title-lg text-title-lg text-on-surface">Webinar proof review</h3><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Before approval, verify that the screenshot shows the student’s matching name and visible webinar content.</p></div>{message && <p role="alert" className="font-body-sm text-body-sm text-danger">{message}</p>}{rows.map((proof) => {
    const student = roster.find((entry) => entry.studentId === proof.studentId);
    const name = student ? `${student.firstName} ${student.middleInitial ? `${student.middleInitial}. ` : ''}${student.lastName}` : proof.studentId;
    return <article key={proof.id} className="grid gap-space-md rounded-xl border border-outline-variant/50 bg-surface-container-low p-space-md md:grid-cols-[12rem_minmax(0,1fr)]"><a href={proof.imageUrl} target="_blank" rel="noreferrer" aria-label={`Open ${name}'s ${proof.kind.replace('_', '-')} proof image`} className="block min-h-32 overflow-hidden rounded-lg bg-surface-card"><img src={proof.imageUrl} alt={`${proof.kind.replace('_', ' ')} screenshot from ${name}`} className="h-full min-h-32 w-full object-contain" /></a><div className="flex min-w-0 flex-col gap-space-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-body-sm-medium text-body-sm-medium text-on-surface">{name}</h4><p className="font-caption text-caption text-text-secondary">{proof.studentId} · {proof.kind.replace('_', ' ')} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(proof.submittedAt))}</p></div><span className="rounded-md bg-surface-card px-2.5 py-1 font-label-sm capitalize text-label-sm text-text-secondary">{proof.status}</span></div>{proof.rejectionReason && <p className="font-caption text-caption text-text-secondary">Reason: {proof.rejectionReason}</p>}{proof.status === 'pending' && <><label className="flex flex-col gap-1 font-caption text-caption text-text-secondary">Rejection reason<textarea value={reasons[proof.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [proof.id]: event.target.value }))} rows={2} className="rounded-lg border border-outline-variant bg-surface-card p-2 font-body-sm text-body-sm text-on-surface" /></label><div className="flex flex-wrap gap-space-sm"><button type="button" disabled={pendingId === proof.id} onClick={() => void review(proof.id, true)} className={actionPrimary}><Icon name="check_circle" size={18} />Approve</button><button type="button" disabled={pendingId === proof.id || !reasons[proof.id]?.trim()} onClick={() => void review(proof.id, false)} className={actionTonal}>Reject</button></div></>}</div></article>;
  })}</section>;
}
