import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  now: 0,
  seminars: [] as unknown,
  reload: vi.fn(),
  acknowledgeAttendance: vi.fn(),
  cancelRegistration: vi.fn(),
}));

vi.mock('../../api/client', () => ({ api: {
  listSeminars: vi.fn(),
  acknowledgeAttendance: mocks.acknowledgeAttendance,
  cancelRegistration: mocks.cancelRegistration,
} }));
vi.mock('../../hooks/useNow', () => ({ useNow: () => mocks.now }));
vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../hooks/useResource', () => ({ useResource: () => ({
  state: { status: 'success', data: mocks.seminars, fromCache: false },
  reload: mocks.reload,
}) }));
vi.mock('../ui/Dialog', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <section role="dialog" aria-label={title}>{children}</section> : null,
}));

import { AttendancePrompt } from './AttendancePrompt';

const startsAt = Date.parse('2026-11-16T10:00:00.000Z');

function seminarItem({ confirmationClosesMinutesBefore = 60, confirmedAt, attendanceAckAt = null }: {
  confirmationClosesMinutesBefore?: number;
  confirmedAt: string;
  attendanceAckAt?: string | null;
}) {
  return {
    seminar: {
      id: 'seminar-late',
      title: 'Late registration seminar',
      startsAt: new Date(startsAt).toISOString(),
      confirmationClosesMinutesBefore,
    },
    registration: {
      status: 'confirmed',
      confirmedAt,
      attendanceAckAt,
    },
  };
}

describe('attendance acknowledgement prompt timing', () => {
  beforeEach(() => {
    mocks.now = startsAt - 3 * 60 * 60_000;
    mocks.seminars = [];
  });

  afterEach(() => cleanup());

  it('prompts a late signup immediately after its confirmation cutoff', () => {
    mocks.seminars = [seminarItem({
      confirmationClosesMinutesBefore: 240,
      confirmedAt: new Date(mocks.now).toISOString(),
    })];

    render(<AttendancePrompt />);

    expect(screen.getByRole('dialog', { name: 'Still attending?' })).not.toBeNull();
    expect(screen.getByText('Late registration seminar')).not.toBeNull();
  });

  it('keeps an ordinary confirmation on the existing one-hour prompt schedule', () => {
    mocks.seminars = [seminarItem({
      confirmationClosesMinutesBefore: 240,
      confirmedAt: new Date(startsAt - 5 * 60 * 60_000).toISOString(),
    })];

    render(<AttendancePrompt />);

    expect(screen.queryByRole('dialog', { name: 'Still attending?' })).toBeNull();
  });
});
