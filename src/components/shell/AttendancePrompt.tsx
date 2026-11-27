import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Dialog } from '../ui/Dialog';
import { actionPrimary, actionTonal } from '../ui/actionStyles';
import { useNow } from '../../hooks/useNow';
import { useResource } from '../../hooks/useResource';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getConfirmationWindow } from '../../features/seminars/confirmationWindow';

/** Prompts confirmed participants at the one-hour point, or immediately after a late signup. */
export function AttendancePrompt() {
  const now = useNow(15_000);
  const online = useOnlineStatus();
  const seminars = useResource(() => api.listSeminars(), 'attendance-prompt-seminars');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const focusRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const refresh = () => seminars.reload();
    window.addEventListener('seminex:registrations-changed', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('seminex:registrations-changed', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [seminars.reload]);
  const due = useMemo(() => seminars.state.status === 'success'
    ? seminars.state.data.find(({ seminar, registration }) => {
      if (now === null || seminar.id === dismissedId || !registration
        || registration.status === 'released' || registration.status === 'cancelled'
        || registration.attendanceAckAt || !registration.confirmedAt) return false;
      const startsAt = Date.parse(seminar.startsAt);
      const confirmedAt = Date.parse(registration.confirmedAt);
      const { closesAt } = getConfirmationWindow(
        seminar.startsAt,
        seminar.confirmationOpensMinutesBefore,
        seminar.confirmationClosesMinutesBefore,
      );
      const lateSignup = Number.isFinite(confirmedAt) && confirmedAt >= closesAt;
      return now >= startsAt - 60 * 60_000 || lateSignup;
    }) ?? null
    : null, [seminars.state, now, dismissedId]);

  async function answer(attending: boolean) {
    if (!due || pending) return;
    if (!online) { setMessage('Connect to the internet to save your response.'); return; }
    setPending(true);
    const result = attending ? await api.acknowledgeAttendance(due.seminar.id) : await api.cancelRegistration(due.seminar.id);
    setPending(false);
    if (!result.ok) { setMessage('Your response could not be saved. Connect and try again.'); return; }
    setMessage(null);
  }

  return <Dialog open={Boolean(due)} onClose={() => { if (due) setDismissedId(due.seminar.id); }} title="Still attending?" initialFocusRef={focusRef}>
    <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">{due?.seminar.title}</p>
    <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">Confirm that you still plan to attend. You can cancel now if your plans changed.</p>
    {message && <p role="alert" className="mt-space-md font-body-sm text-body-sm text-danger">{message}</p>}
    <div className="mt-space-lg flex flex-col-reverse gap-space-sm sm:flex-row sm:justify-end">
      <button type="button" disabled={pending} onClick={() => void answer(false)} className={actionTonal}>Cancel registration</button>
      <button ref={focusRef} type="button" disabled={pending} onClick={() => void answer(true)} className={actionPrimary}>{pending ? 'Saving…' : 'Yes, I’m attending'}</button>
    </div>
  </Dialog>;
}
