---
title: System Overview
aliases: [Architecture, Tech Stack]
tags: [architecture, seminex]
updated: 2026-11-27
status: active
---

# System Overview

Back to [[Home]].

## Tech Stack

| Layer | Technology | Version / Notes |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | React 19.3, TS 5.9, Vite 8.3 |
| Styling | Tailwind CSS v4 + `@tailwindcss/vite` | Warm maroon-and-cream academic theme (`#7A1C1C` / `#FAF8F5`) |
| Routing | `react-router-dom` | v7.18, route-level `React.lazy` code splitting |
| Icons & Fonts | `@material-symbols/svg-400`, `@fontsource/outfit`, `@fontsource/dm-sans` | 16 Google Fonts loaded for Certificate Designer |
| PWA & QR | `vite-plugin-pwa`, `qrcode.react`, `jsqr`, `jspdf` | Pre-cached app shell, client-side QR rendering & fallback decoding |
| Backend / DB | Supabase (PostgreSQL 17, PostgREST, GoTrue, Storage) | Row-Level Security + `SECURITY DEFINER` RPCs |
| Edge Runtime | Supabase Edge Functions (Deno) | `resvg-wasm`, `pdf-lib`, `@jsquash/webp`, `pngjs` |
| Hosting | Vercel (SPA) + Supabase Cloud | Project ref: `davqbdrwsmgwpezqnaoy` |

## Three Portals, One Application

1. **Student Portal** (`/home`, `/seminars`, `/my-seminars`, `/history`, `/profile`):
   - Accessible to `participant` and `org_member` roles (org officers are also students).
   - Handles seminar discovery, registration, confirmation, live QR admission tickets, multi-page evaluations, and e-certificate downloads.
2. **Organization Portal** (`/org/*`):
   - Accessible strictly to active `org_member` officers (signed in via 9-digit Student ID).
   - Handles 4-step seminar authoring, cover cropping, certificate template design, GForms-style evaluation builder, live QR check-in scanner, webinar proof review, and multi-format exports.
3. **Faculty Adviser Portal** (`/org/adviser/*`, sign-in at `/admin/sign-in`):
   - Accessible strictly to `adviser` role (faculty email sign-in).
   - Read-only oversight of seminars and audit logs, plus write authority over officer access requests and organization memberships.

## Related Notes
- [[Security & Access Control]]
- [[Server Clock & Offline Strategy]]
- [[Hosting & Deployment]]
- [[Routing & Portals]]
