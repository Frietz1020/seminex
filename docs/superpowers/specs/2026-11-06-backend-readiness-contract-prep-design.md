# Backend Readiness Contract Preparation

## Goal

Prepare Seminex's frontend API contract for a future backend without building a backend. Keep `src/api/client.ts` as the only API module imported by UI components. Keep mock behavior inside `src/api` and label it `MOCK`.

## Current constraints

- Preserve current product decisions and offline behavior.
- Do not choose any business rule currently marked `Business rule, needs confirmation.`
- Keep server authorization and lifecycle decisions authoritative in the future backend.
- Keep existing mock outcomes available.
- Do not add dependencies or change route URLs.

## Proposed changes

### 1. Cookie-compatible session contract

Separate browser-safe session identity from mock credentials. Add `api.getSession()` to read the current server session and return role, organization IDs, and expiry without returning a bearer token. Real sign-in endpoints will establish an httpOnly cookie; the mock may continue storing its local session for offline operation.

Make session bootstrap asynchronous in route guards. Keep the last known identity locally for offline shell access. Treat cached identity as an offline display aid only; online mutations still require server authorization. Document sign-out behavior when offline.

### 2. Separate seminar queries

Replace the overloaded `listSeminars()` contract with explicit `listAvailableSeminars(query)` and `listMySeminars(query)` operations. Keep `listHistory()` for finished registrations. Update callers and offline cache handling so the catalog is never mistaken for the student's registered list.

Use a shared paginated response with `items`, `nextCursor`, and `hasMore`. Query options support cursor, page size, text search, and operation-specific filters. Apply the same pagination shape to org roster, ledger, proof, certificate, and adviser list operations.

### 3. Gate webinar access data

Remove `joinUrl` from the general seminar response type. Add an access operation whose response contains `canJoin` and an optional `joinUrl`. Return the link only for a confirmed registration during the approved join window. Keep eligibility computation in the server contract; the mock mirrors it for UI development.

### 4. Define structured errors

Extend `ApiError` with optional field errors and retry delay metadata while preserving stable error codes. Add specific user-facing copy for every `ApiErrorCode`. Keep mock failures compatible with the expanded shape.

### 5. Make organization sign-up one operation

Keep one `api.orgSignUp()` request and define its success response as account creation plus organization request creation. A failed request must not leave a partial account. Implement mock-only transactional behavior or a rollback path inside `src/api`; do not expose a second call to the UI.

## Business rules left open

The seven existing `Business rule, needs confirmation.` decisions remain unresolved and stay marked in code and contract documentation. This work must not turn mock assumptions into approved backend policy.

## Validation

- Add or update unit tests for session bootstrap state, list separation and pagination, join-link eligibility, error metadata/copy, and atomic mock organization sign-up.
- Run `npm test`, `npm run lint`, and `npm run build` after implementation.
- Review the final diff before completion.

## Out of scope

- Backend services, database schema, migrations, or real cookie transport.
- Changing the Student ID QR decision.
- Resolving the seven unconfirmed business rules.
- New routes, dependencies, or unrelated refactors.
