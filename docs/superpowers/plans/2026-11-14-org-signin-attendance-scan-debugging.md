# Organization Sign-In, Attendance Scan, and Scanner Mode Plan

> **For agentic workers:** Use the systematic-debugging workflow to execute this investigation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine why organization sign-in triggers `refresh_token_not_found` and why an attendance QR scan returns `not_available`, then add an explicit QR Time-In/Time-Out mode and make the manual-entry reason optional.

**Architecture:** Trace Supabase Auth initialization and password sign-in separately from the scanner RPC. Compare the Auth error with persisted session metadata, then compare attendance RPC guards with challenge expiry, seminar schedule, and registration state. For QR scans, require an explicit mode selection on every Scanner page visit and pass the selected mode to an authenticated, server-validated RPC. Keep manual Student ID entries independent of that selector; make their audit reason optional while preserving it when supplied.

**Tech Stack:** React, TypeScript, Supabase JS 2.119.0, Supabase Auth/PostgREST, PostgreSQL PL/pgSQL, Vitest, Testing Library, and pgTAP.

**Spec:** User-provided Network and console report plus the approved scanner-mode design below; current contracts in `src/api/supabaseClient.ts`, `src/api/auth.ts`, `src/api/attendance.ts`, `src/features/org/pages/OrgScannerPage.tsx`, `src/api/orgTypes.ts`, and `supabase/migrations/20261112000000_registration_scan_challenges.sql`.

## Global Constraints

- Treat the two errors as separate until a trace proves they share session state.
- Do not log, copy, or report access tokens, refresh tokens, passwords, cookies, authorization headers, or raw QR challenges.
- Record event times with timezone and redact student, organization, seminar, and account identifiers in the report.
- Do not clear browser storage, sign users out, change passwords, alter existing database rows, rotate credentials, add dependencies, or deploy without explicit approval.
- A new database migration is in scope for the approved scan-mode RPC contract and optional manual-reason validation; preserve authentication, organization-membership, challenge binding/expiry, idempotency, and attendance-window guards.
- Run `npx supabase test db` only against the repository's isolated local Supabase test database; never run it against a linked, staging, or production project.
- Preserve all existing working-tree changes; the scanner component and its regression test are already modified in this checkout.
- Keep changes limited to the organization sign-in/Auth flow, attendance scanner, attendance API/types, the new attendance migration, and directly relevant tests.
- Do not redesign the Supabase RPC or introduce a REST/OpenAPI layer; document the existing machine-readable error behavior only if it needs correction.
- Require a Time-In or Time-Out selection before QR camera scanning on each Scanner page visit; apply this selector to QR scans only. Manual Student ID entry remains available without a mode selection and keeps its own server-derived attendance kind.
- Make the manual-entry reason optional, retain a supplied reason in the attendance ledger, and do not make it a prerequisite for recording a manual entry.
- Keep the Scanner UI in Operate mode: use existing Seminex organization colors and DM Sans typography, a compact accessible two-option radio control above the camera, and clear selected/focus/disabled states. Do not redesign surrounding layout or add decorative treatment.

---

### Task 1: Separate the events and capture the missing runtime facts

**Files:**
- Inspect: `src/features/auth/pages/OrganizationSignInPage.tsx`
- Inspect: `src/features/org/pages/OrgScannerPage.tsx`
- Inspect: `src/hooks/useNow.ts`
- Runtime evidence: browser Network panel and visible organization sign-in/scanner pages, if available

**Interfaces:**
- Consumes: the user's two Network responses and console stacks.
- Produces: a redacted event timeline for Auth initialization/sign-in and the attendance scan, including which browser origin and session context each came from.

- [ ] **Step 1: Record both response identities.** For Auth, record the request time, response code `refresh_token_not_found`, and whether the separate `token?grant_type=password` sign-in request succeeds or fails. For scanning, record the request time, seminar schedule and timezone, HTTP status, RPC message, and whether there were one or multiple RPC POSTs for one scan.
- [ ] **Step 2: Confirm whether both reports came from the same browser origin, profile, and time window.** Do not infer this from similar console output; record it from the user or browser context.
- [ ] **Step 3: Capture the scan context without recording secrets.** Record the QR's issued/expiry time if visible in the attendee ticket, scan time, seminar `starts_at`/`ends_at`, and whether the registration already has `time_in_at` or `time_out_at`. Do not copy the QR value.
- [ ] **Step 4: Keep errors distinct.** Mark the Auth initialization refresh request, password sign-in response, and scan RPC response as separate events in the timeline.

**Expected deliverable:** A redacted timeline that establishes whether the refresh warning actually blocks password sign-in and provides the schedule/challenge facts needed to classify the scan rejection.

### Task 2: Trace the persisted refresh-token failure

**Files:**
- Inspect: `src/api/supabaseClient.ts`
- Inspect: `src/api/auth.ts` (`mapError`, `signInWithEmail`, `orgSignIn`)
- Inspect: `src/features/auth/pages/OrganizationSignInPage.tsx`
- Inspect: `src/api/auth.test.ts`
- Inspect: `src/api/client.session.test.ts`

**Interfaces:**
- Consumes: Task 1's Auth request sequence and the current Supabase client configuration.
- Produces: a root-cause finding that distinguishes stale persisted session state, project/origin mismatch, concurrent browser session refresh, and password-authentication failure.

- [ ] **Step 1: Trace initialization to the failing request.** Confirm `createClient` enables `autoRefreshToken` and `persistSession`, then follow module initialization through Supabase Auth `_initialize`/`_recoverAndRefresh` and compare it with the explicit `signInWithPassword` call.
- [ ] **Step 2: Inspect only safe session metadata.** If browser access is available, inspect the relevant Supabase storage key name, project/origin association, session presence, and expiry metadata. Never print or copy the stored token values. Do not clear or overwrite storage.
- [ ] **Step 3: Compare project and origin configuration.** Confirm the browser origin is the intended local app and the loaded `VITE_SUPABASE_URL` project matches the session's storage namespace; report only whether they match, not key values.
- [ ] **Step 4: Check for session contention.** Establish whether another tab, browser profile, app origin, recent sign-out, or credential reset could have invalidated/rotated the persisted refresh token before this client attempted refresh.
- [ ] **Step 5: Trace the explicit password sign-in result and UI mapping.** Determine whether the login action itself fails, succeeds despite the initialization warning, or returns a distinct code through `mapError`.
- [ ] **Step 6: State the falsification condition.** The stale-session hypothesis is weakened if the refresh request occurs after a successful fresh password grant with no prior persisted session, or if the failing request targets a different project than the session it attempted to refresh.

**Expected deliverable:** A supported explanation for `refresh_token_not_found`, plus a clear distinction between an initialization warning and an actual failed org login. If the cause is only a stale browser session, report a user-level recovery option without applying it.

### Task 3: Trace `not_available` through scanner, API mapper, and SQL guards

**Files:**
- Inspect: `src/features/org/pages/OrgScannerPage.tsx`
- Inspect: `src/api/attendance.ts` (`recordOrgChallengeScan` and `apiError`)
- Inspect: `src/features/org/pages/OrgScannerPage.test.tsx`
- Inspect: `supabase/migrations/20261112000000_registration_scan_challenges.sql` (`issue_attendance_challenge`, `record_org_challenge_scan`)
- Inspect: `src/features/seminars/AttendanceQr.tsx`

**Interfaces:**
- Consumes: Task 1's scan facts and the exact PostgREST error body.
- Produces: a mapping from HTTP 400 / SQLSTATE `P0001` / message `not_available` to the precise server-side guard and the client behavior after the rejection.

- [ ] **Step 1: Trace the camera flow.** Follow the 350 ms camera polling interval through QR decoding, `processCode`, `api.recordOrgChallengeScan`, error mapping, and the `unavailableCameraCode` suppression. Determine whether the reported stack merely identifies the polling caller or whether one camera read generated repeated RPCs.
- [ ] **Step 2: Read the complete RPC guards.** Confirm `auth.uid()` and active organization membership checks, challenge lookup/binding, consumed state, 30-second `expires_at`, seminar start/end window, and registration Time-In/Time-Out state.
- [ ] **Step 3: Map the response semantics.** Identify which branches return `not_available`, and distinguish them from `session_expired`, `forbidden`, `not_found`, and `conflict`. An authenticated RPC response with `not_available` supports a scan-window/expiry failure rather than a missing scanner session.
- [ ] **Step 4: Match the runtime timestamps to the guards.** Compare database/server time, seminar start/end, challenge issue/expiry, and registration attendance state. At 12:50, determine whether the seminar had already ended and whether the attendee was attempting first Time-In or Time-Out.
- [ ] **Step 5: Review existing local scanner changes without overwriting them.** The current diff adds `unavailableCameraCode` suppression and a user message; the current test asserts one RPC for a repeated camera read after a mocked terminal `not_available`. Determine whether this behavior is in the served bundle and whether the observed Network log shows one or repeated requests.
- [ ] **Step 6: State the falsification condition.** The expiry/window hypothesis is disproved if the challenge was unexpired at database receipt, server time fell inside the correct scan window for the registration's current Time-In/Time-Out state, and the response still came from one of those guards; then investigate deployment/schema mismatch or a different RPC definition.

**Expected deliverable:** The exact cause of the scan error if the timestamps are available. If they are not, report the finite candidate guards and state which timestamp/state is needed to distinguish them.

### Task 4: Verify behavior and test only a demonstrated code defect

**Files:**
- Inspect/run: `src/api/auth.test.ts`
- Inspect/run: `src/api/client.session.test.ts`
- Inspect/run: `src/features/org/pages/OrgScannerPage.test.tsx`
- Inspect/run: `src/api/attendance.test.ts`
- Inspect: `package.json`

**Interfaces:**
- Consumes: root-cause findings from Tasks 2–3.
- Produces: targeted test evidence and, only if needed, one minimal regression test for the proven client/API defect.

- [ ] **Step 1: Select only relevant tests.** Use `npm test -- --run src/api/auth.test.ts src/api/client.session.test.ts src/features/org/pages/OrgScannerPage.test.tsx src/api/attendance.test.ts` to check the existing auth, session, scanner, and RPC-mapping coverage.
- [ ] **Step 2: Review tests against observable behavior.** Confirm scanner tests assert one request after terminal `not_available`; identify whether a test exercises expired QR versus seminar time-window conditions. Confirm auth tests distinguish initial refresh failure from password sign-in outcome if that behavior is covered by the app.
- [ ] **Step 3: If a code defect is demonstrated, add one focused failing regression test first.** Mock Supabase/Auth and scanner RPC boundaries; never call a live API or database from unit tests. Assert externally observable result and request count/error mapping, not internal function call order unless the call count is the reported defect.
- [ ] **Step 4: Apply one minimal client/API correction only after the test reproduces the observed defect.** Do not modify SQL eligibility rules to suppress `not_available` or hide a real expired/out-of-window QR.
- [ ] **Step 5: Re-run the focused test set.** Record exact pass/fail counts and any environment limitations.
- [ ] **Step 6: If source code changed, run `npm run build` and `git diff --check`.** Review only the relevant diff and leave unrelated checkout changes untouched.

**Expected deliverable:** Test evidence that either confirms current client behavior or demonstrates the narrowly fixed defect. Do not claim a live database or browser condition was verified by a unit-test mock.

### Task 5: Add explicit QR scan mode and make manual reason optional

**Files:**
- Modify: `src/features/org/pages/OrgScannerPage.tsx`
- Modify: `src/features/org/pages/OrgScannerPage.test.tsx`
- Modify: `src/api/orgTypes.ts`
- Modify: `src/api/attendance.ts`
- Modify: `src/api/attendance.test.ts`
- Add: `supabase/migrations/20261114000000_explicit_org_scan_mode_and_optional_manual_reason.sql`
- Add: `supabase/tests/attendance_scan_modes.test.sql`
- Inspect: `src/api/client.ts`
- Inspect: `src/styles/index.css`

**Interfaces:**
- Consumes: verified scanner guards and contracts from Tasks 1–4.
- Produces: `RecordOrgChallengeScanInput.kind: 'time_in' | 'time_out'`; RPC overload `record_org_challenge_scan(uuid, text, uuid, text)` with required named argument `p_kind`; a server-validated scan result; and an optional manual reason stored when provided.

**Design direction:**
- Use the existing Operate UI system: DM Sans; primary maroon `#5b0309`; primary container `#7a1c1c`; page surface `#fff8f5`; card white `#ffffff`; text `#1f1b19`; subtle divider `#e5dfd7`.
- Place a native, accessible radio group labeled “Scan mode” directly below “Scan attendee” and above the camera. It has “Time-In” and “Time-Out” options, is left aligned, and follows existing `orgAction*` control dimensions, focus rings, and color tokens.
- Start with neither option selected on each page visit. Keep “Start camera” disabled until an operator selects a mode. Show the selected mode visibly while the camera is active. Disable mode changes while a scan request is in flight; allow switching between attendees after the response completes.
- The selected mode affects QR camera scans only. Manual Student ID entry remains a separate action, does not require a mode selection, and continues using the server’s existing next-punch decision.
- Keep the manual reason field as an optional note. Preserve text when supplied; allow the operator to submit without it.
- Sequence: choose mode → start camera → decode QR → submit the mode with the opaque challenge → database verifies the requested transition and records it → show the recorded mode/result. On mismatch, show a concise next action (for example, “Already timed in. Switch to Time-Out.”).
- Layout at narrow widths stacks the two choices without shrinking tap targets; at wider widths the two options remain a compact inline group. Use existing palette/type tokens rather than adding a new visual system.

```text
Scan attendee
Scan mode
[ Time-In ] [ Time-Out ]
[          Camera preview          ]

Manually enter Student ID
[ Student ID                     ]
Reason (optional)
[                                 ]
[ Record manual entry             ]
```

**Evidence audit / failure checks:**
- A selector that only changes the UI label is insufficient because the current database function chooses the punch kind from registration state. The selected mode must cross the API and be checked in the database transaction.
- A request that changes mode while retrying the same challenge must not reuse an idempotency key created for the other mode. Include `kind` in the pending-scan fingerprint.
- Removing a mandatory reason weakens audit context when staff omit it. Retain the optional field and ledger persistence when present; the authenticated officer, timestamp, scan method, and recorded kind remain required audit fields.

- [ ] **Step 1: Add failing API contract tests.** In `src/api/attendance.test.ts`, use this request shape and assert that the RPC includes the required mode:

```ts
const input = {
  seminarId: 'seminar-1',
  challenge: 'b'.repeat(64),
  idempotencyKey: 'request-2',
  kind: 'time_out' as const,
};

await recordOrgChallengeScan(input);
expect(client.rpc).toHaveBeenCalledWith('record_org_challenge_scan', {
  p_seminar_id: input.seminarId,
  p_challenge: input.challenge,
  p_idempotency_key: input.idempotencyKey,
  p_kind: input.kind,
});
```

- [ ] **Step 2: Add failing database contract tests.** In `supabase/tests/attendance_scan_modes.test.sql`, cover Time-In when no Time-In exists, rejection of Time-Out before Time-In, Time-Out after Time-In, rejection of duplicate Time-In, rejection after completed Time-Out, mode-aware idempotent retry, and manual entry with null, blank, and supplied reasons. Use isolated pgTAP fixtures and assert the exact SQLSTATE and message for rejected transitions.
- [ ] **Step 3: Run the relevant tests to confirm they expose the missing contract.** Run `npm test -- --run src/api/attendance.test.ts` and `npx supabase test db`; expect the new assertions to fail because the current RPC lacks `p_kind` and manual reasons are required.
- [ ] **Step 4: Add the migration.** Add a four-argument authenticated overload of `public.record_org_challenge_scan(uuid, text, uuid, text)` with required named argument `p_kind` (`time_in` or `time_out`); leave the existing three-argument function intact for older clients. Validate mode against locked registration state and database time, record exactly the requested kind, and preserve existing auth, membership, challenge, expiry, idempotency, and time-window checks. Return `conflict` when the selected mode does not match the registration's next valid transition and reserve `not_available` for challenge expiry or the scan time window. Replace `private.record_org_scan_unchecked` with the minimal optional-reason validation change: accept null/blank, normalize blank to null, trim and retain supplied text, and continue rejecting values over 500 characters.
- [ ] **Step 5: Run the database regression suite.** Run `npx supabase test db`; expect the new pgTAP assertions and existing attendance tests to pass.
- [ ] **Step 6: Implement the typed API contract.** Add `kind: 'time_in' | 'time_out'` to `RecordOrgChallengeScanInput` in `src/api/orgTypes.ts`, send it as `p_kind` from `src/api/attendance.ts`, and preserve the existing `recordOrgChallengeScan` client wrapper.
- [ ] **Step 7: Re-run the API contract tests.** Run `npm test -- --run src/api/attendance.test.ts`; expect the mode-aware RPC payload test and all existing attendance tests to pass.

**Expected deliverable:** Backward-compatible authenticated RPC mode contract with database coverage and a typed frontend caller.

### Task 6: Add required mode selection to the QR scanner and make manual reason optional

**Files:**
- Modify: `src/features/org/pages/OrgScannerPage.tsx`
- Modify: `src/features/org/pages/OrgScannerPage.test.tsx`

**Interfaces:**
- Consumes: the mode-aware API from Task 5.
- Produces: per-page-visit QR scan mode selection, exact mode propagation for camera scans, unchanged server-derived manual mode, and optional manual reason behavior.

- [ ] **Step 1: Add failing scanner interaction tests.** In `OrgScannerPage.test.tsx`, assert neither mode is selected on initial render, the camera start button is disabled until a mode is selected, and a selected mode appears as the current scan mode.
- [ ] **Step 2: Add failing QR and manual path tests.** Assert each camera QR request includes the selected mode, switching modes between scans changes the mode parameter and idempotency fingerprint, camera scanning is blocked when mode is unset, and manual Student ID recording remains available without a mode or reason.
- [ ] **Step 3: Run the scanner test to confirm failure.** Run `npm test -- --run src/features/org/pages/OrgScannerPage.test.tsx`; expect failures for the missing selector/mode parameter and currently required reason.
- [ ] **Step 4: Implement the selector and camera guard.** Store `null | 'time_in' | 'time_out'` in page-local state so each page visit starts unset. Add a left-aligned `fieldset` and `legend` with native radio inputs; disable camera start until a choice is made and disable the options during an in-flight scan. Pass the selected kind to `recordOrgChallengeScan` and include it in the pending-scan fingerprint.
- [ ] **Step 5: Make manual reason optional.** Remove the `required` and minimum-length block, update the label to “Reason (optional),” and pass `manualReason.trim() || undefined` so an empty field is omitted while supplied text is preserved.
- [ ] **Step 6: Add mode-aware feedback.** For a QR `conflict`, show: “The selected mode does not match this attendee’s next attendance step. Check their attendance status, then choose Time-In or Time-Out.” Keep expiry/window feedback for `not_available`.
- [ ] **Step 7: Re-run focused scanner tests and build.** Run `npm test -- --run src/features/org/pages/OrgScannerPage.test.tsx src/api/attendance.test.ts`, then `npm run build` and `git diff --check`. Record exact outcomes and investigate failures before proceeding.
- [ ] **Step 8: Review the targeted diff.** Confirm the mode is QR-only, mode selection resets on a new page visit, manual entry remains independent, optional reasons are saved when supplied, and no unrelated dirty file was modified.

**Expected deliverable:** A scanner that requires an explicit per-visit QR mode; its selected mode is sent to and validated by the server. Manual Student ID input remains independent, and its reason is optional.

### Task 7: Review findings and report the diagnosis and scanner-mode change

**Files:**
- Review: only files changed during this investigation, if any
- Do not modify: existing unrelated working-tree changes

**Interfaces:**
- Consumes: redacted timeline, root-cause analysis, test output, and targeted diff.
- Produces: a concise incident report with separate conclusions for sign-in and QR scan, plus a summary of the approved scanner-mode behavior.

- [ ] **Step 1: Summarize the intent before code review.** State that the review checks stale-session handling, terminal scan-error behavior, explicit QR mode validation, and optional manual reason storage without weakening authorization or time-window rules.
- [ ] **Step 2: Review correctness, error mapping, security, and regression coverage.** Use `code-reviewer` if changes were made; use `receiving-code-review` to technically verify any feedback before applying it. Use `frontend-design` and `impeccable` Operate-mode checks to review keyboard access, focus, selected/disabled states, narrow-screen layout, and whether the mode is unmistakable without redesigning the surrounding scanner page.
- [ ] **Step 3: Report each issue separately.** For sign-in, say whether the old persisted refresh token caused an initialization warning, blocked login, or remains unconfirmed. For scanning, name the specific expired-challenge/window/state guard or the missing evidence. For the mode change, confirm per-visit selection, QR-only scope, database enforcement, optional-reason behavior, and backward compatibility.
- [ ] **Step 4: Include evidence and limits.** Provide request timestamps, redacted request counts, relevant seminar/challenge timing, frontend and database test results, changed files, and any required user recovery step. Explicitly mark unavailable runtime/database checks as unperformed.

**Expected deliverable:** A two-part root-cause report, the scanner-mode implementation summary, actionable next step for any unconfirmed branch, and confirmation that no session storage was cleared, existing database rows were changed, or deployment was made.
