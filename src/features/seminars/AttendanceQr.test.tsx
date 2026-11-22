import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ issueAttendanceChallenge: vi.fn(), getServerTime: vi.fn() }));
vi.mock('../../api/client', () => ({ api: {
  issueAttendanceChallenge: mocks.issueAttendanceChallenge,
  getServerTime: mocks.getServerTime,
} }));
vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));

import { AttendanceQr, attendanceChallengePayload, parseAttendanceChallengePayload } from './AttendanceQr';

const startsAt = Date.parse('2026-11-14T10:00:00.000Z');
const endsAt = Date.parse('2026-11-14T11:00:00.000Z');
const expiresAt = new Date(endsAt + 60 * 60_000).toISOString();

describe('attendance QR payload', () => {
  it('contains only the live opaque challenge and never a Student ID', () => {
    expect(attendanceChallengePayload('a'.repeat(64))).toBe(`SEMINEX1:${'a'.repeat(64)}`);
    expect(attendanceChallengePayload('a'.repeat(64))).not.toContain('202410770');
  });

  it('rejects malformed challenge data', () => {
    expect(() => attendanceChallengePayload('202410770')).toThrow();
  });

  it('parses only the Seminex challenge format', () => {
    expect(parseAttendanceChallengePayload(`SEMINEX1:${'c'.repeat(64)}`)).toBe('c'.repeat(64));
    expect(parseAttendanceChallengePayload('202410770')).toBeNull();
    expect(parseAttendanceChallengePayload(`SEMINEX1:${'c'.repeat(63)}`)).toBeNull();
  });
});

describe('attendance challenge timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(startsAt - 1_000);
    mocks.issueAttendanceChallenge.mockReset().mockResolvedValue({ ok: true, data: {
      challenge: 'a'.repeat(64), expiresAt,
    } });
    mocks.getServerTime.mockReset().mockResolvedValue({ ok: true, data: { now: new Date(startsAt - 999).toISOString() } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('requests one QR immediately after acknowledgement, even before seminar start', async () => {
    const props = {
      seminarId: 'seminar-1',
      title: 'Upcoming seminar',
      size: 128,
      acknowledged: true,
      endsAt: new Date(endsAt).toISOString(),
      serverNow: startsAt - 1_000,
    };
    const view = render(<AttendanceQr {...props} />);

    await act(async () => { await Promise.resolve(); });
    expect(mocks.issueAttendanceChallenge).toHaveBeenCalledTimes(1);
    expect(mocks.issueAttendanceChallenge).toHaveBeenCalledWith('seminar-1');
    expect(screen.getByRole('img', { name: /Attendance QR/i })).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Time-In and Time-Out');
    expect(screen.getByRole('status').textContent).not.toContain('Refreshes automatically');
    view.rerender(<AttendanceQr {...props} serverNow={startsAt + 30_000} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(mocks.issueAttendanceChallenge).toHaveBeenCalledTimes(1);
  });

  it('does not request a QR before attendance acknowledgement is saved', () => {
    render(<AttendanceQr
      seminarId="seminar-1"
      title="Upcoming seminar"
      size={128}
      acknowledged={false}
      endsAt={new Date(endsAt).toISOString()}
      serverNow={startsAt}
    />);

    expect(mocks.issueAttendanceChallenge).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('acknowledgement');
  });

  it('does not issue overlapping challenges while checking the server clock', async () => {
    let resolveServerTime: ((value: { ok: true; data: { now: string } }) => void) | undefined;
    mocks.getServerTime.mockReturnValue(new Promise((resolve) => { resolveServerTime = resolve; }));
    const props = {
      seminarId: 'seminar-1',
      title: 'Active seminar',
      size: 128,
      acknowledged: true,
      endsAt: new Date(endsAt).toISOString(),
      serverNow: startsAt - 1_000,
    };
    const view = render(<AttendanceQr {...props} />);
    await act(async () => { await Promise.resolve(); });

    expect(mocks.issueAttendanceChallenge).toHaveBeenCalledTimes(1);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);
    view.rerender(<AttendanceQr {...props} serverNow={startsAt + 5_000} />);
    await act(async () => { await Promise.resolve(); });
    expect(mocks.issueAttendanceChallenge).toHaveBeenCalledTimes(1);
    expect(mocks.getServerTime).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveServerTime?.({ ok: true, data: { now: new Date(startsAt + 5_000).toISOString() } });
      await Promise.resolve();
    });
  });

  it('hides the QR at its server-provided seminar-end-plus-one-hour deadline', async () => {
    const nowAtRequest = endsAt + 30 * 60_000;
    vi.setSystemTime(nowAtRequest);
    mocks.getServerTime.mockImplementation(async () => ({ ok: true, data: { now: new Date(Date.now()).toISOString() } }));
    render(<AttendanceQr
      seminarId="seminar-1"
      title="Active seminar"
      size={128}
      acknowledged
      endsAt={new Date(endsAt).toISOString()}
      serverNow={nowAtRequest}
    />);

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('img', { name: /Attendance QR/i })).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
    expect(screen.getByRole('img', { name: /Attendance QR/i })).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByRole('img', { name: /Attendance QR/i })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('expired');
  });

  it('refreshes server time when the QR page becomes visible', async () => {
    render(<AttendanceQr
      seminarId="seminar-1"
      title="Active seminar"
      size={128}
      acknowledged
      endsAt={new Date(endsAt).toISOString()}
      serverNow={endsAt - 10_000}
    />);
    await act(async () => { await Promise.resolve(); });
    mocks.getServerTime.mockResolvedValue({ ok: true, data: { now: new Date(Date.parse(expiresAt) + 1).toISOString() } });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mocks.getServerTime.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('img', { name: /Attendance QR/i })).toBeNull();
  });
});
