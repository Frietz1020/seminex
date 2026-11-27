---
title: Edge Functions
aliases: [Supabase Functions, Deno Functions, PDF Renderer]
tags: [edge-function, backend]
updated: 2026-11-27
status: active
---

# Supabase Edge Functions

Back to [[Home]] | See also: [[Evaluation & Certificate Issuance]], [[Registration & Attendance Flow]], [[Hosting & Deployment]].

All 3 Edge Functions run on Deno with `verify_jwt = true` in `supabase/config.toml`.

## 1. `issue-certificate` (`supabase/functions/issue-certificate/`)
- **Endpoint:** `POST /functions/v1/issue-certificate` with `{ seminarId: uuid }`.
- **Static Assets:** `resvg.wasm`, `webp_dec.wasm`, `fonts/Outfit-Variable.ttf`.
- **Pipeline:**
  1. Verifies caller JWT via `sessionClient.auth.getUser()`.
  2. Validates UUID body via `request.ts` (`parseIssueCertificateRequest`).
  3. Calls `get_certificate_generation_input(p_seminar_id)`. If already `issued`, returns `200 { status: 'issued', serial }`.
  4. Renders SVG → PNG via `Resvg` (`render_certificate.ts`) with QR (`qrcode.react`) and embeds into a PDF via `pdf-lib`.
  5. Validates template against `CERTIFICATE_RENDER_LIMITS` (`maxSide: 8192`, `maxPixels: 24_000_000`, `maxImageBytes: 5 MiB`) and the 16-font whitelist (`FONT_FAMILIES`).
  6. Uploads PDF to `certificates/<seminarId>/<registrationId>.pdf` via service role and calls `finalize_certificate_issuance`.
- **Errors:** `400 validation_failed`, `401 session_expired`, `403 forbidden`, `404 not_found`, `409 not_available`, `502 network`.

## 2. `regenerate-certificate` (`supabase/functions/regenerate-certificate/`)
- **Endpoint:** `POST /functions/v1/regenerate-certificate` with `{ registrationId: uuid }`.
- **Pipeline:** Calls `get_certificate_regeneration_input`, re-renders PDF using the seminar's latest template via shared `render_certificate.ts`, uploads to `<seminarId>/<registrationId>/<requestId>.pdf` (`upsert: false`), and commits `finalize_certificate_regeneration` (with reconciliation & orphan cleanup on failure).

## 3. `upload-webinar-proof` (`supabase/functions/upload-webinar-proof/`)
- **Endpoint:** `POST /functions/v1/upload-webinar-proof` (`multipart/form-data`: `seminarId`, `kind`, `idempotencyKey`, `file`).
- **Pipeline:** Verifies PNG/JPEG magic bytes (<= 5 MB), uploads to `webinar-proofs/<userId>/<seminarId>/<uuid>.<ext>`, and registers via `register_webinar_proof` (removing orphan object on RPC error or idempotent replay).

## Shared Modules (`supabase/functions/_shared/`)
- `certificateConstraints.ts`: `CERTIFICATE_RENDER_LIMITS`, `isCertificateCanvasWithinLimits()`, `clampCertificateBox()` (imported by both Edge Functions and frontend `CertificateDesigner` / `SeminarEditorPage`).
- `certificateImage.ts`: Raster magic-byte MIME normalization (`PNG`, `JPEG`, `WebP`) and WebP VP8/VP8L/VP8X dimension checks.
