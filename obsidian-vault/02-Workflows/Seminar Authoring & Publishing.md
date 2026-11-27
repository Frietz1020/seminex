---
title: Seminar Authoring & Publishing
aliases: [Seminar Editor, Certificate Designer, Evaluation Builder]
tags: [workflow, frontend, org]
updated: 2026-11-27
status: active
---

# Seminar Authoring & Publishing

Back to [[Home]] | See also: [[Schema & Tables]], [[Edge Functions]], [[RPC Functions & Triggers]].

## 4-Step Authoring Pipeline (`SeminarEditorPage.tsx`)

1. **Step 1 — Details & Cover Image:**
   - Upload seminar cover via `CoverImageEditor.tsx` (16:9 interactive pan/zoom/reset cropper, outputs `1200×675`).
   - Leaving the cropper open when clicking `Save draft` or `Continue` auto-commits via `CoverImageEditorHandle.exportCrop()`, uploads to `seminar-covers` bucket, and cleans up replaced cover files.
   - Configures title, description, speaker, venue, schedule (`startsAt` / `endsAt`), capacity, confirmation window (minutes before start), and seminar type (`in_person` or `webinar`).
2. **Step 2 — Certificate Designer (`CertificateDesigner.tsx` + `ColorPicker.tsx`):**
   - Uploads PNG/JPG/SVG template background (normalized to PNG data URL, max 5 MB, validated against `CERTIFICATE_RENDER_LIMITS`).
   - Interactive drag/resize Name Box and locked 1:1 diagonal-scaling QR Code Box (`clampSquareBox`).
   - 16 categorized Google Fonts (`Outfit`, `DM Sans`, `Montserrat`, `Plus Jakarta Sans`, `Raleway`, `Playfair Display`, `Cinzel`, `Cormorant Garamond`, `Libre Baskerville`, `Merriweather`, `EB Garamond`, `Lora`, `Great Vibes`, `Alex Brush`, `Allura`, `Dancing Script`), synchronized with `supabase/functions/issue-certificate/render_certificate.ts`.
   - `NumberField` steppers for font size (`6–400px`) and line height (`1–500px`), icon toggles (Bold/Italic/Underline, Left/Center/Right), opacity, text transform, and 18-swatch + 2D HSV `ColorPicker`.
3. **Step 3 — Evaluation Builder (`EvaluationBuilder.tsx`):**
   - GForms-style multi-page builder (`Section 1 of N`) with floating active toolbar (`add_circle`, `view_agenda`, B/I/U), question types (`choice`, `checkbox`, `scale`, `rating`, `paragraph`), reorder/duplicate/delete, and Required pill switch.
4. **Step 4 — Review & Publish:**
   - Validates `getDraftReadiness(draft)` (details + certificate + evaluation).
   - Calls `public.publish_seminar(p_draft_id)`: creates/updates `public.seminars`, fires `seminar_drafts_snapshot_published_survey` trigger to snapshot an immutable `seminar_survey_versions` row, and redirects to `/org/my-seminars/:id`.

> [!tip] Editing Published Seminars
> `public.create_org_edit_draft(p_seminar_id)` clones a published seminar back into `seminar_drafts` for safe editing without corrupting live registrations or historical survey versions.
