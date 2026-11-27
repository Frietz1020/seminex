---
title: Security & Access Control
aliases: [Security, RLS, Auth Model]
tags: [architecture, security]
updated: 2026-11-27
status: active
---

# Security & Access Control

Back to [[Home]] | See also: [[System Overview]], [[Schema & Tables]], [[RPC Functions & Triggers]].

## Role Matrix

| Role | Sign-In Identifier | Allowed Routes | Data Scope |
| --- | --- | --- | --- |
| `participant` | 9-digit Student ID (`20XXXXXXX`) | Student Portal, `/organization/request-access`, `/organization/request-status` | Own profile, own registrations, own evaluations & certificates |
| `org_member` | 9-digit Student ID (`20XXXXXXX`) | Student Portal + `/org/*` (excluding `/org/adviser/*`) | Active organization's drafts, seminars, rosters, attendance ledger, anonymous evaluation aggregates, certificates |
| `adviser` | Faculty institutional email | `/org/adviser/*` only | Read-only seminars & audit logs; approve/reject `organization_access_requests`; manage `organization_memberships` |

## Defense-in-Depth Guardrails

1. **Database-Enforced Authorization:**
   - Every table has Row-Level Security (RLS) enabled with `revoke all` from `public`/`anon`/`authenticated` where writes must go through `SECURITY DEFINER` RPCs (`set search_path = ''`).
   - Adviser read-only constraints are enforced in SQL (e.g., `20261109010000_adviser_read_only.sql` and `20261122100000_restore_adviser_read_only_seminar_drafts.sql`).
2. **Opaque, Single-Use-Per-Mode QR Attendance Challenges:**
   - QR payloads are strictly `SEMINEX1:<64-hex-chars>` — never a raw Student ID.
   - Stored in `private.registration_scan_challenges` (unreadable by clients).
   - Requires `attendance_ack_at` before issuance, bounded to seminar end + 1 hour, and enforces explicit `time_in` / `time_out` transitions with idempotency keys.
3. **Append-Only & Immutable Audit Trails:**
   - `attendance_ledger` has a `BEFORE UPDATE OR DELETE` trigger (`attendance_ledger_append_only`) preventing tampering.
   - `seminar_survey_versions` and `evaluation_responses` are immutable after insert.
   - `certificate_regeneration_audit` logs every regenerated PDF with actor, request ID, and previous/new object paths.
4. **Anonymous Evaluations:**
   - `get_org_seminar_evaluation` returns randomized/ordered anonymous responses (`20261109020000_anonymous_evaluation_order.sql`) without exposing student identity.
5. **No Local Clock Trust:**
   - Eligibility, confirmation windows, scan windows, and QR expiry rely on Postgres `clock_timestamp()` server-side and `get_server_time` client-side (see [[Server Clock & Offline Strategy]]).
