# Local Seminar Data Design

## Goal

Replace synthetic seminar fixtures in the browser's mock mode with user-created seminar data saved in IndexedDB, while retaining the sample sign-in accounts and keeping Supabase mode authoritative when configured.

## Current State

- `src/api/mockData.ts` generates sample seminars and student registrations.
- `src/api/mockStore.ts` builds shared student and organization seminar records at module load.
- `src/api/orgMockData.ts` generates sample organization seminars, rosters, attendance, surveys, certificate records, and related content.
- `src/api/orgMock.ts` publishes seminars into the in-memory shared store. Most seminar-domain changes disappear after a page reload.
- Mock profiles and some access/request data are stored in `localStorage`; the sample account definitions are separate from seminar fixtures.
- `src/api/client.ts` selects mock or Supabase adapters. Supabase-backed data must not be redirected through the local store.

## Chosen Architecture

Use IndexedDB as the durable store for seminar-domain data only when `getSupabaseMode()` is `mock`. Supabase mode continues to use existing Supabase adapters as its sole source of truth. The app never silently merges, imports, or falls back between IndexedDB and Supabase.

The local store is shared by the student and organization mock portals in the same browser origin. It persists user-authored drafts and published seminars, registrations, rosters, attendance ledger events, webinar proof blobs and metadata, survey definitions and responses, certificate templates and issuance records, and other records whose identity or lifecycle is tied to a seminar. Existing account, organization, adviser, and sample access fixtures remain in code. No sample seminar or sample seminar activity is inserted into a new local store.

New drafts may contain only the empty editable structures required by the existing editors. They must not include fabricated seminar details, example survey questions, sample attendees, attendance scans, evaluation responses, or certificate issuance records. A sample participant has no pre-existing registration or ticket; the participant can register for a real seminar created in local mode.

## Persistence and Failure Behavior

- Store data under a versioned IndexedDB schema with explicit upgrade handling.
- Provide a user-triggered, versioned JSON export/import for the local seminar store. The backup includes seminar-domain records and attached binary assets, but excludes account fixtures, passwords, sessions, keys, and signed URLs.
- Validate the entire import before replacing data. Show that import replaces all local seminar data, require explicit confirmation, then apply the replacement atomically. Do not merge with Supabase or silently merge two local backups.
- Hydrate the local seminar store before mock API reads or writes that depend on it.
- Persist a successful mutation before returning success to the UI. Use transactions or rollback so a quota, blocked database, or write error cannot make an unsaved mutation look committed.
- Validate records read from IndexedDB. Invalid or unsupported persisted data must fail safely with a recoverable error and must not be treated as a successful empty save.
- Store binary user content as IndexedDB Blobs where applicable; do not persist temporary `blob:` object URLs.
- Make export and import available only in mock mode to organization users with existing organization access. Explain that the downloaded file is the user's responsibility to protect.
- Existing volatile mock seminar state is not durable and cannot be reliably migrated after a reload. The new store starts without synthetic records. Account and access fixtures remain available.

## Behavior Boundaries

- Local/mock mode data belongs to this browser profile and is not shared across devices or synchronized to Supabase.
- Supabase mode reads and writes remain unchanged and use Supabase as the canonical source.
- Sample accounts remain usable in local/mock mode. They are not provisioned into production by this change.
- Empty student and organization screens are expected until a local user creates and publishes seminar data.
- Local export/import can move a backup between browser profiles; it does not sync records or write to Supabase.
- No database migrations, hosted-project changes, or service-role browser access are part of this design.

## Security and Data Integrity

- Keep credentials, Supabase keys, and session tokens out of IndexedDB seminar records.
- Retain existing mock role and organization checks before exposing or changing organization-owned records.
- Key participant registrations and attendance by the existing student and seminar identifiers; never infer the student from user-editable profile text.
- Treat local browser storage as local development data, not as an authorization boundary or a substitute for Supabase RLS.
- Surface storage failure to the user; do not silently fall back to volatile memory for a save.

## Acceptance Criteria

1. A new mock-mode browser profile shows no synthetic seminars, registrations, roster entries, scans, responses, or certificate issuance records.
2. Existing sample student, organization, and adviser sign-in accounts remain available.
3. A local organization account can create, save, publish, and edit seminar content; the student portal sees the published seminar and its correct registration state.
4. Local registrations, tickets, roster, scans, webinar proof, evaluation data, and certificate-template/issuance records remain consistent across both portals and after a full page reload.
5. Failed IndexedDB writes do not return success or leave only a misleading in-memory change.
6. An export contains the current local seminar data and assets but no account credentials, session tokens, Supabase keys, or signed URLs.
7. Import rejects malformed, unsupported, or oversized data without changing existing records; a valid confirmed import replaces all local seminar data atomically.
8. With Supabase configuration enabled, API reads and writes continue to use Supabase only; IndexedDB local records do not appear in Supabase mode, and backup controls are not offered.
9. The README and local environment/API documentation describe the local persistence boundary, backup procedure, import replacement behavior, and data-clearing implications.

## Out of Scope

- Syncing local data to hosted Supabase or importing local data into staging/production.
- Removing sample identities or organization access fixtures.
- Changing Supabase schema, migrations, RLS, hosted Auth, or production records.
- Cloud backup or automatic cross-device synchronization.
