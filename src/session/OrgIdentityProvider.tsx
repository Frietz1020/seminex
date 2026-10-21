import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api, type OrgIdentity } from '../api/client';
import { useResource, type ResourceState } from '../hooks/useResource';
import { useSession } from './useSession';

interface OrgIdentityContextValue {
  state: ResourceState<OrgIdentity>;
  reload: () => void;
}

const OrgIdentityContext = createContext<OrgIdentityContextValue | null>(null);

/** Loads the signed-in org member or adviser once and shares it with the org shell and pages. */
export function OrgIdentityProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { state, reload } = useResource(() => api.getOrgIdentity(), session?.studentId ?? 'none');
  const value = useMemo(() => ({ state, reload }), [state, reload]);
  return <OrgIdentityContext.Provider value={value}>{children}</OrgIdentityContext.Provider>;
}

export function useOrgIdentity(): OrgIdentityContextValue {
  const context = useContext(OrgIdentityContext);
  if (!context) throw new Error('useOrgIdentity must be used inside OrgIdentityProvider.');
  return context;
}