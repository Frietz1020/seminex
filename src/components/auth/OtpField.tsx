import { useState } from 'react';
import { api } from '../../api/client';
import { RESEND_COOLDOWN_SECONDS, STUDENT_EMAIL_DOMAIN } from '../../config';
import { useCooldown } from '../../hooks/useCooldown';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { validatePasswordResetIdentifier, validateStudentId } from '../../features/auth/validation';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { TextField } from '../ui/TextField';

interface OtpFieldProps {
  id: string;
  studentId: string;
  password?: string;
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  purpose?: 'signup' | 'password-reset';
}

function otpFailureMessage(code: string): string {
  if (code === 'network') return 'Connect to the internet and try again.';
  if (code === 'configuration_error') return 'OTP delivery is not configured. Contact the Seminex administrator.';
  if (code === 'rate_limited') return 'Too many requests. Wait a little while, then try again.';
  if (code === 'student_id_taken') return 'An account already exists for this Student ID. Sign in or reset its password.';
  return 'The OTP could not be processed. Check the code and try again.';
}

/** Shared signup OTP input. OTP delivery and verification are handled by Supabase Auth. */
export function OtpField({ id, studentId, password, verified, onVerifiedChange, purpose = 'signup' }: OtpFieldProps) {
  const online = useOnlineStatus();
  const { remaining, start } = useCooldown(RESEND_COOLDOWN_SECONDS, false);
  const validIdentifier = purpose === 'signup'
    ? !validateStudentId(studentId)
    : !validatePasswordResetIdentifier(studentId);
  const [sent, setSent] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState('');

  async function sendOtp() {
    if (!online || busy || remaining > 0) return;
    setBusy('send');
    setError('');
    onVerifiedChange(false);
    const result = purpose === 'signup'
      ? sent
        ? await api.resendVerification(`${studentId}@${STUDENT_EMAIL_DOMAIN}`)
        : await api.sendSignupOtp(studentId, password ?? '')
      : await api.sendPasswordResetOtp(studentId);
    setBusy(null);
    if (!result.ok) {
      setError(otpFailureMessage(result.error.code));
      return;
    }
    setSent(true);
    setValue('');
    start();
  }

  async function verifyOtp() {
    if (!online || busy || value.length !== 6) return;
    setBusy('verify');
    setError('');
    const result = purpose === 'signup' ? await api.verifySignupOtp(studentId, value) : await api.verifyPasswordResetOtp(studentId, value);
    setBusy(null);
    if (!result.ok) {
      onVerifiedChange(false);
      setError(otpFailureMessage(result.error.code));
      return;
    }
    onVerifiedChange(true);
  }

  const canSend = validIdentifier && (purpose !== 'signup' || sent || Boolean(password)) && online && !busy && remaining === 0 && !verified;

  return (
    <div className="space-y-3 border-t border-border-subtle pt-4">
      {!sent ? (
        <Button variant="secondary" type="button" onClick={() => void sendOtp()} disabled={!canSend}>
          {busy === 'send' ? 'Sending OTP…' : 'Send OTP'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            {!verified && (
              <div className="absolute right-0 top-0 flex items-center">
                <button
                  type="button"
                  onClick={() => void sendOtp()}
                  disabled={!canSend}
                  className="inline-flex min-h-6 items-center font-body-sm-medium text-body-sm-medium tabular-nums text-primary transition-colors hover:text-maroon-dark disabled:cursor-not-allowed disabled:text-text-subtle"
                >
                  {busy === 'send' ? 'Sending…' : remaining > 0 ? `Resend in ${remaining}s` : 'Resend OTP'}
                </button>
              </div>
            )}
            <TextField
              id={id}
              label="One-time password"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter 6-digit code"
              value={value}
              error={error || undefined}
              onChange={(next) => {
                setValue(next.replace(/\D/g, '').slice(0, 6));
                if (error) setError('');
              }}
              disabled={verified || !online}
            />
          </div>

          {verified ? (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-lg bg-status-available-container px-3 py-2.5 font-body-sm-medium text-body-sm-medium text-status-available"
            >
              <Icon name="check_circle" size={18} />
              <span>OTP verified</span>
            </p>
          ) : (
            <Button
              variant="secondary"
              type="button"
              onClick={() => void verifyOtp()}
              disabled={busy !== null || !online || value.length !== 6}
            >
              {busy === 'verify' ? 'Verifying…' : 'Verify OTP'}
            </Button>
          )}
        </div>
      )}

      {!sent && error && (
        <p role="alert" className="font-body-sm text-body-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
