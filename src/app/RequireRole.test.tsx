import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiResult, SessionIdentity } from '../api/types';

const apiMock = vi.hoisted(() => ({ getSession: vi.fn<() => Promise<ApiResult<SessionIdentity | null>>>() }));

vi.mock('../api/client', () => ({ api: apiMock }));

import { RequireRole } from './RequireRole';
import { RequireSession } from './RequireSession';
import { clearSession } from '../session/storage';

const participant: SessionIdentity = {
  studentId: '209999901',
  expiresAt: Date.now() + 60_000,
  role: 'participant',
  organizationIds: [],
};

const organizationMember: SessionIdentity = {
  studentId: '202410002',
  expiresAt: Date.now() + 60_000,
  role: 'org_member',
  organizationIds: ['org-ccs'],
};

function renderOrgRoute() {
  return render(
    <MemoryRouter initialEntries={['/org/private']}>
      <Routes>
        <Route element={<RequireSession />}>
          <Route path="/org/private" element={<RequireRole allow={['org_member', 'adviser']} redirectTo="/home" />}>
            <Route index element={<p>Organization workspace</p>} />
          </Route>
        </Route>
        <Route path="/home" element={<p>Participant home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderStudentRoute() {
  return render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route element={<RequireSession />}>
          <Route path="/home" element={<RequireRole allow={['participant', 'org_member']} redirectTo="/org" />}>
            <Route index element={<p>Student portal</p>} />
          </Route>
        </Route>
        <Route path="/org" element={<p>Organization portal</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderOrganizationWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/org/private']}>
      <Routes>
        <Route element={<RequireSession />}>
          <Route path="/org/private" element={<RequireRole allow={['org_member', 'adviser']} redirectTo="/home" />}>
            <Route index element={<p>Organization workspace</p>} />
          </Route>
        </Route>
        <Route path="/home" element={<p>Student portal</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearSession();
  apiMock.getSession.mockReset();
  apiMock.getSession.mockResolvedValue({ ok: true, data: participant });
});

afterEach(() => cleanup());

describe('RequireRole with bootstrapped identity', () => {
  it('redirects a participant away from the organization workspace', async () => {
    renderOrgRoute();

    expect(await screen.findByText('Participant home')).toBeTruthy();
    expect(screen.queryByText('Organization workspace')).toBeNull();
  });

  it('allows an organization member to use the student portal', async () => {
    apiMock.getSession.mockResolvedValue({ ok: true, data: organizationMember });

    renderStudentRoute();

    expect(await screen.findByText('Student portal')).toBeTruthy();
  });

  it('allows an organization member to use the organization portal', async () => {
    apiMock.getSession.mockResolvedValue({ ok: true, data: organizationMember });

    renderOrganizationWorkspace();

    expect(await screen.findByText('Organization workspace')).toBeTruthy();
  });
});
