---
title: Migrations Timeline
aliases: [SQL Migrations, Database History]
tags: [schema, database]
updated: 2026-11-27
status: active
---

# Supabase Migrations Timeline (21 Migrations)

Back to [[Home]] | See also: [[Schema & Tables]], [[RPC Functions & Triggers]].

| # | Migration File | Summary |
| --- | --- | --- |
| 1 | `20261106000000_identity.sql` | `profiles`, `organizations`, `organization_memberships`, auth sync trigger |
| 2 | `20261106000001_signup_identity.sql` | `organization_access_requests`, `complete_org_signup` |
| 3 | `20261106042858_seminar_registration.sql` | `seminars`, `seminar_drafts`, `registrations`, `registration_read_model`, publish/register/confirm/cancel RPCs |
| 4 | `20261106050000_attendance_webinar_proofs.sql` | `attendance_ledger`, `webinar_proofs`, `webinar-proofs` & `avatars` buckets, scan & proof RPCs |
| 5 | `20261109000000_evaluation_backend.sql` | `seminar_survey_versions`, `evaluation_responses`, immutability triggers, survey/submit/aggregate RPCs |
| 6 | `20261109010000_adviser_read_only.sql` | Enforces adviser read-only permissions on seminars & drafts |
| 7 | `20261109020000_anonymous_evaluation_order.sql` | Randomizes/decouples response order in org evaluation views |
| 8 | `20261109030000_attendance_ack_server_time.sql` | `attendance_ack_at`, `get_server_time()`, `acknowledge_attendance()` |
| 9 | `20261110000000_certificate_issuance.sql` | `certificate_issuances`, `certificates` bucket, trigger & issuance RPCs |
| 10 | `20261110120000_seminar_covers.sql` | Public `seminar-covers` bucket + officer upload/delete policies |
| 11 | `20261110150000_adviser_management.sql` | Adviser request approval & member management RPCs |
| 12 | `20261112000000_registration_scan_challenges.sql` | `private.registration_scan_challenges`, `issue_attendance_challenge`, `record_org_challenge_scan` |
| 13 | `20261113110000_org_seminar_authoring_improvements.sql` | Confirmation windows in minutes, safe draft deletion, `archive_org_seminar` |
| 14 | `20261114000000_explicit_org_scan_mode_and_optional_manual_reason.sql` | Explicit `time_in` / `time_out` scan mode & optional manual reason |
| 15 | `20261116000000_late_registration_confirmation.sql` | Auto-confirms late registrations inside/after confirmation close |
| 16 | `20261116100000_attendance_acknowledgement_required_for_qr.sql` | Requires `attendance_ack_at` before QR challenge issuance |
| 17 | `20261116110000_attendance_scan_transition_errors.sql` | Structured transition error codes (`wrong_attendance_step`, `attendance_already_complete`) |
| 18 | `20261116120000_attendance_scan_window_boundaries.sql` | `private.attendance_scan_window` boundary enforcement |
| 19 | `20261116130000_attendance_qr_lifecycle_and_per_mode_once.sql` | Per-mode once-only QR enforcement + `endsAt + 60m` lifecycle |
| 20 | `20261117100000_certificate_regeneration.sql` | `certificate_regeneration_audit` + regeneration input/finalize RPCs |
| 21 | `20261122100000_restore_adviser_read_only_seminar_drafts.sql` | Restores adviser read-only policy on `seminar_drafts` |
