import { useSyncExternalStore } from 'react';
import type { Session } from '../api/types';
import { getSession, subscribeSession } from './storage';

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}