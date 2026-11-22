import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  recordOrgChallengeScan: vi.fn(),
  recordOrgScan: vi.fn(),
  reload: vi.fn(),
  now: Date.parse('2026-11-14T11:00:00.000Z'),
  listing: null as unknown,
}));

vi.mock('../../../api/client', () => ({ api: { recordOrgChallengeScan: mocks.recordOrgChallengeScan, recordOrgScan: mocks.recordOrgScan } }));
vi.mock('../../../hooks/useNow', () => ({ useNow: () => mocks.now }));
vi.mock('../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../../hooks/useResource', () => ({
  useResource: (_loader: unknown, key: string) => ({
    state: { status: 'success', data: key.startsWith('scanner-seminar-') ? mocks.listing : [] },
    reload: mocks.reload,
  }),
}));

import OrgScannerPage from './OrgScannerPage';

const challenge = 'a'.repeat(64);
const rawQr = `SEMINEX1:${challenge}`;
let cameraQr: string | undefined = rawQr;
const originalBarcodeDetector = Object.getOwnPropertyDescriptor(window, 'BarcodeDetector');
const originalReadyState = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState');
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalDialogClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

describe('organization attendance camera scan', () => {
  beforeEach(() => {
    cameraQr = rawQr;
    mocks.reload.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(mocks.now);
    mocks.listing = {
      seminars: {
        items: [{
          id: 'seminar-1',
          title: 'Current seminar',
          reference: 'SEM-1',
          seminarType: 'seminar',
          startsAt: '2026-11-14T10:00:00.000Z',
          endsAt: '2026-11-14T12:00:00.000Z',
        }],
      },
      drafts: { items: [] },
    };
    mocks.recordOrgChallengeScan.mockReset().mockResolvedValue({
      ok: false,
      error: { code: 'not_available' },
    });
    mocks.recordOrgScan.mockReset().mockResolvedValue({
      ok: true,
      data: {
        entry: { kind: 'time_in' },
        student: { firstName: 'Test', lastName: 'Student', studentId: '207000711' },
      },
    });

    class BarcodeDetectorMock {
      async detect() { return cameraQr ? [{ rawValue: cameraQr }] : []; }
    }
    Object.defineProperty(window, 'BarcodeDetector', { configurable: true, value: BarcodeDetectorMock });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 2 });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function showModal(this: HTMLDialogElement) { this.open = true; },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function close(this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalBarcodeDetector) Object.defineProperty(window, 'BarcodeDetector', originalBarcodeDetector);
    else Reflect.deleteProperty(window, 'BarcodeDetector');
    if (originalReadyState) Object.defineProperty(HTMLMediaElement.prototype, 'readyState', originalReadyState);
    else Reflect.deleteProperty(HTMLMediaElement.prototype, 'readyState');
    if (originalMediaDevices) Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
    if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    if (originalDialogClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalDialogClose);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  });

  it('requires an explicit QR scan mode before the camera can start', () => {
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );

    expect((screen.getByRole('radio', { name: 'Time-In' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('radio', { name: 'Time-Out' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('button', { name: 'Start camera' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('passes the selected QR mode to the scan API', async () => {
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Time-Out' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledWith(expect.objectContaining({ kind: 'time_out' }));
  });

  it('uses a distinct idempotency key when the selected mode changes for a retry', async () => {
    mocks.recordOrgChallengeScan
      .mockResolvedValueOnce({ ok: false, error: { code: 'network' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'conflict' } });
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Time-In' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cameraQr = undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_600); });
    fireEvent.click(screen.getByRole('radio', { name: 'Time-Out' }));
    cameraQr = rawQr;
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    const first = mocks.recordOrgChallengeScan.mock.calls[0]?.[0];
    const second = mocks.recordOrgChallengeScan.mock.calls[1]?.[0];
    expect(first).toMatchObject({ kind: 'time_in' });
    expect(second).toMatchObject({ kind: 'time_out' });
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('reuses a key only for an uncertain retry, then creates a new key for the next QR', async () => {
    mocks.recordOrgChallengeScan
      .mockResolvedValueOnce({ ok: false, error: { code: 'network' } })
      .mockResolvedValue({ ok: true, data: {
        entry: { kind: 'time_in' },
        student: { firstName: 'Test', lastName: 'Student', studentId: '207000711' },
      } });
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Time-In' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cameraQr = undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_600); });
    cameraQr = rawQr;
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cameraQr = undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_600); });
    cameraQr = `SEMINEX1:${'b'.repeat(64)}`;
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    const first = mocks.recordOrgChallengeScan.mock.calls[0]?.[0];
    const retry = mocks.recordOrgChallengeScan.mock.calls[1]?.[0];
    const nextScan = mocks.recordOrgChallengeScan.mock.calls[2]?.[0];
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    expect(nextScan.idempotencyKey).not.toBe(retry.idempotencyKey);
  });

  it('allows manual Student ID entry without QR mode or reason', async () => {
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Manually enter Student ID'), { target: { value: '207000711' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record manual entry' }));
    await act(async () => { await Promise.resolve(); });

    expect(mocks.recordOrgScan).toHaveBeenCalledWith(expect.objectContaining({ method: 'manual', reason: undefined }));
  });

  it('shows successful manual attendance in a dialog', async () => {
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Manually enter Student ID'), { target: { value: '207000711' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record manual entry' }));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('dialog').textContent).toMatch(/Manual Time-In recorded successfully/i);
  });

  it('keeps a supplied manual reason when recording without selecting a QR mode', async () => {
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Manually enter Student ID'), { target: { value: '207000711' } });
    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: '  ID verified  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record manual entry' }));
    await act(async () => { await Promise.resolve(); });

    expect(mocks.recordOrgScan).toHaveBeenCalledWith(expect.objectContaining({ method: 'manual', reason: 'ID verified' }));
  });

  it('does not resubmit the same camera QR after a terminal not_available response', async () => {
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Time-In' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });

    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog').textContent).toMatch(/This QR has expired or attendance is outside the scan window\./i);
  });

  it('explains that a new live QR is needed after the server says the challenge expired', async () => {
    mocks.recordOrgChallengeScan.mockResolvedValue({ ok: false, error: { code: 'challenge_expired' } });
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Time-In' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(screen.getByRole('dialog').textContent).toMatch(/QR challenge expired/i);
    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['time_in', 'Time-In'],
    ['time_out', 'Time-Out'],
  ] as const)('shows a mode-specific already-recorded dialog for %s', async (kind, label) => {
    mocks.recordOrgChallengeScan.mockResolvedValue({ ok: false, error: { code: 'attendance_already_recorded' } });
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('radio', { name: label }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledWith(expect.objectContaining({ kind }));
    expect(screen.getByRole('dialog').textContent).toMatch(new RegExp(`${label} is already recorded`, 'i'));
  });

  it('pauses camera while feedback is open and allows the same QR in the other mode after close', async () => {
    mocks.recordOrgChallengeScan.mockResolvedValue({ ok: true, data: {
      entry: { kind: 'time_in' },
      student: { firstName: 'Test', lastName: 'Student', studentId: '207000711' },
    } });
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Time-In' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByRole('dialog').textContent).toMatch(/Time-in recorded/i);

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Time-Out' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledTimes(2);
    expect(mocks.recordOrgChallengeScan.mock.calls[1]?.[0]).toMatchObject({ kind: 'time_out' });
  });

  it('allows an intentional repeat of a QR after it leaves and re-enters the camera', async () => {
    mocks.recordOrgChallengeScan
      .mockResolvedValueOnce({ ok: true, data: {
        entry: { kind: 'time_in' },
        student: { firstName: 'Test', lastName: 'Student', studentId: '207000711' },
      } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'attendance_already_recorded' } });
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Time-In' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledTimes(1);

    cameraQr = undefined;
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); });
    cameraQr = rawQr;
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(mocks.recordOrgChallengeScan).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('dialog').textContent).toMatch(/Time-In is already recorded/i);
  });

  it.each([
    ['outside_scan_window', /outside the scan window/i],
    ['wrong_attendance_step', /selected mode does not match/i],
    ['attendance_already_complete', /already has both/i],
    ['forbidden', /organization access does not allow/i],
    ['server_error', /attendance service could not process/i],
  ] as const)('shows actionable feedback for %s', async (code, message) => {
    mocks.recordOrgChallengeScan.mockResolvedValue({ ok: false, error: { code } });
    render(
      <MemoryRouter initialEntries={['/org/scanner/seminar-1']}>
        <Routes><Route path="/org/scanner/:id" element={<OrgScannerPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Time-In' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start camera' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(screen.getByRole('dialog').textContent).toMatch(message);
  });
});
