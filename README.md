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
- `src/index.css`: the design system's **named Tailwind colour tokens**, font families, and system dark-mode overrides. Nunito headings stay at 600; Nunito Sans handles body copy; JetBrains Mono handles dates/countdowns. Fonts load from Google Fonts, with local fallbacks.
- `src/components/`: domain-specific forms, submissions, reviews, and discussions.
- `src/pages/`: routed views. `src/hooks/`: small fetch/mutation/session hooks.
- `api/`: PHP front controller, route modules, prepared SQLite queries, native sessions, hashed single-use tokens, and an iCalendar feed.

## Checks

```bash
pnpm build
pnpm lint
pnpm format
pnpm test:api
pnpm exec playwright install chromium
pnpm test:ui
```

API tests use an isolated temporary SQLite database and PHP on port 8018. Browser tests use isolated temporary data, PHP on 8000 and Vite on 5179; stop the usual dev command first. They exercise login, talks, conferences, reviews, editions, submissions, attendance, comments, mobile layout, and profile saving. Screenshots and traces go to ignored `test-results/`.

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

The workflow defaults to **explicit FTPS on port 21**, with strict certificate verification. Optional repository **Actions variables** `FTP_PROTOCOL` (`ftps`, `ftps-legacy`, or `ftp`) and `FTP_PORT` can match your host's requirements. Prefer encrypted FTPS; plain FTP exposes credentials and application files in transit.

Only production files are staged, including Apache `.htaccess` files. The live `api/db/db.sqlite*`, `api/db/sessions/`, and `api/config.local.php` are excluded from both upload and deletion. Do not enable the action's `dangerous-clean-slate` option. Deployments are serialized to avoid overlapping uploads.

**FTP cannot run PHP commands.** On the first deployment and whenever migrations change, run `php api/db/migrate.php` in the deployed directory over SSH. Create the production config and bootstrap the first user using the setup steps below. No deployment has been run merely by adding this workflow.

### Manual SSH deployment and server setup

1. Configure the subdomain's document root, PHP 8.3+, PDO SQLite, Apache rewrites, and HTTPS.
2. Set `DEPLOY_HOST` (and optionally `DEPLOY_DEST`) and run `bash deploy.sh`.
3. On the server, create an ignored `api/config.local.php` with `env => production`, `base_url => https://green-room.nico.dev`, and the desired `mail_from`.
4. Ensure PHP can write `api/db/` and `api/db/sessions/`. These paths are blocked by Apache. Sessions live in this protected directory to support 180-day sessions on shared hosting.
5. Run `php api/db/seed.php "Nico" nico@example.com` over SSH, then open the link.
6. Configure SPF/DKIM for cyon's outgoing mail service. Magic links use PHP `mail()` in production.

Deployment preserves the live database, SQLite sidecar files, sessions, and local config. It builds static assets, uploads frontend and API separately, and runs CLI migrations. No Node process is needed in production.

Verify after deployment:

```bash
curl -I https://green-room.nico.dev/api/db/db.sqlite
curl -I https://green-room.nico.dev/api/config.local.php
curl https://green-room.nico.dev/api/me
```

The first two must return **403**; the third must return **401 JSON** when signed out. Check `/talks` loads the SPA directly. Test real magic-link mail delivery and a calendar subscription on the deployed host.

## Privacy and security

Papers, notes, and abstract overrides are owner-only. Shared submissions expose public member data, title (unless hidden), and status—never abstracts. Shared entities are soft-deleted; private talk deletion is permanent and confirms first. Writes require the `X-Requested-With: green-room` header. Production sessions use Secure/HttpOnly/SameSite=Lax cookies; Secure is disabled only for local HTTP development.

Metadata fetching rejects private/reserved addresses, pins DNS using cURL, does not follow redirects, and limits response size and time. Metadata is best-effort; fields always remain editable.
