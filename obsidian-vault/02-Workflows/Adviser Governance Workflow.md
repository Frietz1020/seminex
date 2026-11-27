---
title: Adviser Governance Workflow
aliases: [Adviser Portal, Admin Portal, Approvals]
tags: [workflow, security, adviser]
updated: 2026-11-27
status: active
---

# Adviser Governance Workflow

Back to [[Home]] | See also: [[Security & Access Control]], [[Routing & Portals]], [[RPC Functions & Triggers]].

## Capabilities (`/org/adviser/*`)

Faculty Advisers sign in at `/admin/sign-in` and operate strictly inside the `/org/adviser/*` route tree:

1. **Access Requests (`/org/adviser/requests` — `OrganizationApprovalsPage.tsx`):**
   - Reviews pending student officer applications (`list_adviser_org_requests`).
   - Approves or rejects requests (`decide_adviser_org_request`), granting active `org_member` membership on approval.
2. **Organization Members (`/org/adviser/members` — `AdminMembersPage.tsx`):**
   - Lists active officers (`list_adviser_org_members`).
   - Updates officer positions (`update_adviser_member_position`) or removes memberships (`remove_adviser_member`).
3. **Seminars Oversight (`/org/adviser/seminars` — `AdminSeminarsPage.tsx`):**
   - Strictly read-only view of all organization seminars with multi-format table export (`.csv`, `.md`, `.xlsx` via `ExportMenu.tsx`).
4. **Audit Log (`/org/adviser/audit-log` — `AdminAuditLogPage.tsx`):**
   - Chronological activity log with filtering and multi-format table export.
5. **Adviser Profile (`/org/adviser/profile` — `AdminProfilePage.tsx`):**
   - Institutional adviser identity details and sign-out.
