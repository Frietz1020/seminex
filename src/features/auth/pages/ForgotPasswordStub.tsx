import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { OtpField } from '../../../components/auth/OtpField';
import { PasswordField } from '../../../components/ui/PasswordField';
import { PasswordRules } from '../../../components/auth/PasswordRules';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { api } from '../../../api/client';
import { sanitizeStudentId, validateNewPassword, validateStudentId } from '../validation';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const error = validateNewPassword(password);
    if (validateStudentId(studentId) || !verified || error) { setMessage(error ?? 'Enter your Student ID and verify the OTP first.'); return; }
    setBusy(true);
    const result = await api.resetPassword(studentId, password);
    setBusy(false);
    if (!result.ok) { setMessage('Your password could not be reset. Connect and try again.'); return; }
    navigate('/sign-in', { replace: true, state: { message: 'Password reset. Sign in with your new password.' } });
  }

  return (
    <AuthLayout brandMessage="Reset your password" brandSupportingText="Verify your Student ID, then choose a new password.">
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <TextField id="reset-student-id" label="Student ID" required inputMode="numeric" autoComplete="username" value={studentId} onChange={(value) => { setStudentId(sanitizeStudentId(value)); setVerified(false); }} error={studentId ? validateStudentId(studentId) : undefined} />
        <OtpField id="reset-otp" studentId={studentId} verified={verified} onVerifiedChange={setVerified} purpose="password-reset" />
        <div><PasswordField id="reset-password" label="New password" required autoComplete="new-password" value={password} onChange={setPassword} error={password ? validateNewPassword(password) : undefined} /><PasswordRules password={password} /></div>
        {message && <p role="alert" className="font-body-sm text-body-sm text-danger">{message}</p>}
        <Button type="submit" loading={busy} loadingLabel="Resetting password...">Reset password</Button>
        <Link to="/sign-in" className="inline-flex min-h-11 items-center font-body-sm-medium text-body-sm-medium text-primary hover:underline">Back to sign in</Link>
      </form>
    </AuthLayout>
  );
}
