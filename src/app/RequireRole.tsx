import { Navigate, Outlet } from 'react-router-dom';
import type { SessionRole } from '../api/types';
import { useSession } from '../session/useSession';

interface RequireRoleProps {
  allow: readonly SessionRole[];
  /** Where a signed-in person without an allowed role goes. */
  redirectTo: string | ((role: SessionRole) => string);
}

/** Place inside RequireSession. Sends a signed-in person whose role is not allowed somewhere they can use. */
export function RequireRole({ allow, redirectTo }: RequireRoleProps) {
  const session = useSession();
  if (!session) return null;
  if (allow.includes(session.role)) return <Outlet />;
  const target = typeof redirectTo === 'function' ? redirectTo(session.role) : redirectTo;
  return <Navigate to={target} replace />;
}