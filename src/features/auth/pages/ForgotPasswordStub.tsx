import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { OtpField } from '../../../components/auth/OtpField';
import { PasswordField } from '../../../components/ui/PasswordField';
import { PasswordRules } from '../../../components/auth/PasswordRules';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { Button } from '../../../components/ui/Button';
import { TextField } from '../../../components/ui/TextField';
import { api } from '../../../api/client';
import { validateNewPassword, validatePasswordResetIdentifier } from '../validation';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = ['/sign-in', '/organization/sign-in', '/admin/sign-in'].includes(location.state?.returnTo)
    ? location.state.returnTo as string
    : '/sign-in';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Reset password - Seminex';
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const error = validateNewPassword(password);
    if (validatePasswordResetIdentifier(identifier) || !verified || error) { setMessage(error ?? 'Enter your Student ID or faculty email and verify the OTP first.'); return; }
    setBusy(true);
    const result = await api.resetPassword(identifier, password);
    setBusy(false);
    if (!result.ok) { setMessage('Your password could not be reset. Connect and try again.'); return; }
    navigate(returnTo, { replace: true, state: { message: 'Password reset. Sign in with your new password.' } });
  }

  return (
    <AuthLayout brandMessage="Reset your password" brandSupportingText="Verify your Student ID or faculty email, then choose a new password.">
      <div className="mb-6 md:mb-8">
        <h1 className="font-heading text-2xl font-bold text-charcoal-900 md:text-3xl">Reset your password</h1>
        <p className="mt-1.5 text-base text-charcoal-700 md:mt-2">
          Verify your Student ID or faculty email, then choose a new password.
        </p>
      </div>
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <TextField id="reset-account-identifier" label="Student ID or faculty email" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Student ID or name@gordoncollege.edu.ph" value={identifier} onChange={(value) => { setIdentifier(value); setVerified(false); }} error={identifier ? validatePasswordResetIdentifier(identifier) : undefined} />
        <OtpField key={identifier} id="reset-otp" studentId={identifier} verified={verified} onVerifiedChange={setVerified} purpose="password-reset" />
        <div><PasswordField id="reset-password" label="New password" required autoComplete="new-password" value={password} onChange={setPassword} error={password ? validateNewPassword(password) : undefined} /><PasswordRules password={password} /></div>
        {message && <p role="alert" className="font-body-sm text-body-sm text-danger">{message}</p>}
        <Button type="submit" loading={busy} loadingLabel="Resetting password...">Reset password</Button>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to={returnTo} className="inline-flex min-h-11 items-center font-body-sm-medium text-body-sm-medium text-primary hover:underline">Back to sign in</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
