import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({
  session: null as unknown,
  getProfile: vi.fn(),
  listOrganizations: vi.fn(),
  orgSignUp: vi.fn(),
  submitOrgAccessRequest: vi.fn(),
}));

vi.mock('../../../session/useSession', () => ({ useSession: () => state.session }));
vi.mock('../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../../../hooks/useNow', () => ({ useNow: () => null }));
vi.mock('../../../api/client', () => ({
  api: {
    getProfile: state.getProfile,
    listOrganizations: state.listOrganizations,
    orgSignUp: state.orgSignUp,
    submitOrgAccessRequest: state.submitOrgAccessRequest,
  },
}));
vi.mock('../../../components/auth/BrandPanel', () => ({ BrandPanel: () => null }));
vi.mock('../../../components/shell/BrandMark', () => ({ BrandMark: () => null }));
vi.mock('../../../components/auth/PasswordRules', () => ({ PasswordRules: () => null }));
vi.mock('../../../components/ui/Alert', () => ({ Alert: () => null }));
vi.mock('../../../components/ui/StateMessage', () => ({
  InlineError: ({ children }: { children: ReactNode }) => <p role="alert">{children}</p>,
}));
vi.mock('../../../components/ui/Button', () => ({
  Button: ({ children, type = 'button', onClick, disabled, icon }: {
    children: ReactNode;
    type?: 'button' | 'submit' | 'reset';
    onClick?: () => void;
    disabled?: boolean;
    icon?: ReactNode;
  }) => <button type={type} onClick={onClick} disabled={disabled}>{children}{icon}</button>,
}));
vi.mock('../../../components/ui/TextField', () => ({
  TextField: ({ id, label, value, onChange, error }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
  }) => <label htmlFor={id}>{label}<input id={id} value={value} onChange={(event) => onChange(event.target.value)} />{error && <span role="alert">{error}</span>}</label>,
}));
vi.mock('../../../components/ui/PasswordField', () => ({
  PasswordField: ({ id, label, value, onChange }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => <label htmlFor={id}>{label}<input id={id} type="password" value={value} onChange={(event) => onChange(event.target.value)} /></label>,
}));
vi.mock('../../../components/auth/StudentIdField', () => ({
  StudentIdField: ({ id, value, onChange }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
  }) => <label htmlFor={id}>Student ID<input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></label>,
}));
vi.mock('../../../components/ui/SelectField', () => ({
  SelectField: ({ id, label, options, value, onChange, disabled }: {
    id: string;
    label: string;
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <label htmlFor={id}>{label}<select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
  ),
}));
vi.mock('../../../components/auth/OtpField', () => ({
  OtpField: ({ verified, onVerifiedChange }: { verified: boolean; onVerifiedChange: (verified: boolean) => void }) => (
    <button type="button" onClick={() => {
      state.session = { studentId: '209999901', role: 'participant', onboardingComplete: false };
      onVerifiedChange(true);
    }}>{verified ? 'OTP verified' : 'Verify test OTP'}</button>
  ),
}));

import OrganizationSignUpPage from './OrganizationSignUpPage';

const completedProfile = {
  studentId: '209999901',
  firstName: 'Test',
  lastName: 'Student',
  middleInitial: '',
  program: 'CS',
  yearLevel: 2,
  block: 'A',
  college: null,
};

function renderPage() {
  return render(<MemoryRouter><OrganizationSignUpPage /></MemoryRouter>);
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText('Student ID'), { target: { value: '209999901' } });
  fireEvent.change(screen.getByLabelText('Account password'), { target: { value: 'Seminex1!' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Seminex1!' } });
}

function completePersonalAndOrganizationDetails() {
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Student' } });
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText('Academic program'), { target: { value: 'CS' } });
  fireEvent.change(screen.getByLabelText('Year level'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Assigned block'), { target: { value: 'A' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to your organization' }));
  fireEvent.change(screen.getByLabelText('Student organization'), { target: { value: 'org-1' } });
  fireEvent.change(screen.getByLabelText('Constitutional role'), { target: { value: 'President' } });
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  state.session = null;
  state.getProfile.mockResolvedValue({ ok: false, error: { code: 'not_available' } });
  state.listOrganizations.mockResolvedValue({
    ok: true,
    data: [{ id: 'org-1', name: 'CCS Student Council', department: 'CCS', adviserId: '' }],
  });
  state.orgSignUp.mockResolvedValue({ ok: true, data: { email: '209999901@gordoncollege.edu.ph' } });
  state.submitOrgAccessRequest.mockResolvedValue({ ok: true, data: {} });
});

describe('organization signup with an incomplete profile', () => {
  it('keeps the credentials step usable when OTP verification creates an incomplete session', async () => {
    renderPage();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Verify test OTP' }));

    await waitFor(() => expect(state.session).toMatchObject({ role: 'participant', onboardingComplete: false }));
    expect(screen.queryByText('Your applicant profile could not be loaded.')).toBeNull();
    expect(screen.getByRole('button', { name: 'OTP verified' })).toBeTruthy();
    expect(state.getProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Personal Information/ }));
    expect(screen.getByRole('heading', { name: 'Personal information' })).toBeTruthy();
  });

  it('advances valid verified credentials to personal details', () => {
    renderPage();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Verify test OTP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to personal information' }));

    expect(screen.getByRole('heading', { name: 'Personal information' })).toBeTruthy();
  });

  it('resumes a verified incomplete session and completes organization signup without a second OTP', async () => {
    state.session = { studentId: '209999901', role: 'participant', onboardingComplete: false };

    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Personal information' })).toBeTruthy());
    expect(state.getProfile).not.toHaveBeenCalled();

    completePersonalAndOrganizationDetails();
    expect(screen.getByText(/Test Student.*209999901/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create account and send request' }));

    await waitFor(() => expect(state.orgSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: '209999901', firstName: 'Test', lastName: 'Student' }),
      { organizationId: 'org-1', position: 'President' },
    ));
    expect(state.submitOrgAccessRequest).not.toHaveBeenCalled();
  });

  it('does not advance to organization selection while personal details are missing', async () => {
    state.session = { studentId: '209999901', role: 'participant', onboardingComplete: false };

    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Personal information' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Continue to your organization' }));

    expect(screen.getByRole('heading', { name: 'Personal information' })).toBeTruthy();
    expect(screen.getByText('Last name is missing. Enter your last name.')).toBeTruthy();
  });

  it('keeps the profile-prefilled access-request path for a completed participant', async () => {
    state.session = { studentId: '209999901', role: 'participant', onboardingComplete: true };
    state.getProfile.mockResolvedValue({ ok: true, data: completedProfile });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Test Student.*209999901/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Send organization access request' })).toBeTruthy();
    expect(state.orgSignUp).not.toHaveBeenCalled();
  });
});
