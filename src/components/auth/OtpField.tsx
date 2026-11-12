import { useState } from 'react';
import { api } from '../../api/client';
import { RESEND_COOLDOWN_SECONDS, STUDENT_EMAIL_DOMAIN } from '../../config';
import { useCooldown } from '../../hooks/useCooldown';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { validateStudentId } from '../../features/auth/validation';
import { Button } from '../ui/Button';
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
  const validStudentId = !validateStudentId(studentId);
  const [sent, setSent] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function sendOtp() {
    if (!online || busy || remaining > 0) return;
    setBusy(true);
    setMessage('');
    onVerifiedChange(false);
    const result = purpose === 'signup'
      ? sent
        ? await api.resendVerification(`${studentId}@${STUDENT_EMAIL_DOMAIN}`)
        : await api.sendSignupOtp(studentId, password ?? '')
      : await api.sendPasswordResetOtp(studentId);
    setBusy(false);
    if (!result.ok) {
      setMessage(otpFailureMessage(result.error.code));
      return;
    }
    setSent(true);
    setValue('');
    start();
    setMessage('OTP sent. Enter the 6-digit code to verify your account.');
  }

  async function verifyOtp() {
    if (!online || busy || value.length !== 6) return;
    setBusy(true);
    setMessage('');
    const result = purpose === 'signup' ? await api.verifySignupOtp(studentId, value) : await api.verifyPasswordResetOtp(studentId, value);
    setBusy(false);
    if (!result.ok) {
      onVerifiedChange(false);
      setMessage(otpFailureMessage(result.error.code));
      return;
    }
    onVerifiedChange(true);
    setMessage('OTP verified.');
  }

  return (
    <div className="space-y-3 rounded-xl bg-cream-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" type="button" onClick={() => void sendOtp()} disabled={!validStudentId || (purpose === 'signup' && !sent && !password) || !online || busy || remaining > 0 || verified}>
          {busy ? 'Sending…' : sent ? remaining > 0 ? `Resend OTP in ${remaining}s` : 'Resend OTP' : 'Send OTP'}
        </Button>
        {sent && <span className="font-caption text-caption text-text-secondary">A code was sent to your institutional email.</span>}
      </div>
      {sent && (
        <>
          <TextField
            id={id}
            label="One-time password"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            value={value}
            onChange={(next) => setValue(next.replace(/\D/g, '').slice(0, 6))}
            disabled={verified || !online}
          />
          <Button variant="secondary" type="button" onClick={() => void verifyOtp()} disabled={verified || busy || !online || value.length !== 6}>
            {verified ? 'OTP verified' : busy ? 'Verifying…' : 'Verify OTP'}
          </Button>
        </>
      )}
      {message && <p role="status" aria-live="polite" className="font-caption text-caption text-text-secondary">{message}</p>}
    </div>
  );
}
