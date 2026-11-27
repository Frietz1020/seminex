---
title: Server Clock & Offline Strategy
aliases: [Server Clock, Offline Cache, PWA]
tags: [architecture, frontend, performance]
updated: 2026-11-27
status: active
---

# Server Clock & Offline Strategy

Back to [[Home]] | See also: [[System Overview]], [[Hooks, Session & UI System]].

## Authoritative Server Clock (`src/hooks/serverClock.ts`)

> [!important] Security Invariant
> Seminex **never** falls back to `Date.now()` as a clock value when unanchored. `useNow()` remains `null` until Postgres `get_server_time` returns a valid ISO timestamp.

### How It Works
- **Single Deduplicated Anchor:** All `useNow()` hooks share one singleton store in `src/hooks/serverClock.ts`. Concurrent mounts trigger **1** `get_server_time` RPC.
- **Monotonic Local Ticking:** Once anchored with NTP midpoint (`syncedPerfMs = reqStartPerf + rtt/2`, `syncedWallMs = Date.now() - rtt/2`), `getEstimatedServerNow()` advances locally via `serverEpochMs + (performance.now() - syncedPerfMs)` with **zero RPCs per tick**.
- **Sleep/Suspend Protection:** `Date.now()` is used *strictly* to detect OS sleep jumps (`|wallElapsed - perfElapsed| > 5_000ms`). On jump detection, the anchor is invalidated (`null`) so stale timestamps are never returned and a deduplicated resync fires immediately.
- **Resync & Backoff Cadence:**
  - Unanchored boot failure: retries at `1s → 2s → 5s → 15s → 30s` and immediately on `window` `online`.
  - Anchored steady state: background drift resync every **5 minutes** (`DRIFT_RESYNC_MS = 300_000`) and on `visibilitychange` when stale (`> 30s`).
  - All listeners and timers tear down automatically when subscriber count hits `0`.

## PWA & Offline Caching

- **App Shell (`vite.config.ts`):** `vite-plugin-pwa` (Workbox) precaches static assets (`js`, `css`, `html`, `svg`, `png`, `woff2`) with `navigateFallback: '/index.html'`. No runtime API caching in Workbox.
- **Structured Offline Cache (`src/api/offlineCache.ts` & `src/api/orgOfflineCache.ts`):**
  - Caches profile, seminar listings, and active tickets per Student ID so students can view saved details offline.
  - `prefetchTickets()` in `src/api/client.ts` short-circuits when all registered tickets are already cached and deduplicates its 60s server-time lookup.
  - Ephemeral QR challenges (`SEMINEX1:...`) are **never** cached offline; live attendance scanning requires connectivity.
