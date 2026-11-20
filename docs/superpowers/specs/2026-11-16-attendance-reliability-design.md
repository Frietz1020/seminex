# Attendance Reliability and Certificate Delivery Design

**Status:** Approved for implementation  
**Date:** 2026-11-16  
**Scope:** Attendance confirmation, QR Time-In/Time-Out, and staging verification of certificate mail-merge plus in-app delivery.

## Goal

Make seminar registration confirmation and QR attendance behave as one reliable, server-authoritative lifecycle, and verify that eligible applicants can receive a correctly personalized certificate through the app.

## Evidence and Current Behavior

The implementation currently divides the lifecycle between applicant UI, Supabase RPC functions, and registration/ledger rows:

- `register_for_seminar` calculates a confirmation period and runs `private.release_expired_registrations`. A newly inserted registration outside the configured confirmation interval can become `released` immediately even when the seminar registration UI accepted it.
- `AttendancePrompt` is shown for confirmed registrations that have not acknowledged attendance, starting one hour before the seminar.
- `issue_attendance_challenge` accepts registrations in `registered` or `confirmed`, issues a 30-second challenge, and uses the database clock. Time-In is allowed from seminar start up to (excluding) seminar end. After Time-In, Time-Out challenges are allowed through seminar end plus one hour.
- `record_org_challenge_scan` requires a fresh challenge and explicit `p_kind`, then atomically writes the ledger row and registration timestamp. It returns `not_available` for an expired challenge or a time-window failure and `conflict` for a mismatched scan mode or invalid next step.
- `OrgScannerPage` currently maps those broad errors to user-facing feedback. A QR scan can fail for more than one reason under each generic code.
- The Nov 14 migration supplies the explicit scan-mode RPC signature. Local source, the deployed staging database, and the Vite staging environment must be checked as separate things.
- Certificate code exists for PDF rendering and authenticated in-app access, but no complete staging journey has been evidenced. The current documented delivery channel is in-app; email sending is outside this design.

## Product Decisions

1. **Late registration:** Allow registration through seminar end, subject to the existing capacity, duplicate-registration, seminar publication, and account rules. If an applicant registers after the confirmation cutoff but before seminar end, persist the registration as `confirmed` and immediately show the attendance acknowledgement prompt. Do not release that newly created late registration. Existing registrations that remain unconfirmed when their confirmation cutoff passes continue to be released.
2. **Acknowledgement:** An applicant must acknowledge attendance before the applicant QR becomes available. An acknowledgement made before the attendance window does not permit a scan before the seminar starts.
3. **Attendance windows:** Preserve current server-side policy: Time-In at or after `starts_at` and before `ends_at`; Time-Out only after a valid Time-In and through `ends_at + 1 hour`. Use database server time for the acceptance decision. Seminar values remain timezone-aware instants; UI display and authoring continue to use the seminar’s existing timezone conversion.
4. **Challenge lifecycle:** Challenges remain short-lived, single-use, bound to the registration and seminar, and explicit about `time_in` versus `time_out`. A network retry with the same idempotency key returns the already-recorded result without inserting a second ledger entry.
5. **Certificate scope:** Verify PDF merge fields, eligibility, private storage, and applicant/org in-app download. Do not add email delivery in this work.

## Intended Design

### Registration and acknowledgement

The database is the authority for registration status and confirmation timestamps. A registration made inside the confirmation window follows the existing confirmation/acknowledgement behavior. A late registration is immediately confirmed by the registration RPC, and the applicant UI derives its next step from the returned/persisted status rather than inferring it from the seminar clock alone. The UI displays the acknowledgement promptly and only offers the QR after the acknowledgement is stored.

The release routine applies only to registrations that existed before their confirmation deadline and were not confirmed. It must not release a late registration created after that deadline. Capacity and duplicate checks remain atomic with registration.

### QR attendance state machine

The registration is the canonical summary state (`time_in_at`, `time_out_at`); `attendance_ledger` is the auditable event history. Challenge issuance and consumption must lock or otherwise serialize the registration transition so concurrent scans cannot produce two Time-Ins or two Time-Outs. The ledger insert, registration timestamp update, and challenge consumption remain one transaction. A completed Time-Out cannot be repeated with a different challenge/key.

| Current registration attendance state | Allowed challenge | Accepted window | Result |
| --- | --- | --- | --- |
| Not timed in | Time-In | `starts_at <= server_now < ends_at` | Insert one Time-In ledger event and set `time_in_at` |
| Timed in, not timed out | Time-Out | `starts_at <= server_now <= ends_at + 1 hour` | Insert one Time-Out ledger event and set `time_out_at` |
| Timed out | None | None | Reject as an already-completed attendance state |

The applicant QR refresh path requests a new challenge before expiry and reflects a fresh server result. A stale challenge must not be silently reused. The scanner retains the same idempotency key only for retrying an uncertain network result; a new scan action uses a new key.

### Errors and feedback

Keep stable application error codes in the API adapter and document which backend conditions produce each code. At minimum, distinguish expired/invalid challenge, outside-window, wrong scan mode, already-completed step, missing/released registration, unauthorized org, and transient network failure. If the database RPC must retain PostgREST `P0001`, map exact database messages to typed client errors without collapsing unknown server failures into `network`. The scanner message must tell the operator the actionable next step and must not claim the seminar is inactive when the true failure is a wrong mode or completed step.

### Migration and environment safety

Use forward-only Supabase migrations for function changes. Before staging verification, confirm the Vite staging variables point to the intended Supabase project and compare that project's applied migration ledger with the repository migrations. Apply migrations to the staging database using the established project workflow; `npm run dev -- --mode staging` starts the frontend with staging mode but does not apply database migrations or deploy Edge Functions. Never run staging SQL against the local linked project without verifying the project reference.

### Certificate verification

The certificate verification track remains independent of attendance repairs. On staging, create a seminar with a known certificate template and a test applicant whose confirmed Time-In/Time-Out duration meets the documented 60% attendance threshold and evaluation requirement. Verify the generated PDF contains the intended applicant and seminar fields, is stored in the private certificate bucket, and can be opened by the applicant and authorized organization account through the app. Verify ineligible applicants cannot issue/download a certificate, repeat requests do not create conflicting artifacts, and expired signed URLs can be refreshed. Email delivery is not part of acceptance.

## Failure and Recovery Behavior

- A registration RPC failure does not leave a visible ticket that appears confirmed; the applicant can retry safely without duplicating the registration.
- A lost scan response can be retried with the original idempotency key and returns the original committed ledger result.
- If the ledger and registration summary ever disagree, the implementation must not invent a successful scan. The repair plan must diagnose which value is canonical, provide an auditable reconciliation path, and ensure certificate eligibility follows the validated attendance state.
- Staging deployment checks identify the exact project ref, migration version, RPC signature, and Edge Function version before the browser workflow is exercised.

## Acceptance Criteria

### Attendance

1. A registration before the confirmation cutoff follows the configured confirmation and release lifecycle.
2. A registration after the cutoff but before seminar end remains active, is auto-confirmed, and immediately receives the attendance acknowledgement prompt.
3. A registration after seminar end is rejected; capacity and duplicate checks remain enforced for allowed registration.
4. QR is not available until acknowledgement is persisted and before the Time-In window opens.
5. A valid Time-In creates exactly one ledger event and sets `time_in_at`; the ledger shows one timed-in attendee.
6. A fresh Time-Out challenge after Time-In creates exactly one ledger event and sets `time_out_at`; the ledger shows one timed-out attendee.
7. Expired QR, early/late scan, wrong mode, duplicate completion, released registration, and transient network retry each produce a deterministic result and actionable feedback.
8. Concurrent scans and retry-after-lost-response cannot duplicate or corrupt attendance state.
9. Boundary checks use the database clock and cover exactly at seminar start, immediately before seminar end, exactly at seminar end, and exactly at the Time-Out deadline.
10. The applied staging migration and RPC signatures match the source used to test the staging app.

### Certificates

1. An eligible test applicant can obtain a PDF with correct applicant/seminar merge fields.
2. The certificate artifact is stored privately and authorized applicant and organization users can access it in-app.
3. Ineligible accounts cannot issue/download certificates; repeated issuance and expired-link retry behave safely.
4. The verified result is explicitly documented as in-app delivery; no email behavior is claimed.

## Non-Goals

- Replacing Supabase RPCs with a new REST API or changing the API versioning model.
- Adding certificate email delivery.
- Changing the documented 60% attendance eligibility threshold.
- Broad redesign of seminar authoring or scanner UI beyond feedback and state needed for correct operation.

## Proposed Workstream Split

1. **Attendance reliability:** registration policy, acknowledgement gating, QR state machine, scan error mapping, migrations, and attendance-focused staging verification.
2. **Certificate delivery verification:** independent staging verification of mail-merge PDF generation and in-app access. Only make certificate code changes if this verification finds a reproducible defect; keep any repair scoped to its own follow-up plan.

## Design Review Questions

- Confirm that “Make it late” means late signup remains open until seminar end, with late registrants auto-confirmed and prompted to acknowledge immediately.
- Confirm the workstream split and that certificate email delivery is out of scope.
- Confirm the existing Time-In/Time-Out windows above should remain the policy.
