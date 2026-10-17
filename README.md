# Green Room

A private backstage room for a small crew of conference speakers. React 18, TypeScript, Vite, Tailwind v4, and a dependency-free PHP/SQLite API. No demo sign-in or fabricated conference data.

## Run locally

Requires Node 22.12+, pnpm 11.1.1, and PHP 8.3+ with PDO SQLite. PHP cURL and DOM enable best-effort conference metadata fetching.

```bash
pnpm install
pnpm dev
```

**One command starts both servers:** Vite at `http://localhost:5173` and PHP at `127.0.0.1:8000`. Vite proxies `/api`, so browser requests stay same-origin. Migrations run automatically. Ctrl+C stops both processes.

In another terminal, create the first member and print a one-use login URL:

```bash
GREEN_ROOM_ENV=dev php api/db/seed.php "Nico" nico@example.com
```

Open the printed URL. Future logins use the email form; in development it shows the magic link, without sending email. Invite friends from **The crew**. No content is automatically seeded.

To customize configuration, copy `api/config.example.php` to `api/config.local.php`. This ignored local file overrides defaults. Set `base_url` if you change the Vite port. Never use `env => dev` on a public deployment.

## UI architecture

- `src/theme/`: reusable, business-logic-free UI primitives, always exported through `src/theme/index.ts`. Includes the design template's buttons, fields, checkboxes, segmented control, tag pills, status chips, deadline badges, avatar stacks, logo tiles, cards, and list rows, plus navigation, dialogs, and feedback components.
- `src/index.css`: the design system's **named Tailwind colour tokens**, font families, and light/dark overrides. Nunito headings stay at 600; Nunito Sans handles body copy; JetBrains Mono handles dates/countdowns. Fonts load from Google Fonts, with local fallbacks.
- `src/components/`: domain-specific forms, submissions, reviews, and discussions.
- `src/pages/`: routed views. `src/hooks/`: small fetch/mutation/session hooks.
- `api/`: PHP front controller, route modules, prepared SQLite queries, native sessions, hashed single-use tokens, and an iCalendar feed.

### Browser appearance preference

Use the theme icon in the header to cycle **System → Light → Dark**, or choose directly in **Settings → Set the mood**. The same control is available on sign-in and setup screens. System is the default and follows OS changes automatically; an explicit choice overrides the OS preference.

The choice is stored only in a host-only `gr_theme` cookie (`Path=/`, `SameSite=Lax`, one-year lifetime, `Secure` on HTTPS). It survives reloads and sign-out on that browser but is not written to your account, database, or local storage. Other browsers keep their own preferences. `public/color-scheme.js` applies the cookie before the app renders to prevent a flash of the wrong theme, and picks up other-tab changes when the window regains focus.

## Checks

```bash
pnpm build
pnpm lint
pnpm format
pnpm test:api
pnpm test:deploy
pnpm exec playwright install chromium
pnpm test:ui
```

API tests use an isolated temporary SQLite database and PHP on port 8018. Browser tests use isolated temporary data, PHP on 8019 and Vite on 5179, without interrupting the usual dev server. They exercise first-user web setup, login, talks, conferences, reviews, editions, submissions, attendance, comments, mobile layout, and profile saving. Screenshots and traces go to ignored `test-results/`.

## Deploy to cyon

### GitHub Actions (FTP/FTPS)

`.github/workflows/deploy.yml` builds with pnpm and uploads Vite's `dist/` contents plus the PHP `api/` directory on pushes to `main` or manual **Run workflow**. It does not use Matomo or `repository_dispatch`.

Configure these repository **Actions secrets**:

| Secret | Value |
| --- | --- |
| `FTP_SERVER` | FTP hostname, without a URL scheme |
| `FTP_USERNAME` | FTP account username |
| `FTP_PASSWORD` | FTP account password |
| `FTP_DEPLOY_PATH` | App document root relative to the FTP account, ending in `/`, e.g. `public_html/green-room/` |
| `APP_BASE_URL` | Required production HTTPS origin, e.g. `https://greenroom.nico.dev` |
| `APP_MAIL_FROM` | Optional sender, defaults to `Green Room <noreply@nico.dev>` |
| `APP_SETUP_KEY` | Optional unique random secret of at least 32 characters; set only for first-user setup |

The workflow defaults to **explicit FTPS on port 21**, with strict certificate verification. Optional repository **Actions variables** `FTP_PROTOCOL` (`ftps`, `ftps-legacy`, or `ftp`) and `FTP_PORT` can match your host's requirements. Prefer encrypted FTPS; plain FTP exposes credentials and application files in transit.

Only production files are staged, including Apache `.htaccess` files. The live `api/db/db.sqlite*` and `api/db/sessions/` are excluded from both upload and deletion. Do not enable the action's `dangerous-clean-slate` option. Deployments are serialized to avoid overlapping uploads.

After the frontend build, the workflow generates **`api/config.local.php` from the `APP_*` secrets**, forces production mode, and uploads it with the backend. GitHub secrets are the source of truth: **each deployment replaces manual server config changes**. Local config files from the checkout are never copied. Invalid or missing required settings fail the deployment before upload. Secrets are confined to this PHP config, not frontend bundles, build logs, or uploaded CI artifacts; the runner's generated file is removed afterward. Apache denies web access to the config.

Deleting `APP_SETUP_KEY` and redeploying writes `setup_key => null`, explicitly disabling web setup. The workflow does not change the database path or session storage. If your existing config contains other custom settings, account for those before switching to this generated config.

**FTP cannot run PHP commands.** For a first installation without SSH, use the one-time web setup below. Existing installations still need `php api/db/migrate.php` when migrations change; the web installer cannot migrate an existing crew. No deployment has been run merely by adding this workflow.

### First installation without command-line access

1. Configure the FTP and `APP_BASE_URL` GitHub secrets above.
2. Generate a unique random secret (preferably 64 characters) with a password manager and store it as `APP_SETUP_KEY`. Do not use an example password or put it in Git, a URL, or a support message.
3. Deploy the latest frontend and API files using GitHub Actions. The workflow generates and uploads the production config automatically.
4. Make `api/db/` writable by the PHP process using the hosting panel's ownership/permissions controls. If `db.sqlite` already exists, it must also be writable. Avoid world-writable (`777`) permissions.
5. Open **https://greenroom.nico.dev/setup**. Enter your setup key, your name, and your email (for example `mail@nico.dev`). This creates the schema and first user and signs you in immediately, without sending email.
6. Delete `APP_SETUP_KEY` from GitHub secrets and redeploy; changing secrets alone does not update the server. The setup endpoint also refuses all further bootstraps as soon as any user exists, even if you forget to remove the key. Future members join via invites.

Setup is disabled by default, requires the same CSRF header as other writes, checks the secret before accessing the database, and uses a write transaction to prevent concurrent bootstraps. It does not reset or overwrite existing data. It can also create the first user when the schema exists but no users have been added yet.

If setup succeeds but future sign-in emails do not arrive, check PHP `mail()` delivery and the sender domain's SPF/DKIM in your hosting panel. Keep the production `base_url` set to your actual domain so magic links and calendar URLs point to the right site.

### Troubleshooting API errors

The JSON `server_error` response means PHP received the request but encountered a server-side exception. Check the hosting panel's PHP error log for the exact cause; stack traces and database details are intentionally not exposed to visitors.

- `setup_required` (503): database tables are missing. Use `/setup` for a new installation, or apply pending migrations for an existing one.
- `database_unavailable` (503): enable **PDO SQLite / pdo_sqlite** for the site's PHP version.
- `storage_unavailable` (503): PHP cannot open/write SQLite. Check `api/db/` and database ownership/permissions. SQLite needs directory write access for WAL sidecar files as well.
- Other 500 errors: inspect the PHP error log, including session-directory permissions and mail errors. Do not enable public PHP error display or switch production to dev mode to troubleshoot.

### Manual SSH deployment and server setup

1. Configure the subdomain's document root, PHP 8.3+, PDO SQLite, Apache rewrites, and HTTPS.
2. Set `DEPLOY_HOST` (and optionally `DEPLOY_DEST`) and run `bash deploy.sh`.
3. On the server, create an ignored `api/config.local.php` with `env => production`, `base_url => https://greenroom.nico.dev`, and the desired `mail_from`.
4. Ensure PHP can write `api/db/` and `api/db/sessions/`. These paths are blocked by Apache. Sessions live in this protected directory to support 180-day sessions on shared hosting.
5. Run `php api/db/seed.php "Nico" nico@example.com` over SSH, then open the link.
6. Configure SPF/DKIM for cyon's outgoing mail service. Magic links use PHP `mail()` in production.

Deployment preserves the live database, SQLite sidecar files, sessions, and local config. It builds static assets, uploads frontend and API separately, and runs CLI migrations. No Node process is needed in production.

Verify after deployment:

```bash
curl -I https://greenroom.nico.dev/api/db/db.sqlite
curl -I https://greenroom.nico.dev/api/config.local.php
curl https://greenroom.nico.dev/api/me
```

The first two must return **403**; the third must return **401 JSON** when signed out. Check `/talks` loads the SPA directly. Test real magic-link mail delivery and a calendar subscription on the deployed host.

## Privacy and security

Papers, notes, and abstract overrides are owner-only. Shared submissions expose public member data, title (unless hidden), and status—never abstracts. Shared entities are soft-deleted; private talk deletion is permanent and confirms first. Writes require the `X-Requested-With: green-room` header. Production sessions use Secure/HttpOnly/SameSite=Lax cookies; Secure is disabled only for local HTTP development.

Metadata fetching rejects private/reserved addresses, pins DNS using cURL, does not follow redirects, and limits response size and time. Metadata is best-effort; fields always remain editable.
