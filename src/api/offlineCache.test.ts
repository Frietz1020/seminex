import { beforeEach, describe, expect, it } from 'vitest';
import type { SeminarListItem } from './types';
import { cacheItem, readItem } from './offlineCache';

const webinarItem: SeminarListItem = {
  seminar: {
    id: 'webinar-1',
    seminarType: 'webinar',
    reference: 'WEB-1',
    title: 'Online seminar',
    description: 'Online session',
    speaker: { name: 'Speaker', role: 'Guest' },
    venue: '',
    department: 'CCS',
    topics: [],
    startsAt: '2026-11-06T08:00:00.000Z',
    endsAt: '2026-11-06T10:00:00.000Z',
    capacity: 20,
    registeredCount: 1,
    requiredAttendancePercent: 60,
    joinUrl: 'https://meet.example.test/private-room',
  },
  registration: {
    reference: 'TKT-1',
    registeredAt: '2026-11-01T00:00:00.000Z',
    status: 'confirmed',
    confirmedAt: '2026-11-01T00:01:00.000Z',
    attendanceAckAt: null,
    timeIn: null,
    timeOut: null,
    evaluationSubmittedAt: null,
    certificateIssuedAt: null,
  },
};

describe('student offline cache', () => {
  beforeEach(() => localStorage.clear());

  it('never stores a server-gated webinar join URL', () => {
    cacheItem('209999901', webinarItem);

    expect(readItem('209999901', webinarItem.seminar.id)?.seminar.joinUrl).toBeUndefined();
    expect(localStorage.getItem('seminex.offline.v3.209999901')).not.toContain('private-room');
  });

  it('removes webinar join URLs left in older version-three cache entries', () => {
    localStorage.setItem('seminex.offline.v3.209999901', JSON.stringify({
      version: 3,
      cachedAt: '2026-11-06T00:00:00.000Z',
      items: { [webinarItem.seminar.id]: webinarItem },
      tickets: {},
    }));

    expect(readItem('209999901', webinarItem.seminar.id)?.seminar.joinUrl).toBeUndefined();
    expect(localStorage.getItem('seminex.offline.v3.209999901')).not.toContain('private-room');
  });
});
