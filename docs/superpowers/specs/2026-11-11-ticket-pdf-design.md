# Ticket PDF Design

## Status

Approved by the user on 2026-11-11. This design covers the existing student ticket download action only.

## Context

`SeminarHeader` exposes a Download PDF action. `api.getTicketPdf(seminarId)` currently resolves to the mock implementation, which always returns `not_available`. The ticket screen already displays seminar details, applicant identity, registration reference, and a QR code. The QR payload intentionally contains the applicant's Student ID; the scanner maps it to the applicant's profile and records time-in/time-out against the seminar registration.

## Goal

Generate and download a one-page PDF ticket for the signed-in applicant's active seminar registration.

## User flow

1. The applicant opens a seminar for which they have an active registration.
2. The applicant selects **Download PDF**.
3. Seminex loads the applicant's authorized ticket and profile plus the seminar and registration details.
4. Seminex generates and downloads one PDF file. On failure, the existing header displays an actionable error and does not report success.

## PDF contents

Use one A4 portrait page. Include:

- Seminar title, date, time range, and venue.
- Applicant's displayed name and Student ID.
- Registration reference.
- A high-contrast QR code with a quiet zone. Encode the same Student ID as the on-screen ticket QR.

Name the file `seminex-<seminar-reference>-ticket.pdf`, with filename characters sanitized for the host operating system. Do not include email addresses, access tokens, private storage paths, or certificate data.

## Architecture

- Keep the public API operation `api.getTicketPdf(seminarId): Promise<ApiResult<Blob>>`.
- Implement the operation at the API boundary. It gathers the existing `getTicket`, `getProfile`, and `getSeminar` results, returns the first authorization or data error, and passes validated data to a focused PDF generator module.
- Generate the PDF in the browser with jsPDF. Use the existing QR implementation (`qrcode.react`) and rasterize its SVG at high resolution for embedding. Do not add a second QR-code package.
- Return the PDF as a Blob. The header downloads it with a stable sanitized filename and keeps its loading, session-expiry, and error states accurate.
- Update `docs/api-contract.md` to describe the actual PDF behavior and failures.

## Security and privacy

- Use the existing caller-scoped ticket read. Supabase ticket lookup filters by the authenticated user; never use a service-role key or a new public endpoint.
- Generate the file in the browser. Do not store it in Supabase Storage, send it by email, or cache the PDF or a signed URL.
- The Student-ID QR is a product decision, not a secret or authentication token. Preserve its current payload and let the existing scanner enforce registration and attendance rules.
- Escape or render seminar/profile text through the PDF library's text API; do not inject it as raw HTML.

## Failure behavior

- Preserve the API error result for expired sessions, missing registrations, network failures, and configuration failures.
- Treat missing or malformed ticket/profile/seminar data as a failure; do not create a partial ticket.
- If QR rasterization or PDF generation fails, show a recoverable error and do not trigger a download.
- Keep the existing online/offline ticket-read behavior. Generate from available authorized data; if required data is unavailable offline, explain that the ticket PDF could not be prepared and leave the on-screen QR available.

## Verification requirements

- Add focused tests before implementation. Observe each new test fail for the intended missing behavior.
- Verify generated Blob MIME type is `application/pdf`, the document contains the required text, and its embedded QR encodes the exact Student ID.
- Verify the API does not generate a document when ticket, profile, or seminar lookup fails.
- Verify the header downloads the Blob with a sanitized filename, preserves session-expiry handling, and displays generation errors.
- Run focused tests, lint, and build after implementation; perform a browser check that the PDF opens and its QR scans to the Student ID.

## Non-goals

- Changing QR payload or attendance scanner rules.
- Sending ticket or certificate emails.
- Adding Supabase tables, migrations, Edge Functions, or Storage objects.
- Implementing certificate override requests or decisions.
- Configuring staging SMTP or deploying hosted code.
