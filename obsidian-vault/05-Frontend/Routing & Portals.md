---
title: Routing & Portals
aliases: [Routes, Pages, AppRoutes]
tags: [frontend, architecture]
updated: 2026-11-27
status: active
---

# Routing & Portals (`src/app/routes.tsx`)

Back to [[Home]] | See also: [[System Overview]], [[Security & Access Control]], [[Hooks, Session & UI System]].

## Public Routes
| Path | Page Component | Purpose |
| --- | --- | --- |
| `/` | `LandingPage` | Portal selection landing page |
| `/terms`, `/security` | `TermsOfUsePage`, `SecurityPolicyPage` | Editorial policy pages |
| `/sign-in`, `/sign-up` | `SignInPage`, `SignUpPage` | Student Portal auth (Student ID + 3-step OTP sign-up) |
| `/organization/sign-in`, `/organization/sign-up` | `OrganizationSignInPage`, `OrganizationSignUpPage` | Org Officer auth (uniform Student ID sign-in) |
| `/admin/sign-in` | `AdminSignInPage` | Faculty Adviser email sign-in |
| `/verify-email`, `/forgot-password` | `VerifyEmailPage`, `ForgotPasswordStub` | Email verification & OTP password recovery |

## Student Portal (`AppShell`, roles: `participant | org_member`)
| Path | Page Component | Purpose |
| --- | --- | --- |
| `/home` | `HomePage` | Greeting, Recent Seminar History card, Evaluation Banner, Ongoing Seminar Card (QR → Complete Evaluation transition) |
| `/seminars` | `AvailableSeminarsPage` | Unregistered open seminars (registered seminars disappear immediately) |
| `/seminars/:id` | `SeminarDetailsPage` | Unified 16:9 hero + details card + inline `TicketTab` when registered & confirmed |
| `/my-seminars` | `MySeminarsPage` | Search, sort, and segmented filter toolbar matching History |
| `/my-seminars/:id` | `SeminarPage` | Unified `SeminarHeader` + `TicketTab` / `EvaluationTab` |
| `/my-seminars/:id/evaluation` | `EvaluationPage` | Multi-page anonymous evaluation (`EvaluationForm` + `SubmittedDialog`) |
| `/history`, `/history/:id` | `HistoryPage`, `HistorySummaryPage` | Completed records, attendance meters, inline PDF certificate viewer & download |
| `/profile`, `/guidelines` | `ProfilePage`, `RegistrationGuidelinesPage` | Student identity, avatar upload, activity card, offline-ready guidelines |
| `/organization/request-access`, `/organization/request-status` | `RequestOrganizationAccessPage`, `OrganizationRequestStatusPage` | Officer access request submission & status tracking |

## Organization Portal (`OrgShell`, role: `org_member`)
| Path | Page Component | Purpose |
| --- | --- | --- |
| `/org` | `OrgHomePage` | 4-KPI strip, Drafts needing attention, Live attendance check-in strip, Active & upcoming seminars |
| `/org/my-seminars` | `OrgSeminarsPage` | Active seminars & drafts management |
| `/org/my-seminars/:id` | `OrgSeminarDetailsPage` | 16:9 hero, live sample certificate preview, side-by-side Attendance verification & ledger, Evaluation overview, Certificates tab, multi-format export |
| `/org/my-seminars/:id/scanner` | `OrgScannerPage` | 2-column live QR + manual check-in console with structured verification modal |
| `/org/seminars/:draftId/edit` | `SeminarEditorPage` | 4-step editor (16:9 `CoverImageEditor`, `CertificateDesigner`, `EvaluationBuilder`, Publish) |
| `/org/history`, `/org/profile` | `OrgHistoryPage`, `OrgProfilePage` | Archived seminars with `.csv`/`.md`/`.xlsx` export; locked org fields + editable officer details |

## Faculty Adviser Portal (`OrgShell`, role: `adviser`)
| Path | Page Component | Purpose |
| --- | --- | --- |
| `/org/adviser` | Redirect → `/org/adviser/requests` | Default adviser landing |
| `/org/adviser/requests` | `OrganizationApprovalsPage` | Officer access approval queue |
| `/org/adviser/members` | `AdminMembersPage` | Active officer roster & position/removal actions |
| `/org/adviser/seminars` | `AdminSeminarsPage` | Read-only seminar oversight + multi-format export |
| `/org/adviser/audit-log` | `AdminAuditLogPage` | Activity audit log + multi-format export |
| `/org/adviser/profile` | `AdminProfilePage` | Adviser profile & sign-out |
