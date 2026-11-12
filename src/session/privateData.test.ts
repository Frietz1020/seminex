import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPrivateUserData } from './privateData';

describe('private data cleanup', () => {
  beforeEach(() => localStorage.clear());

  it('removes per-user reads, drafts, organization cache, and service-worker caches', async () => {
    localStorage.setItem('seminex.offline.v3.student-1', '{"private":"read and draft"}');
    localStorage.setItem('seminex.org.offline.v1.student-1', '{"private":"org data"}');
    localStorage.setItem('seminex.offline.v3.student-2', '{"private":"other account"}');
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['workbox-precache-v1', 'seminex-runtime']), delete: del });

    await clearPrivateUserData('student-1');

    expect(localStorage.getItem('seminex.offline.v3.student-1')).toBeNull();
    expect(localStorage.getItem('seminex.org.offline.v1.student-1')).toBeNull();
    expect(localStorage.getItem('seminex.offline.v3.student-2')).not.toBeNull();
    expect(del).toHaveBeenCalledTimes(2);
  });
});
