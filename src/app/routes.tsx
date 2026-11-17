import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { StubPage } from '../components/auth/StubPage';
import { AppShell } from '../components/shell/AppShell';
import { RequireSession } from './RequireSession';
import { RequireRole } from './RequireRole';
import { OrgShell } from '../components/shell/org/OrgShell';
const LandingPage = lazy(() => import('../features/home/pages/LandingPage'));
const SignInPage = lazy(() => import('../features/auth/pages/SignInPage'));
const SignUpPage = lazy(() => import('../features/auth/pages/SignUpPage'));
const OrganizationSignInPage = lazy(() => import('../features/auth/pages/OrganizationSignInPage'));
const OrganizationSignUpPage = lazy(() => import('../features/auth/pages/OrganizationSignUpPage'));
const AdminSignInPage = lazy(() => import('../features/admin/pages/AdminSignInPage'));
const VerifyEmailPage = lazy(() => import('../features/auth/pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('../features/auth/pages/ForgotPasswordStub'));
const RequestOrganizationAccessPage = lazy(() => import('../features/org/pages/RequestOrganizationAccessPage'));
const OrganizationRequestStatusPage = lazy(() => import('../features/org/pages/OrganizationRequestStatusPage'));
const HomePage = lazy(() => import('../features/home/pages/HomePage'));
const AvailableSeminarsPage = lazy(() => import('../features/seminars/pages/AvailableSeminarsPage'));
const SeminarPage = lazy(() => import('../features/seminars/pages/SeminarPage'));
const SeminarDetailsPage = lazy(() => import('../features/seminars/pages/SeminarDetailsPage'));
const EvaluationPage = lazy(() => import('../features/evaluation/pages/EvaluationPage'));
const HistoryPage = lazy(() => import('../features/history/pages/HistoryPage'));
const HistorySummaryPage = lazy(() => import('../features/history/pages/HistorySummaryPage'));
const ProfilePage = lazy(() => import('../features/profile/pages/ProfilePage'));
const MySeminarsPage = lazy(() => import('../features/seminars/pages/MySeminarsPage'));
const RegistrationGuidelinesPage = lazy(() => import('../features/guidelines/RegistrationGuidelinesPage'));
const OrganizationApprovalsPage = lazy(() => import('../features/org/pages/OrganizationApprovalsPage'));

const OrgSeminarsPage = lazy(() => import('../features/org/pages/OrgSeminarsPage'));
const OrgHistoryPage = lazy(() => import('../features/org/pages/OrgHistoryPage'));
const OrgProfilePage = lazy(() => import('../features/org/pages/OrgProfilePage'));
const OrgSeminarDetailsPage = lazy(() => import('../features/org/pages/OrgSeminarDetailsPage'));
const OrgScannerPage = lazy(() => import('../features/org/pages/OrgScannerPage'));
const SeminarEditorPage = lazy(() => import('../features/org/pages/SeminarEditorPage'));
const OrgHomePage = lazy(() => import('../features/org/pages/OrgHomePage'));
const AdminMembersPage = lazy(() => import('../features/admin/pages/AdminMembersPage'));
const AdminSeminarsPage = lazy(() => import('../features/admin/pages/AdminSeminarsPage'));
const AdminAuditLogPage = lazy(() => import('../features/admin/pages/AdminAuditLogPage'));
const AdminProfilePage = lazy(() => import('../features/admin/pages/AdminProfilePage'));

function OrgPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div role="status" className="mx-auto w-full max-w-7xl px-gutter py-space-xl md:px-margin">Loading organization page…</div>}>{children}</Suspense>;
}

function StudentPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div role="status" className="mx-auto w-full max-w-7xl px-gutter py-space-xl md:px-margin">Loading page…</div>}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<StudentPage><LandingPage /></StudentPage>} />
      <Route path="/sign-in" element={<StudentPage><SignInPage /></StudentPage>} />
      <Route path="/sign-up" element={<StudentPage><SignUpPage /></StudentPage>} />
      <Route path="/organization/sign-in" element={<StudentPage><OrganizationSignInPage /></StudentPage>} />
      <Route path="/organization/sign-up" element={<StudentPage><OrganizationSignUpPage /></StudentPage>} />
      <Route path="/admin/sign-in" element={<StudentPage><AdminSignInPage /></StudentPage>} />
      <Route path="/verify-email" element={<StudentPage><VerifyEmailPage /></StudentPage>} />
      <Route path="/forgot-password" element={<StudentPage><ForgotPasswordPage /></StudentPage>} />

      <Route element={<RequireSession />}>
        <Route element={<RequireRole allow={['participant']} redirectTo={(role) => role === 'adviser' ? '/org/adviser' : '/org'} />}>
          <Route path="/organization/request-access" element={<StudentPage><RequestOrganizationAccessPage /></StudentPage>} />
        </Route>
        <Route element={<RequireRole allow={['participant', 'org_member']} redirectTo={(role) => role === 'adviser' ? '/org/adviser' : '/org'} />}>
          <Route path="/organization/request-status" element={<StudentPage><OrganizationRequestStatusPage /></StudentPage>} />
        </Route>
        <Route element={<RequireRole allow={['participant', 'org_member']} redirectTo="/org/adviser" />}>
        <Route element={<AppShell />}>
          <Route path="/home" element={<StudentPage><HomePage /></StudentPage>} />
          <Route path="/seminars" element={<StudentPage><AvailableSeminarsPage /></StudentPage>} />
          <Route path="/my-seminars/:id" element={<StudentPage><SeminarPage /></StudentPage>} />

          <Route path="/seminars/:id" element={<StudentPage><SeminarDetailsPage /></StudentPage>} />
          <Route path="/my-seminars" element={<StudentPage><MySeminarsPage /></StudentPage>} />
          <Route path="/history" element={<StudentPage><HistoryPage /></StudentPage>} />
          <Route path="/profile" element={<StudentPage><ProfilePage /></StudentPage>} />
          <Route path="/history/:id" element={<StudentPage><HistorySummaryPage /></StudentPage>} />
          <Route path="/my-seminars/:id/evaluation" element={<StudentPage><EvaluationPage /></StudentPage>} />
          <Route path="/guidelines" element={<StudentPage><RegistrationGuidelinesPage /></StudentPage>} />
        </Route>
        </Route>

        <Route element={<RequireRole allow={['org_member', 'adviser']} redirectTo="/home" />}>
          <Route path="/org" element={<OrgShell />}>
            <Route element={<RequireRole allow={['org_member']} redirectTo="/org/adviser" />}>
              <Route index element={<OrgPage><OrgHomePage /></OrgPage>} />
              <Route path="my-seminars" element={<OrgPage><OrgSeminarsPage /></OrgPage>} />
              <Route path="my-seminars/:id/scanner" element={<OrgPage><OrgScannerPage /></OrgPage>} />
              <Route path="my-seminars/:id" element={<OrgPage><OrgSeminarDetailsPage /></OrgPage>} />
              <Route path="seminars/:draftId/edit" element={<OrgPage><SeminarEditorPage /></OrgPage>} />
              <Route path="history" element={<OrgPage><OrgHistoryPage /></OrgPage>} />
              <Route path="profile" element={<OrgPage><OrgProfilePage /></OrgPage>} />
            </Route>
            <Route element={<RequireRole allow={['adviser']} redirectTo="/org" />}>
              <Route path="adviser" element={<Navigate to="/org/adviser/requests" replace />} />
              <Route path="adviser/members" element={<OrgPage><AdminMembersPage /></OrgPage>} />
              <Route path="adviser/requests" element={<OrgPage><OrganizationApprovalsPage /></OrgPage>} />
              <Route path="adviser/seminars" element={<OrgPage><AdminSeminarsPage /></OrgPage>} />
              <Route path="adviser/audit-log" element={<OrgPage><AdminAuditLogPage /></OrgPage>} />
              <Route path="adviser/profile" element={<OrgPage><AdminProfilePage /></OrgPage>} />
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
