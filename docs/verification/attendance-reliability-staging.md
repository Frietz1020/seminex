# Attendance Reliability Verification

**Date:** 2026-11-16  
**Status:** Local implementation verified; staging deployment pending review and connectivity.

## Local verification

- Local Supabase migrations `20261116000000`, `20261116100000`, `20261116110000`, and `20261116120000` applied to the local `seminex-local` project.
- Focused pgTAP: 152 tests passed across registration rules, scan modes, and webinar attendance.
- Full pgTAP: 353 tests ran. All attendance-related suites passed. Two unrelated existing failures remain:
  - `seminar_covers.test.sql`, test 13: expected no public cover Storage policy, found one.
  - `seminars_rls.test.sql`, test 21: adviser draft query returned `Adviser edit` instead of expected `CCS draft`.
- Focused frontend tests: 38 passed across attendance API mapping, scanner feedback/retry, QR gating, and attendance prompt.
- `npm run build`: passed.
- `npm run lint`: exit 0; 0 errors and 23 warnings across the current workspace.

## Staging target and migration review

- Staging Supabase project ref from `.env.staging.local`: `davqbdrwsmgwpezqnaoy`.
- The publishable key is configured; its value is withheld.
- Remote migration inspection was attempted with the explicit project ref. The Supabase CLI identified the target as `davqbdrwsmgwpezqnaoy` but could not connect because the current network does not support the project's IPv6 database endpoint (`DbConfigIpv6Error`). The dry run therefore could not report the remote migration list.
- No staging migration or other staging write was performed.
- Candidate attendance migrations from this implementation are `20261116000000`, `20261116100000`, `20261116110000`, and `20261116120000`. Confirm the remote ledger and dry-run output before applying; do not assume these are the only pending migrations.

## Pending staging checks

After remote IPv4 database connectivity is available, inspect `supabase migration list --remote=davqbdrwsmgwpezqnaoy` and `supabase db push --dry-run --remote=davqbdrwsmgwpezqnaoy`. Review the exact pending migration list before authorizing a shared staging write. After approval and deployment, use a disposable seminar and accounts to verify late registration, immediate acknowledgement, Time-In, fresh-QR Time-Out, and ledger counts of one for each checkpoint.
