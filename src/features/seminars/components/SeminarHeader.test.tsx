import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Registration, Seminar } from '../../../api/types';

const mocks = vi.hoisted(() => ({
  getTicketPdf: vi.fn(),
  saveBlob: vi.fn(),
  expireSession: vi.fn(),
}));

vi.mock('../../../api/client', () => ({ api: { getTicketPdf: mocks.getTicketPdf } }));
vi.mock('../../history/saveBlob', () => ({ saveBlob: mocks.saveBlob }));
vi.mock('../../../session/storage', () => ({ expireSession: mocks.expireSession }));

import { SeminarHeader } from './SeminarHeader';

const seminar: Seminar = {
  id: 'seminar-1',
  reference: 'SEM/2026:01',
  title: 'Secure Systems Workshop',
  description: '',
  speaker: { name: 'Alex Speaker', role: 'Engineer' },
  venue: 'CCS Auditorium',
  department: 'CCS',
  topics: [],
  startsAt: '2026-11-10T09:00:00+08:00',
  endsAt: '2026-11-10T12:00:00+08:00',
  capacity: 100,
  registeredCount: 1,
  requiredAttendancePercent: 60,
};
const registration: Registration = {
  reference: 'SNX-TICKET-0001',
  registeredAt: '2026-11-01T10:00:00+08:00',
  status: 'confirmed',
  timeIn: null,
  timeOut: null,
  evaluationSubmittedAt: null,
  certificateIssuedAt: null,
};

function renderHeader() {
  return render(
    <MemoryRouter>
      <SeminarHeader seminar={seminar} registration={registration} primaryStatus="available" />
    </MemoryRouter>,
  );
}

describe('SeminarHeader ticket PDF download', () => {
  beforeEach(() => {
    mocks.getTicketPdf.mockReset();
    mocks.saveBlob.mockReset();
    mocks.expireSession.mockReset();
  });

  it('downloads a successful PDF with a sanitized seminar filename', async () => {
    const user = userEvent.setup();
    const pdf = new Blob(['pdf'], { type: 'application/pdf' });
    mocks.getTicketPdf.mockResolvedValue({ ok: true, data: pdf });
    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(mocks.getTicketPdf).toHaveBeenCalledWith('seminar-1');
    expect(mocks.saveBlob).toHaveBeenCalledWith(pdf, 'seminex-SEM_2026_01-ticket.pdf');
  });

  it('shows the preparing state while the request is pending', async () => {
    let finish!: (result: { ok: true; data: Blob }) => void;
    mocks.getTicketPdf.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderHeader();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(screen.getByText('Preparing PDF...').textContent).toBe('Preparing PDF...');
    finish({ ok: true, data: new Blob(['pdf'], { type: 'application/pdf' }) });
    await waitFor(() => expect(screen.queryByText('Preparing PDF...')).toBeNull());
  });

  it('directs the applicant to the QR ticket when PDF generation is unavailable', async () => {
    mocks.getTicketPdf.mockResolvedValue({ ok: false, error: { code: 'not_available' } });
    renderHeader();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(screen.getByRole('alert').textContent).toContain('PDF could not be generated. Use the QR code on the QR ticket tab instead.');
  });

  it('expires the session for an expired caller session', async () => {
    mocks.getTicketPdf.mockResolvedValue({ ok: false, error: { code: 'session_expired' } });
    renderHeader();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(mocks.expireSession).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the standard network error', async () => {
    mocks.getTicketPdf.mockResolvedValue({ ok: false, error: { code: 'network' } });
    renderHeader();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(screen.getByRole('alert').textContent).toContain('Seminex could not be reached. Check your connection and try again.');
  });
});
