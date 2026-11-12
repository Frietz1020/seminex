import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '../api/client';
import type { SessionIdentity } from '../api/types';
import { subscribeAuthState } from '../api/supabaseClient';
import { clearPrivateUserData } from './privateData';
import {
  clearSession,
  expireSession,
  getCachedIdentity,
  getSessionIdentity,
  saveCachedIdentity,
  subscribeSession,
} from './storage';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; identity: SessionIdentity }
  | { status: 'offline'; identity: SessionIdentity | null };

/** Synchronous safe identity snapshot for shells and data loaders. */
export function useSession(): SessionIdentity | null {
  return useSyncExternalStore(subscribeSession, getSessionIdentity, () => null);
}

/** Bootstraps identity from the API and keeps local identity limited to shell rendering. */
export function useSessionState(isOnline: boolean): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const load = async () => {
      const currentRequest = ++requestId;
      const result = await api.getSession();
      if (!active || currentRequest !== requestId) return;
      if (result.ok) {
        if (result.data) {
          if (result.data.expiresAt <= Date.now()) {
            const departing = getCachedIdentity();
            if (departing) await clearPrivateUserData(departing.studentId);
            expireSession();
            setState({ status: 'signedOut' });
            return;
          }
          const previous = getCachedIdentity();
          if (previous && previous.studentId !== result.data.studentId) {
            await clearPrivateUserData(previous.studentId);
          }
          saveCachedIdentity(result.data);
          setState({ status: 'signedIn', identity: result.data });
          return;
        }
        const departing = getCachedIdentity();
        if (departing) await clearPrivateUserData(departing.studentId);
        clearSession();
        setState({ status: 'signedOut' });
        return;
      }
      if (result.error.code === 'network') {
        setState({ status: 'offline', identity: getCachedIdentity() });
        return;
      }
      if (result.error.code === 'session_expired') {
        const departing = getCachedIdentity();
        if (departing) await clearPrivateUserData(departing.studentId);
        expireSession();
        setState({ status: 'signedOut' });
        return;
      }
      const departing = getCachedIdentity();
      if (departing) await clearPrivateUserData(departing.studentId);
      clearSession();
      setState({ status: 'signedOut' });
    };
    void load();

    const unsubscribe = subscribeSession(() => {
      const identity = getSessionIdentity();
      if (identity) setState({ status: 'signedIn', identity });
      else setState({ status: 'signedOut' });
    });
    const refreshAfterAuth = () => {
      if (active) void load();
    };
    const unsubscribeAuth = subscribeAuthState(refreshAfterAuth);
    window.addEventListener('seminex:session-changed', refreshAfterAuth);
    return () => {
      active = false;
      unsubscribe();
      unsubscribeAuth();
      window.removeEventListener('seminex:session-changed', refreshAfterAuth);
    };
  }, [isOnline]);

  return state;
}
