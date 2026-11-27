---
title: API Client Reference
aliases: [API Client, src/api/client.ts]
tags: [frontend, api]
updated: 2026-11-27
status: active
---

# API Client Reference (`src/api/client.ts`)

Back to [[Home]] | See also: [[RPC Functions & Triggers]], [[Edge Functions]], [[Server Clock & Offline Strategy]].

All API methods return `Promise<ApiResult<T>>`:
`{ ok: true; data: T; fromCache?: boolean } | { ok: false; error: { code: ApiErrorCode } }`.

## Domain Modules Behind `api`

| Module | File | Exported `api.*` Methods |
| --- | --- | --- |
| **Auth & Session** | `src/api/auth.ts` | `signIn`, `signUp`, `sendSignupOtp`, `verifySignupOtp`, `resendVerification`, `getSession`, `signOut`, `sendPasswordResetOtp`, `verifyPasswordResetOtp`, `resetPassword`, `getProfile`, `updateProfile`, `uploadAvatar`, `orgSignIn`, `orgSignUp`, `listOrganizations`, `submitOrgAccessRequest`, `getMyOrgAccessStatus`, `withdrawMyOrgRequest`, `getOrgIdentity` |
| **Server Time** | `src/api/serverTime.ts` | `getServerTime` (raw stateless RPC; consumed by `src/hooks/serverClock.ts`) |
| **Seminars & Registration** | `src/api/seminars.ts` | `listHistory`, `listAvailableSeminars`, `listMySeminars`, `listSeminars`, `getSeminar`, `registerForSeminar`, `cancelRegistration`, `confirmRegistration`, `acknowledgeAttendance`, `getTicket`, `listOrgSeminars`, `createOrgDraft`, `createOrgEditDraft`, `saveOrgDraft`, `uploadOrgSeminarCover`, `removeOrgSeminarCover`, `publishOrgDraft`, `deleteOrgDraft`, `archiveOrgSeminar` |
| **Attendance & Proofs** | `src/api/attendance.ts` | `listOrgRoster`, `listLedger`, `recordOrgScan`, `issueAttendanceChallenge`, `recordOrgChallengeScan`, `uploadWebinarProof`, `listMyWebinarProofs`, `listWebinarProofs`, `reviewWebinarProof` |
| **Evaluations** | `src/api/evaluations.ts` | `listEvaluationsDue`, `getEvaluationSurvey`, `submitEvaluation` (auto-invokes `issue-certificate`), `getOrgSeminarEvaluation` |
| **Certificates & Tickets** | `src/api/certificates.ts`, `src/api/ticketPdf.ts` | `getCertificate`, `getOrgSeminarCertificates`, `getOrgCertificate`, `regenerateOrgCertificate`, `getTicketPdf` |
| **Adviser** | `src/api/adviser.ts` | `listAdviserOrgRequests`, `listAdviserOrgMembers`, `updateAdviserMemberPosition`, `removeAdviserMember`, `decideAdviserOrgRequest` |

## Standard `ApiErrorCode` Values
`invalid_credentials`, `session_expired`, `forbidden`, `not_found`, `not_available`, `conflict`, `validation_failed`, `rate_limited`, `network`, `configuration_error`, plus attendance-specific scan error codes handled in `OrgScannerPage.tsx`.
