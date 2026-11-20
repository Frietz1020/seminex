# Attendance QR Timing Debugging Plan

> **For agentic workers:** Use the available systematic-debugging workflow to execute this investigation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm that the local Seminex app waits until the seminar start time before requesting an attendance QR challenge, and identify any remaining pre-start request at its actual caller.

**Architecture:** The UI uses `useNow()` and `api.getServerTime()` to obtain database time, gates `api.issueAttendanceChallenge()` in `AttendanceQr`, and leaves final eligibility enforcement in the `issue_attendance_challenge` database function. Diagnose from caller to database, using a focused regression test and (when a seminar is available) browser Network evidence.

**Tech Stack:** React, TypeScript, Vitest, Supabase RPC, PostgreSQL PL/pgSQL, Vite local app.

**Spec:** User-provided incident context and current behavior in `src/features/seminars/AttendanceQr.tsx`, `src/hooks/useNow.ts`, `src/api/serverTime.ts`, and `supabase/migrations/20261112000000_registration_scan_challenges.sql`.

## Global Constraints

- Preserve the database eligibility guard; `not_available` before `starts_at` is expected server behavior.
- Diagnose the running local bundle and request caller before changing code.
- Keep any code changes limited to `src/features/seminars/AttendanceQr.tsx`, its ticket call sites, and the directly relevant tests.
- Do not modify migrations, database state, `.env` files, dependency manifests, unrelated dirty files, or deploy anything.
- Do not assume the supplied root cause proves what code the current browser loaded; report direct observations separately from the supplied history.

---

### Task 1: Establish the current implementation and all challenge callers

**Files:**
- Inspect: `src/features/seminars/AttendanceQr.tsx`
- Inspect: `src/features/seminars/AttendanceQr.test.tsx`
- Inspect: `src/features/seminars/pages/MySeminarsPage.tsx`
- Inspect: `src/features/seminars/tabs/TicketTab.tsx`
- Inspect: `src/api/attendance.ts`
- Inspect: `src/api/serverTime.ts`
- Inspect: `src/hooks/useNow.ts`

**Interfaces:**
- Consumes: the supplied incident description and current checkout.
- Produces: a concise call graph from ticket views to `issueAttendanceChallenge`, including the `serverNow` source and every rendered call site.

- [ ] **Step 1: Search every frontend call to `issueAttendanceChallenge`.** Record each direct call and confirm whether it passes through `AttendanceQr`.
- [ ] **Step 2: Trace the timestamp input.** Confirm that `AttendanceQr.serverNow` comes from `useNow()`, which calls `api.getServerTime()`, and that `getServerTime()` calls the `get_server_time` RPC without a local-clock fallback.
- [ ] **Step 3: Inspect the gate and its cleanup.** Record the conditions that prevent issuing a challenge, how the start timer is scheduled, and how it is cancelled when the component inputs change or unmounts.
- [ ] **Step 4: Compare the working tree with the prior implementation.** Use `git diff --` on only the attendance QR component, its call sites, and its test. Do not reset, stage, or modify the other existing changes in the checkout.

**Expected deliverable:** A call graph and a factual summary of whether every visible ticket QR uses the timing gate in the current source.

### Task 2: Verify the database boundary and evidence for the root cause

**Files:**
- Inspect: `supabase/migrations/20261112000000_registration_scan_challenges.sql` (`public.issue_attendance_challenge`)
- Inspect: `supabase/migrations/20261109030000_attendance_ack_server_time.sql` (`public.get_server_time`)
- Inspect: `src/features/seminars/AttendanceQr.tsx`

**Interfaces:**
- Consumes: the RPC call graph from Task 1 and the database function definitions.
- Produces: a claim/evidence table distinguishing client gating from authoritative server enforcement.

- [ ] **Step 1: Read the full challenge-issuance function.** Identify the seminar-type, publication, registration, attendance-state, and time-window guards; record the exact condition that returns `not_available` before start.
- [ ] **Step 2: Read the full server-time function.** Confirm the clock source and the function's execution grants.
- [ ] **Step 3: Compare both clock paths.** Confirm that the client countdown starts from the database timestamp and that the issuance RPC still checks database time when the request arrives.
- [ ] **Step 4: Record competing explanations for a reported pre-start `not_available`.** Include stale Vite/browser/service-worker assets, another caller bypassing `AttendanceQr`, stale or invalid seminar start data, and a request sent after a schedule or session change. Mark each as confirmed, ruled out, or unverified based on evidence.

**Expected deliverable:** Evidence that `not_available` before the start is intentional server enforcement, plus a clear statement of what evidence does or does not prove the browser used the updated component.

### Task 3: Run the focused timing regression and inspect the uncovered boundaries

**Files:**
- Inspect/run: `src/features/seminars/AttendanceQr.test.tsx`
- Inspect: `package.json`

**Interfaces:**
- Consumes: current Vitest setup and the existing `AttendanceQr` test.
- Produces: command output for the focused timing test and a short coverage note for pre-start, start boundary, unavailable server time, and changed seminar inputs.

- [ ] **Step 1: Run the focused test.** Run `npm test -- --run src/features/seminars/AttendanceQr.test.tsx` from the repository root and record the exit code and test count.
- [ ] **Step 2: Check the existing assertion.** Confirm that it asserts both the pre-start status and zero challenge requests before the fake timer reaches `startsAt`, followed by one request at the boundary.
- [ ] **Step 3: Compare uncovered cases to the incident.** Determine whether any uncovered case could explain the observed local request. Add a regression case only if it corresponds to a demonstrated failure or materially ambiguous boundary; do not broaden the suite speculatively.
- [ ] **Step 4: If the focused test fails, capture the first failing assertion and inspect the responsible path before making a change.** Do not edit the database function to bypass the eligibility rule.

**Expected deliverable:** Focused test result and a reasoned conclusion about whether the existing regression test exercises the reported timing failure.

### Task 4: Verify the browser is running the current source

**Files:**
- Inspect in browser: local Seminex app and DevTools Network panel
- Inspect if needed: Vite terminal output and service-worker registration in the current app

**Interfaces:**
- Consumes: a logged-in local browser session and a published seminar that has not started, if available.
- Produces: a redacted observation containing the displayed status, challenge-RPC request count before start, loaded app origin, and whether a refresh changes the loaded behavior.

- [ ] **Step 1: Open the local app and record its origin.** Confirm the page is served by the expected local checkout and avoid copying cookies, authorization headers, or tokens.
- [ ] **Step 2: Open one upcoming seminar ticket and inspect the status.** Before start, expect “Live attendance QR available when the seminar starts.”
- [ ] **Step 3: Inspect Network requests before start.** Filter for `issue_attendance_challenge`; expect zero calls from the ticket QR before the scheduled start.
- [ ] **Step 4: Reload once with Network logging enabled.** If the old QR or a pre-start request remains, inspect the request initiator and loaded JavaScript asset, then check for a stale dev-server process or service-worker cache before changing source.
- [ ] **Step 5: If a real seminar crosses its start time during observation, confirm that one issuance request begins only at/after the boundary and that any later `not_available` is attributed to the database's current eligibility guards.** If no suitable seminar is available, report this runtime check as not performed rather than simulating production data.

**Expected deliverable:** Browser evidence that distinguishes an application-source problem from stale local assets or an alternate caller. Redact identifiers and credentials.

### Task 5: Make only an evidence-backed correction and report the result

**Files:**
- Modify only if required: `src/features/seminars/AttendanceQr.tsx`
- Modify only if required: `src/features/seminars/AttendanceQr.test.tsx`
- Modify only if required: the ticket call site proven to bypass or omit the gate

**Interfaces:**
- Consumes: findings from Tasks 1–4.
- Produces: either a root-cause report with no code changes, or the smallest targeted fix with regression evidence.

- [ ] **Step 1: Decide from evidence.** If source, focused test, and browser behavior agree, make no code changes and report that the issue is resolved in the current local source. If they disagree, name the failing condition and the exact caller before changing code.
- [ ] **Step 2: For a demonstrated code defect, add or adjust one focused regression assertion first.** It must fail for the observed defect and must not weaken the SQL eligibility boundary.
- [ ] **Step 3: Apply the smallest correction in the allowed file scope.** Preserve the loading, offline, retry, challenge-expiry, and database-enforcement behavior unless the evidence identifies one of them as faulty.
- [ ] **Step 4: Re-run the focused test.** Run `npm test -- --run src/features/seminars/AttendanceQr.test.tsx`; expect all focused tests to pass.
- [ ] **Step 5: Run the production build and whitespace check only if code changed.** Run `npm run build` and `git diff --check`; record actual results without claiming runtime verification if Task 4 was unavailable.
- [ ] **Step 6: Review the targeted diff.** Summarize changed files, the evidence that justified the change, verification output, unresolved uncertainty, and confirm no deployment or database mutation occurred.

**Expected deliverable:** A concise incident report and, only when warranted, a narrow tested correction.
