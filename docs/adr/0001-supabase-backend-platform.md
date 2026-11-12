# ADR-0001: Use Supabase as the Backend Platform

> Historical decision record. The decision remains accepted, but the context below describes the project when this ADR was written. Current implementation and hosted-environment status are maintained in [the API contract](../api-contract.md) and [environment guide](../ENVIRONMENTS.md).

## Status

Accepted

## Context

At the time of this decision, Seminex was a client-only Vite PWA with mock APIs and no backend. It needed relational seminar and registration data, role-aware access for students and organizations, OTP email, file storage, atomic registration and attendance writes, and certificate generation.

## Decision

Use Supabase Postgres, Auth, and Storage as the backend platform. Use the Supabase JavaScript client in the Vite app with Row Level Security on exposed tables. Keep authorization data in server-controlled profile and organization-membership records. Do not trust client-side role state for data access.

Use Postgres functions for atomic, data-intensive actions such as registration capacity checks and attendance ledger transitions. Use Supabase Edge Functions for external integrations and certificate generation. Keep schema migrations, local configuration, and seed data versioned with Supabase CLI.

Use Supabase Auth email OTP templates for the locked OTP entry flow. Configure a hosted SMTP provider before sending OTPs to student mailboxes. Certificate delivery is in-app only; SMTP is not used for certificate delivery.

## Alternatives Considered

- **Custom Express backend with Supabase Postgres:** Rejected for initial implementation because it adds a separately operated server and duplicates capabilities available in Supabase Auth, Postgres functions, RLS, Storage, and Edge Functions.
- **HttpOnly-cookie backend-for-frontend:** Rejected for the current Vite PWA because it adds a custom session service. The Supabase browser client stores its session in browser storage; RLS remains the authorization boundary.
- **Direct table access for every mutation:** Rejected for capacity and attendance transitions because those writes need transactional checks and server-owned timestamps.

## Consequences

### Positive

- One managed platform provides Postgres, authentication, file storage, and server-side functions.
- RLS applies authorization at the database boundary for browser requests.
- SQL functions can make capacity and scan updates atomic.
- Supabase CLI supports reproducible local development and versioned migrations.

### Negative

- RLS policies and database grants need explicit tests for each role and operation.
- Browser Auth sessions persist outside httpOnly cookies; XSS prevention and restrictive RLS remain important.
- OTP delivery to real users requires custom SMTP configuration.
- The project must avoid using service-role credentials in browser code.

### Neutral

- Approved domain rules informed the schema and transition constraints. Hosted SMTP remains unconfigured per the current project record; webinar proof upload and review are implemented. See the current environment guide for evidence and deployment limits.
- No production schema or hosted project is created by this decision record.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase JavaScript Auth](https://supabase.com/docs/reference/javascript/auth)
- [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development/cli-workflows)
