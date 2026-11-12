import { Navigate } from 'react-router-dom';

/** Kept for existing links; verification is completed with an OTP during account creation. */
export default function VerifyEmailPage() {
  return <Navigate to="/sign-in" replace />;
}
