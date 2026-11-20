# Organization Seminar Authoring Improvements Implementation Plan

> **For agentic workers:** Execute the workstreams in order. Follow test-driven development: add a focused failing test, run it to confirm the expected failure, make the smallest change, then rerun it. Keep existing unrelated worktree changes unstaged and untouched.

**Goal:** Improve organization seminar management, details scheduling, certificate design controls, and evaluation authoring without weakening the existing Supabase authorization or seminar eligibility rules.

**Architecture:** Extend the existing React/TypeScript organization seminar editor and its API boundary, with Supabase/Postgres enforcing ownership, validation, and persisted minute-based confirmation windows. Split the work into three independently reviewable workstreams: lifecycle/details, certificate designer, and evaluation builder. Use additive forward migrations where schema changes are required; preserve existing published seminar data and dependent participant records.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Vitest, Testing Library, Supabase JS, PostgreSQL migrations and SQL tests.

**Spec:** This plan is derived from the user brief in the current conversation and `docs/SEMINEX_CODEBASE_MAP.md`; there is no separate approved design spec for these changes.

## Global Constraints

- Keep changes within organization seminar management, the seminar editor, certificate design, evaluation authoring, and the database/API contracts those flows require.
- Inspect current routes, types, migrations, RLS policies, database functions, and tests before editing; use existing patterns and current workspace state as the source of truth.
- Preserve existing uncommitted changes. Do not stage, commit, reset, clean, overwrite, or revert unrelated worktree files.
- Preserve the 60% attendance eligibility rule and its current configurable `requiredAttendancePercent` behavior; do not reintroduce the stale 80% threshold.
- Do not expose service-role credentials or bypass Supabase RLS. Enforce organization ownership and input validation in trusted database functions/policies as well as the UI.
- Do not edit already-applied migrations. Add a forward migration for any schema/function/policy changes and preserve existing rows.
- Published seminar deletion must not silently cascade registrations, attendance, evaluation responses, certificate serials, or issued certificate files. If the existing schema cannot support the requested deletion while retaining those records, stop and report the exact constraint and safe options before implementing destructive behavior.
- Do not add dependencies unless inspection proves existing browser APIs/components cannot meet the requirement; stop and ask before adding one.
- Preserve typed question and certificate data compatibility for existing drafts and published seminars; define safe defaults when loading older JSON payloads.
- Use the existing design system. Keep all controls keyboard accessible, labeled, responsive, and usable at narrow viewports.
- Run focused tests after each workstream and the existing relevant lint/build/test checks before reporting completion. Do not apply migrations to hosted Supabase projects.

---

## File Structure and Responsibilities

Inspect before editing; this list is an evidence-based starting map, not permission to create duplicate abstractions.

- `src/features/org/pages/OrgSeminarsPage.tsx` and `src/features/org/pages/OrgSeminarDetailsPage.tsx`: organization seminar lists/details and lifecycle actions.
- `src/features/org/pages/SeminarEditorPage.tsx`: Details, Certificate, Evaluation, and publish wizard, including question authoring.
- `src/features/org/components/CertificateDesigner.tsx`: certificate canvas and formatting controls.
- `src/api/orgTypes.ts` and `src/api/types.ts`: persisted and authored seminar, certificate, attendance, and survey contracts.
- `src/api/seminars.ts`, `src/api/client.ts`, and `src/api/evaluations.ts`: API adapters and result/error conventions.
- `supabase/migrations/`: add a timestamped forward migration only if data contracts or database behavior change.
- `supabase/tests/`: add focused SQL tests for ownership, lifecycle deletion, migration/backfill behavior, and minute-window enforcement where applicable.
- `src/features/org/pages/SeminarEditorPage.test.tsx`, `src/api/seminars.test.ts`, `src/api/evaluations.test.ts`, and focused component test files: UI/API regression coverage.
- `docs/api-contract.md` and `docs/SEMINEX_CODEBASE_MAP.md`: update only if the API contract or architecture materially changes.

## Workstream 1: Seminar lifecycle and Details

**Deliverable:** Organization members can request deletion of drafts and published seminars through a confirmation flow; details fields are clearer and accept typed date/time input; attendance confirmation opening and closing offsets are configurable in minutes and enforced consistently.

### Task 1.1: Trace current lifecycle and deletion constraints

- Inspect seminar list/detail routes, status transitions, `seminar_drafts`, `seminars`, Storage cover ownership, related registration/attendance/evaluation/certificate tables, RLS, and foreign-key delete actions.
- Write focused tests first for the intended authorized deletion outcomes and confirmation/cancel behavior. Verify foreign organization members cannot delete another organization's seminar.
- For drafts, delete the owned draft and its cover objects only through the established ownership-safe path.
- For published seminars, preserve related participant history. Prefer an existing supported soft-delete/archive state if it removes the seminar from participant-facing lists while retaining dependent data. If unavailable and implementing it requires material ambiguous lifecycle/data-retention choices, stop and report findings rather than adding an unsafe cascade.
- Add a clear confirmation dialog that names the seminar and describes the effect; prevent duplicate submissions and show actionable failures.
- Test RLS/database enforcement, cover cleanup boundaries, success, cancellation, and failure states.

### Task 1.2: Improve details field labels and date/time editing

- Remove decorative asterisks beside name fields; retain actual required validation and accessible required/error semantics.
- Provide text-entry-capable date and time controls for start/end that retain the existing picker affordance where supported.
- Parse and format local date/time without converting invalid/partial input into an unintended ISO timestamp. Validate start precedes end, show field-level errors, and preserve timezone behavior consistent with current `localDateTime` handling.
- Add component tests for keyboard typing, picker changes, invalid/partial values, clearing, and round-trip timezone-safe values.

### Task 1.3: Convert attendance confirmation offsets to minutes

- Replace the hour-only authoring controls with minute-valued controls for when attendance confirmation opens and closes before start.
- Inspect all affected contracts and database functions, including `confirmation_opens_hours_before`, `confirmation_closes_hours_before`, publishing, evaluation, attendance acknowledgement, and scanner timing.
- Add a forward migration that preserves current semantics by backfilling minute values as old hour values multiplied by 60; update constraints, publish logic, and enforcement functions atomically. Do not edit migration history or touch hosted projects.
- Keep defaults equivalent to current behavior (24 hours = 1440 minutes; 1 hour = 60 minutes), validate nonnegative/ordered offsets and supported bounds, and ensure open time is earlier than close time.
- Add SQL and TypeScript tests for migration/default/backfill mapping, boundaries, and server-side acceptance/rejection around the minute thresholds.

## Workstream 2: Certificate designer

**Deliverable:** A cleaner certificate editor with standard text formatting, text alignment/case transformations, expanded color/opacity controls, and removal of obsolete guidance, coordinate widgets, and e-signature features while preserving existing certificate rendering.

### Task 2.1: Remove explicitly unwanted interface and e-signatures

- Remove “Snap to Center,” “Show safety guidelines,” “Dynamic certificate canvas · Visual bounds and attendee name preview,” the automatic issuance/60% explanatory banner, name-box numeric coordinate controls/readouts, QR placement numeric coordinate controls/readouts, and every e-signature control, callback, data type, persistence path, and renderer branch that is solely for e-signatures.
- Keep eligibility and issuance enforcement in backend code intact; remove only the specified explanatory designer copy.
- Remove dead state and props without disturbing name/QR visual placement or certificate output. Retain existing canvas drag/resize placement and the requested left/center/right text alignment controls; coordinate removal applies only to numeric position controls/readouts.
- Add tests proving removed controls are absent and existing templates without signature data still load/render.

### Task 2.2: Implement typography and color controls

- Provide bold, italic, underline, left/center/right alignment, and case transformations: sentence case, lowercase, uppercase, and capitalize each word.
- Provide a broader curated palette, native/color-wheel picker, opacity control, and validated hex input. Display controls with clear icons or words and accessible names; do not rely on icon-only unlabeled controls.
- Extend certificate template types and rendering only as necessary. Preserve existing template defaults and safely load templates that lack new optional fields.
- Apply case changes to the attendee-name display only; do not mutate source attendee records or other certificate copy.
- Validate hex input and opacity bounds, debounce or commit edits predictably, and ensure preview and generated PDF agree on font weight/style, decoration, alignment, case, color, and opacity.
- Add component/API/rendering tests for each formatting value, invalid hex, opacity boundaries, old-template defaults, and PDF/render parity where existing test seams permit.

## Workstream 3: Evaluation authoring

**Deliverable:** A clearer, responsive evaluation authoring experience; option inputs retain every keystroke; linear-scale questions configure their range and description with endpoint labels positioned above the scale options.

### Task 3.1: Fix disappearing option text

- Reproduce the disappearing-character behavior in `SeminarEditorPage` using the existing option editor.
- Trace controlled input value, option value regeneration, React keys, survey normalization, and persistence. Change only the root cause.
- Preserve stable option identity independently of the editable label so typing spaces, punctuation, repeated characters, and edits in the middle of text work without caret jumps or disappearing input.
- Add regression tests using `userEvent.type` for these cases, plus add/remove option and save/reload behavior.

### Task 3.2: Configure linear scale and its layout

- Add editable minimum and maximum values with validation and safe bounds that keep the rendered option count usable.
- Add an editable question description, persisting it through the current authored question schema and displaying it to evaluation respondents.
- Render endpoint labels above the scale options, aligned with the first and last value. Keep the preview responsive and readable on narrow screens.
- Inspect database validation, evaluation response validation, and results aggregation so custom minimum/maximum values work end to end; add a forward migration only if the current persisted contract cannot support the fields.
- Add authoring, preview/respondent, validation, and backend SQL tests for custom ranges, descriptions, endpoints, and out-of-range submitted values.

### Task 3.3: Overhaul evaluation authoring UI

- Refactor the authoring step into focused subcomponents only where that reduces the current `SeminarEditorPage` responsibilities; preserve existing question types and survey data shape.
- Improve hierarchy, spacing, responsiveness, question selection, add/remove/duplicate actions, and empty/validation states using the existing product palette and components.
- Keep authoring behavior consistent with attendee evaluation rendering, label every input, expose keyboard focus, and respect reduced motion.
- Add interaction tests for question creation/editing/reordering if already supported, selected question tools, mobile layout structure, and error/empty states.

## Final integration and review

- Run focused Vitest tests for each changed workstream, then `npm run lint`, `npm run build`, and `npm test` if time and local environment allow.
- Run relevant Supabase SQL tests against the local test database only; report when no local database is available instead of claiming those checks passed.
- Review the complete diff for data-loss risks, organization ownership checks, RLS coverage, UI accessibility, removed dead code, and unrelated worktree changes. Do not stage or commit without a separate explicit request.
- Report changed files, migrations added, checks run with exact results, any blocked deletion semantics, and remaining limitations.

## Master Prompt for Codex

```text
You are working in the Seminex repository. Implement the approved plan in `docs/superpowers/plans/2026-11-13-org-seminar-authoring.md` for organization-side seminar management, Details scheduling, certificate design, and evaluation authoring.

## Goal
Deliver the three workstreams in that plan: (1) draft/published seminar deletion and Details improvements, including minute-based attendance confirmation windows; (2) certificate typography/color controls and removal of the specified obsolete controls and all e-signatures; (3) evaluation UI improvements, reliable option typing, and configurable linear-scale ranges/descriptions.

## Context
- This is a Vite/React 19/TypeScript app using Supabase Auth, Postgres, Storage, RLS, database functions, and Edge Functions. Use `docs/SEMINEX_CODEBASE_MAP.md`, existing APIs/types/migrations, and current tests as starting points; verify them before changing code.
- Main starting files: `src/features/org/pages/OrgSeminarsPage.tsx`, `src/features/org/pages/OrgSeminarDetailsPage.tsx`, `src/features/org/pages/SeminarEditorPage.tsx`, `src/features/org/components/CertificateDesigner.tsx`, `src/api/orgTypes.ts`, `src/api/types.ts`, `src/api/seminars.ts`, `src/api/evaluations.ts`, and `supabase/migrations/` plus `supabase/tests/`.
- Attendance eligibility is 60% by default and is enforced through the current configurable `requiredAttendancePercent`. Preserve it; ignore stale 80% wording.
- Attendance confirmation offsets are currently stored/enforced in hours. Maintain equivalent defaults (opens 1440 minutes before, closes 60 minutes before) when migrating to minutes.
- `SeminarEditorPage.tsx` currently uses controlled choice/checkbox option inputs and a linear-scale editor. Reproduce and diagnose disappearing option characters before editing.
- The current worktree has unrelated user changes. Preserve them exactly; do not stage, commit, reset, clean, overwrite, or revert unrelated files.

## Scope and execution
- Read the plan fully, inspect repository guidance (`AGENTS.md` if present), status, relevant files, migrations, RLS, foreign keys, and tests. Treat current checkout evidence as authoritative; do not assume this plan's starting map is exhaustive.
- Execute all three workstreams in order. Within each task, use test-first implementation: add focused regression coverage, confirm it fails for the expected reason, make the smallest change, then rerun it.
- Draft deletion must verify active organization ownership and clean only that draft's owned cover objects. Published deletion must not silently cascade or erase registrations, attendance, evaluation answers, certificate serials, or issued PDFs. Use an existing safe lifecycle/archive mechanism if it satisfies the request. If not, stop before destructive behavior and report the exact schema constraint and safe choices for the user.
- Convert hour-based confirmation values through a forward-only, data-preserving migration and update every publishing/enforcement contract that consumes them. Never edit already-applied migrations or run migrations against hosted projects.
- Remove the certificate UI elements named in the plan, all e-signature-only code paths, and obsolete related props/state. Retain visual drag/resize positioning, left/center/right text alignment, and certificate rendering unless repository evidence conflicts with the plan; ask before broadening scope.
- Implement all requested certificate controls and keep preview/PDF behavior aligned. Preserve old saved certificate templates with safe defaults.
- Fix option typing at the root cause and keep stable option IDs separate from user-editable labels. Add linear-scale min/max/description and ensure persistence, respondent display, answer validation, and analytics agree.
- Keep the 60% eligibility rule, existing question types, design system, API conventions, and RLS boundaries. Validate all user-entered values server-side where persisted/business-critical.
- Do not add dependencies, apply hosted database changes, or perform destructive data operations. Stop and ask before any action that would erase participant data or require a product retention decision.

## Verification
- Run focused Vitest tests for changed UI/API behavior after each workstream.
- Run `npm run lint`, `npm run build`, and `npm test` before completion where the local environment supports them. Run relevant Supabase SQL tests against a local database only; never claim unrun checks passed.
- Review the final diff for authorization, RLS, ownership, backward compatibility, accessibility, data loss, and unrelated changes. Do not stage or commit.

## Done
All three workstreams are implemented and verified, or execution has stopped with a precise blocker where safe published-seminar deletion cannot be designed without a retention decision. Report a concise changed-file summary, migrations, exact checks/results, and any blocker. Do not include hidden reasoning.

This prompt is for an agentic tool with real system access. Review the scope locks, forbidden actions, and stop conditions before pasting. Confirm file paths, directories, and permissions match the actual project.
```
