import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, type Profile } from '../api/client';
import { useResource, type ResourceState } from '../hooks/useResource';
import { useSession } from './useSession';

interface ProfileContextValue {
  state: ResourceState<Profile>;
  reload: () => void;
  /** Shows a saved change (new details or photo) everywhere at once, without reloading the profile. */
  replace: (profile: Profile) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** Loads the signed-in student's profile once and shares it with the shell and pages. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { state: loaded, reload } = useResource(() => api.getProfile(), session?.studentId ?? 'none');
  // The replacement is tied to the loaded object, so a fresh load discards it.
  const [override, setOverride] = useState<{ base: Profile; profile: Profile } | null>(null);

  const state = useMemo<ResourceState<Profile>>(() => {
    if (loaded.status === 'success' && override && override.base === loaded.data) {
      return { ...loaded, data: override.profile };
    }
    return loaded;
  }, [loaded, override]);

  const replace = useCallback(
    (profile: Profile) => {
      if (loaded.status === 'success') setOverride({ base: loaded.data, profile });
    },
    [loaded],
  );

  const value = useMemo(() => ({ state, reload, replace }), [state, reload, replace]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside ProfileProvider.');
  return context;
}