# Hosting and deployment

purpleroom runs as static frontend assets plus a PHP/SQLite API on Apache hosting. The deployment workflow uses GitHub Actions and FTP/FTPS; server SSH access and a production Node.js process are not required.

For product behaviour, see [app logic](agent/app-logic.md). For local development and codebase conventions, see [AGENTS.md](../AGENTS.md).

## Hosting requirements

- HTTPS and Apache with `.htaccess` rewrites enabled.
- PHP 8.3+ with PDO SQLite. Enable PHP cURL for SMTP (with SMTP/SMTPS and TLS support) and metadata/logo downloads, and DOM for metadata parsing and SVG sanitisation.
- Enable GD for speaker-picture resizing and EXIF for JPEG orientation. GD must support the photo format being imported (PNG/JPEG, optionally WebP/AVIF); generated non-JPEG variants use WebP when available, otherwise PNG. For local-file uploads up to 5 MB, configure `upload_max_filesize` to at least `5M` and `post_max_size` to at least `6M` in the hosting PHP settings. Keep a realistic memory limit (at least 128M recommended); oversized decoding/rotation buffers are rejected before allocation instead of exhausting PHP memory. Do not disable image pixel/size limits to work around failures.
- PHP can write `api/db/`, the SQLite file/sidecars, and private runtime subdirectories. Use appropriate ownership/permissions; avoid world-writable `777` directories.
- Either authenticated SMTP delivery or working host PHP `mail()` delivery. Configure the sender domain's SPF/DKIM with your mail provider and use a permitted/verified sender address.
- A document root containing the built frontend and `api/`. Direct access to database files, config, libraries, and routes must remain denied.

## Speaker social previews (Shareable)

Public `/u/{username}` pages are rewritten through PHP to add crawler-readable metadata to the built `index.html`; all other frontend pages remain static. Keep the public `.htaccess` speaker rewrite and the deployed root `index.html` together. Development Vite middleware mirrors this using the isolated/local PHP server. No production Node process or external JavaScript library is needed.

Speaker image metadata uses `https://shareable.nico.dev/render`. Run that Shareable instance and include the exact configured `APP_BASE_URL` origin in its `ALLOWED_HOSTS`; it must be able to reach the public profile and its images over HTTPS without authentication. The hosted instance cannot reach a developer's localhost. Test a published profile at `/u/{username}#render-shareable` at 1200×630 (or 1200×600 for the current Shareable Twitter renderer), then follow its `og:image` URL. Do not send private toolkit URLs or credentials to Shareable. Speaker settings loads the published image, reports render/host failures and can force regeneration with `rebuild=true`.

Each explicit publication/update changes the image cache version. Shareable and social platforms can retain old images after unpublishing: source pages stop exposing profile data, but those external caches are not revoked by purpleroom. Do not promise immediate deletion of third-party preview caches.

## GitHub configuration

[The workflow](../.github/workflows/deploy.yml) deploys on pushes to `main` or manual **Run workflow**. Configure these repository **Actions variables** (not secrets):

| Variable | Purpose |
| --- | --- |
| `APP_BASE_URL` | Required HTTPS origin, without a path, query, credentials, or fragment. |
| `APP_MAIL_FROM` | Optional sender; defaults to `purpleroom <noreply@nico.dev>`. |
| `SMTP_HOST` | Optional SMTP hostname only, e.g. `smtp.example.com`; do not include a scheme or port. Required together with username/password to enable SMTP. |
| `SMTP_USERNAME` | SMTP authentication username. |

Configure these repository **Actions secrets**:

| Secret | Purpose |
| --- | --- |
| `FTP_SERVER` | FTP hostname, without a URL scheme. |
| `FTP_USERNAME` | FTP account username. |
| `FTP_PASSWORD` | FTP account password. |
| `FTP_DEPLOY_PATH` | App document root relative to the FTP account; must end with `/`. |
| `APP_SETUP_KEY` | Optional unique secret of at least 32 characters, used only for first-admin setup. |
| `SMTP_PASSWORD` | SMTP authentication password or provider app password. |
| `SMTP_PORT` | Optional port, default `587` for `tls`, `465` for `ssl`. |
| `SMTP_ENCRYPTION` | Optional `tls` for required STARTTLS (default), or `ssl` for implicit TLS. Plaintext SMTP is not supported. |

Default transport is explicit FTPS on port 21 with strict certificate verification. Optional Actions variables `FTP_PROTOCOL` (`ftps`, `ftps-legacy`, or `ftp`) and `FTP_PORT` can match the host. Prefer encrypted FTPS; plain FTP exposes credentials and files in transit.

The deployed origin and FTP destination come from configuration, not the repository name. Do not change them simply because branding changes.

### Email delivery

Set `SMTP_HOST`, `SMTP_USERNAME`, and `SMTP_PASSWORD` to use your SMTP provider. Port 587 with `SMTP_ENCRYPTION=tls` is the default; for implicit TLS on port 465 set `SMTP_ENCRYPTION=ssl`. Set `APP_MAIL_FROM` to a sender your provider allows. PHP cURL handles authentication and TLS with certificate/hostname verification and bounded timeouts; no Composer installation is required on the server.

If no SMTP settings are set, sign-in emails use PHP `mail()`. Partial or invalid SMTP settings fail configuration generation before upload. A delivery failure after deployment is logged safely and does **not** cause an automatic downgrade to PHP mail or unencrypted SMTP. Removing all SMTP variables and secrets and redeploying explicitly restores the PHP transport.

Emails contain a selectable six-digit sign-in code in branded HTML and a plain-text alternative, not an authentication link; neither format loads remote images. Codes expire after 15 minutes and work only in the browser request that issued them. Local development displays codes without sending mail, even if SMTP is configured. For manual local configuration, use the commented `smtp_*` keys in `api/config.example.php`. An optional locally configured `smtp_ca_file` can trust a private CA bundle; TLS verification must remain enabled.

## What a deployment does

The workflow pins the hosted runner to **Ubuntu 24.04**, avoiding automatic `ubuntu-latest` operating-system transitions. Checkout, Node setup, pnpm setup, and FTP deployment use releases that declare **Node 24** as their action runtime. This is separate from the application's build runtime, which remains **Node 22** with the pnpm version pinned in `package.json`. Review action/runtime and runner-image upgrades deliberately; do not suppress deprecation warnings by allowing obsolete runtimes.

1. Installs locked dependencies with pnpm and builds the React frontend, injecting the checked-out commit's short hash as `VITE_APP_VERSION`. The footer displays `version: dev-HASH` (or `version: dev-local` for local builds without metadata); it identifies the deployed frontend, not the latest remote commit after deployment.
2. Stages the frontend output and PHP API, including Apache protection files and SQL migrations; excludes runtime data, local config, and the development router.
3. Generates `api/config.local.php` from `APP_*` and `SMTP_*` variables and secrets, with production mode forced on. Invalid required settings stop deployment before upload.
4. Uploads incrementally through `SamKirkland/FTP-Deploy-Action`, with deployments serialised and `dangerous-clean-slate` disabled.
5. Removes the generated config from the runner, including on failure.

**GitHub Actions variables and secrets are the source of truth for production config. Each deployment overwrites manual edits to the server config.** Changing a variable or secret alone does not change the host until the workflow deploys again. Secrets must never enter frontend bundles, uploaded artifacts, or logs. The workflow builds/deploys; run the documented test suites before releasing changes.

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
- Migration 005 adds directly owned, optionally talk-linked submissions for “Topic to be agreed”. It rebuilds the submissions table transactionally, backfills owners, and retains IDs, statuses, dates, and legacy fields. Back up the database before deployment; no manual SQL or server CLI step is required.
- Migration 006 adds optional private submission notes. Existing rows start with empty notes; all other fields are retained.
- Migration 007 adds conference topic tags, initialising existing conferences to an empty tag list without changing their other data.
- Migration 008 adds hashed, request-bound login codes and attempt counts without changing accounts or existing tokens. Already-issued email/CLI links remain usable; new public requests send codes instead.
- Migration 009 rebuilds users with non-reusable IDs and conferences/editions with nullable creator attribution, retaining all existing IDs, values, and relationships. It also adds a durable account-file cleanup queue. The migration runner disables foreign-key enforcement only on its connection before taking the transaction lock, validates the full foreign-key graph before commit, and always restores enforcement. Take a consistent backup before upgrading; normal API requests apply the migration without server CLI access.
- Migration 010 adds nullable IANA date timezones, CFP closing times/server-derived UTC instants, and private submission timezone metadata without changing existing dates. Existing deadlines show “Timezone not set” and keep their previous UTC calendar-date behaviour until an admin configures them. New forms default to the browser timezone and 23:59 closing; verify a saved deadline's local time/zone and open/closed state after upgrading. Keep PHP/browser timezone data current; do not backfill old records with the deploying user's timezone.
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

Owner-confirmed account deletion removes personal database content and invalidates sessions/tokens while preserving the shared catalog. Associated profile-image files and historical invitation payloads are removed after commit; if removal fails, `account_deletion_files` retains only their relative paths for bounded retry on normal API requests (not `/health`). Keep storage permissions writable and investigate safe “account file cleanup pending” log messages. Never purge the entire avatar/invitation directory or shared key to resolve one account's cleanup. Backups remain subject to your retention policy; if restoring an older backup, account for deletions made since that backup before reopening the site.

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
| Sign-in code never arrives | Selected SMTP/PHP transport, SMTP host/port/encryption/credentials, certificate trust, allowed sender/SPF/DKIM, spam filtering, request rate limits, and suspension status. Redeploy after changing settings. |
| Code rejected | Use the newest email's code in the browser/tab that requested it. Codes expire after 15 minutes and lock after five wrong guesses; request a new one. |
| Setup still enabled after secret removal | Run a new deployment; changing the secret alone does not rewrite server config. |
| Logo/avatar import fails | PHP cURL/DOM, image validity/size, reachable public URL, and logo/avatar-storage permissions. Failed imports leave the corresponding catalog/profile data unchanged. |

Do not enable public PHP error display, expose tokens/config, switch production to development mode, or delete/reinitialise the database as a troubleshooting shortcut.
