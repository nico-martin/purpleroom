# Hosting and deployment

purpleroom runs as static frontend assets plus a PHP/SQLite API on Apache hosting. The deployment workflow uses GitHub Actions and FTP/FTPS; server SSH access and a production Node.js process are not required.

For product behaviour, see [app logic](agent/app-logic.md). For local development and codebase conventions, see [AGENTS.md](../AGENTS.md).

## Hosting requirements

- HTTPS and Apache with `.htaccess` rewrites enabled.
- PHP 8.3+ with PDO SQLite. Enable PHP cURL for metadata/logo downloads and DOM for metadata parsing and SVG sanitisation.
- PHP can write `api/db/`, the SQLite file/sidecars, and private runtime subdirectories. Use appropriate ownership/permissions; avoid world-writable `777` directories.
- Working PHP `mail()` delivery, with sender-domain SPF/DKIM configured in the hosting panel.
- A document root containing the built frontend and `api/`. Direct access to database files, config, libraries, and routes must remain denied.

## GitHub configuration

[The workflow](../.github/workflows/deploy.yml) deploys on pushes to `main` or manual **Run workflow**. Configure repository Actions secrets:

| Secret | Purpose |
| --- | --- |
| `FTP_SERVER` | FTP hostname, without a URL scheme. |
| `FTP_USERNAME` | FTP account username. |
| `FTP_PASSWORD` | FTP account password. |
| `FTP_DEPLOY_PATH` | App document root relative to the FTP account; must end with `/`. |
| `APP_BASE_URL` | Required HTTPS origin, without a path, query, credentials, or fragment. |
| `APP_MAIL_FROM` | Optional sender; defaults to `purpleroom <noreply@nico.dev>`. |
| `APP_SETUP_KEY` | Optional unique secret of at least 32 characters, used only for first-admin setup. |

Default transport is explicit FTPS on port 21 with strict certificate verification. Optional Actions variables `FTP_PROTOCOL` (`ftps`, `ftps-legacy`, or `ftp`) and `FTP_PORT` can match the host. Prefer encrypted FTPS; plain FTP exposes credentials and files in transit.

The deployed origin and FTP destination come from configuration, not the repository name. Do not change them simply because branding changes.

## What a deployment does

1. Installs locked dependencies with pnpm and builds the React frontend, injecting the checked-out commit's short hash as `VITE_APP_VERSION`. The footer displays this build identifier; it identifies the deployed frontend, not the latest remote commit after deployment.
2. Stages the frontend output and PHP API, including Apache protection files and SQL migrations; excludes runtime data, local config, and the development router.
3. Generates `api/config.local.php` from `APP_*` secrets, with production mode forced on. Invalid required settings stop deployment before upload.
4. Uploads incrementally through `SamKirkland/FTP-Deploy-Action`, with deployments serialised and `dangerous-clean-slate` disabled.
5. Removes the generated config from the runner, including on failure.

**GitHub secrets are the source of truth for production config. Each deployment overwrites manual edits to the server config.** Changing a secret alone does not change the host until the workflow deploys again. Secrets must never enter frontend bundles, uploaded artifacts, or logs. The workflow builds/deploys; run the documented test suites before releasing changes.

## First installation without server CLI access

1. Configure HTTPS, the document root, PHP extensions, FTP secrets, and `APP_BASE_URL`.
2. Generate a strong unique setup secret (preferably 64 random characters) and store it as `APP_SETUP_KEY`. Never put it in Git, a URL, or a support message.
3. Deploy the app and ensure PHP can write its private runtime storage.
4. Open `/setup` on the configured origin. Enter the setup key, display name, and email. Setup applies the schema/migrations, creates the first **admin**, and signs that account in without requiring email delivery.
5. Delete `APP_SETUP_KEY` from repository secrets and redeploy. This explicitly disables setup in the generated production config.
6. Verify real sign-in email delivery and new-member signup. Subsequent members join through verified email and are not admins.

Setup defaults to disabled, checks its secret before database access, uses a write lock, and permanently refuses another bootstrap once any user exists. It does not reset existing data. Initialise the intended admin before inviting people to use a fresh site; normal public signup is never an admin bootstrap.

## Existing installations and upgrades

**Take a consistent SQLite backup and back up private runtime storage before schema-changing deployments.** A host-supported database backup or SQLite-consistent backup is preferable to copying only an actively written database file and ignoring its WAL.

Initialised databases apply bundled numbered migrations automatically on the next normal API request. A write lock and migration ledger prevent concurrent duplicate application. `/health` does not run migrations and cannot verify that an upgrade completed. An uninitialised database still requires setup. There is no public migration endpoint and no server CLI step.

- Migration 002 adds edition titles and backfills all editions, including deleted ones, without changing IDs.
- Migration 003 adds roles and social relationships. It promotes only the **existing `mail@nico.dev` account** to admin; verify that account mapping before deploying the upgrade. All other accounts remain members and no friendships are created automatically.
- Migration 004 adds homepage/social profile fields without rewriting existing account data. Remote profile images migrate into local avatar storage on the next profile save, not during the schema migration.
- Historical data remains stored even when its feature is retired. Existing invitation and calendar URLs no longer provide functionality.
- Rollback planning must account for the database schema as well as uploaded files; restoring an older frontend alone does not undo a migration.

## Runtime data and backups

The workflow excludes these paths from upload/deletion:

| Path | Contents |
| --- | --- |
| `api/db/db.sqlite*` | Live database and SQLite sidecars. |
| `api/db/sessions/` | Private PHP sessions. |
| `api/db/logos/` | Validated, locally stored conference logos. |
| `api/db/avatars/` | Validated, locally stored member profile images. |
| `api/db/invite-links/` | Retained historical encrypted invitation payloads and `key.bin`. |

Include the full historical invitation directory, including its key, in backups; never replace that key during deployment. Runtime directories are not committed or bundled. Apache blocks direct access to them. Conference logos and profile images are served through authenticated API routes, not directly from storage. Avatar serving additionally enforces member visibility, blocking, and suspension.

Local `api/config.local.php` is never copied from the checkout. Production receives the separately generated config. Preserve the workflow's FTP state tracking, exclusion rules, serialised uploads, and strict transport defaults.

## Post-deployment checks

Using your configured origin, verify:

```bash
curl -I https://YOUR_HOST/api/db/db.sqlite
curl -I https://YOUR_HOST/api/config.local.php
curl https://YOUR_HOST/api/me
```

The first two must return **403**. The third must return **401 JSON** without a session. Confirm that a direct SPA deep link such as `/talks` leads to sign-in rather than an Apache error.

Test real email signup/login, required profile completion, initial-admin access, member restrictions, crew requests, friend-scoped plans/reviews, and independent attendance. Verify that old calendar, invitation, and comment routes remain unavailable. Never test against real member data destructively.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `setup_required` (503) | Missing tables: complete protected setup for a fresh installation; inspect migration state for an existing one. |
| `database_unavailable` (503) | PDO SQLite is enabled for the site's PHP version. |
| `storage_unavailable` (503) | Database, `api/db/`, WAL sidecars, and session-directory ownership/write permissions. |
| Generic `server_error` (500) | Hosting-panel PHP logs; database/session errors and extension availability. Details are intentionally not sent to visitors. |
| Email link never arrives | PHP `mail()` delivery, sender/SPF/DKIM, spam filtering, request rate limits, and suspension status. |
| Wrong origin in email links | `APP_BASE_URL`, then redeploy the generated config. |
| Setup still enabled after secret removal | Run a new deployment; changing the secret alone does not rewrite server config. |
| Logo/avatar import fails | PHP cURL/DOM, image validity/size, reachable public URL, and logo/avatar-storage permissions. Failed imports leave the corresponding catalog/profile data unchanged. |

Do not enable public PHP error display, expose tokens/config, switch production to development mode, or delete/reinitialise the database as a troubleshooting shortcut.
