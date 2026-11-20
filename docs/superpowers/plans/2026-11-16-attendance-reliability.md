# Attendance Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make registration confirmation, applicant acknowledgement, QR challenge issuance, Time-In, and Time-Out follow one reliable server-authoritative lifecycle.

**Architecture:** PostgreSQL owns registration status, acceptance windows, challenge consumption, attendance timestamps, and ledger writes. The React applicant and org flows render those persisted states and map stable API errors to actionable messages. Staging verification happens only after the exact Supabase project and migration state are confirmed.

**Tech Stack:** React, TypeScript, Supabase JS, PostgreSQL PL/pgSQL, Supabase migrations and pgTAP, Vitest, Testing Library, Vite.

**Spec:** `docs/superpowers/specs/2026-11-16-attendance-reliability-design.md`

## Global Constraints

- Apply the approved attendance windows exactly: Time-In accepts `starts_at <= server_now < ends_at`; Time-Out accepts `starts_at <= server_now <= ends_at + interval '1 hour'` after a valid Time-In.
- A late registration after the confirmation cutoff and before seminar end stays active, becomes `confirmed`, and immediately requires the applicant's attendance acknowledgement; an already-existing unconfirmed registration is still released at its cutoff.
- Keep seminar capacity, duplicate registration, publication, and account authorization checks atomic and server-side.
- Store server-authoritative attendance in `registrations.time_in_at`, `registrations.time_out_at`, and `attendance_ledger`; write/update/consume challenge in one transaction.
- Preserve per-seminar attendance eligibility configuration (60% remains the documented default); do not hard-code a different threshold.
- Use forward-only migrations. Never amend an already deployed migration or expose service-role credentials in browser code.
- `npm run dev -- --mode staging` selects Vite staging configuration only; it does not deploy migrations or Edge Functions. Verify project refs before any linked Supabase command.
- Preserve unrelated pre-existing working-tree changes. Stage only files belonging to the current task if a commit is later requested.

---

### Task 1: Lock late-registration behavior with database regressions

**Files:**
- Modify: `supabase/tests/registration_rules.test.sql`
- Inspect: `supabase/migrations/20261106042858_seminar_registration.sql`
- Inspect: `supabase/migrations/20261113110000_org_seminar_authoring_improvements.sql`

**Interfaces:**
- Consumes: existing registration fixtures and `register_for_seminar` / `private.release_expired_registrations` behavior.
- Produces: assertions proving late signup remains active and older unconfirmed registrations still release.

- [x] **Step 1: Add a failing pgTAP case for signup after the confirmation cutoff but before seminar end.** Set a published seminar fixture so `starts_at - make_interval(mins => confirmation_closes_minutes_before) < clock_timestamp()` and `ends_at > clock_timestamp()`; call `register_for_seminar` as its student and assert status `confirmed`, non-null `confirmed_at`, active capacity count incremented once, and no `released_at`.
- [x] **Step 2: Add a failing case for signup at or after seminar end.** Assert the RPC rejects with `not_available` and leaves no active registration or extra capacity consumption.
- [x] **Step 3: Retain the existing release regression and assert an earlier unconfirmed row is still released at its deadline.** Run `npx supabase test db supabase/tests/registration_rules.test.sql`; record the expected failure before changing SQL.
- [x] **Step 4: Assert a late signup still fails when full and a repeated request for the active registration returns the same registration ID without creating a second row or incrementing active capacity.**

**Expected result:** Tests distinguish a newly created late signup from a previously created unconfirmed row reaching its deadline.

### Task 2: Implement the late-registration transition in a forward migration

**Files:**
- Create: `supabase/migrations/20261116000000_late_registration_confirmation.sql`
- Test: `supabase/tests/registration_rules.test.sql`

**Interfaces:**
- Consumes: Task 1 registration policy assertions.
- Produces: revised `public.register_for_seminar` with its current RPC signature and grants preserved; the release routine continues to release only unconfirmed `registered` rows.

- [x] **Step 1: Copy the current `register_for_seminar` function definition into the migration as `CREATE OR REPLACE FUNCTION`.** Preserve its signature, grants, security-definer behavior, search path, capacity locking, and caller checks.
- [x] **Step 2: Set a newly created/reactivated registration to `confirmed` with database `confirmed_at` when `v_now >= v_closes_at AND v_now < v_seminar.ends_at`.** Leave `attendance_ack_at` null so the acknowledgement is still required. Keep existing in-window confirmation behavior.
- [x] **Step 3: Ensure the routine expiry call cannot release the just-created late registration by returning it as `confirmed`.** Preserve release behavior for existing unconfirmed registrations.
- [x] **Step 4: Preserve publication, seminar-type, duplicate, capacity, cancellation/reactivation, and seminar-end checks.** At or after seminar end, keep returning `not_available`.
- [x] **Step 5: Run registration pgTAP and the full local DB suite.** Attendance-related tests pass; the full suite has two unrelated failures documented in `docs/verification/attendance-reliability-staging.md`.

**Expected result:** The database no longer accepts a late registration and immediately releases it.

### Task 3: Require persisted acknowledgement before applicant QR issuance

**Files:**
- Create: `supabase/migrations/20261116100000_attendance_acknowledgement_required_for_qr.sql`
- Modify: `supabase/tests/attendance_scan_modes.test.sql`
- Modify: `supabase/tests/registration_rules.test.sql`
- Modify: `src/features/seminars/AttendanceQr.tsx`
- Modify: `src/components/shell/AttendancePrompt.tsx`
- Create: `src/components/shell/AttendancePrompt.test.tsx`
- Modify: `src/features/seminars/AttendanceQr.test.tsx`
- Modify: `src/features/seminars/pages/SeminarPage.tsx`
- Modify: `src/features/seminars/tabs/TicketTab.tsx`
- Modify: `src/features/seminars/pages/MySeminarsPage.tsx`
- Modify: `src/features/home/components/OngoingSeminarCard.tsx`

**Interfaces:**
- Consumes: registration status, `attendance_ack_at`, seminar timestamps, and `issue_attendance_challenge` result `{ challenge, expires_at }`.
- Produces: immediate late-registration acknowledgement accepted by the server, both applicant QR entry points gated on persisted acknowledgement, and refreshed registration props after acknowledgement.

- [x] **Step 1: Add failing pgTAP cases for both RPCs.** Late acknowledgement, ordinary prompt timing, QR acknowledgement guard, and QR issuance after acknowledgement are asserted.
- [x] **Step 2: Replace `acknowledge_attendance(uuid)` in the migration.** Preserve ownership, confirmed status, idempotency, grants, and ordinary one-hour timing; permit late-registration acknowledgement.
- [x] **Step 3: Add the acknowledgement guard to `issue_attendance_challenge(uuid)`.** Preserve the 30-second expiry, binding, locking, windows, and grants.
- [x] **Step 4: Update `AttendancePrompt` for both its ordinary one-hour prompt and immediate late-signup prompt.**
- [x] **Step 5: Gate every `AttendanceQr` entry point (ticket, My Seminars, and home card) on persisted acknowledgement.**
- [x] **Step 6: Reload registration data after acknowledgement events in `SeminarPage` and `MySeminarsPage`.**
- [x] **Step 7: Add component tests for late prompt and QR gating.**
- [x] **Step 8: Run focused pgTAP and component tests.** Attendance registration and QR tests pass locally.

**Expected result:** A late registrant can acknowledge promptly and receive a QR when Time-In becomes available.

### Task 4: Make Time-In/Time-Out transitions atomic, typed, and retry-safe

**Files:**
- Create: `supabase/migrations/20261116110000_attendance_scan_transition_errors.sql`
- Modify: `supabase/tests/attendance_scan_modes.test.sql`
- Inspect: `supabase/migrations/20261114000000_explicit_org_scan_mode_and_optional_manual_reason.sql`

**Interfaces:**
- Consumes: explicit `p_kind` (`time_in` or `time_out`), idempotency key, bound challenge, active org membership, and locked registration row.
- Produces: exactly one ledger row and corresponding registration timestamp per accepted step; a same-key retry returns the original committed result.

- [x] **Step 1: Add pgTAP cases for scan transitions:** Time-In/Time-Out sequence, duplicate/wrong mode, completed state, expired challenge, and boundary checks.
- [x] **Step 2: Add an idempotent retry case using the same officer, challenge, and idempotency key.** The original entry returns without adding a duplicate.
- [x] **Step 3: Inspect lock order and transaction boundaries.** The registration lock precedes transition validation; ledger insert, registration update, and challenge consumption share one RPC transaction. Concurrent calls were not race-tested locally.
- [x] **Step 4: Ensure a new challenge and key cannot duplicate a completed checkpoint.** The database returns specific transition errors without another ledger write.
- [x] **Step 5: Run focused scan tests and the full local DB suite.** Attendance tests pass; two unrelated suite failures are documented in the verification note.

**Expected result:** A valid Time-In is followed by a valid Time-Out using a fresh QR, and ledger counts agree with registration timestamps.

### Task 5: Map scan failures to actionable application errors

**Files:**
- Modify: `src/api/types.ts`
- Modify: `src/api/attendance.ts`
- Modify: `src/api/attendance.test.ts`
- Modify: `src/features/org/pages/OrgScannerPage.tsx`
- Modify: `src/features/org/pages/OrgScannerPage.test.tsx`
- Modify: `docs/api-contract.md`

**Interfaces:**
- Consumes: exact stable database error messages and scan result shape.
- Produces: typed UI errors distinguishing invalid/expired challenge, outside-window, wrong mode, completed step, missing/released registration, forbidden org access, and network failure.

- [x] **Step 1: Add adapter tests for exact backend messages and an unknown server error.** Unknown server failures map to `server_error`, not `network`.
- [x] **Step 2: Normalize exact database messages and SQLSTATE `42501`.** Unknown errors map to `server_error`.
- [x] **Step 3: Update scanner feedback by error code.** Wrong step, completed, expired/outside-window, forbidden, network, and unknown server failures have distinct guidance.
- [x] **Step 4: Keep the idempotency key only for retrying an uncertain network outcome.** UI tests cover same-key retry and a new-key next scan.
- [x] **Step 5: Update the API contract with RPC request/response, authorization, stable error mapping, and online-only behavior.**
- [x] **Step 6: Run focused attendance API and scanner tests.** Result: 38 tests pass.

**Expected result:** Operators can tell what went wrong and what to do without reading DevTools.

### Task 6: Verify consistency, timing boundaries, and regressions locally

**Files:**
- Modify: `supabase/tests/registration_rules.test.sql`
- Modify: `supabase/tests/attendance_scan_modes.test.sql`
- Modify: `src/features/seminars/AttendanceQr.test.tsx`
- Modify: `src/components/shell/AttendancePrompt.test.tsx`
- Modify: `src/api/attendance.test.ts`
- Modify: `src/features/org/pages/OrgScannerPage.test.tsx`

**Interfaces:**
- Consumes: all implementation tasks above.
- Produces: passing focused and full regression evidence for the designed lifecycle.

- [x] **Step 1: Make exact time-boundary checks deterministic without replacing production server time.** A private SQL predicate takes `p_now`; the RPC supplies its captured database clock. Fixed-time tests cover start, end, and the Time-Out deadline.
- [x] **Step 2: Verify the ledger invariant:** one event of each kind exists and registration timestamps equal their ledger event times.
- [ ] **Step 3: Verify retry and race behavior using two concurrent local RPC calls for the same registration.** Assert at most one event commits for each checkpoint and the losing request returns the documented conflict or idempotent result.
- [x] **Step 4: Run the focused frontend tests.** Result: 38 tests pass.
- [x] **Step 5: Run the full local database suite.** Result: 353 tests; attendance suites pass and two unrelated failures are documented in the verification note.
- [x] **Step 6: Run `npm run build` and `npm run lint`.** Build passes; lint exits 0 with 0 errors and 23 warnings.

**Expected result:** Applicant status, scanner feedback, registration timestamps, and ledger counts agree across the complete workflow.

### Task 7: Prepare and verify the staging rollout

**Files:**
- Inspect: `.env.staging` or the configured Vite staging env file (never print key values)
- Inspect: `supabase/config.toml`, `supabase/migrations/`, and `docs/ENVIRONMENTS.md`
- Create: `docs/verification/attendance-reliability-staging.md`

**Interfaces:**
- Consumes: passing local regressions and reviewed forward migrations.
- Produces: redacted staging evidence with project ref, applied migration versions, RPC signatures, test cases, and outcomes.

- [x] **Step 1: Read the staging Supabase base URL without outputting keys.** Project ref is `davqbdrwsmgwpezqnaoy`; CLI target matched but its environment remains unverified.
- [ ] **Step 2: Check migration state and RPC signatures.** Confirm `issue_attendance_challenge(uuid)` and `record_org_challenge_scan(uuid,text,uuid,text)` are present and all required migration versions are applied.
- [ ] **Step 3: Prepare the deployment command from `docs/ENVIRONMENTS.md`.** Candidate migrations and the failed remote-read attempt are documented; verify the remote pending list and request authorization before applying.
- [ ] **Step 4: After authorized deployment, start the app with `npm run dev -- --mode staging`.** Use a disposable seminar and test accounts to complete late registration, immediate acknowledgement, Time-In, a fresh-QR Time-Out, and ledger verification of `1 timed-in / 1 timed-out`.
- [ ] **Step 5: Record the result without auth headers, tokens, or real student identifiers.** Include project ref, migration versions, RPC signature, timestamps/timezone, expected/observed ledger counts, and unresolved failures.

**Expected result:** The staging browser and database run compatible code, and the full attendance journey is recorded.
