# Certificate Mail-Merge and In-App Delivery Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to complete this verification task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify on staging that an eligible applicant receives a correctly personalized certificate PDF and that authorized applicant and organization users can download it in-app.

**Architecture:** Keep certificate verification independent from the attendance repair. Use a controlled staging seminar, synthetic applicant, valid attendance and evaluation state, and the existing `issue-certificate` Edge Function. Verify the rendered PDF, private Storage artifact, issuance record, and both app download paths. If a step reveals a reproducible defect, capture evidence and create a separate design and implementation plan before changing certificate code.

**Tech Stack:** React, TypeScript, Supabase JS, PostgreSQL, Supabase Edge Functions (Deno), private Supabase Storage, PDF rendering, Vitest, pgTAP, Vite.

**Spec:** `docs/superpowers/specs/2026-11-16-attendance-reliability-design.md`

## Global Constraints

- Certificate delivery in this scope is in-app only; do not send certificate emails or claim email delivery works.
- Use a staging-only test seminar and synthetic data. Do not use real applicant personal data in artifacts or reports.
- Preserve the seminar's configured attendance percentage and evaluation eligibility gate.
- Never expose service-role credentials, private object paths, signed URLs, or auth tokens in the report.
- `npm run dev -- --mode staging` starts the frontend in staging mode; it does not deploy migrations or Edge Functions.
- Do not mutate staging data or deploy functions until the project ref and target environment are confirmed and the user approves the staging write.

---

### Task 1: Confirm staging target and map certificate issuance

**Files:**
- Inspect: `docs/ENVIRONMENTS.md`
- Inspect: `src/api/certificates.ts`
- Inspect: `src/features/history/pages/HistorySummaryPage.tsx`
- Inspect: `src/features/history/components/RecordCard.tsx`
- Inspect: `src/features/org/pages/OrgSeminarDetailsPage.tsx`
- Inspect: `supabase/functions/issue-certificate/index.ts`
- Inspect: `supabase/functions/issue-certificate/render_certificate.ts`
- Inspect: `supabase/migrations/20261110000000_certificate_issuance.sql`
- Inspect: `supabase/tests/certificate_issuance.test.sql`
- Inspect: `src/api/certificates.test.ts`

**Interfaces:**
- Consumes: staging URL/project ref and authenticated applicant/org certificate APIs.
- Produces: a redacted call path from eligibility to rendering, private object storage, issuance finalization, and signed download.

- [ ] **Step 1: Read staging configuration without printing keys.** Record only the Supabase project ref and app origin. Confirm the Supabase CLI target matches the intended staging ref; stop if they differ.
- [ ] **Step 2: Trace certificate eligibility.** Confirm the seminar's configured attendance percentage, validated Time-Out, and evaluation requirements from SQL and `docs/api-contract.md`.
- [ ] **Step 3: Trace rendering and merge inputs.** Record supported template fields, data sources, PDF output checks, and behavior for missing or oversized fields.
- [ ] **Step 4: Trace storage and authorization.** Confirm the bucket is private, object paths are never rendered into user-visible output, applicant reads are scoped to their own registration, and org reads require active seminar membership.
- [ ] **Step 5: Compare existing tests with staging-only behavior.** Mark PDF rendering, adapter, SQL issuance, and role-based app download as covered or unverified. Do not change source during this verification task.

**Expected result:** A concise checklist identifying the exact data and authorization path before staging writes begin.

### Task 2: Prepare a disposable eligible staging case

**Files:**
- Create: `docs/verification/certificate-delivery-staging.md`
- Inspect: `src/features/org/components/CertificateDesigner.tsx`
- Inspect: `src/features/org/pages/SeminarEditorPage.tsx`

**Interfaces:**
- Consumes: verified project ref, synthetic applicant and org accounts, seminar editor, and certificate template.
- Produces: one published staging seminar and one eligible applicant with known synthetic merge values.

- [ ] **Step 1: Create `docs/verification/` and start the report with project ref, app origin, date/timezone, and synthetic test-account labels.** Exclude credentials and tokens.
- [ ] **Step 2: Create a published staging-only seminar with a short known duration and a certificate template containing distinct synthetic values for each supported merge field.** Record expected merge values in the report.
- [ ] **Step 3: Register the synthetic applicant, complete acknowledgement, Time-In, and Time-Out using the verified attendance workflow.** Ensure the attendee meets the seminar's configured threshold.
- [ ] **Step 4: Submit the required evaluation and verify one issuance record and one template snapshot exist before asking for the PDF.**
- [ ] **Step 5: Before any shared staging write, confirm the project ref and obtain explicit user authorization.** If that authorization is absent, stop after documenting the pending setup action.

**Expected result:** A minimal eligible synthetic fixture with known expected certificate text.

### Task 3: Verify PDF generation and mail-merge fields

**Files:**
- Inspect: `supabase/functions/issue-certificate/render_certificate.ts`
- Inspect: `supabase/functions/issue-certificate/index.ts`
- Update: `docs/verification/certificate-delivery-staging.md`

**Interfaces:**
- Consumes: eligible registration and saved template snapshot.
- Produces: issued PDF artifact, finalized issuance record, and a redacted merge-field comparison.

- [ ] **Step 1: Request the certificate from the applicant app.** Record the result and synthetic serial; do not capture authorization headers or signed URLs.
- [ ] **Step 2: Open the downloaded PDF and compare each visible field with the synthetic expected values.** Check page count, clipping, blank values, font/render issues, and PDF readability.
- [ ] **Step 3: Confirm the issuance row is finalized and tied to the expected registration and template snapshot, with one private object path.** Do not include the object path in the report.
- [ ] **Step 4: Repeat the applicant request.** Verify it returns the existing issuance/artifact rather than creating a second issuance or serial.
- [ ] **Step 5: Record pass/fail and use redacted screenshots if evidence is needed.**

**Expected result:** A readable, correctly personalized PDF tied to one finalized issuance.

### Task 4: Verify applicant and organization in-app distribution and denied access

**Files:**
- Inspect: `src/api/certificates.ts`
- Inspect: `src/features/history/pages/HistorySummaryPage.tsx`
- Inspect: `src/features/history/components/RecordCard.tsx`
- Inspect: `src/features/org/pages/OrgSeminarDetailsPage.tsx`
- Update: `docs/verification/certificate-delivery-staging.md`

**Interfaces:**
- Consumes: finalized issuance, applicant session, active organization membership, and private Storage.
- Produces: authorization evidence for permitted downloads and denied ineligible access.

- [ ] **Step 1: Download as the owning applicant through the app.** Verify the app uses a short-lived URL and returns the PDF; no object path or URL is persisted as durable applicant data.
- [ ] **Step 2: Download as an active org member authorized for the seminar.** Verify the app shows the correct applicant/seminar record and delivers the same PDF.
- [ ] **Step 3: Try a synthetic ineligible applicant and an org account without seminar membership.** Expect denial and no PDF download or new issuance.
- [ ] **Step 4: Verify signed URL refresh by obtaining a new download through the app after the previous URL expires.** Confirm the retry does not create another issuance.
- [ ] **Step 5: Record each role, action, expected outcome, observed outcome, and sanitized timestamp.**

**Expected result:** The eligible owner and authorized org can download; ineligible or unauthorized callers cannot.

### Task 5: Close verification and classify any defect

**Files:**
- Update: `docs/verification/certificate-delivery-staging.md`

**Interfaces:**
- Consumes: render, storage, retry, eligibility, and authorization observations.
- Produces: pass/fail decision, evidence references, and a scoped follow-up if the app fails.

- [ ] **Step 1: Reconcile the required checks:** correct merge fields, private storage/finalized issuance, applicant download, organization download/authorization, and retry behavior.
- [ ] **Step 2: State clearly whether certificate in-app distribution was verified.** Explicitly state that email behavior was not tested and is out of scope.
- [ ] **Step 3: If a failure is reproducible, capture the exact sanitized request/error and relevant issuance state.** Do not patch certificate source as part of this verification-only plan.
- [ ] **Step 4: Remove the disposable seminar and synthetic accounts only through a safe, approved cleanup operation.** Record cleanup status; do not delete shared or unrelated data.
- [ ] **Step 5: Save the report and, for a reproducible defect, prepare a separate defect design and implementation plan after design approval.**

**Expected result:** A clear staging-verification record, or an evidence-backed follow-up for a certificate defect.
