# Seminex

Seminex manages academic seminars, live QR attendance, anonymous evaluations, and verifiable e-certificates for the College of Computer Studies (CCS) at Gordon College. This repository contains the **Student**, **Organization**, and **Faculty Adviser** portals backed by Supabase and deployed as a Vite PWA on Vercel.

> [!NOTE]
> Full system architecture, workflows, SQL schemas, RPC functions, Edge Functions, and frontend references are maintained in the **Obsidian Vault** at [`obsidian-vault/`](obsidian-vault/00-MOC/Home.md). Open `obsidian-vault/` directly in Obsidian to explore the linked knowledge graph.

## Stack

- **Frontend:** Vite 8, React 19, TypeScript 5.9, Tailwind CSS 4, React Router 7
- **PWA & Utilities:** `vite-plugin-pwa`, `@material-symbols/svg-400`, `qrcode.react`, `jsqr`, `jspdf`, zero-dependency `.csv`/`.md`/`.xlsx` table exporter
- **Backend:** Supabase (PostgreSQL 17, GoTrue Auth, Row-Level Security, Storage, and Deno Edge Functions)
- **Hosting:** Vercel (SPA) + Supabase Cloud

## Requirements

- Node.js 20 or newer (LTS recommended)
- Git
- Docker (only required if running local Supabase)

## Getting Started (Staging Mode)

By default, connect to the **staging** Supabase environment using Vite's `staging` mode:

1. Clone and install dependencies:

   ```bash
   git clone <repository-url>
   cd seminex
   npm install
   ```

2. Create `.env.staging.local` from `.env.example` and populate the staging Supabase credentials:

   ```bash
   cp .env.example .env.staging.local
   ```

   ```env
   VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
   ```

   > These browser variables are public project values; never put a `service_role` key in Vite variables. Missing or partial configuration fails closed.

3. Start the development server in **staging mode**:

   ```bash
   npm run dev -- --mode staging
   ```

4. Build or preview in **staging mode**:

   ```bash
   npm run build -- --mode staging
   npm run preview -- --mode staging
   ```

For environment and deployment details, see [`obsidian-vault/01-Architecture/Hosting & Deployment.md`](obsidian-vault/01-Architecture/Hosting%20%26%20Deployment.md).

## Local Supabase (Optional)

The repository also includes a local Supabase stack under `supabase/` for offline backend development and SQL authorization tests:

```bash
npx supabase start
npx supabase migration up --local
npx supabase test db
```

- Local Mailpit inbox for 6-digit Auth OTP codes: `http://127.0.0.1:54324`
- For local mode, copy `.env.example` to `.env.local` with `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the local publishable key from `npx supabase status`, then run `npm run dev`.
- Use `npx supabase db reset` only when you intentionally want to wipe local data and re-apply all migrations and seeds.

### Deploying Edge Functions

Seminex uses three Deno Edge Functions (`issue-certificate`, `regenerate-certificate`, `upload-webinar-proof`):

```bash
npx supabase functions deploy issue-certificate --project-ref <project-ref> --yes
npx supabase functions deploy regenerate-certificate --project-ref <project-ref> --yes
npx supabase functions deploy upload-webinar-proof --project-ref <project-ref> --yes
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev -- --mode staging` | Start the Vite dev server against `.env.staging.local` |
| `npm run dev` | Start the Vite dev server against `.env.local` |
| `npm run build -- --mode staging` | Type-check and build `dist/` using staging env |
| `npm run build` | Type-check and build `dist/` for production |
| `npm run preview` | Preview the built bundle locally |
| `npm run lint` | Run ESLint across `src/` |
| `npm test` | Run Vitest unit tests |

## Project Structure

- `src/app` — App entry, lazy-loaded portal routes, session & role guards
- `src/api` — Supabase API adapters, offline read caches, shared domain types
- `src/components` — Shared UI primitives, Student & Org shells, auth layouts
- `src/features` — Feature screens (`home`, `seminars`, `evaluation`, `history`, `profile`, `org`, `admin`, `auth`, `guidelines`, `legal`)
- `src/hooks` — Shared monotonic `serverClock`, `useNow`, `useResource`, `useOnlineStatus`, `useSidebarCollapsed`
- `src/session` — Session storage, `ProfileProvider`, `OrgIdentityProvider`
- `src/shared` — Multi-format table export utility (`.csv`, `.md`, `.xlsx`)
- `supabase/` — 21 SQL migrations, RLS policies, triggers, and 3 Deno Edge Functions
- `obsidian-vault/` — Complete Obsidian documentation vault (architecture, workflows, schemas, RPCs, APIs)
- `public/` — Static assets and PWA icons

## Core Architecture & Data Guarantees

- **Authoritative Server Time:** Lifecycle transitions, confirmation windows, scan windows, and QR expiry are anchored to Postgres `get_server_time` via a shared monotonic clock (`src/hooks/serverClock.ts`) with sleep/resume recovery and zero local wall-clock fallback.
- **Role-Scoped Portals:** Student Portal (`participant`, `org_member`), Organization Portal (`org_member`, Student ID sign-in), and Faculty Adviser Portal (`adviser`, institutional email sign-in) are enforced both in routing and Postgres RLS.
- **Verifiable Certificates:** Submitting an evaluation creates an idempotent `SNX-...` issuance record and immediately invokes `issue-certificate` to render and store a private PDF (downloaded via 60-second signed URLs).
- **Offline Support:** The PWA shell is precached and read-only caches keep saved seminars, tickets, and profiles accessible offline; state-changing actions require connectivity and are never silently queued.

## Contributing

1. Pull the latest `main`.
2. Create a branch: `feat/<short-name>` or `fix/<short-name>`.
3. Make focused commits with clear, plain-language messages.
4. Run `npm run build` and `npm run lint` before opening a pull request into `main`.
5. Merge after review, then delete the branch.
