# Attendance QR Lifecycle and Scanner Feedback Design

**Status:** Draft for user review  
**Date:** 2026-11-16  
**Scope:** Applicant attendance QR lifetime, at-most-once Time-In/Time-Out recording, and organization scanner feedback.

## Goal

Replace the 30-second rotating attendance QR challenge with a stable QR for both attendance modes, valid from persisted attendance acknowledgement until one hour after the seminar ends. Enforce one Time-In and one Time-Out per registration in the database and present scanner results in a pop-up.

## Current Behavior and Evidence

- `public.issue_attendance_challenge` creates a random 32-byte challenge and sets `expires_at` to database time plus 30 seconds.
- `AttendanceQr` compares the server-provided expiry with browser `Date.now()` and schedules a refresh five seconds before expiry. A backgrounded tab or clock skew can delay/advance refresh; the database remains authoritative.
- `public.record_org_challenge_scan` locks the challenge and registration, rejects an expired challenge, inserts a ledger row, updates the registration timestamp, and marks the challenge consumed. A consumed challenge is therefore currently single-use overall, so it cannot support the same QR for both modes.
- `attendance_ledger` currently has a uniqueness constraint on `(officer_user_id, idempotency_key)`, but no uniqueness constraint on `(registration_id, kind)` for Time-In/Time-Out.
- `OrgScannerPage` renders scan feedback in an inline status message, not a dialog.

## Decisions

1. The QR becomes available after the applicant's attendance acknowledgement has been persisted. It may appear before the seminar starts.
2. The QR expires at `seminars.ends_at + interval '1 hour'`.
3. Time-In is accepted only while `starts_at <= server_now < ends_at`.
4. Time-Out requires an accepted Time-In and is accepted while `starts_at <= server_now <= ends_at + interval '1 hour'`.
5. Attendance duration and the existing attendance eligibility threshold continue to use the seminar's scheduled interval; the Time-Out grace period does not add attendance credit.
6. The same QR payload is used for Time-In and Time-Out. A successful scan for one mode does not consume the QR for the other mode.
7. Each registration may have no more than one Time-In and one Time-Out. A second intentional scan for an already-recorded mode returns a specific `attendance_already_recorded` error.
8. A retry after an uncertain network result uses the same idempotency key and returns the original successful result. Idempotent retry is not reported as a duplicate scan.
9. Scanner success and actionable scan errors appear in an accessible pop-up. Camera scanning pauses while the pop-up is open and resumes after it closes.
10. The user accepts the risk that an attendee can share or photograph a longer-lived QR.

## Proposed Design

### QR credential and lifetime

Keep the existing authenticated RPC interface rather than introduce a new REST API. Update the issue RPC to require a signed-in applicant, a published in-person seminar, an active registration, and a persisted attendance acknowledgement. It returns an opaque random challenge bound to the registration and seminar, with an expiry exactly equal to the seminar end plus one hour. Issuance is permitted after acknowledgement and before that expiry, including before seminar start.

The applicant UI requests the challenge once when its QR view becomes eligible, displays that payload without the 30-second refresh timer, and hides it when server-synchronized seminar time reaches the expiry. On reload/reopening the view, the RPC may issue a replacement payload with the same registration binding and same fixed expiry; existing payloads remain valid only until that expiry. The QR payload and challenge are never logged. Server validation, not UI visibility, controls whether a scan is accepted.

The scan RPC continues to verify the challenge hash, registration binding, seminar, organization membership, and server-clock expiry. It no longer treats a successful Time-In as consuming the credential for Time-Out. The registration row is locked for the complete attendance transition.

### Attendance state transitions

| Registration state | Requested mode | Acceptance condition | Result |
| --- | --- | --- | --- |
| No Time-In | Time-In | `starts_at <= server_now < ends_at` and QR not expired | Insert one ledger event and set `time_in_at` |
| Time-In recorded, no Time-Out | Time-Out | `starts_at <= server_now <= ends_at + 1 hour` and QR not expired | Insert one ledger event and set `time_out_at` |
| Mode already recorded | Same mode again | Any time before QR expiry | Reject with `attendance_already_recorded` and the repeated mode |
| No Time-In | Time-Out | Any time | Reject with `wrong_attendance_step` |
| Time-In recorded | Time-In again | Any time | Reject with `attendance_already_recorded` |
| Time-Out recorded | Either mode | Any time | Reject with `attendance_already_recorded` for that mode or completed-state error for the other mode |

The implementation must make the exact Time-Out-after-Time-In rule deterministic under concurrent scans. Use the registration row lock plus a database uniqueness invariant for one attendance ledger event per registration and mode. Before adding an index/constraint, inspect existing rows for duplicates and define an auditable resolution; the migration must not silently delete attendance history. Correction ledger entries remain history and do not count as a second Time-In/Time-Out event.

`attendance_ledger` remains the audit history; `registrations.time_in_at` and `time_out_at` remain the registration summary. Each successful ledger insert and summary update occurs in the same database transaction. Preserve existing semantics for manual attendance and webinar-proof attendance while ensuring they cannot create a second Time-In/Time-Out for a registration already recorded by another method.

### RPC/API contract

Keep current RPC names and parameter shapes to avoid an unnecessary API-version migration:

| RPC | Request | Success response | Important errors |
| --- | --- | --- | --- |
| `issue_attendance_challenge(p_seminar_id uuid)` | Seminar UUID; authenticated applicant session | `{ challenge: string, expires_at: timestamptz }` | `session_expired`, `not_found`, `not_available`, `attendance_qr_expired` |
| `record_org_challenge_scan(p_seminar_id uuid, p_challenge text, p_idempotency_key uuid, p_kind text)` | Seminar UUID, opaque challenge, per-action UUID, `time_in` or `time_out`; authenticated organization member | Existing attendance entry and student identity response | `challenge_expired`, `outside_scan_window`, `wrong_attendance_step`, `attendance_already_recorded`, `challenge_replayed`, `idempotency_conflict`, `forbidden`, `not_found` |

The API adapter maps stable database error messages to typed client error codes. Unknown database errors remain server errors; they must not be misreported as network failures. Do not expose raw database details to attendees or log QR/challenge values, tokens, or unnecessary personal data.

For a repeated mode, the database error includes the attempted `p_kind` in a safe, structured field or stable message; the scanner maps it to a mode-specific operator message such as “Time-In is already recorded for this attendee.” Do not return attendee PII in an error response.

### Scanner feedback pop-up

Replace the scanner page's persistent bottom-of-form feedback with an accessible modal dialog for completed scan outcomes, including camera QR and manual attendance submissions. The dialog shows a clear success/error heading, the selected mode, a short actionable message, and a Close button. It remains open until dismissed. While open, ignore camera detections and prevent another scan submission; after closing, camera detection resumes. Camera permission/setup guidance may remain adjacent to the camera controls because it is not a scan result.

### Observability and privacy

For diagnosis, record or aggregate the RPC result category, requested mode, and request duration using available Supabase/database observability. Never log the QR payload, challenge, bearer token, student ID, or full student identity. No new external metrics stack is in scope.

## Migration and Rollout

1. Add a forward-only Supabase migration that changes challenge expiry/issuance and scan behavior, introduces deterministic duplicate-mode errors, and adds the database uniqueness invariant after a duplicate-data preflight.
2. Keep the RPC names and parameters stable. Deploy/apply the database migration before using the updated client against that project.
3. Update applicant QR eligibility/display and organization scanner dialog/error mapping.
4. Run focused database and frontend tests locally, then apply the migration to staging and verify the staging project reference and applied migration version before exercising the workflow.
5. Do not include certificate mail delivery or unrelated registration behavior in this change.

## Failure and Recovery

- A scan inside the QR lifetime but outside the selected mode's scan window returns `outside_scan_window`, not `challenge_expired`.
- A second scan in the same mode returns `attendance_already_recorded`; a network retry with its original idempotency key returns the first committed result.
- If a duplicate-data preflight finds multiple attendance events for one registration/mode, stop migration rollout and reconcile them with an auditable correction before enforcing uniqueness.
- A failure between ledger insertion and registration update cannot partially commit because both changes run in the same transaction.
- When challenge issuance fails, the QR view shows a retry action and does not display an old challenge as current.
- Pop-up dismissal resumes camera scanning; it does not repeat the previous operation.

## Acceptance Criteria

1. Before attendance acknowledgement, no attendance QR is issued or displayed.
2. After persisted acknowledgement, a challenge can be issued before seminar start and expires exactly at `ends_at + 1 hour`.
3. Applicant UI displays the same challenge continuously while its QR view remains mounted; there is no 30-second timer refresh. Reopening can issue a replacement with the same fixed expiry.
4. Time-In succeeds at seminar start, fails before start, succeeds immediately before seminar end, and fails at seminar end.
5. Time-Out fails before Time-In, succeeds after Time-In through exactly one hour after seminar end, and fails after that deadline.
6. The identical QR payload can successfully record Time-In and then Time-Out once each.
7. Repeating Time-In or Time-Out, including concurrent attempts with different idempotency keys, never creates a second ledger event and returns the explicit already-recorded error.
8. Retrying a successful request with the original idempotency key returns the original success and does not append a ledger row.
9. Manual and webinar-proof attendance cannot create duplicate Time-In/Time-Out ledger events for the same registration.
10. Attendance-duration calculations remain capped to scheduled seminar hours; post-seminar Time-Out grace adds no credit.
11. The scanner presents success and scan-error feedback in a modal; camera submissions are paused while it is open and resume after close.
12. Migrations preserve existing ledger history, and duplicate data is surfaced before a uniqueness constraint is applied.
13. Staging verification confirms the intended Supabase project and migration version, and all workflow requests succeed or return the expected policy error.

## The Fool: Evidence and Failure-Mode Review

- **Supported:** The current issue RPC sets a 30-second database expiry; the scan RPC rejects an expired challenge before writing attendance. This explains the `challenge_expired` response.
- **Not established by the supplied capture:** Why the submitted QR was stale at scan time. The capture lacked the scan response's server `Date` header and did not match either pasted issuance payload.
- **Accepted risk:** A longer-lived QR can be copied and replayed until the fixed deadline. Registration binding, server-side window checks, one event per mode, and minimal token retention limit the impact but do not prevent someone holding a copied QR from attempting attendance for that registration.
- **Concurrency risk:** Application checks alone cannot enforce at-most-once under racing scanner requests. The registration lock and unique database invariant are both required.

## Non-Goals

- Changing registration confirmation/cutoff policy.
- Changing the attendance eligibility threshold or scheduled-hours duration calculation.
- Adding email certificate delivery or changing certificate behavior.
- Adding a new REST API, external observability provider, or unrelated scanner redesign.

