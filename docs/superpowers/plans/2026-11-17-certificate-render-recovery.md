# Certificate Rendering and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent malformed certificate backgrounds from producing blank PDFs, verify visible mail-merge output, and let an authorized organization safely replace an already-issued blank PDF.

**Architecture:** Normalize accepted raster backgrounds to PNG at upload, and independently validate image signatures in the Edge Function before rendering. Bundle the Outfit font in the renderer instead of relying on host system fonts. Refactor the renderer so tests can inspect the actual composed PNG and assert that both the background and attendee name are visible. Add a separate organization-authorized regeneration endpoint: render from the current saved seminar template into a new private Storage object, then atomically switch the issuance to that object while retaining the serial and recording an audit event; failed finalization leaves the old PDF in place.

**Tech Stack:** React, TypeScript, Vitest, Supabase JS, PostgreSQL with pgTAP, Supabase Edge Functions on Deno, Resvg, pdf-lib, private Supabase Storage, `pngjs` for renderer pixel assertions.

**Spec:** Approved scope in the conversation; no standalone certificate defect spec exists.

## Global Constraints

- Preserve existing attendance and evaluation eligibility gates for original issuance.
- Keep regeneration limited to an active organization member of the seminar's organization; applicant accounts cannot regenerate.
- Keep the certificate serial and issuance row identity stable during regeneration.
- Generate a replacement PDF before changing the issuance pointer; on failure, the current PDF remains downloadable.
- Keep certificate Storage private; do not expose object paths, signed URLs, access tokens, attendee names, or raw template data in logs.
- Do not update or delete staging records or deploy functions/migrations until the staging project ref and deployment target are verified.
- Work only with task-owned diffs; the checkout has unrelated pre-existing changes. Do not stage or revert unrelated files.

---

## File Map

- `src/features/org/pages/SeminarEditorPage.tsx`: normalize raster uploads to PNG and reject unreadable or unsupported files before saving the draft.
- `src/features/org/pages/SeminarEditorPage.test.tsx`: cover real decoded raster normalization and malformed-file feedback.
- `supabase/functions/issue-certificate/render_certificate.ts`: verify data URI bytes agree with image type and expose the composed PNG stage used by PDF output.
- `supabase/functions/issue-certificate/render_certificate_test.ts`: assert image and name pixels are present in the composed output; cover signature mismatch and supported SVG behavior; import `PNG` from `npm:pngjs@7.0.0` and update `supabase/functions/issue-certificate/deno.lock`.
- `supabase/functions/issue-certificate/fonts/Outfit-Variable.ttf`: bundle the open Outfit font in TTF format so Edge rendering does not depend on installed system fonts.
- `supabase/migrations/20261117100000_certificate_regeneration.sql`: add an append-only regeneration audit table plus organization-authorized input and service-only finalization RPCs.
- `supabase/tests/certificate_regeneration.test.sql`: verify role authorization, path switching, stable serial/issuance, audit entry creation, and conflict rollback.
- `supabase/functions/regenerate-certificate/index.ts`: authenticate the organization member, obtain authorized render input, create a new private PDF object, finalize the pointer/audit, and clean up an uncommitted object on failure.
- `supabase/functions/regenerate-certificate/index_test.ts`: exercise request validation, authorization/error mapping, finalization conflict, and upload cleanup behavior.
- `src/api/certificates.ts`: add typed organization regeneration API call and stable error mapping.
- `src/api/certificates.test.ts`: cover regeneration invocation, authorization denial, and transport errors.
- `src/features/org/pages/OrgSeminarDetailsPage.tsx`: add a deliberate confirmation action for regenerating an issued participant's PDF and show success/failure feedback.
- `src/features/org/pages/OrgSeminarDetailsPage.test.tsx`: create tests verifying only issued records expose the action and that it calls the API for the selected registration after confirmation.
- `docs/verification/certificate-render-recovery-staging.md`: record redacted staging verification of the repaired merge, regenerated PDF, and both authorized download paths.

## Task 1: Normalize Certificate Background Uploads

**Files:**
- Modify: `src/features/org/pages/SeminarEditorPage.tsx`
- Test: `src/features/org/pages/SeminarEditorPage.test.tsx`

**Interfaces:**
- Consumes: the existing certificate upload handler and draft `backgroundUrl` data URI.
- Produces: a PNG data URI for every decoded PNG/JPEG raster upload; SVG remains an SVG data URI and is checked by the server renderer.

- [ ] **Step 1: Add failing upload tests.** Cover a valid JPEG being stored as a PNG data URI, a mislabeled WebP being decoded and stored as PNG when the browser can decode it, a corrupt file showing an error without replacing the current draft background, and a valid SVG remaining SVG.
- [ ] **Step 2: Run the focused tests and confirm they fail for the current FileReader-only path.** Run `npx vitest run src/features/org/pages/SeminarEditorPage.test.tsx`.
- [ ] **Step 3: Add raster normalization.** Decode raster files with `createImageBitmap`, reject decoded dimensions over 8,192 px per side or 24,000,000 pixels, draw to canvas, serialize via `canvas.toBlob('image/png')`, and save the PNG data URL. Revoke temporary bitmap resources and reject empty, undecodable, over-5-MiB source files, or normalized PNGs over 5 MiB with the existing user-facing error channel. Keep SVG out of canvas normalization.
- [ ] **Step 4: Run the focused upload tests and confirm they pass.** Run `npx vitest run src/features/org/pages/SeminarEditorPage.test.tsx`.
- [ ] **Step 5: Review the staged diff for this task only.** Stage only `src/features/org/pages/SeminarEditorPage.tsx` and its test after confirming their diff contains no pre-existing work; if the files already contain unrelated edits, do not commit them as a combined change.

**Expected result:** Raster file metadata cannot cause WebP/JPEG/PNG bytes to be stored under the wrong declared MIME type; unreadable uploads do not overwrite a saved template.

## Task 2: Reject Signature Mismatches and Test Visible Render Output

**Files:**
- Modify: `supabase/functions/issue-certificate/render_certificate.ts`
- Test: `supabase/functions/issue-certificate/render_certificate_test.ts`

**Interfaces:**
- Consumes: a template background data URI and the existing `RenderCertificateInput`.
- Produces: `renderCertificatePng(input): Promise<Uint8Array>` containing the composed background, name, and optional QR; `renderCertificatePdf(input)` embeds those same PNG bytes.

- [ ] **Step 1: Write failing renderer tests.** Include a true PNG with a distinctive solid background, a valid JPEG, an SVG, WebP bytes mislabeled as JPEG, PNG bytes mislabeled as JPEG, and a rendered certificate with a known attendee name. Decode the composed PNG and assert background pixels match the source and pixels in the configured name box include non-background text pixels.
- [ ] **Step 2: Run the Deno tests and verify the new behavior is not covered yet.** Run `deno test supabase/functions/issue-certificate/render_certificate_test.ts`.
- [ ] **Step 3: Implement signature checks, a bundled Outfit font, and the shared composed-PNG stage.** Verify PNG, JPEG, and SVG signatures against the URI MIME; reject WebP and mismatches with `validation_failed`; load the bundled font through Resvg `fontBuffers` for both certificate and SVG-background rendering; preserve SVG sanitization and external-image rejection; have the PDF method embed output from `renderCertificatePng` without a second render path.
- [ ] **Step 4: Run renderer tests and the existing TypeScript build.** Run `deno test supabase/functions/issue-certificate/render_certificate_test.ts` and `npm run build`.
- [ ] **Step 5: Review the diff and commit only task-owned renderer/test changes if those paths contain no unrelated edits.**

**Expected result:** A mismatched image is rejected with a stable validation error instead of becoming an apparently successful blank certificate, and regression coverage checks actual rendered pixels including the mail-merged name.

## Task 3: Add Audited, Atomic Regeneration Database Operations

**Files:**
- Create: `supabase/migrations/20261117100000_certificate_regeneration.sql`
- Test: `supabase/tests/certificate_regeneration.test.sql`

**Interfaces:**
- `public.get_certificate_regeneration_input(p_registration_id uuid) returns jsonb`: authenticated active organization member only; returns seminar ID, registration ID, existing serial/object path, current saved certificate template, seminar title, and resolved participant name.
- `public.finalize_certificate_regeneration(p_registration_id uuid, p_actor_user_id uuid, p_expected_object_path text, p_new_object_path text, p_request_id uuid) returns jsonb`: service-role only; rechecks that the actor is still an active organization member, requires the current object path to equal the expected path and the new private Storage object to exist; atomically changes `object_path` and inserts an audit event.
- Audit record includes issuance ID, actor user ID, request UUID, previous path, replacement path, and timestamp. Client roles receive no direct table access.

- [ ] **Step 1: Write failing pgTAP tests.** Assert an active member receives generation input, a non-member/applicant is denied without revealing issuance data, a successful finalize changes only the object pointer and adds one audit row while preserving serial/issuance ID, and a stale expected path or missing uploaded object leaves the issuance and audit unchanged.
- [ ] **Step 2: Run the focused database tests against an isolated local Supabase database and confirm they fail because the RPCs/table do not exist.** Run `npx supabase test db`; use `npx supabase db reset` only after confirming the local database has no data that needs to be preserved.
- [ ] **Step 3: Add the migration.** Define the private audit table and tightly granted RPCs; use `auth.uid()` and active organization membership for input access, `FOR UPDATE` plus expected-path comparison for finalization, recheck active membership for the supplied actor inside finalization, and validate that the new path is scoped to the same seminar and registration with a unique request/version component.
- [ ] **Step 4: Run local migrations and database tests.** Run `npx supabase db reset` followed by `npx supabase test db`.
- [ ] **Step 5: Review grants, RLS, search paths, and rollback behavior.** Confirm no authenticated client can call the service-only finalizer or read the audit table directly; commit only the new migration and test if cleanly isolated.

**Expected result:** Regeneration is authorized, concurrency-safe, auditable, and atomic from the issuance record's perspective.

## Task 4: Implement the Regeneration Edge Function

**Files:**
- Create: `supabase/functions/regenerate-certificate/index.ts`
- Create: `supabase/functions/regenerate-certificate/index_test.ts`
- Modify: `supabase/config.toml` only if the project requires explicit per-function configuration.

**Interfaces:**
- Request: `POST { "registrationId": "<uuid>" }` with the caller's Supabase bearer session.
- Success: `200 { "status": "issued", "serial": "<existing serial>" }`.
- Stable errors: `400 validation_failed`, `401 session_expired`, `404 not_found` for missing issuance or unauthorized membership, `409 conflict`, and `502 network`.
- For unit testing, export `createRegenerationHandler(dependencies)` and call `Deno.serve` only when `import.meta.main`; inject the session client, service client, renderer, and request-ID generator so upload/finalize/cleanup behavior can be tested without real credentials.

- [ ] **Step 1: Add endpoint tests for malformed bodies, applicant/non-member denial, missing issuance, valid replacement, stale-pointer conflict, and cleanup of a newly uploaded object if finalization fails.**
- [ ] **Step 2: Run the Deno endpoint tests and confirm expected failing imports/behavior before implementation.** Run `deno test supabase/functions/regenerate-certificate/index_test.ts`.
- [ ] **Step 3: Implement the endpoint.** Validate the bearer session and exact request shape; call the organization-authorized input RPC; render using the shared renderer; upload with `upsert: false` to a unique versioned path; invoke the finalizer with the expected old path; delete the candidate object on any finalization error; log only sanitized error codes.
- [ ] **Step 4: Run endpoint and renderer tests.** Run `deno test supabase/functions/issue-certificate/render_certificate_test.ts supabase/functions/regenerate-certificate/index_test.ts`.
- [ ] **Step 5: Run `npx supabase functions serve regenerate-certificate --env-file .env.local` and verify a local authorized request plus a denied applicant request.** Use synthetic local accounts only; do not print bearer tokens.
- [ ] **Step 6: Review authorization, object cleanup, retries, and error responses; commit only the new function and tests if task-owned.**

**Expected result:** A replacement is fully rendered and stored before the issuance pointer changes; unsuccessful attempts leave the prior issued PDF intact.

## Task 5: Add the Organization Regeneration Action

**Files:**
- Modify: `src/api/certificates.ts`
- Test: `src/api/certificates.test.ts`
- Modify: `src/features/org/pages/OrgSeminarDetailsPage.tsx`
- Create: `src/features/org/pages/OrgSeminarDetailsPage.test.tsx`

**Interfaces:**
- `regenerateOrgCertificate(registrationId: string): Promise<ApiResult<{ serial: string }>>` invokes `regenerate-certificate` and maps stable errors.
- The Certificates tab shows a regenerate action only for `state === 'issued'`; it asks the organization member to confirm replacing the current PDF, then refreshes certificate records and shows a dismissible result dialog.

- [ ] **Step 1: Add failing API and UI tests.** Verify request body uses only the selected registration ID, error codes are mapped, only issued rows show the action, cancellation makes no request, and confirmation calls regeneration once and refreshes records on success.
- [ ] **Step 2: Run focused Vitest tests and verify they fail before implementation.** Run `npx vitest run src/api/certificates.test.ts src/features/org/pages/OrgSeminarDetailsPage.test.tsx`.
- [ ] **Step 3: Implement the typed API call and confirmation/result dialog using the page's existing dialog and loading conventions.** Prevent duplicate submissions while pending; do not expose object path or serial beyond existing certificate display patterns.
- [ ] **Step 4: Run focused tests, `npm run lint`, and `npm run build`.**
- [ ] **Step 5: Review keyboard focus, screen-reader announcements, cancel behavior, duplicate-click behavior, and post-success refresh; commit only task-owned UI/API changes if isolated.**

**Expected result:** An organization member can deliberately replace an issued PDF for a selected participant and receives clear success or failure feedback.

## Task 6: Verify Staging, Existing Download Paths, and Recovery

**Files:**
- Create: `docs/verification/certificate-render-recovery-staging.md`

**Interfaces:**
- Consumes: the deployed upload normalization, renderer, regeneration endpoint, migration, and organization UI.
- Produces: redacted verification results for a newly issued PDF and a replacement of the already-issued blank certificate.

- [ ] **Step 1: Verify current Git status and staging Supabase project ref.** Confirm the intended staging project from local Supabase config and deployment target; do not rely on `npm run dev -- --mode staging`, which configures only Vite.
- [ ] **Step 2: Run migration dry-run and inspect the exact migration set.** Run `npx supabase db push --dry-run --remote=<verified-staging-ref>`; stop if any migration other than `20261117100000_certificate_regeneration.sql` is included or the target is not staging.
- [ ] **Step 3: Apply the approved migration and deploy both Edge Functions to the verified staging ref.** Use explicit project ref flags and verify the CLI target before each write operation.
- [ ] **Step 4: Upload a synthetic raster background and issue a new staging certificate.** Open the resulting PDF visually; confirm the background and synthetic attendee name are visible and the database shows exactly one issuance.
- [ ] **Step 5: Replace and save the affected seminar's background through the normalized upload flow.** Confirm the saved template background is a PNG data URI before requesting regeneration.
- [ ] **Step 6: Use the organization Certificates tab to regenerate the known blank issuance.** Confirm the serial and issuance ID remain stable, a single audit event is recorded, the new object path is active, and the PDF visibly contains the background and expected synthetic attendee name.
- [ ] **Step 7: Verify download authorization through both applicant and active organization accounts; verify an unrelated applicant and non-member cannot regenerate or download the replacement.**
- [ ] **Step 8: Record sanitized timestamps, outcomes, PDF page count, and visual checks in `docs/verification/certificate-render-recovery-staging.md`.** Do not include attendee PII, raw image data, bearer tokens, signed URLs, or Storage paths.

**Expected result:** A new certificate renders with visible mail-merged fields, the existing blank issuance is safely replaced without changing its serial, and authorized applicant/organization download paths retrieve the replacement.

## Evidence Audit and Failure Criteria

- **Claim:** The background-format mismatch caused the blank output. **Evidence:** The saved data URI declared JPEG while its bytes had a WebP signature; the renderer trusts the MIME label and the existing test checks only the PDF header. **Falsified if:** A correctly normalized PNG plus the same saved name/template still renders blank in the composed PNG test.
- **Claim:** Mail-merge data exists for the affected issuance. **Evidence:** The generation-input query returned a non-empty resolved name. **Falsified if:** The staging generation-input RPC returns an empty name for the affected registration.
- **Competing explanations to test:** stale deployed Edge Function code; invisible name style/geometry; renderer image decoding failure. Staging task distinguishes these by recording deployed function version, inspecting the current saved template, and checking pixel output before PDF download.
- **Additional renderer evidence:** The name-pixel test initially found zero changed pixels in the name box with the default Outfit family. The renderer relied on system fonts; bundling Outfit makes font availability deterministic.
- **Release gate:** Do not report the fix verified until the composed-PNG test proves visible background and name pixels, the end-to-end staged PDF is visually inspected, the audit row is present, and both authorized download paths return the replacement.
