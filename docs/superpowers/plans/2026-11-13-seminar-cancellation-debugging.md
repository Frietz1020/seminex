# Seminar Cancellation Error Debugging Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to carry out this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify why an applicant's `cancel_registration` RPC returns HTTP 400 even though the applicant reports no Time-In, then make only the smallest evidence-backed correction if the database, API mapping, or UI is inconsistent.

**Architecture:** Trace one cancellation attempt across the applicant dialog, `api.cancelRegistration`, PostgREST, and `public.cancel_registration`. Compare the actual PostgREST error and the exact applicant registration row against the SQL function's guards. Keep cancellation eligibility enforced by the database; do not weaken it to make the request succeed.

**Tech Stack:** React, TypeScript, Supabase JS/PostgREST, PostgreSQL PL/pgSQL, existing Vitest and pgTAP coverage.

**Spec:** User report and attached browser screenshot; no separate design spec. Current behavior contract is in `docs/api-contract.md` and `supabase/migrations/20261106042858_seminar_registration.sql`.

## Global Constraints

- Diagnose before changing code or data; preserve the database cancellation rule unless evidence shows its current condition is wrong.
- Use the affected applicant's seminar ID and registration only; do not dump other applicants' records or auth tokens.
- Keep database inspection read-only; do not manually update the registration to force cancellation.
- Treat HTTP 400 alone as insufficient evidence; record the PostgREST response `code`, `message`, `details`, and `hint`.
- Keep investigation scoped to cancellation flow, its state inputs, and the observed repeated requests; do not tune query performance or redesign registration.

---

### Task 1: Capture the failing RPC response and reproduce once

**Files:**
- Inspect: `src/features/seminars/components/CancelRegistrationDialog.tsx`
- Inspect: `src/api/seminars.ts`
- Inspect: `src/api/types.ts`

**Interfaces:**
- Consumes: the affected applicant's authenticated session and seminar from the report.
- Produces: one redacted request/response record that distinguishes SQL `not_available`, `not_found`, `forbidden`, PostgREST schema errors, and transport failures.

- [ ] **Step 1: Reproduce one cancellation attempt** in the same applicant account, with DevTools Network open and Preserve log enabled. Click “Cancel registration” once; avoid repeated clicks while the request is pending.
- [ ] **Step 2: Record the request identity**: request URL/function name, request JSON `p_seminar_id`, HTTP status, and number of matching POSTs. Do not copy `Authorization`, cookies, or full request headers.
- [ ] **Step 3: Record the response JSON** fields `code`, `message`, `details`, and `hint`. Also note the `content-profile`/schema header if present. This response body is the authoritative error detail missing from the screenshot.
- [ ] **Step 4: Trace the caller and mapper**: confirm the call is `supabase.rpc('cancel_registration', { p_seminar_id: seminarId })` in `src/api/seminars.ts`; follow `settle` → `apiError` → `CancelRegistrationDialog` to document how that exact response becomes the visible alert.
- [ ] **Step 5: Compare the matching POST count with user actions**. If one click yields three POSTs, inspect the Network Initiator and any request retry/wrapper behavior before attributing duplicates to SQL; if there were multiple clicks, reproduce with a single click.

**Expected deliverable:** Exact server error code/message and a known count of client requests per single click. Do not change behavior in this task.

### Task 2: Verify the affected registration and cancellation preconditions

**Files:**
- Inspect: `supabase/migrations/20261106042858_seminar_registration.sql` (`public.cancel_registration` and `private.release_expired_registrations`)
- Inspect: `src/api/seminars.ts` (`registrationFromRow`, `apiError`, `settle`)
- Inspect: `docs/api-contract.md` (cancellation contract)

**Interfaces:**
- Consumes: `p_seminar_id` from Task 1 and the authenticated applicant's user ID.
- Produces: a redacted state snapshot and a mapping from the failing RPC response to the exact database guard, or evidence that the response originates elsewhere.

- [ ] **Step 1: Read the complete SQL function and its called release helper.** List each path that can reject cancellation: missing/invalid student profile, missing seminar, missing registration, a registration status outside `registered`/`confirmed`, or non-null `time_in_at` after expired registrations are released.
- [ ] **Step 2: Inspect only the applicant's row using a read-only query** in the project's approved Supabase SQL environment. Substitute the seminar ID from the request and the authenticated applicant's user ID; select only these fields:

```sql
select registration.id,
       registration.seminar_id,
       registration.student_user_id,
       registration.status,
       registration.registered_at,
       registration.confirmed_at,
       registration.time_in_at,
       registration.time_out_at,
       registration.updated_at
from public.registrations as registration
where registration.seminar_id = '<p_seminar_id from the captured request>'::uuid
  and registration.student_user_id = '<authenticated applicant user id>'::uuid;
```

- [ ] **Step 3: Compare `status` and `time_in_at` with the SQL guard.** A null `time_in_at` rules out the Time-In branch, but `released` or `cancelled` status still causes `not_available`; absence of a row instead follows the `not_found` path.
- [ ] **Step 4: If the database row says `time_in_at` is null but the applicant-facing view shows a Time-In, trace the read model/query and `registrationFromRow` mapping.** Check whether stale cached data or an unexpected response shape supplies the displayed state; do not infer persisted state from the UI alone.
- [ ] **Step 5: If the response does not match any guard, inspect the full PostgREST error `details`/`hint` and confirm the deployed function signature/body matches the checked-in migration.** Record deployment drift as a separate finding; do not run a migration as part of diagnosis.

**Expected deliverable:** One confirmed rejection condition or a narrowed discrepancy between deployed SQL, registration state, and API/UI state. No database writes.

### Task 3: Compare nearby working paths and form a single root-cause hypothesis

**Files:**
- Compare: `src/features/seminars/components/CancelRegistrationDialog.tsx`
- Compare: `src/api/seminars.ts`
- Compare: `supabase/tests/registration_rules.test.sql`

**Interfaces:**
- Consumes: evidence from Tasks 1–2.
- Produces: one written hypothesis with the specific mismatched value/branch and one minimal falsifying check.

- [ ] **Step 1: Compare the captured request argument with the selected seminar ID** used to open the dialog; confirm `p_seminar_id` is a UUID for the displayed seminar.
- [ ] **Step 2: Compare the live rejection with existing pgTAP cases** for successful cancellation before Time-In, rejection after Time-In, missing registrations, and released registrations. Identify any guard without a representative case only if it relates to the observed failure.
- [ ] **Step 3: State one hypothesis in the investigation notes**, for example: “The row is `released` because the server-side expiry helper transitioned it before cancellation; the UI still includes it as an active registration.” Tie it to the captured SQL state and row values; do not adopt this example unless evidence supports it.
- [ ] **Step 4: Define the smallest falsifying check** for that hypothesis, such as a single read-only query of the relevant seminar timestamps/configuration or a focused assertion against the identified SQL guard.

**Expected deliverable:** A testable, evidence-based root-cause statement. If evidence is incomplete, list only the missing observation needed to decide.

### Task 4: Apply a minimal correction only after the root cause is confirmed

**Files:**
- Modify only the file or migration proven responsible by Tasks 1–3.
- Test only the affected area: `supabase/tests/registration_rules.test.sql`, `src/api/seminars.test.ts`, or a focused applicant dialog test, depending on the confirmed layer.

**Interfaces:**
- Consumes: confirmed hypothesis and its falsifying check from Task 3.
- Produces: a correction at the layer that introduced the bad state/interpretation, plus a focused regression check.

- [ ] **Step 1: Add or update one focused failing regression case** for the observed state/response. Preserve expected server-side enforcement that applicants cannot cancel after a real Time-In.
- [ ] **Step 2: Run only that focused case** and verify it reproduces the confirmed defect before editing implementation.
- [ ] **Step 3: Make one minimal correction** at the responsible layer: SQL only for a proven database guard/state bug; API only for a proven RPC/error decoding issue; applicant UI only for a proven stale/misleading state presentation. Do not bundle unrelated retry, copy, or refactoring changes.
- [ ] **Step 4: Re-run the focused regression case** and the single-click applicant reproduction. Confirm successful pre-Time-In cancellation still releases the slot and that a real Time-In still blocks cancellation.
- [ ] **Step 5: Report the root cause, changed files, verification evidence, and any deployment step required.** Do not claim the live Supabase deployment is fixed based only on a local migration or test.

**Expected deliverable:** A narrowly scoped, verified fix only if the gathered evidence confirms a code defect; otherwise, a concise diagnosis naming the database state or deployment action that explains the rejection.

## Plan Self-Review

- **Scope:** Covers only applicant cancellation, the `cancel_registration` RPC, state passed/read by that flow, the repeated POST observation, and a conditional minimal correction.
- **Placeholders:** The only substituted values are concrete identifiers captured from the failing request/session; no speculative root cause is treated as fact.
- **Database safety:** State inspection is read-only and scoped to one applicant registration; plan forbids direct state mutation.
- **Coverage:** Captures the missing response body, traces UI/API/database boundaries, checks the exact status/Time-In guards, compares existing SQL coverage, then gates any fix on a reproduced root cause.
