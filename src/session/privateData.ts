import { clearOrgOfflineCache } from '../api/orgOfflineCache';
import { clearOfflineCache } from '../api/offlineCache';

/** Clears account-scoped app data and origin service-worker caches when an account leaves. */
export async function clearPrivateUserData(accountId: string): Promise<void> {
  clearOfflineCache(accountId);
  clearOrgOfflineCache(accountId);
  try {
    if (typeof caches === 'undefined') return;
    const names = await caches.keys();
    await Promise.allSettled(names.map((name) => caches.delete(name)));
  } catch {
    // CacheStorage can be unavailable in restricted browser contexts; account storage is still cleared.
  }
}
