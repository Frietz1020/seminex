import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../../session/useSession', () => ({ useSession: () => null }));
vi.mock('../../../api/client', () => ({ api: { orgSignIn: vi.fn() } }));
vi.mock('../../../components/auth/AuthLayout', () => ({ AuthLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../../components/ui/Button', () => ({
  Button: ({ children, type = 'button', onClick }: { children: React.ReactNode; type?: 'button' | 'submit' | 'reset'; onClick?: () => void }) => (
    <button type={type} onClick={onClick}>{children}</button>
  ),
}));
vi.mock('../../../components/ui/TextField', () => ({
  TextField: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) => (
    <label htmlFor={id}>{label}<input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></label>
  ),
}));
vi.mock('../../../components/ui/PasswordField', () => ({
  PasswordField: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) => (
    <label htmlFor={id}>{label}<input id={id} type="password" value={value} onChange={(event) => onChange(event.target.value)} /></label>
  ),
}));

import OrganizationSignInPage from './OrganizationSignInPage';

afterEach(() => cleanup());

describe('organization sign-in', () => {
  it('starts with blank credentials and shows no demo account', () => {
    render(<MemoryRouter><OrganizationSignInPage /></MemoryRouter>);

    expect(screen.queryByRole('button', { name: 'Use sample account' })).toBeNull();
    expect((screen.getByLabelText('Student ID') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
  });
});
