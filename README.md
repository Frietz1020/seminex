# Seminex

Seminex manages seminar events at CCS Gordon College. This repository contains student, organization member, and adviser front ends. Supabase is the app's data backend. Missing or partial Supabase configuration stops authenticated data flows with a configuration error.

## Stack

- Vite, React 19, TypeScript
- Tailwind CSS 4
- React Router 7
- vite-plugin-pwa for the service worker and installability
- Supabase Auth and Postgres schemas for identity, seminars, registrations, attendance, webinar proofs, and evaluations

## Requirements

- Node.js 20 or newer (LTS recommended)
- Git

## Getting started

```bash
git clone <repository-url>
cd seminex
npm install
npm run dev
```

Open the local address printed in the terminal.

For local, staging, and production setup and safe Supabase migration commands, see [Environment and deployment guide](docs/ENVIRONMENTS.md).

## Local Supabase

The repository includes a local Supabase project for backend development. It uses Docker and does not connect to a hosted project.

```bash
npm install
npx supabase start
npx supabase db reset
```

The local Auth email is captured by Mailpit at `http://127.0.0.1:54324`. Signup and recovery templates contain six-digit codes for their OTP flows. For the frontend Auth adapter, copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the local publishable key printed by `npx supabase status`. These browser variables are public project values; never put a service-role key in Vite variables.

Local Supabase starts without demo accounts or organization/seminar records. Create test identities through the local Auth and application flows. SQL tests create their own temporary fixtures.

The migrations create profiles, organizations, organization memberships, access requests, seminars, registrations, attendance records, webinar proof records, evaluation data, and certificate issuance records with row-level security and narrowly scoped database functions. Certificate eligibility is enforced by the database using validated Time-Out, the seminar's configured attendance threshold (60% by default), and completed evaluation. Evaluation submission creates one idempotent issuance record and serial; an authenticated Edge Function renders a PDF from the snapshotted template and stores it in a private bucket. Students and active organization members download issued PDFs through short-lived signed URLs. Certificate delivery is in-app only; no certificate email is sent. Ticket PDF generation and the adviser override request/decision flow are not connected to Supabase.

Seminar covers use the public `seminar-covers` Storage bucket. PNG, JPEG, and WebP files up to 5 MiB are supported. Cover files become publicly readable immediately after upload, including before a draft is published. Upload and deletion policies require an active organization officer and a matching unpublished draft in that organization. Definite draft-save failures attempt to remove the new upload; if cleanup fails, the editor reports that the public object may remain. A network failure has an unknown save result, so the editor keeps the object and asks the user to reload before retrying.

Apply pending migrations to the local database without resetting its data, then run the focused Storage policy test:

```bash
npx supabase migration up --local
npx supabase test db supabase/tests/seminar_covers.test.sql
```

`npx supabase db reset` drops local database data. Use it only when a local reset is intended.

Reset local data and reapply migrations and seeds with:

```bash
npx supabase db reset
```

Run the SQL authorization tests with:

```bash
npx supabase test db
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create a production build in `dist` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest tests |

GitHub Actions runs these checks and starts a fresh local Supabase stack for database tests. The database job uses the pinned CLI and synthetic local data; it does not connect to a hosted Supabase project or require Supabase secrets.

## Project structure

- `src/app` - app root, routes, session guard
- `src/api` - Supabase API client, offline read caches, shared types
- `src/components` - shared UI, shell (sidebar, top bar, bottom nav), auth layout
- `src/features` - screens grouped by feature
- `src/config.ts` - app-wide constants
- `public` - static assets and icons

## Data

Components call `src/api/client.ts`, which routes to Supabase adapters. Set both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; missing or partial settings fail closed. Attendance acknowledgement is persisted by a database function. Ticket reads are scoped to the signed-in student's registration and profile. Lifecycle time comes from the database clock. Ticket PDFs are generated in the browser from the ticket, profile, and seminar data. Certificate eligibility, issuance identity, serial assignment, and template snapshot are database-owned. The `issue-certificate` Edge Function renders and stores PDFs privately; eligible students and active organization members download issued PDFs through a 60-second signed URL. Evaluation submission remains saved if PDF generation fails, and students can retry generation from the certificate download action. Certificates are delivered in-app only. Adviser management is connected; certificate override requests and decisions are not. Time-dependent screens remain unavailable until the app receives a valid server-time sample.

Offline, students can read cached Supabase seminars, tickets, and profiles, and can edit evaluation drafts. The app shell is precached. Registration, cancellation, attendance acknowledgement/scanning, password reset, and webinar proof upload/review require a connection and are never queued. Organization identity, seminar listings, rosters, and attendance ledgers use read-only caches. Local cache data is not a separate seminar database and does not sync writes while offline.

## Contributing

1. Pull the latest `main`.
2. Create a branch: `feat/<short-name>` or `fix/<short-name>`.
3. Make one focused change per commit, with a plain-language commit message.
4. Push the branch and open a pull request into `main`.
5. Merge after review, then delete the branch.
