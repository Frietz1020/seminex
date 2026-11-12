import { Navigate, Outlet } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { wasExpired } from '../session/storage';
import { useSessionState } from '../session/useSession';

const SIGN_IN_PATH = '/sign-in';
const SESSION_EXPIRED_PATH = '/sign-in?reason=session-expired';

/**
 * Sends anyone without a valid session to sign in. An expired session carries the
 * session-expired reason. While offline, the clock is not used to expire the session,
 * so cached tickets stay viewable; the server decides on the next online request.
 */
export function RequireSession() {
  const online = useOnlineStatus();
  const state = useSessionState(online);

  if (state.status === 'loading') {
    return <div role="status" aria-live="polite">Checking your session…</div>;
  }
  if (state.status === 'signedOut' && wasExpired()) {
    return <Navigate to={SESSION_EXPIRED_PATH} replace />;
  }
  if ((state.status === 'signedIn' || state.status === 'offline') && state.identity?.onboardingComplete === false) {
    return <Navigate to="/sign-up?resume=1" replace />;
  }
  if (state.status === 'signedIn' || (state.status === 'offline' && state.identity)) return <Outlet />;
  return <Navigate to={SIGN_IN_PATH} replace />;
}
