import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AtSign, CircleCheck, Mail, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react';
import { api } from '../../../api/client';
import { RESEND_COOLDOWN_SECONDS } from '../../../config';
import { useCooldown } from '../../../hooks/useCooldown';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { BrandMark } from '../../../components/shell/BrandMark';

export default function VerifyEmailPage() {
  const location = useLocation();
  const state = location.state as { email?: unknown; returnTo?: unknown } | null;
  const email = typeof state?.email === 'string' ? state.email : null;
  let savedReturnTo: string | null = null;
  try { savedReturnTo = window.sessionStorage.getItem('seminex.auth.returnTo'); } catch { /* Route state remains available in this tab. */ }
  const returnTo = state?.returnTo === '/organization/sign-in' || savedReturnTo === '/organization/sign-in'
    ? '/organization/sign-in'
    : '/sign-in';

  // The address only exists in route state. Without it (for example after a reload), start over.
  if (!email) return <Navigate to="/sign-up" replace />;
  return <VerifyEmailContent email={email} returnTo={returnTo} />;
}

function VerifyEmailContent({ email, returnTo }: { email: string; returnTo: string }) {
  const online = useOnlineStatus();
  const { remaining, start } = useCooldown(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<'sent' | 'failed' | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const offlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Check your email - Seminex';
  }, []);

  // Move focus to the result so the disabled-then-enabled button does not strand keyboard focus.
  useEffect(() => {
    if (outcome) messageRef.current?.focus();
  }, [outcome]);

  const coolingDown = remaining > 0;

  async function handleResend() {
    if (sending || coolingDown) return;
    if (!online) {
      offlineRef.current?.focus();
      return;
    }
    setOutcome(null);
    setSending(true);
    const result = await api.resendVerification(email);
    setSending(false);
    if (result.ok) {
      start();
      setOutcome('sent');
    } else {
      setOutcome('failed');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col justify-between bg-cream-50 pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <BrandMark size={40} />
        <div>
          <span className="block font-heading text-xl font-bold leading-none tracking-tight text-charcoal-900">
            Seminex
          </span>
          <span className="mt-1 block text-xs font-medium uppercase tracking-wide text-burnt">
            CCS Gordon College
          </span>
        </div>
      </header>

      <div className="my-auto py-8">
        <div
          aria-hidden="true"
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-maroon/20 bg-maroon/10 text-maroon"
        >
          <Mail className="h-8 w-8" strokeWidth={1.8} />
        </div>

        <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight text-charcoal-900">Check your email</h1>
        <p className="mb-4 text-base leading-relaxed text-charcoal-700">We sent a verification link to:</p>

        <div className="mb-6 flex items-center gap-2.5 rounded-control border border-charcoal-300 bg-white p-3.5 shadow-control">
          <AtSign aria-hidden="true" className="h-5 w-5 shrink-0 text-maroon" />
          <span className="break-all text-base font-semibold text-charcoal-900">{email}</span>
        </div>

        <p className="mb-8 text-sm leading-normal text-charcoal-700">
          Click the link in the message to activate your account and start registering for upcoming CCS seminars.
        </p>

        <div className="space-y-3">
          {!online && (
            <Alert ref={offlineRef} variant="neutral" role="status" icon={WifiOff} title="You are offline">
              Connect to the internet to resend the email.
            </Alert>
          )}
          {outcome === 'sent' && (
            <Alert ref={messageRef} variant="neutral" role="status" icon={CircleCheck} title="Email sent">
              A new verification link is on its way. It can take a few minutes to arrive.
            </Alert>
          )}
          {outcome === 'failed' && (
            <Alert ref={messageRef} variant="error" icon={TriangleAlert} title="Email not sent">
              Seminex could not be reached. Check your connection and try again.
            </Alert>
          )}

          <Button
            variant="secondary"
            icon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
            loading={sending}
            loadingLabel="Sending..."
            disabled={coolingDown}
            onClick={handleResend}
          >
            {coolingDown ? `Resend email in ${remaining}s` : 'Resend email'}
          </Button>

          <Link
            to={returnTo}
            onClick={() => { try { window.sessionStorage.removeItem('seminex.auth.returnTo'); } catch { /* Ignore unavailable storage. */ } }}
            className="flex min-h-12 w-full items-center justify-center rounded-control bg-maroon px-6 py-3 text-base font-medium text-white shadow-control transition-colors hover:bg-maroon-dark"
          >
            {returnTo === '/organization/sign-in' ? 'Back to organization sign in' : 'Back to sign in'}
          </Link>
        </div>
      </div>

      <footer className="border-t border-charcoal-200 pt-6 text-center">
        <p className="text-xs text-charcoal-500">
          Did not receive it? Check your institutional spam folder or contact the CCS Student Council Secretariat.
        </p>
      </footer>
    </main>
  );
}
