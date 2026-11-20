# Attendance QR Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 30-second attendance challenges with one QR usable for Time-In and Time-Out through one hour after seminar end, enforce one successful ledger event per mode, and show scanner feedback in an accessible pop-up.

**Architecture:** Keep the existing Supabase RPC names and request shapes. A forward-only migration will set the QR expiry from `seminars.ends_at`, preserve server-side scan windows, and enforce one event per registration and mode; the React applicant QR will stop rotating and the organization scanner will use the existing `Dialog` component for outcomes.

**Tech Stack:** PostgreSQL / Supabase migrations and pgTAP, TypeScript, React, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-attendance-qr-lifecycle-design.md`

## Global Constraints

- “The QR expires at `seminars.ends_at + interval '1 hour'`.”
- “Time-In is accepted only while `starts_at <= server_now < ends_at`.”
- “Time-Out requires an accepted Time-In and is accepted while `starts_at <= server_now <= ends_at + interval '1 hour'`.”
- “Attendance duration and the existing attendance eligibility threshold continue to use the seminar's scheduled interval; the Time-Out grace period does not add attendance credit.”
- “The same QR payload is used for Time-In and Time-Out. A successful scan for one mode does not consume the QR for the other mode.”
- “Each registration may have no more than one Time-In and one Time-Out.”
- “A retry after an uncertain network result uses the same idempotency key and returns the original successful result.”
- “The user accepts the risk that an attendee can share or photograph a longer-lived QR.”
- “Keep current RPC names and parameter shapes to avoid an unnecessary API-version migration.”
- “The QR payload and challenge are never logged.”
- “No new external metrics stack is in scope.”
- “Migrations preserve existing ledger history, and duplicate data is surfaced before a uniqueness constraint is applied.”
- Apply database migrations locally first. Do not use `npm run dev -- --mode staging` as a migration command; it only selects frontend environment mode.

---

## File Map

| File | Responsibility in this plan |
| --- | --- |
| `supabase/migrations/20261116130000_attendance_qr_lifecycle_and_per_mode_once.sql` | Forward-only QR expiry, per-mode uniqueness, and RPC transaction behavior. |
| `supabase/tests/attendance_qr_lifecycle.test.sql` | Challenge issue eligibility and fixed expiry contract. |
| `supabase/tests/attendance_scan_modes.test.sql` | Same-token Time-In/Time-Out, duplicate modes, and retry behavior. |
| `supabase/tests/attendance_webinar.test.sql` | Ensure proof-review attendance writers respect the same uniqueness invariant. |
| `src/api/types.ts` | Shared stable attendance error code union. |
| `src/api/attendance.ts` | Map the new PostgREST error without hiding unknown server errors. |
| `src/api/attendance.test.ts` | Verify server error-code mapping and QR expiry response parsing. |
| `src/features/seminars/AttendanceQr.tsx` | Issue once per QR view, show after acknowledgement, retain until fixed deadline, and hide at expiry. |
| `src/features/seminars/AttendanceQr.test.tsx` | Verify acknowledgement gate, pre-start visibility, no 30-second refresh, and expiry behavior. |
| `src/features/seminars/tabs/TicketTab.tsx` | Pass seminar end time to the ticket QR in the standard and expanded views. |
| `src/features/seminars/pages/MySeminarsPage.tsx` | Pass seminar end time to the active ticket QR. |
| `src/features/home/components/OngoingSeminarCard.tsx` | Pass seminar end time to the home-card QR. |
| `src/features/org/pages/OrgScannerPage.tsx` | Show outcome feedback in a modal and pause scanning while it is open. |
| `src/features/org/pages/OrgScannerPage.test.tsx` | Verify successful, rejected, duplicate, and paused-camera outcomes. |
| `docs/verification/attendance-qr-staging.md` | Record staging project/migration evidence and the manual test results without credentials or QR values. |

## Implementation Tasks

### Task 1: Database QR lifetime and per-mode attendance invariant

**Files:**
- Create: `supabase/migrations/20261116130000_attendance_qr_lifecycle_and_per_mode_once.sql`
- Create: `supabase/tests/attendance_qr_lifecycle.test.sql`
- Modify: `supabase/tests/attendance_scan_modes.test.sql`
- Modify: `supabase/tests/attendance_webinar.test.sql`

**Interfaces:**
- Consumes: Existing RPC contracts `issue_attendance_challenge(uuid)` and `record_org_challenge_scan(uuid, text, uuid, text)`.
- Produces: `issue_attendance_challenge` returns `{challenge, expires_at}` where `expires_at = seminar.ends_at + interval '1 hour'`; the same unconsumed challenge can record one `time_in` and then one `time_out`; duplicate mode attempts raise `P0001 / attendance_already_recorded`; retry of the same committed `(officer_user_id, idempotency_key)` returns its original attendance response.

- [ ] **Step 1: Add failing pgTAP assertions for QR issuance before the seminar starts.** In `attendance_qr_lifecycle.test.sql`, create an acknowledged, active registration for a published seminar whose start is in the future, authenticate as that applicant, and assert issuance succeeds and returns the exact seminar-end-plus-one-hour expiry:

```sql
select is(
  (public.issue_attendance_challenge('00000000-0000-4000-8000-000000000731')->>'expires_at')::timestamptz,
  (select ends_at + interval '1 hour' from public.seminars where id = '00000000-0000-4000-8000-000000000731'),
  'acknowledged applicant receives a QR that expires at seminar end plus one hour'
);
```

- [ ] **Step 2: Run the focused SQL test and confirm the new assertion fails against the current 30-second issuance function.** Run `npx supabase test db supabase/tests/attendance_qr_lifecycle.test.sql` against the local Supabase test stack only. Expected: the returned 30-second expiry does not equal `ends_at + 1 hour`.

- [ ] **Step 3: Add failing scan assertions that reuse one challenge for both modes and reject a repeated mode.** In `attendance_scan_modes.test.sql`, retain the challenge returned before Time-In and use it again for Time-Out; add a second Time-In attempt with a fresh idempotency key and assert the exact error. Preserve the existing same-key retry assertion.

```sql
select throws_ok(
  $$select public.record_org_challenge_scan('00000000-0000-4000-8000-000000000731', current_setting('test.time_in_challenge'), '00000000-0000-4000-8000-000000000752', 'time_in')$$,
  'P0001', 'attendance_already_recorded', 'a second Time-In is rejected explicitly'
);
```

- [ ] **Step 4: Run the focused scan test and confirm it fails for the current consumed-challenge behavior.** Run `npx supabase test db supabase/tests/attendance_scan_modes.test.sql`. Expected: same-token Time-Out is currently rejected as `challenge_replayed`.

- [ ] **Step 5: Run the duplicate-data preflight before adding a uniqueness index.** Run this read-only query against the local database and later repeat it against staging before deployment:

```sql
select registration_id, kind, count(*) as event_count
from public.attendance_ledger
where kind in ('time_in', 'time_out')
group by registration_id, kind
having count(*) > 1;
```

Expected: zero rows. If any rows appear, stop this migration task and reconcile them through an auditable data-repair decision before applying the constraint; do not delete or rewrite ledger history in this migration.

- [ ] **Step 6: Add a partial unique index and migration guard.** Add a `DO` preflight that raises an actionable exception if the duplicate query returns any rows, then create a unique index on `(registration_id, kind)` for `kind in ('time_in', 'time_out')`. Do not include `correction` rows in the index.

```sql
create unique index attendance_ledger_registration_mode_uidx
  on public.attendance_ledger (registration_id, kind)
  where kind in ('time_in', 'time_out');
```

- [ ] **Step 7: Update challenge issuance.** In the new migration, replace the RPC body so it still requires an authenticated applicant, published in-person seminar, active registration, and persisted acknowledgement; permit issuance before seminar start; set the expiry from `ends_at + interval '1 hour'`; raise `P0001 / attendance_qr_expired` if issuance occurs at or after that expiry; retain the opaque random challenge, hash, registration binding, grants, and existing return shape.

- [ ] **Step 8: Update scan transaction and all attendance ledger writers.** In the new migration, replace the current `record_org_challenge_scan` body so it validates the challenge hash, registration binding, seminar, organization authorization, and server-clock expiry but does not mark the challenge consumed after Time-In. Resolve the challenge and lock its registration; before checking expiry or current scan windows, look up an existing ledger event by authenticated officer and idempotency key. Return it only if seminar, registration, and mode match, even if the QR has since expired; otherwise raise `idempotency_conflict`. For a new action, treat the expiry timestamp as inclusive for the Time-Out endpoint: reject only when `server_now > expires_at`, then enforce the mode's own window (`Time-In` excludes seminar end; `Time-Out` includes `ends_at + 1 hour`). Raise `attendance_already_recorded` for a repeated requested mode and atomically insert the event and update the registration timestamp. Ensure `private.record_org_scan_unchecked` and `public.review_webinar_proof` cannot bypass the unique invariant or create duplicate modes; map duplicate writes to stable application errors where the RPC contract permits.

- [ ] **Step 9: Add sanitized scan outcome logging.** In `record_org_challenge_scan`, log successful, idempotent-retry, and rejected outcomes with only the stable outcome category, requested mode, elapsed milliseconds, and request ID when available. Map unknown exception messages to `server_error` before logging and re-raise the original error unchanged. Never log `p_challenge`, idempotency keys, JWTs, registration/student identifiers, or full identity data.

- [ ] **Step 10: Run all focused database tests.** Run `npx supabase test db supabase/tests/attendance_qr_lifecycle.test.sql`, `npx supabase test db supabase/tests/attendance_scan_modes.test.sql`, and `npx supabase test db supabase/tests/attendance_webinar.test.sql`. Expected: fixed expiry, pre-start issuance, exact inclusive Time-Out/QR endpoint, same-token two-mode use, duplicate rejection, idempotent retry, and webinar-proof coverage pass.

- [ ] **Step 11: Commit the independently testable database task.** Stage only the new migration and the three SQL test files, then commit with `git commit -m "fix: support seminar-lifetime attendance QR"`.

### Task 2: Typed API errors for duplicate scans and QR lifetime

**Files:**
- Modify: `src/api/types.ts`
- Modify: `src/api/attendance.ts`
- Modify: `src/api/attendance.test.ts`

**Interfaces:**
- Consumes: RPC errors `P0001 / attendance_already_recorded` and `P0001 / attendance_qr_expired`.
- Produces: `ApiErrorCode` and the two attendance RPC adapters expose stable typed codes for the approved contract, including `attendance_already_recorded`, `attendance_qr_expired`, `challenge_expired`, `outside_scan_window`, `wrong_attendance_step`, `challenge_replayed`, and `idempotency_conflict`. Unknown PostgREST errors continue to map to `server_error`.

- [ ] **Step 1: Add a failing adapter test for a repeated mode.** In `attendance.test.ts`, mock the RPC error and assert the API result contains the typed code without exposing raw Postgres details:

```ts
it('maps an already-recorded mode to a stable attendance error', async () => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'attendance_already_recorded' } }) };
  mocks.getSupabaseClient.mockReturnValue(client);
  await expect(recordOrgChallengeScan({
    seminarId: 'seminar-1', challenge: 'b'.repeat(64), idempotencyKey: 'request-6', kind: 'time_in',
  })).resolves.toEqual({
    ok: false,
    error: { code: 'attendance_already_recorded' },
  });
});
```

- [ ] **Step 2: Run `npm test -- src/api/attendance.test.ts` and confirm the new mapping assertion fails.** Expected: current adapter does not recognize the new message.

- [ ] **Step 3: Add the approved stable API error codes to the shared union and map exact RPC messages.** Keep the allowlist in `attendance.ts` explicit for the issue/scan contract, including `attendance_qr_expired` from `issue_attendance_challenge` and the scan errors listed in the Interfaces section. Do not map unrecognized `P0001` messages to `network`.

- [ ] **Step 4: Add a test proving an unknown database error remains `server_error`.** Use a non-allowlisted `P0001` message and assert the adapter does not expose `message`, `details`, or `hint`.

- [ ] **Step 5: Run `npm test -- src/api/attendance.test.ts` and commit this task.** Expected: all attendance API tests pass. Commit with `git add src/api/types.ts src/api/attendance.ts src/api/attendance.test.ts` and `git commit -m "fix: map attendance mode conflicts"`.

### Task 3: Applicant QR availability and fixed deadline

**Files:**
- Modify: `src/features/seminars/AttendanceQr.tsx`
- Modify: `src/features/seminars/AttendanceQr.test.tsx`
- Modify: `src/features/seminars/tabs/TicketTab.tsx`
- Modify: `src/features/seminars/pages/MySeminarsPage.tsx`
- Modify: `src/features/home/components/OngoingSeminarCard.tsx`

**Interfaces:**
- Consumes: `AttendanceQr` receives `seminarId`, `title`, `size`, persisted `acknowledged`, `startsAt`, `endsAt`, and server-synchronized `serverNow`.
- Produces: QR issue request after acknowledgement without waiting for seminar start; no periodic challenge rotation; same challenge remains displayed for Time-In and Time-Out; QR remains visible through the exact `endsAt + 1 hour` endpoint and hides immediately after it based on server time and visibility refresh; QR is never issued/displayed before acknowledgement.

- [ ] **Step 1: Add failing component tests for acknowledgment, pre-start display, stable challenge, and cutoff.** Update `AttendanceQr.test.tsx` props with `endsAt`; cover no issue before acknowledgement, issue after acknowledgement while server time is before start, one issue call while mounted after advancing beyond 30 seconds, visibility at the exact one-hour-after-end endpoint, and hiding immediately after it.

```tsx
it('requests one stable QR after acknowledgement even before seminar start', async () => {
  const props = {
    seminarId: 'seminar-1', title: 'Upcoming seminar', size: 128, acknowledged: true,
    startsAt: '2026-11-16T10:00:00.000Z', endsAt: '2026-11-16T11:00:00.000Z',
    serverNow: Date.parse('2026-11-16T09:59:00.000Z'),
  };
  mocks.issueAttendanceChallenge.mockResolvedValue({ ok: true, data: {
    challenge: 'a'.repeat(64), expiresAt: '2026-11-16T12:00:00.000Z',
  } });
  render(<AttendanceQr {...props} />);
  expect(mocks.issueAttendanceChallenge).toHaveBeenCalledTimes(1);
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
  expect(mocks.issueAttendanceChallenge).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run `npm test -- src/features/seminars/AttendanceQr.test.tsx` and verify those expectations fail for the old start-time gate and 30-second timer.**

- [ ] **Step 3: Change the QR component's eligibility rule.** Allow challenge issuance when acknowledged, online, and before the fixed expiry, including before `startsAt`. Remove the 30-second refresh timer and local `Date.now()` expiry comparison. Use `expiresAt - serverNow` to schedule a one-shot hide timer; on `visibilitychange`, call the existing `api.getServerTime()` and hide immediately if the server deadline has passed. Keep the one-request retry action and clear failed/stale state when seminar or registration identity changes.

- [ ] **Step 4: Pass `endsAt` through all three existing QR call sites.** Update the standard/expanded ticket, active seminar ticket, and home ongoing-seminar card so all views use the same fixed expiry rule.

- [ ] **Step 5: Run the focused test and TypeScript build.** Run `npm test -- src/features/seminars/AttendanceQr.test.tsx` and `npm run build`. Expected: the QR remains stable past 30 seconds and is hidden at the fixed deadline in every view.

- [ ] **Step 6: Commit this task.** Stage only the six listed applicant QR files and commit with `git commit -m "fix: keep attendance QR valid through timeout grace"`.

### Task 4: Scanner outcome pop-up and camera pause

**Files:**
- Modify: `src/features/org/pages/OrgScannerPage.tsx`
- Modify: `src/features/org/pages/OrgScannerPage.test.tsx`
- Reuse: `src/components/ui/Dialog.tsx`

**Interfaces:**
- Consumes: typed scan results from Task 2, selected scan mode, and existing `Dialog` props `{open, onClose, title, children}`.
- Produces: modal success/error feedback for manual and QR attendance operations; duplicate feedback names the attempted mode; camera and form submissions pause while the outcome dialog is open and resume only after dismissal.

- [ ] **Step 1: Change scanner tests to expect a dialog instead of inline feedback.** Cover a success, an `attendance_already_recorded` result for Time-In and Time-Out, an expired/outside-window result, a manual scan result, and scanner camera pause until dialog close.

```tsx
expect(screen.getByRole('dialog')).not.toBeNull();
expect(screen.getByText(/Time-In is already recorded/i)).not.toBeNull();
```

- [ ] **Step 2: Run `npm test -- src/features/org/pages/OrgScannerPage.test.tsx` and verify the dialog and duplicate-mode cases fail against the inline-status implementation.**

- [ ] **Step 3: Replace `reason` outcome state with a typed feedback-dialog state.** Store only display text and outcome category; build the duplicate message from the current selected mode. Render the existing `Dialog` with a stable accessible title, result text, and Close button. Keep camera permission/setup messages beside the camera controls because they are not completed scan outcomes.

- [ ] **Step 4: Guard both camera and manual submissions while the dialog is open.** Have the camera interval skip detections while feedback is open and make `processCode` return before sending an RPC if a previous result still awaits dismissal. After success or a terminal QR error, prevent automatic re-detection of the same `(payload, scan mode)` while that QR remains continuously in frame; clear that suppression after a different or absent QR is observed so an intentional re-presentation reaches the server and can show `attendance_already_recorded`. Changing from Time-In to Time-Out permits the same QR payload to be scanned for the second mode. On close, resume camera detection without automatically replaying the prior operation.

- [ ] **Step 5: Run `npm test -- src/features/org/pages/OrgScannerPage.test.tsx` and commit this task.** Expected: all scan results appear in the modal, duplicate messages identify mode, and camera does not submit while the modal is open. Commit with `git add src/features/org/pages/OrgScannerPage.tsx src/features/org/pages/OrgScannerPage.test.tsx` and `git commit -m "feat: show attendance scan results in dialog"`.

### Task 5: End-to-end verification and staging evidence

**Files:**
- Create: `docs/verification/attendance-qr-staging.md`
- Verify: Tasks 1–4 files and the approved spec.

**Interfaces:**
- Consumes: completed local implementation, staging database connection stored in `SEMINEX_STAGING_DB_URI`, staging Vite environment, and Supabase CLI migration targeting.
- Produces: fresh verification results and a sanitized staging record containing project reference, applied migration version, test steps, result codes, and no credential or QR payload.

- [ ] **Step 1: Run the full local frontend test suite.** Run `npm test`. Expected: zero failed tests.

- [ ] **Step 2: Run the full local Supabase pgTAP suite.** Run `npx supabase test db` only against the local test stack, as required by the repository README. Expected: zero failed tests. Do not run `supabase db reset` unless the local database reset is intended; it drops local database data.

- [ ] **Step 3: Run build and lint.** Run `npm run build` and `npm run lint`. Record each exit code and any existing warnings separately.

- [ ] **Step 4: Check the staging migration target before applying anything.** Use the CLI's explicit remote URL targeting and inspect the dry-run target and pending migration list. The current Supabase CLI documents `--remote=<ref|branch|url>` for `db push`; do not rely on an implicit linked project. Run in PowerShell:

```powershell
npx supabase migration list "--remote=$env:SEMINEX_STAGING_DB_URI"
npx supabase db push --dry-run "--remote=$env:SEMINEX_STAGING_DB_URI"
```

Expected: target is the known staging project, only the intended pending migration set is shown, and the ledger duplicate preflight returns zero rows. If any target or migration is unexpected, stop before push. Supabase's CLI reference documents explicit `--remote` targeting and dry-run behavior: [Supabase CLI `db push`](https://supabase.com/docs/reference/cli/introduction).

- [ ] **Step 5: Apply the migration to staging only after the dry-run review.** Run `npx supabase db push "--remote=$env:SEMINEX_STAGING_DB_URI"` and confirm the CLI's displayed target and migration list before accepting its prompt. Do not add `--yes`. Then rerun `npx supabase migration list "--remote=$env:SEMINEX_STAGING_DB_URI"` and confirm the migration is applied.

- [ ] **Step 6: Exercise the staging workflow with two test accounts.** Use `npm run dev -- --mode staging`. Acknowledge attendance as the applicant before seminar start and verify the QR appears. At start, scan the same displayed QR for Time-In; confirm exactly one ledger Time-In. Scan the identical QR for Time-Out; confirm exactly one ledger Time-Out. Scan Time-In again and verify the modal says it is already recorded. Repeat Time-Out and verify its specific duplicate message. Confirm a Time-Out scan during the one-hour grace succeeds, but Time-In after seminar end fails. Verify attendance-duration credit remains within scheduled hours.

- [ ] **Step 7: Verify secret-safe diagnostics and record evidence.** Confirm logs/observability show request outcome category, requested mode, request ID where available, and duration without QR/challenge, bearer token, Student ID, or full identity. Record staging project reference (not the database URI), migration version, test account aliases, ledger counts, boundary outcomes, and build/test results in `docs/verification/attendance-qr-staging.md`.

- [ ] **Step 8: Perform a focused code/security review before declaring completion.** Review migration grants/search paths, transaction/idempotency order, unique-index scope, duplicate-data preflight, token logging, API error mapping, and modal/camera accessibility. Resolve Critical and Important findings, rerun the affected focused tests, and commit the sanitized staging evidence with `git commit -m "docs: record attendance QR staging verification"`.

## Self-Review Checklist

- Spec coverage: criteria 1–3 are Task 3; 4–10 are Tasks 1 and 5; 11 is Task 4; 12 is Task 1; 13 is Task 5.
- Placeholder scan: no TBD/TODO or "implement later" instructions are used.
- Interface consistency: the RPC names/arguments remain unchanged; `AttendanceQr` adds `endsAt`; client errors use `attendance_already_recorded`; the scanner derives the display mode from its existing `scanKind` state.
- Migration safety: uniqueness is preceded by a read-only duplicate query, the migration fails safely if duplicates exist, and no attendance history is silently deleted.
- Scope: this plan covers only the attendance QR lifecycle and scanner feedback; certificate delivery and registration policy remain out of scope.
