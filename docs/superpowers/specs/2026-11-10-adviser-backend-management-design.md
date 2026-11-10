# Adviser Organization Management Backend Design

## Goal

Replace the five mock-only adviser organization-management operations with Supabase-backed operations. Advisers can review access requests, view the member directory, update an active member's position, remove an active member, and approve or reject a pending request.

## Current context

- `public.organization_memberships` already assigns advisers to organizations through `role = 'adviser'` and `status = 'active'`.
- `public.organization_access_requests` already stores pending and decided requests. Advisers can read requests for their assigned organizations through RLS.
- The membership table currently has a composite key `(organization_id, user_id)`, but no stable membership ID or position and appointment fields required by the adviser directory contract.
- The existing UI already calls all five operations through `src/api/client.ts`. In Supabase mode, those calls currently return `not_available`.
- `src/api/orgMock.ts` defines the expected request and directory behavior and remains the local development adapter.

## Approved architecture

Add one migration with narrow Postgres functions for all five adviser operations. The functions run with a fixed search path, derive the caller from `auth.uid()`, and authorize each operation against an active adviser membership in the target organization. Grant execution only to `authenticated`; keep direct table writes unavailable to browser roles. Read functions return only the fields required by `OrgRequest` and `AdviserDirectoryMember`.

The migration adds a stable UUID membership ID while preserving the unique `(organization_id, user_id)` relationship. It adds the current position, appointment timestamp, and endorsing adviser fields needed for directory reads and membership lifecycle. Existing adviser rows remain read-only directory entries and appear with position `Faculty adviser`. For existing member rows, derive position and endorser from the newest approved access request when available; otherwise use `Member` and null endorser. Preserve existing membership `created_at` as the appointment timestamp and retain each row's active or removed status.

Approval is one database transaction. It locks the pending request, records the decision and adviser, then inserts or reactivates the organization member row with the requested position. Reactivation preserves the membership ID, sets status to active, and refreshes appointment and endorser fields. Rejection records the decision without changing membership. A request for a user who already has an active membership cannot overwrite that membership; approval returns a conflict and leaves the request pending for adviser follow-up.

Position updates apply only to active `org_member` rows. Removal changes an active member's status to `removed`; it never deletes membership history. Neither operation can edit or remove adviser rows. An access request cannot convert an existing adviser membership into an organization-member row; approval returns a conflict and leaves that request pending. Each operation checks organization authorization in the database, including directory reads.

## API and data flow

Keep the existing UI boundary and method signatures in `src/api/client.ts`. Add `src/api/adviser.ts` for the Supabase adapter and route the five operations to it when Supabase mode is active. Keep mock mode on `src/api/orgMock.ts`; align mock approval with the approved reactivation rule.

The five operations are:

1. `listAdviserOrgRequests()` returns the caller's assigned-organization requests, ordered newest first, matching the current array contract.
2. `listAdviserOrgMembers()` returns member and adviser directory entries only for organizations assigned to the caller. Member entries include stable membership ID, organization, profile identity, position, status, and appointment time. Adviser entries are read-only.
3. `decideAdviserOrgRequest(requestId, decision, decisionNote)` accepts only `approved` or `rejected`. It records the authenticated adviser and database decision time. Approval also creates or reactivates membership atomically.
4. `updateAdviserMemberPosition(memberId, position)` trims the position, requires 1–100 characters, and updates an active member in an assigned organization.
5. `removeAdviserMember(memberId)` changes an active member to removed and returns the updated directory entry.

Use these authenticated Postgres RPCs: `list_adviser_org_requests()`, `list_adviser_org_members()`, `decide_adviser_org_request(p_request_id uuid, p_decision text, p_decision_note text)`, `update_adviser_member_position(p_membership_id uuid, p_position text)`, and `remove_adviser_member(p_membership_id uuid)`. The two list RPCs return JSON arrays. Each mutation RPC returns the updated `OrgRequest` or `AdviserDirectoryMember` JSON object. The membership UUID preserves the existing member operation signatures without changing UI callers.

Map missing or out-of-scope records to `not_found` to avoid revealing cross-organization records. Map a signed-in caller without an active adviser assignment to `forbidden`, stale or incompatible state to `conflict`, invalid position input to `validation_failed`, and database/network failures to `network`. Keep response shapes consistent with the existing API types. Do not add pagination or new UI behavior in this slice.

## Security and consistency

- Never trust organization ID, member role, adviser identity, or decision actor from client claims or request payloads.
- Verify active adviser membership for the exact target organization inside each function.
- Lock pending requests and membership rows before state transitions to prevent concurrent approvals and removal/update races.
- Keep database role changes inside the transaction. Do not expose table update grants to `authenticated`.
- Preserve removed rows for audit and allow only a new approved request to reactivate a removed member.
- Do not use service-role credentials or an Edge Function for these operations.

## Verification

Add pgTAP coverage for:

- An assigned active adviser can list only requests and directory entries for assigned organizations.
- Unrelated users, organization members, and removed advisers cannot access or mutate adviser data.
- Approval records the actor and database time and creates membership atomically.
- Approval reactivates an existing removed membership without changing its stable ID.
- Rejection does not create or reactivate membership.
- An already-active membership cannot be overwritten by a pending request decision.
- Concurrent or repeated decisions cannot create duplicate memberships or produce partial request state.
- Position updates accept trimmed values of 1–100 characters and reject invalid values.
- Removal marks an active organization member removed and preserves the row.
- Adviser directory entries cannot be changed or removed through member operations.

Add frontend adapter tests for Supabase RPC selection, DTO mapping, stable error mapping, and mock/Supabase mode routing. Run the focused Vitest tests, local Supabase database tests, lint, and build after implementation. Do not apply migrations to a hosted project as part of this work.

## Out of scope

- Adviser account provisioning or changing which organizations an adviser advises.
- Email notifications for decisions.
- Pagination or search changes to the existing adviser pages.
- Certificate overrides, ticket PDFs, or other production-readiness gaps.
- Hosted Supabase deployment or migration.
