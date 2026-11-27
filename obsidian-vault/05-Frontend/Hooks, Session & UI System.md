---
title: Hooks, Session & UI System
aliases: [Hooks, UI Components, Design System, Export Utility]
tags: [frontend, architecture]
updated: 2026-11-27
status: active
---

# Hooks, Session & UI System

Back to [[Home]] | See also: [[Routing & Portals]], [[Server Clock & Offline Strategy]], [[API Client Reference]].

## Custom Hooks (`src/hooks/`)

| Hook / Module | Responsibility |
| --- | --- |
| `serverClock.ts` | Shared monotonic authoritative clock singleton (`syncServerClock`, `getEstimatedServerNow`, `checkServerClock`, `subscribeServerClock`, `resetServerClockForTests`) |
| `useNow.ts` | Subscribes to `serverClock` and ticks locally on `intervalMs` (default `30_000`, `15_000` on `AttendancePrompt` & `SeminarPage`) with zero per-tick RPCs |
| `useResource.ts` | Generic async loader with `loading` / `success` / `empty` / `error` states and `reload()` |
| `useOnlineStatus.ts` | Reactive `navigator.onLine` subscription |
| `useSidebarCollapsed.ts` | Persistent desktop sidebar collapse state shared by `AppShell` and `OrgShell` |
| `useCooldown.ts` | Countdown cooldown helper for OTP resend actions |
| `useMediaQuery.ts` | Responsive media query listener |

## Session & Context Providers (`src/session/`)
- `storage.ts` & `useSession.ts`: Session state, `seminex:session-changed` custom event, and `expireSession()`.
- `ProfileProvider.tsx`: Cached student profile context across StudentPortal.
- `OrgIdentityProvider.tsx`: Active officer/adviser organization identity context across OrgShell.
- `privateData.ts`: Clears sensitive per-user local/offline caches on sign-out.

## Design System & Shared Utilities
- **Theme (`src/styles/index.css`):** Warm maroon (`#7A1C1C`) and cream (`#FAF8F5`) Tailwind v4 tokens (`surface-card`, `surface-container-low`, `border-subtle`, `primary`, `status-available`, `danger`).
- **Icons (`src/components/ui/Icon.tsx` & `icons.ts`):** Unified Material Symbols (`@material-symbols/svg-400`); `lucide-react` completely removed.
- **Core UI Primitives (`src/components/ui/`):** `Button`, `Dialog`, `BottomSheet`, `Alert`, `Toast`, `Tabs`, `SegmentedControl`, `ProgressBar`, `StatusBadge`, `Avatar`, `ExportMenu`, `TextField`, `PasswordField`, `SelectField`, `StateMessage`, `ErrorSummary`.
- **Multi-Format Table Exporter (`src/shared/exportTable.ts` + `ExportMenu.tsx`):** Zero-dependency client-side export to UTF-8 `.csv`, Markdown `.md`, and OOXML `.xlsx` (used in `OrgHistoryPage`, `OrgSeminarDetailsPage`, `AdminSeminarsPage`, and `AdminAuditLogPage`).
