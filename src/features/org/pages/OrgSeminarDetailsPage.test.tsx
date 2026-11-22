import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: { regenerateOrgCertificate: vi.fn() },
  useResource: vi.fn(),
  useNow: vi.fn(),
  certificateReload: vi.fn(),
}));

vi.mock('../../../api/client', () => ({ api: mocks.api }));
vi.mock('../../../hooks/useResource', () => ({ useResource: mocks.useResource }));
vi.mock('../../../hooks/useNow', () => ({ useNow: mocks.useNow }));

import OrgSeminarDetailsPage from './OrgSeminarDetailsPage';

const seminar = {
  id: 'seminar-1', reference: 'SEM-CERT', title: 'Certificate Recovery Seminar',
  startsAt: '2026-11-16T10:00:00.000Z', endsAt: '2026-11-16T11:00:00.000Z',
  requiredAttendancePercent: 60, publicationStatus: 'published', seminarType: 'seminar',
  speaker: { name: 'Speaker', role: 'Presenter' }, venue: 'Hall', department: 'CCS', topics: [], capacity: 10,
};

const records = [
  { id: 'registration-issued', seminarId: 'seminar-1', studentId: '209000001', state: 'issued', reason: 'Issued', serial: 'SNX-KEEP-ME' },
  { id: 'registration-waiting', seminarId: 'seminar-1', studentId: '209000002', state: 'waiting', reason: 'Not eligible' },
];

function setPageResources() {
  mocks.useResource.mockImplementation((_load: unknown, key: string) => {
    if (key === 'org-seminar-seminar-1') return { state: { status: 'success', data: { seminars: { items: [seminar] } } }, reload: vi.fn() };
    if (key === 'org-roster-seminar-1') return { state: { status: 'success', data: [] }, reload: vi.fn() };
    if (key === 'org-ledger-seminar-1') return { state: { status: 'success', data: [] }, reload: vi.fn() };
    if (key === 'org-evaluation-seminar-1') return { state: { status: 'success', data: { survey: null, surveyVersions: [], aggregates: [], responses: { items: [], nextCursor: null } } }, reload: vi.fn() };
    if (key === 'org-certificates-seminar-1') return { state: { status: 'success', data: { template: null, records, overrideRequests: [] } }, reload: mocks.certificateReload };
    throw new Error(`Unexpected resource key ${key}`);
  });
}

function renderCertificatesPage() {
  window.location.hash = 'certificates';
  return render(<MemoryRouter initialEntries={['/org/seminars/seminar-1']}><Routes><Route path="/org/seminars/:id" element={<OrgSeminarDetailsPage />} /></Routes></MemoryRouter>);
}

describe('organization certificate regeneration action', () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('shows regeneration only for issued records and requires confirmation before calling the API', async () => {
    mocks.useNow.mockReturnValue(Date.parse('2026-11-16T12:00:00.000Z'));
    mocks.api.regenerateOrgCertificate.mockResolvedValue({ ok: true, data: { serial: 'SNX-KEEP-ME' } });
    setPageResources();
    renderCertificatesPage();

    const actions = screen.getAllByRole('button', { name: 'Regenerate certificate' });
    expect(actions).toHaveLength(1);
    fireEvent.click(actions[0]!);
    expect(screen.getByRole('alertdialog', { name: 'Replace this issued certificate?' })).toBeTruthy();
    const replaceButton = screen.getByRole('button', { name: 'Replace certificate' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(document.activeElement).toBe(replaceButton);
    fireEvent.keyDown(replaceButton, { key: 'Tab' });
    expect(document.activeElement).toBe(cancelButton);
    fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(replaceButton);
    fireEvent.keyDown(replaceButton, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(actions[0]);

    fireEvent.click(actions[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.api.regenerateOrgCertificate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate certificate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace certificate' }));

    await waitFor(() => expect(mocks.api.regenerateOrgCertificate).toHaveBeenCalledOnce());
    expect(mocks.api.regenerateOrgCertificate).toHaveBeenCalledWith('registration-issued');
    expect(mocks.certificateReload).toHaveBeenCalledOnce();
    expect(await screen.findByRole('dialog', { name: 'Certificate replaced' })).toBeTruthy();
  });
});
