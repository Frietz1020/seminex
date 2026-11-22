import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ listing: null as unknown, deleteDraft: vi.fn(), now: 1794000000000 }));
vi.mock('../../../api/client', () => ({ api: {
  listOrgSeminars: vi.fn(), createOrgDraft: vi.fn(), deleteOrgDraft: mocks.deleteDraft,
} }));
vi.mock('../../../hooks/useResource', () => ({ useResource: () => ({ state: { status: 'success', data: mocks.listing }, reload: vi.fn() }) }));
vi.mock('../../../hooks/useNow', () => ({ useNow: () => mocks.now }));

import OrgSeminarsPage from './OrgSeminarsPage';

const draft = {
  id: 'draft-1', organizationId: 'org-1', createdByOfficerId: 'user-1',
  createdAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z',
  details: { title: 'Systems Seminar' }, certificate: null, survey: null,
};

describe('organization draft deletion confirmation', () => {
  beforeEach(() => {
    mocks.listing = { seminars: { items: [], nextCursor: null }, drafts: { items: [draft], nextCursor: null } };
    mocks.deleteDraft.mockReset().mockResolvedValue({ ok: true, data: undefined });
  });
  afterEach(() => cleanup());

  it('keeps the draft when the confirmation is cancelled', () => {
    render(<MemoryRouter><OrgSeminarsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    expect(screen.getByRole('alertdialog')).not.toBeNull();
    expect(screen.getByText(/permanently removes the unpublished draft and its cover images/i)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Keep draft' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mocks.deleteDraft).not.toHaveBeenCalled();
  });

  it('deletes only after explicit confirmation', () => {
    render(<MemoryRouter><OrgSeminarsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete draft' })[1]!);
    expect(mocks.deleteDraft).toHaveBeenCalledWith('draft-1');
  });
});
