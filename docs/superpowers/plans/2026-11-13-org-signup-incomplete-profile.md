# Organization Signup Incomplete Profile Recovery Plan

> **For agentic workers:** Execute the tasks in order. Follow test-driven development: add a focused failing test, run it to confirm the expected failure, make the smallest change, and rerun the test. Do not stage or commit unrelated worktree changes.

**Goal:** Keep OTP-verified organization signups with incomplete profiles in the account-creation flow, while preserving the existing shortcut for fully onboarded participants.

**Architecture:** The organization signup page will distinguish an existing applicant from a verified but unfinished signup using `SessionIdentity.onboardingComplete`. Finished participants continue to load their profile and submit an organization access request; incomplete authenticated users continue collecting their personal and organization details and finish through `api.orgSignUp` / `complete_org_signup`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Supabase Auth/Postgres adapter.

**Spec:** User-approved bounded fix in this conversation. Repository evidence: `src/api/client.ts` caches identity after signup OTP verification; `src/api/auth.ts` derives `onboardingComplete` and rejects incomplete profile reads; `src/features/auth/pages/OrganizationSignUpPage.tsx` currently branches on role alone.

## Global Constraints

- Change only the organization signup flow and its focused tests.
- An authenticated non-adviser with `onboardingComplete === false` is a verified unfinished signup, not an existing applicant.
- A completed non-adviser account must retain profile prefill and the organization access-request path.
- Preserve entered values and OTP verification when the session updates immediately after OTP verification.
- When reopening the page with a verified incomplete session, resume at personal details, prefill Student ID from the session identity, and do not require the lost password or a second OTP.
- Valid fields must advance the signup step; invalid fields must keep the user on the current step and show field errors.
- Do not change Supabase Auth templates, SMTP settings, database schema, RLS, migrations, or hosted services as part of this fix.
- Keep the Auth `/verify` 403 and password-token 400 as separate unclassified observations unless response-body evidence connects them to this UI failure.
- Preserve existing modified, deleted, and untracked work. Do not stage, commit, reset, clean, or overwrite it.

## Evidence and challenge

The code path strongly supports the page-branch diagnosis: `verifySignupOtp` refreshes and caches the current identity; incomplete identities have `onboardingComplete === false`; the page currently treats every signed-in non-adviser as an existing applicant; and `getProfile` reports `not_available` until required personal fields exist. This matches the displayed profile-load error and the user's reproduction both immediately after OTP and on a later account-creation attempt. During test-first work, a second blocking defect was found in the same flow: `validateFields` returns true for valid input, but the Step 1 and Step 2 continuation conditions currently treat that result backwards. The browser screenshot does not show the failing profile request or response, so it does not independently explain the Auth 403/400 entries. Regression tests must verify both correct session classification and valid/invalid step transitions while preserving the completed-account path.

## File Map

- `src/features/auth/pages/OrganizationSignUpPage.tsx` — decide whether a session is a completed applicant or an unfinished verified signup; resume the correct step and submit through the correct API path.
- `src/features/auth/pages/OrganizationSignUpPage.test.tsx` — add page-level regression coverage for immediate OTP session transition, reload/resume of an incomplete verified session, and completed participant behavior.
- `src/api/auth.test.ts` — existing adapter coverage for OTP verification and `completeOrganizationSignup`; extend only if the page tests expose a missing contract assertion.

## Task 1: Add signup branch regression tests

**Files:**
- Create: `src/features/auth/pages/OrganizationSignUpPage.test.tsx`
- Read: `src/features/auth/pages/OrganizationSignInPage.test.tsx` for component-test conventions
- Read: `src/api/auth.test.ts` for existing adapter coverage

**Interfaces:**
- Consume `SessionIdentity` from `src/api/types.ts` (through `src/api/client.ts`) with `role` and `onboardingComplete` values.
- Assert the page selects between `api.getProfile` + `api.submitOrgAccessRequest` for a completed applicant, and the ordinary form + `api.orgSignUp` for an incomplete verified signup.

- [ ] **Step 1: Create a page test harness** with `MemoryRouter`, mocked `useSession`, `useOnlineStatus`, `useNow`, `api`, and lightweight field/OTP components. Use a mutable mocked session value and rerender to model the OTP verification changing the session without unmounting the page.
- [ ] **Step 2: Add the failing immediate-transition test.** Start with no session, render the credentials step, enter valid Student ID/password values, trigger the OTP mock to set `otpVerified=true` and change the session to `{ role: 'participant', onboardingComplete: false }`, then rerender. Assert the credentials and OTP-complete state remain usable, continuing opens personal details, and the page does not render “Your applicant profile could not be loaded.”
- [ ] **Step 3: Add the failing resume test.** Start with an incomplete verified participant session. Assert the page opens at personal details, pre-fills the Student ID from the session, does not call `api.getProfile`, and eventually offers the “Create account and send request” path rather than the completed-applicant access-request path.
- [ ] **Step 4: Add the completed-account control test.** Start with a completed participant session and a valid profile result. Assert profile details are prefilled, the organization step is shown, and the action remains “Send organization access request.”
- [ ] **Step 5: Run the focused tests before implementation.** Run `npm test -- src/features/auth/pages/OrganizationSignUpPage.test.tsx`. Confirm the incomplete-session cases fail because the page enters the profile-load branch, while record whether the completed-account control passes.

## Task 2: Separate completed applicants from unfinished verified signups

**Files:**
- Modify: `src/features/auth/pages/OrganizationSignUpPage.tsx`
- Test: `src/features/auth/pages/OrganizationSignUpPage.test.tsx`

**Interfaces:**
- Continue consuming `SessionIdentity.onboardingComplete`; do not add or change API/database contracts.
- Keep `api.orgSignUp` as the completion path for unfinished accounts and `api.submitOrgAccessRequest` as the path for fully onboarded participants requesting organization membership.

- [ ] **Step 1: Define the page predicates.** Treat a non-adviser session as an existing applicant only when `onboardingComplete === true`. Treat a non-adviser session with `onboardingComplete === false` as a verified unfinished signup.
- [ ] **Step 2: Preserve the immediate OTP transition.** Do not clear local form values or the local OTP-verified state when the session changes from signed out to the authenticated incomplete identity. Keep the user in the signup flow rather than switching to profile loading.
- [ ] **Step 3: Resume after page reload.** Initialize an already-authenticated incomplete signup at Step 2, initialize OTP verification as satisfied for that authenticated session, and prefill `studentId` from `session.studentId`. Do not attempt `api.getProfile` for this state.
- [ ] **Step 4: Preserve the completed-applicant behavior.** Continue loading and prefilling `api.getProfile` only for fully onboarded non-adviser accounts, and continue submitting those users through `api.submitOrgAccessRequest`.
- [ ] **Step 5: Run the focused tests.** Run `npm test -- src/features/auth/pages/OrganizationSignUpPage.test.tsx`. Confirm the immediate transition, incomplete-session resume, and completed-account control tests pass.

## Task 3: Correct step validation guards

**Files:**
- Modify: `src/features/auth/pages/OrganizationSignUpPage.tsx`
- Test: `src/features/auth/pages/OrganizationSignUpPage.test.tsx`

**Interfaces:**
- `validateFields(fields)` returns `true` only when every requested field is valid and `false` when one or more requested fields have errors.
- Do not change individual validation rules or error copy.

- [ ] **Step 1: Add failing assertions** that valid verified credentials advance to personal details, valid personal details advance to organization selection, and missing personal details keep the page on Step 2 while displaying field errors.
- [ ] **Step 2: Run the focused test file** and verify the new assertions fail because the continuation guards invert the `validateFields` result.
- [ ] **Step 3: Correct only the guards.** Return early when credentials or personal details are invalid; advance to the next step only when `validateFields` returns true. Apply the same valid-input condition to the Step 3 progress control.
- [ ] **Step 4: Rerun the focused tests** and verify valid input advances while invalid input remains on its current step.

## Task 4: Verify related contracts and regression scope

**Files:**
- Read or modify only if needed: `src/api/auth.test.ts`
- Read: `src/api/auth.ts`, `src/api/client.ts`, and `src/api/types.ts`

**Interfaces:**
- The `complete_org_signup` RPC remains the existing authenticated completion mechanism.
- `SessionIdentity.onboardingComplete` remains derived from the required profile fields; no identity shape changes are in scope.

- [ ] **Step 1: Confirm the adapter contract.** Check the existing `completeOrganizationSignup` test proves the RPC is called for the authenticated user without resetting the password. Add one focused assertion only if the current test does not cover this behavior.
- [ ] **Step 2: Run the focused API tests.** Run `npm test -- src/api/auth.test.ts` and confirm the existing OTP and organization completion adapter behavior passes.
- [ ] **Step 3: Run the full local test suite.** Run `npm test` and record the exact result. Do not alter unrelated failures.
- [ ] **Step 4: Review the final diff and worktree.** Confirm only the signup page, its new focused test, and any necessary adapter-test assertion changed. Leave all pre-existing user changes untouched and unstaged.

## Acceptance Criteria

- A newly OTP-verified incomplete participant no longer sees “Your applicant profile could not be loaded” just because profile completion has not happened yet.
- During the current OTP flow, entered credentials/details and the verified status survive the session update; the user can proceed to personal details and organization selection.
- After refresh, an authenticated incomplete signup resumes at personal details with Student ID filled and without requiring password re-entry or another OTP.
- A fully onboarded participant still sees profile-prefilled organization request flow and submits through `api.submitOrgAccessRequest`.
- Valid signup input advances through each step, and invalid input cannot bypass field validation.
- Focused page tests and adapter tests pass; full local tests are recorded without claiming unrun checks.
- The Auth 403/400 responses remain a separate investigation unless their response bodies establish a causal connection.
