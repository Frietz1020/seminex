---
title: Hosting & Deployment
aliases: [Deployment, Vercel, Supabase Deploy]
tags: [architecture, deployment]
updated: 2026-11-27
status: active
---

# Hosting & Deployment

Back to [[Home]] | See also: [[System Overview]], [[Edge Functions]].

## Production Topology

- **Frontend Hosting:** Vercel (static Vite SPA build from `dist/`, configured via `vercel.json`).
  - Rewrites all routes to `/index.html`.
  - Sets `no-cache, no-store, must-revalidate` on `/index.html` and `/sw.js`, and 1-year `immutable` caching on hashed `/assets/*`.
- **Backend & Storage:** Supabase project `davqbdrwsmgwpezqnaoy`.

## Required Environment Variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Vercel / `.env.local` | Supabase project REST/Auth URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vercel / `.env.local` | Supabase anon/publishable client key |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Functions (auto-injected) | Edge Function auth verification and service-role RPC/Storage access |

## Build & Deploy Commands

```bash
# Local development
npm run dev

# Production typecheck + Vite bundle
npm run build

# Lint & Unit Tests
npm run lint
npm test

# Deploy Supabase Edge Functions
npx supabase functions deploy issue-certificate --project-ref davqbdrwsmgwpezqnaoy --yes
npx supabase functions deploy regenerate-certificate --project-ref davqbdrwsmgwpezqnaoy --yes
npx supabase functions deploy upload-webinar-proof --project-ref davqbdrwsmgwpezqnaoy --yes
```

## Hosting-Required Root Files

Only the following root files/folders are needed for hosting & CI:
`index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vercel.json`, `eslint.config.js`, `.env.example`, `.gitattributes`, `.gitignore`, `README.md`, `src/`, `public/`, `supabase/`, `.github/`.

Non-hosting archives (`graphify-out/`, `docs/`, `tmp/`, `SecureBackups/`, local CLI homes) live in `redundant/` (gitignored).
