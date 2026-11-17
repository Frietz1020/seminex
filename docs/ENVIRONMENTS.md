# Environment and Deployment Guide

## Selected frontend host

Vercel is the selected repository configuration target for the static Vite PWA. `vercel.json` provides SPA fallback and cache headers for the HTML shell, service worker, and content-hashed assets. The Vercel account, production domain, DNS, and named release owner are still unconfirmed; do not configure or deploy hosting until those are recorded and authorized.

## Rollback and recovery runbook

- **Frontend:** redeploy the previously approved Vercel build and verify the app shell and critical routes.
- **Edge Functions:** redeploy the previously approved versions of `upload-webinar-proof` and `issue-certificate` to the same project.
- **Database:** migrations are forward-only by default. For each migration, prepare and review a forward-fix; use a down script only when it is demonstrably safe and preserves user data.
- **Backup restore:** restore only into an isolated scratch Supabase project. Verify database rows, Auth users, and Storage objects before recording the restore as successful. This repository has no evidence of a completed restore drill.
- **Release order:** capture a backup, apply reviewed migrations, deploy functions, then deploy the frontend. Smoke test the deployed version and retain the prior frontend and function versions for rollback.

Alerts for OTP delivery, registration, attendance, and certificate issuance must be configured in the hosted services before production; this repository does not establish that alerts are active.

This guide separates local development from hosted staging and production. It records the state known from the workspace and project chats on 2026-11-12. Dashboard status, CLI flags, and provider limits can change; recheck them before acting.

## Recorded environment status

| Environment or service | Recorded state | Evidence and limits |
| --- | --- | --- |
| Local app | Vite app requires both public Supabase settings. Missing or partial settings fail closed. | See the commands below. |
| Local Supabase | Configured in `supabase/config.toml` with project ID `seminex-local`, local Auth, local database, and Mailpit on `127.0.0.1:54324`. | This stack is separate from hosted projects. `npx supabase stop` stops only the local containers. |
| Production Supabase | A project chat records a CLI run against `Seminex-CS · production` that applied 11 migrations; the latest was `adviser_management`. A later screenshot showed Healthy on Nano. | Historical user-provided evidence, not a live status check. Do not infer frontend deployment from database migration status. |
| Production backup | The user reports that a database backup was saved locally. | Backup contents, secure retention, inclusion of Auth users and Storage objects, and restore verification are not confirmed here. |
| Staging Supabase | A separate staging project was discussed and its setup was being followed. | Project reference, migration state, and end-to-end smoke-test result are not recorded as verified. Confirm the project name and ref in Dashboard before each remote CLI operation. |
| Auth SMTP | Custom SMTP has not been configured, per the user's latest message. | Hosted OTP delivery is therefore not verified. Supabase's built-in sender is restricted to project team addresses and currently two messages per hour; see [Supabase SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp). |
| Certificate email | Not used. | Certificates are delivered in-app only. SMTP is for Auth OTP and recovery messages. |
| Hosted Edge Functions | Deployment status is not recorded for staging or production. | Applying database migrations does not establish that `upload-webinar-proof` or `issue-certificate` was deployed. |
| GitHub integration / frontend hosting | Not confirmed in the project chats reviewed. | The repository has a Git remote and a CI workflow, but neither proves Supabase GitHub integration or a deployed frontend. `npm run build` creates local files in `dist`; it does not deploy them. |

## Local development

Run PowerShell in the repository root (`C:\Users\Frietz\Documents\seminex`). Docker Desktop must be running for local Supabase.

```powershell
npm install
npx supabase start
npx supabase status
npm run dev
```

For the Supabase-backed frontend, copy `.env.example` to ignored `.env.local`. Set `VITE_SUPABASE_URL` to `http://127.0.0.1:54321` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the local publishable key printed by `npx supabase status`. Do not put a service-role key in any `VITE_` variable.

Local Auth emails appear in Mailpit at `http://127.0.0.1:54324`. Local resets do not create demo accounts, organizations, or seminar records. Create test identities through the local Auth and application flows.

Stop processes when finished:

```powershell
# Stop the Vite process in its terminal with Ctrl+C.
npx supabase stop
```

`npx supabase stop` stops local containers and preserves local data. `npx supabase db reset` deletes local database data, then reapplies migrations and seed data; use it only when a local reset is intended. It is not a hosted-project recovery command.

## Staging frontend settings

Create ignored `.env.staging.local` containing only the staging project's public URL and publishable key:

```dotenv
VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
```

Start the Vite app with that mode:

```powershell
npm run dev -- --mode staging
```

Vite mode selection changes which local environment file is read. It does not deploy the frontend or change a Supabase database. Keep service-role keys and SMTP passwords out of Vite variables and Git.

## Apply migrations to staging

Use the staging project reference copied from the staging Dashboard URL or Project Settings. Supabase CLI 3 targets local by default, so every hosted database command below uses an explicit `--remote=<ref>` target. First inspect migrations:

```powershell
$stagingRef = "<staging-project-ref>"

npx supabase login
npx supabase migration list --remote=$stagingRef
npx supabase db push --dry-run --remote=$stagingRef
```

Check the command's `Target:` line and every pending migration. Stop if the target is not staging or the migration list is unexpected. `--dry-run` makes no database changes.

After review, apply the migrations interactively:

```powershell
npx supabase db push --remote=$stagingRef
```

Review the target and migration list again at the CLI confirmation. Do not add `--yes` for a manual run; that bypasses the confirmation prompt. Never run `db reset --remote` against a hosted project.

Deploy the Edge Functions from this checkout only after reviewing their code and confirming staging is the target:

```powershell
npx supabase functions deploy upload-webinar-proof --remote=$stagingRef
npx supabase functions deploy issue-certificate --remote=$stagingRef
```

Then run staging smoke checks for signup and OTP, seminar registration, confirmation, attendance acknowledgement and scanning, webinar proof upload/review, evaluation submission, in-app certificate issue/download, ticket PDF download, and adviser membership management. Adviser certificate override requests and decisions remain a known Supabase gap and should not be counted as a passing flow.

## Configure hosted Auth SMTP

Hosted signup and recovery OTPs require a working email sender. Custom SMTP has not been configured according to the latest project update. In the staging project's Supabase Dashboard, open **Authentication → Email → SMTP Settings**, enable custom SMTP, and enter the values supplied by the chosen provider: sender address and name, SMTP host, port, username, and password. Save, send one staging OTP, and inspect **Logs → Auth** if it fails. Do not store provider credentials in this repository. Email is for authentication codes only; certificates and other deliverables remain in-app only.

## Production change procedure

The production project has already received migrations according to the project chat. Before any later production change:

1. Confirm the local migrations match the reviewed release and staging has passed its smoke checks.
2. Confirm a current, restorable production backup. The locally reported backup has not been restore-tested in this guide.
3. Set an explicit production ref and inspect it with a dry run:

   ```powershell
   $productionRef = "<production-project-ref>"
   npx supabase migration list --remote=$productionRef
   npx supabase db push --dry-run --remote=$productionRef
   ```

4. Stop if the target or migration list is unexpected. Apply only after reviewing the production plan and obtaining the production owner's go-ahead:

   ```powershell
   npx supabase db push --remote=$productionRef
   ```

5. Deploy required Edge Functions to the same explicit project ref, then verify project logs and the relevant app flows.

Do not push the current working tree wholesale: it contains unrelated uncommitted and untracked application files. Review `git status --short`, stage only reviewed files, and never use `git add .` as a shortcut for this checkout.

## Related references

- [Supabase local and hosted workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase CLI v3 migration changes](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3)
- [Supabase environments and deployment](https://supabase.com/docs/guides/deployment)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
