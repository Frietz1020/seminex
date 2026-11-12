import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ApiResult, SessionIdentity } from '../api/types';

const apiMock = vi.hoisted(() => ({ getSession: vi.fn<() => Promise<ApiResult<SessionIdentity | null>>>() }));

vi.mock('../api/client', () => ({ api: apiMock }));

import { RequireSession } from './RequireSession';
import { clearSession, saveSession } from '../session/storage';

const identity: SessionIdentity = {
  studentId: '209999901',
  expiresAt: Date.now() + 60_000,
  role: 'org_member',
  organizationIds: ['org-1'],
};

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/protected" element={<RequireSession />}>
          <Route index element={<p>Protected content</p>} />
        </Route>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<p>Complete sign-up</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function SignInPage() {
  const location = useLocation();
  return <><p>Sign-in page</p><p>{location.search}</p></>;
}

beforeEach(() => {
  clearSession();
  apiMock.getSession.mockReset();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => cleanup());

describe('RequireSession asynchronous bootstrap', () => {
  it('shows a loading state while the server session is being checked', () => {
    apiMock.getSession.mockReturnValue(new Promise(() => undefined));

    renderProtectedRoute();

    expect(screen.getByRole('status').textContent).toContain('Checking your session');
    expect(screen.queryByText('Sign-in page')).toBeNull();
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('opens the protected route after the server returns a safe identity', async () => {
    apiMock.getSession.mockResolvedValue({ ok: true, data: identity });

    renderProtectedRoute();

    await waitFor(() => expect(screen.getByText('Protected content')).toBeTruthy());
    expect(JSON.parse(localStorage.getItem('seminex.identity') ?? 'null')).toEqual(identity);
    expect(localStorage.getItem('seminex.identity')).not.toContain('token');
  });

  it('routes an authenticated account with an incomplete profile back to sign-up', async () => {
    apiMock.getSession.mockResolvedValue({ ok: true, data: { ...identity, onboardingComplete: false } });

    renderProtectedRoute();

    expect(await screen.findByText('Complete sign-up')).toBeTruthy();
  });

  it('redirects to sign-in when the server confirms no session', async () => {
    apiMock.getSession.mockResolvedValue({ ok: true, data: null });

    renderProtectedRoute();

    expect(await screen.findByText('Sign-in page')).toBeTruthy();
  });

  it('keeps cached identity available offline after a network error', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    localStorage.setItem('seminex.identity', JSON.stringify(identity));
    apiMock.getSession.mockResolvedValue({ ok: false, error: { code: 'network' } });

    renderProtectedRoute();

    expect(await screen.findByText('Protected content')).toBeTruthy();
  });

  it('does not open a protected route offline without a cached identity', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    apiMock.getSession.mockResolvedValue({ ok: false, error: { code: 'network' } });

    renderProtectedRoute();

    expect(await screen.findByText('Sign-in page')).toBeTruthy();
  });

  it('clears cached identities during sign-out and expiration cleanup', () => {
    localStorage.setItem('seminex.identity', JSON.stringify(identity));
    saveSession({ ...identity, token: 'mock-only-token' });

    clearSession();

    expect(localStorage.getItem('seminex.identity')).toBeNull();
    expect(localStorage.getItem('seminex.session')).toBeNull();
    expect(localStorage.getItem('seminex.identity')).toBeNull();
  });

  it('refreshes identity after auth actions dispatch the session-changed event', async () => {
    apiMock.getSession
      .mockResolvedValueOnce({ ok: true, data: identity })
      .mockResolvedValueOnce({ ok: true, data: { ...identity, role: 'participant' } });

    renderProtectedRoute();
    expect(await screen.findByText('Protected content')).toBeTruthy();

    window.dispatchEvent(new Event('seminex:session-changed'));

    await waitFor(() => expect(JSON.parse(localStorage.getItem('seminex.identity') ?? 'null').role).toBe('participant'));
    expect(apiMock.getSession).toHaveBeenCalledTimes(2);
  });

  it('redirects to sign-in with the expired reason when the API reports an expired session', async () => {
    saveSession({ ...identity, token: 'mock-only-token' });
    apiMock.getSession.mockResolvedValue({ ok: false, error: { code: 'session_expired' } });

    renderProtectedRoute();

    expect(await screen.findByText('?reason=session-expired')).toBeTruthy();
  });
});
