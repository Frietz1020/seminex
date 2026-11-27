---
title: RPC Functions & Triggers
aliases: [SQL Functions, RPCs, Triggers]
tags: [schema, database, api]
updated: 2026-11-27
status: active
---

# RPC Functions & Triggers

Back to [[Home]] | See also: [[Schema & Tables]], [[API Client Reference]], [[Edge Functions]].

## Public RPC Functions

### Identity, Time & Profile
- `public.get_server_time()` — Returns authoritative Postgres `clock_timestamp()` ISO string.
- `public.complete_org_signup(...)` — Links new/existing student account to an org access request.
- `public.set_my_avatar(p_object_path)` — Persists validated avatar storage path on `profiles`.

### Seminar Authoring & Lifecycle
- `public.publish_seminar(p_draft_id)` — Validates & publishes a draft into `public.seminars`.
- `public.create_org_edit_draft(p_seminar_id)` — Clones a published seminar into `seminar_drafts` for editing.
- `public.begin_org_draft_deletion(p_draft_id)` — Marks draft deletion in progress so publish trigger blocks races.
- `public.archive_org_seminar(p_seminar_id)` — Archives a published seminar.

### Registration & Attendance
- `public.register_for_seminar(p_seminar_id)` — Reserves a seat (auto-confirms late registrations).
- `public.confirm_registration(p_seminar_id)` — Confirms seat within the seminar's confirmation window.
- `public.cancel_registration(p_seminar_id)` — Cancels an active registration.
- `public.acknowledge_attendance(p_seminar_id)` — Records `"Still attending?"` acknowledgement (required before QR issuance).
- `public.get_webinar_join_url(p_seminar_id)` — Returns join URL for confirmed webinar participants.
- `public.issue_attendance_challenge(p_seminar_id)` — Issues opaque 64-hex QR challenge valid until `endsAt + 60m`.
- `public.record_org_challenge_scan(...)` — Validates QR challenge, enforces `time_in` / `time_out` transition & scan window, writes `attendance_ledger`.
- `public.record_org_scan(...)` — Records manual 9-digit Student ID attendance with optional reason and idempotency key.
- `public.list_org_roster(p_seminar_id)` / `public.list_attendance_ledger(p_seminar_id)` — Org attendance inspection.
- `public.register_webinar_proof(...)` / `public.review_webinar_proof(...)` / `public.list_webinar_proofs(p_seminar_id)` — Webinar screenshot workflow.

### Evaluations & Certificates
- `public.list_evaluations_due()` — Lists seminars where attendance is met and evaluation is pending.
- `public.get_evaluation_survey(p_seminar_id)` — Returns active survey version for eligible participant.
- `public.submit_evaluation(p_seminar_id, p_survey_id, p_survey_version, p_answers)` — Validates answers, inserts response, triggers pending `certificate_issuances` row, returns `{ submittedAt, certificateSerial }`.
- `public.get_org_seminar_evaluation(p_seminar_id, p_cursor, p_page_size)` — Anonymous aggregates & paginated responses.
- `public.get_my_certificate(p_seminar_id)` — Returns student's certificate issuance row (`status`, `object_path`, `serial`).
- `public.get_certificate_generation_input(p_seminar_id)` — Supplies template snapshot + student/seminar metadata to `issue-certificate`.
- `public.finalize_certificate_issuance(p_registration_id, p_object_path)` — Service-role RPC marking certificate `issued`.
- `public.get_org_seminar_certificates(p_seminar_id)` — Returns seminar template + participant certificate states.
- `public.get_certificate_regeneration_input(p_registration_id)` / `public.finalize_certificate_regeneration(...)` — Org PDF regeneration + audit logging.

### Adviser Governance
- `public.list_adviser_org_requests()` / `public.decide_adviser_org_request(...)`
- `public.list_adviser_org_members()` / `public.update_adviser_member_position(...)` / `public.remove_adviser_member(...)`

## Private Helper Functions & Triggers (12 Triggers)

| Trigger | Table | Function | Role |
| --- | --- | --- | --- |
| `on_auth_user_created_or_email_changed` | `auth.users` | `private.sync_auth_user_profile()` | Keeps `public.profiles` synced |
| `seminars_set_updated_at`, `seminar_drafts_set_updated_at`, `registrations_set_updated_at` | Core tables | `private.set_updated_at()` | Auto-updates `updated_at` |
| `registrations_sync_seminar_registered_count` | `registrations` | `private.sync_seminar_registered_count()` | Keeps `seminars.registered_count` exact |
| `attendance_ledger_append_only` | `attendance_ledger` | `private.prevent_attendance_ledger_mutation()` | Blocks UPDATE/DELETE tampering |
| `seminar_survey_versions_immutable` | `seminar_survey_versions` | `private.prevent_evaluation_history_mutation()` | Blocks survey history edits |
| `evaluation_responses_immutable` | `evaluation_responses` | `private.prevent_evaluation_history_mutation()` | Blocks answer edits after submit |
| `seminar_drafts_snapshot_published_survey` | `seminar_drafts` | `private.snapshot_published_survey()` | Snapshots survey version on publish |
| `evaluation_responses_sync_registration` | `evaluation_responses` | `private.sync_evaluation_submitted_at()` | Stamps `registrations.evaluation_submitted_at` |
| `evaluation_responses_create_certificate_issuance` | `evaluation_responses` | `private.create_certificate_issuance()` | Creates pending `SNX-...` issuance row |
| `seminar_drafts_prevent_publish_during_deletion` | `seminar_drafts` | `private.prevent_publish_during_draft_deletion()` | Prevents publish/delete race |
