---
title: Evaluation & Certificate Issuance
aliases: [Evaluations, Certificates, PDF Generation]
tags: [workflow, edge-function]
updated: 2026-11-27
status: active
---

# Evaluation & Certificate Issuance

Back to [[Home]] | See also: [[Edge Functions]], [[Schema & Tables]], [[RPC Functions & Triggers]].

## End-to-End Flow

```mermaid
sequenceDiagram
  actor Student
  participant Form as EvaluationForm.tsx
  participant DB as Postgres (submit_evaluation)
  participant EF as issue-certificate (Deno)
  participant ST as Storage (certificates)

  Student->>Form: Complete multi-page survey & click Submit
  Form->>DB: rpc('submit_evaluation', seminarId, surveyId, version, answers)
  DB->>DB: Validate eligibility + answers -> insert evaluation_responses
  DB->>DB: Trigger creates pending certificate_issuances row + SNX serial
  DB-->>Form: { submittedAt, certificateSerial }
  Form->>EF: functions.invoke('issue-certificate', { seminarId })
  EF->>DB: rpc('get_certificate_generation_input', seminarId)
  EF->>EF: renderCertificatePdf (Resvg SVG->PNG + QR + pdf-lib)
  EF->>ST: Upload <seminarId>/<registrationId>.pdf
  EF->>DB: rpc('finalize_certificate_issuance', registrationId, objectPath)
  EF-->>Form: { status: 'issued', serial }
  Form-->>Student: SubmittedDialog -> "View certificate" (/history/:seminarId)
```

## Key Details

- **Multi-Page Survey Navigation (`EvaluationForm.tsx`):**
  - Paginates across `survey.sections` with per-section validation on `Next` and local draft persistence (`draftStore.ts`).
  - Uses distinct React keys (`next-section` vs `submit-evaluation`) + `isLastSection` guard so advancing pages never triggers accidental form submission.
- **Immediate Certificate Issuance (`src/api/evaluations.ts`):**
  - Immediately invokes `issue-certificate` right after `submit_evaluation` commits, captures the returned `serial`, and dispatches `seminex:registrations-changed`.
- **Viewing & Downloading (`HistorySummaryPage.tsx`, `src/api/certificates.ts`):**
  - `getCertificate(seminarId)` ensures issuance via `issue-certificate`, reads `object_path` via `get_my_certificate`, creates a 60s signed URL from the private `certificates` bucket, and returns the PDF `Blob` for inline preview and download.
- **Regeneration (`regenerate-certificate` Edge Function):**
  - Org officers can regenerate an issued certificate after updating a seminar's template; writes a new path `<seminarId>/<registrationId>/<requestId>.pdf` and records an audit row in `certificate_regeneration_audit`.
