import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { expireSession, wasExpired } from '../session/storage';
import { useSession } from '../session/useSession';

const SIGN_IN_PATH = '/sign-in';
const SESSION_EXPIRED_PATH = '/sign-in?reason=session-expired';

/**
 * Sends anyone without a valid session to sign in. An expired session carries the
 * session-expired reason. While offline, the clock is not used to expire the session,
 * so cached tickets stay viewable; the server decides on the next online request.
 */
export function RequireSession() {
  const session = useSession();
  const online = useOnlineStatus();
  const clockExpired = session !== null && online && session.expiresAt <= Date.now();

  useEffect(() => {
    if (clockExpired) expireSession();
  }, [clockExpired]);

  if (clockExpired || (!session && wasExpired())) {
    return <Navigate to={SESSION_EXPIRED_PATH} replace />;
  }
  if (!session) return <Navigate to={SIGN_IN_PATH} replace />;
  return <Outlet />;
}