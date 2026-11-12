import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SeminarDraft } from '../../../api/orgTypes';

const mocks = vi.hoisted(() => ({
  listing: null as unknown,
  saveDraft: vi.fn(),
  uploadCover: vi.fn(),
  removeCover: vi.fn(),
  publishDraft: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  api: {
    listOrgSeminars: vi.fn(),
    saveOrgDraft: mocks.saveDraft,
    uploadOrgSeminarCover: mocks.uploadCover,
    removeOrgSeminarCover: mocks.removeCover,
    publishOrgDraft: mocks.publishDraft,
  },
}));
vi.mock('../../../hooks/useResource', () => ({
  useResource: () => ({ state: { status: 'success', data: mocks.listing }, reload: vi.fn() }),
}));

import SeminarEditorPage from './SeminarEditorPage';

const legacyCover = 'data:image/png;base64,AQ==';
const publicUrl = 'https://project.test/storage/v1/object/public/seminar-covers/org-1/draft-1/cover.png';
const objectPath = 'org-1/draft-1/12345678-1234-4234-8234-123456789012.png';

function makeDraft(coverImageUrl = legacyCover): SeminarDraft {
  return {
    id: 'draft-1', organizationId: 'org-1', createdByOfficerId: 'user-1',
    createdAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z',
    details: {
      title: 'Systems Seminar', description: 'A systems session', speakerName: 'Alex Speaker',
      startsAt: '2027-01-02T02:00:00.000Z', endsAt: '2027-01-02T04:00:00.000Z',
      capacity: 40, venue: 'CCS Hall', coverImageUrl,
    },
    certificate: {
      backgroundUrl: 'https://project.test/template.png',
      nameBox: { x: 1, y: 1, width: 10, height: 10, fontFamily: 'Outfit', fontSize: 12, fontWeight: 700, align: 'center', color: '#000000' },
      updatedAt: '2026-11-10T00:00:00.000Z',
    },
    survey: {
      id: 'survey-1', version: 1, seminarId: 'draft-1', title: 'Evaluation', instructions: '',
      sections: [{ id: 'section-1', title: 'Questions', questions: [{ id: 'q-1', type: 'paragraph', prompt: 'Feedback', required: false, maxLength: 200, placeholder: '' }] }],
    },
  };
}

function renderPage(draft = makeDraft()) {
  mocks.listing = { seminars: { items: [], nextCursor: null }, drafts: { items: [draft], nextCursor: null } };
  return render(<MemoryRouter initialEntries={['/org/drafts/draft-1']}><Routes><Route path="/org/drafts/:draftId" element={<SeminarEditorPage />} /><Route path="*" element={<div />} /></Routes></MemoryRouter>);
}

describe('SeminarEditorPage cover persistence', () => {
  beforeEach(() => {
    mocks.saveDraft.mockReset();
    mocks.uploadCover.mockReset();
    mocks.removeCover.mockReset();
    mocks.publishDraft.mockReset();
    mocks.uploadCover.mockResolvedValue({ ok: true, data: { publicUrl, objectPath } });
    mocks.removeCover.mockResolvedValue({ ok: true, data: undefined });
    mocks.saveDraft.mockImplementation(async (draft: SeminarDraft) => ({ ok: true, data: draft }));
    mocks.publishDraft.mockResolvedValue({ ok: true, data: { id: 'seminar-1' } });
  });

  afterEach(() => cleanup());

  it('uploads and saves a legacy cover URL before publishing', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Review & Publish/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish seminar' }));

    await waitFor(() => expect(mocks.publishDraft).toHaveBeenCalledWith('draft-1'));
    expect(mocks.uploadCover).toHaveBeenCalledWith('draft-1', expect.objectContaining({ type: 'image/png', size: 1 }));
    const uploadedAt = mocks.uploadCover.mock.invocationCallOrder[0];
    const savedAt = mocks.saveDraft.mock.invocationCallOrder[0];
    const publishedAt = mocks.publishDraft.mock.invocationCallOrder[0];
    expect(uploadedAt).toBeLessThan(savedAt ?? 0);
    expect(savedAt).toBeLessThan(publishedAt ?? 0);
    expect(mocks.saveDraft.mock.calls[0]?.[0].details.coverImageUrl).toBe(publicUrl);
  });

  it('does not save or publish when cover upload fails', async () => {
    mocks.uploadCover.mockResolvedValue({ ok: false, error: { code: 'network' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Review & Publish/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publish seminar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('cover could not be uploaded');
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(mocks.publishDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Details/ }));
    expect(screen.getByAltText('Seminar cover preview').getAttribute('src')).toBe(legacyCover);
  });

  it('removes a newly uploaded cover when draft save fails', async () => {
    mocks.saveDraft.mockResolvedValue({ ok: false, error: { code: 'validation_failed' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));

    expect((await screen.findByRole('alert')).textContent).toContain('draft could not be saved');
    expect(mocks.removeCover).toHaveBeenCalledWith('draft-1', objectPath);
    expect(mocks.publishDraft).not.toHaveBeenCalled();
    expect(screen.getByAltText('Seminar cover preview').getAttribute('src')).toBe(legacyCover);
  });

  it('keeps an uploaded object when a network failure leaves draft save status unknown', async () => {
    mocks.saveDraft.mockResolvedValue({ ok: false, error: { code: 'network' } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Save draft' }));

    expect((await screen.findByRole('alert')).textContent).toContain('reload the draft');
    expect(mocks.removeCover).not.toHaveBeenCalled();
    expect(mocks.publishDraft).not.toHaveBeenCalled();
    expect(screen.getByAltText('Seminar cover preview').getAttribute('src')).toBe(legacyCover);
  });

  it('removes the superseded cover only after the replacement draft saves', async () => {
    const oldCover = 'https://project.test/storage/v1/object/public/seminar-covers/org-1/draft-1/12345678-1234-4234-8234-123456789099.png';
    const oldPath = 'org-1/draft-1/12345678-1234-4234-8234-123456789099.png';
    renderPage(makeDraft(oldCover));
    fireEvent.change(screen.getByLabelText(/Choose PNG, JPG, or WebP/), {
      target: { files: [new File(['replacement'], 'replacement.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByAltText('Seminar cover preview').getAttribute('src')).not.toBe(oldCover));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(mocks.removeCover).toHaveBeenCalledWith('draft-1', oldPath));
    expect(mocks.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeCover.mock.invocationCallOrder[0] ?? 0);
  });

});
