import { OrgMySeminarsPage } from '../features/org/pages/OrgMySeminarsPage';
import { Route, Routes } from 'react-router-dom';
import SignInPage from '../features/auth/pages/SignInPage';
import SignUpPage from '../features/auth/pages/SignUpPage';
import OrganizationSignInPage from '../features/auth/pages/OrganizationSignInPage';
import OrganizationSignUpPage from '../features/auth/pages/OrganizationSignUpPage';
import AdminSignInPage from '../features/admin/pages/AdminSignInPage';
import RequestOrganizationAccessPage from '../features/org/pages/RequestOrganizationAccessPage';
import OrganizationRequestStatusPage from '../features/org/pages/OrganizationRequestStatusPage';
import VerifyEmailPage from '../features/auth/pages/VerifyEmailPage';
import ForgotPasswordStub from '../features/auth/pages/ForgotPasswordStub';
import LandingPage from '../features/home/pages/LandingPage';
import HomePage from '../features/home/pages/HomePage';
import AvailableSeminarsPage from '../features/seminars/pages/AvailableSeminarsPage';
import SeminarPage from '../features/seminars/pages/SeminarPage';
import SeminarDetailsPage from '../features/seminars/pages/SeminarDetailsPage';
import EvaluationPage from '../features/evaluation/pages/EvaluationPage';
import HistoryPage from '../features/history/pages/HistoryPage';
import HistorySummaryPage from '../features/history/pages/HistorySummaryPage';
import ProfilePage from '../features/profile/pages/ProfilePage';
import MySeminarsPage from '../features/seminars/pages/MySeminarsPage';
import RegistrationGuidelinesPage from '../features/guidelines/RegistrationGuidelinesPage';
import { StubPage } from '../components/auth/StubPage';
import { AppShell } from '../components/shell/AppShell';
import { PlaceholderPage } from '../components/shell/PlaceholderPage';
import { RequireSession } from './RequireSession';
import { RequireRole } from './RequireRole';
import { OrgShell } from '../components/shell/org/OrgShell';
import { OrgPlaceholderPage } from '../features/org/pages/OrgPlaceholderPage';
import OrganizationApprovalsPage from '../features/org/pages/OrganizationApprovalsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/organization/sign-in" element={<OrganizationSignInPage />} />
      <Route path="/organization/sign-up" element={<OrganizationSignUpPage />} />
      <Route path="/admin/sign-in" element={<AdminSignInPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordStub />} />

      <Route element={<RequireSession />}>
        <Route element={<RequireRole allow={['participant']} redirectTo={(role) => role === 'adviser' ? '/org/adviser' : '/org'} />}>
          <Route path="/organization/request-access" element={<RequestOrganizationAccessPage />} />
        </Route>
        <Route element={<RequireRole allow={['participant', 'org_member']} redirectTo={(role) => role === 'adviser' ? '/org/adviser' : '/org'} />}>
          <Route path="/organization/request-status" element={<OrganizationRequestStatusPage />} />
        </Route>
        <Route element={<RequireRole allow={['participant', 'org_member']} redirectTo="/org/adviser" />}>
          <Route element={<AppShell />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/seminars" element={<AvailableSeminarsPage />} />
            <Route path="/my-seminars/:id" element={<SeminarPage />} />

            <Route path="/seminars/:id" element={<SeminarDetailsPage />} />
            <Route path="/my-seminars" element={<MySeminarsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/history/:id" element={<HistorySummaryPage />} />
            <Route path="/audit-log" element={<PlaceholderPage title="Audit log" />} />
            <Route path="/my-seminars/:id/evaluation" element={<EvaluationPage />} />
            <Route path="/notifications" element={<PlaceholderPage title="Notifications" />} />
            <Route path="/guidelines" element={<RegistrationGuidelinesPage />} />
          </Route>
        </Route>

        <Route element={<RequireRole allow={['org_member', 'adviser']} redirectTo="/home" />}>
          <Route path="/org" element={<OrgShell />}>
            <Route element={<RequireRole allow={['org_member']} redirectTo="/org/adviser" />}>
              <Route index element={<OrgPlaceholderPage title="Home" icon="home" />} />
              
              {/* Updated: Points to your actual OrgMySeminarsPage now! */}
              <Route path="my-seminars" element={<OrgMySeminarsPage />} />
              
              <Route path="history" element={<OrgPlaceholderPage title="History" icon="history" />} />
              <Route path="profile" element={<OrgPlaceholderPage title="Profile" icon="person" />} />
            </Route>
            <Route element={<RequireRole allow={['adviser']} redirectTo="/org" />}>
              <Route path="adviser" element={<OrganizationApprovalsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={<StubPage title="Page not found">The page you opened does not exist.</StubPage>}
      />
    </Routes>
  );
}