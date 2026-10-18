# purpleroom

Named in homage to CSS `rebeccapurple` (`#663399`). Repository: `git@github.com:nico-martin/purpleroom.git`.

The rename preserves existing storage, sessions, invitation encryption, calendar UIDs, `GREEN_ROOM_*` environment variables, and internal browser/request identifiers. The current production hostname and deployment destination are unchanged; set `APP_BASE_URL` and `FTP_DEPLOY_PATH` in GitHub when moving to a new domain. Set `APP_MAIL_FROM` if an existing secret still uses the old sender name.

A members-only social platform for conference speakers: private proposals, personal crews, manual attendance, and friends-only speaker reviews. React 18, TypeScript, Vite, Tailwind v4, and a dependency-free PHP/SQLite API. No demo sign-in or fabricated conference data. Product rules are recorded in [`app-locig-social.md`](app-locig-social.md), which supersedes the original flat-group specification.

## Social platform and migration

- Anyone can request an email sign-in link. The account is created only after verification, and a display name is required before directory listing. All content requires login.
- **Members** manage their own profiles, proposals, submissions, attendance, and crew. **Admins** additionally manage conferences, editions, trash, roles, and suspensions. Admins cannot read other members' private proposals or submission statuses.
- **The crew** has My crew, All members, Requests, and Blocked views. Requests can be accepted/declined/cancelled; crossed requests accept instantly. Unfriend/block revoke access. Requests are in-app only.
- Attendance is explicitly Going/Maybe/none on each edition and is never inferred from CFP outcomes.
- Friends may see who submitted, but never proposal content, individual submission totals, or outcomes. Every status except `interested` qualifies; each friend counts once.
- Reviews, tags, and review aggregates are scoped to the viewer and their accepted friends.
- Calendar subscriptions, signup invitations, and “Notes from the crew” comments are disabled, including their API routes. Historical data and storage remain intact.
- Signup mail is limited to five requests per email/hour and 30 per IP/hour; crew sends to 30/member/hour. Limits are stored as hashed keys in SQLite. Production never returns development sign-in links.

**Back up the live SQLite database and protected runtime directories before deployment.** Migration `003_social.sql` runs automatically on an initialized installation's next API request, preserving existing records and IDs. Only the existing account with email **`mail@nico.dev`** becomes admin; all others remain members. Verify that this account exists before deployment. There is no automatic first-public-signup promotion and no automatic friendship between existing users. Fresh installations still use protected `/setup` to create the initial admin.

Admins use **Manage members** to promote/demote, suspend, and restore access. The last active admin cannot be demoted/suspended. Suspension invalidates all prior sessions (even after restoration) and hides social data while preserving friendships and records. Blocking hides both members from each other's directory; unblocking does not restore friendship. Proposals retain the owner's read access to submissions linked to deleted catalog items.

## Run locally

Requires Node 22.12+, pnpm 11.1.1, and PHP 8.3+ with PDO SQLite. PHP cURL and DOM enable best-effort conference metadata fetching.

```bash
pnpm install
pnpm dev
```

**One command starts both servers:** Vite at `http://localhost:5173` and PHP at `127.0.0.1:8000`. Vite proxies `/api`, so browser requests stay same-origin. Migrations run automatically. Ctrl+C stops both processes.

In another terminal, create the first member and print a one-use login URL:

```bash
GREEN_ROOM_ENV=dev php api/db/seed.php "Nico" mail@nico.dev
```

Open the printed URL. Future logins and signups use the email form; in development it shows the magic link without sending email. Connect with members from **The crew → All members**. No conference content is automatically seeded.

To customize configuration, copy `api/config.example.php` to `api/config.local.php`. This ignored local file overrides defaults. Set `base_url` if you change the Vite port. Never use `env => dev` on a public deployment.

## UI architecture

- `src/theme/`: reusable, business-logic-free UI primitives, always exported through `src/theme/index.ts`. Includes the design template's buttons, fields, checkboxes, segmented control, tag pills, status chips, deadline badges, avatar stacks, logo tiles, cards, and list rows, plus navigation, dialogs, and feedback components.
- `src/index.css`: the design system's **named Tailwind colour tokens**, font families, and light/dark overrides. Nunito headings stay at 600; Nunito Sans handles body copy; JetBrains Mono handles dates/countdowns. Fonts load from Google Fonts, with local fallbacks.
- `src/components/`: domain-specific forms, submissions, reviews, crew actions, and onboarding.
- `src/pages/`: routed views. `src/hooks/`: small fetch/mutation/session hooks.
- `api/`: PHP front controller, role/privacy-aware route modules, prepared SQLite queries, native sessions, and hashed single-use email tokens.

### Browser appearance preference

Use the theme icon in the header to cycle **System → Light → Dark**, or choose directly in **Settings → Set the mood**. The same control is available on sign-in and setup screens. System is the default and follows OS changes automatically; an explicit choice overrides the OS preference.

The choice is stored only in a host-only `gr_theme` cookie (`Path=/`, `SameSite=Lax`, one-year lifetime, `Secure` on HTTPS). It survives reloads and sign-out on that browser but is not written to your account, database, or local storage. Other browsers keep their own preferences. `public/color-scheme.js` applies the cookie before the app renders to prevent a flash of the wrong theme, and picks up other-tab changes when the window regains focus.

### Edition titles and same-year editions

Each edition has its own **Edition title**, separate from its parent **Conference** and date range. Selecting a conference prefills its name; admins can change it to e.g. **“JSNation Berlin 26”**. Titles are displayed exactly as entered—no year is appended automatically. Custom titles are preserved when switching the selected conference or changing dates. There is no one-edition-per-year restriction: dates, submissions, and attendance remain tied to each edition's independent ID. Reviews remain at the conference level, visible only to the author and friends.

There is **no separate Year input**. First/last-day fields provide the calendar year, and date displays include it where useful. When starting from a previous edition, location/links can be reused, but dates are left for you to enter. Calendar event UIDs stay unchanged. The existing SQLite `year` column is retained only for compatibility and is derived from the first day (or last day when only that date is known); it is never appended to the title or used for edition ordering. Undated editions retain legacy metadata or use the current UTC year internally. Older API clients may still supply a year, but known dates take precedence. No additional schema migration or title rewrite is required for this change.

Migration **`002_edition_titles.sql`** adds the title column and backfills every existing edition—including deleted editions—with its parent conference's name. IDs, dates, submissions, attendance, and other data are preserved. Existing initialized databases apply bundled migrations automatically on the next normal API request after deployment, under a write lock and with a migration ledger so concurrent requests cannot run the same migration twice. **No SSH/CLI step is required.** `/health` does not migrate, and an uninitialized database still requires the protected first-user setup. CLI migrations remain supported and idempotent. Take a consistent hosting/database backup before deploying schema changes.

### Conference logos and existing-data migration

The conference overview uses compact, name-first cards: **four per desktop row**, with three/two/one columns at smaller widths. Cards show the conference name, website, next edition, and speaker-take count without placeholder descriptions or logo images. Image dimensions, transparency, and colours cannot disrupt the layout. Stored logos remain available on conference detail and edit screens; no existing image data is removed. The generic summary-card layout lives in `src/theme/`.

Conference forms no longer ask for “A little context”. Existing descriptions are left intact, not deleted or overwritten when you edit a conference.

Paste an image URL (or prefill it from the website) and save. The backend downloads and validates the image, stores it in **`api/db/logos/{id}/`**, and changes `logo_url` to a same-origin URL such as **`/api/conference-logos/12/jsnation-a1b2c3d4e5f67890.png`**. The filename uses the conference's slug plus a content hash so replacement images don't get stuck in browser caches. Renaming a conference updates the slug using the already-stored image, without fetching it again. Stored images are served only to signed-in crew members; direct access to the storage directory is blocked.

**Migration is lazy and requires no SQL migration, CLI command, or bulk job.** The existing `logo_url` column accepts both old URLs and new local paths:

- Existing conferences continue to show their external logo until edited.
- The next conference save downloads an existing remote logo, even when a PATCH omits `logo_url`.
- Subsequent saves reuse the local image. Ordinary reads never trigger downloads.
- A failed download or storage write returns an actionable error and leaves the conference unchanged. Replace the URL or remove the logo to continue.
- Clearing the logo explicitly skips downloading the old one. Soft delete/restore retains stored images. Old image versions are retained on disk rather than deleting files that another request or restore could still need.

Logo downloads require PHP **cURL**. Supported formats are PNG, JPEG, GIF, WebP, AVIF, ICO, and **SVG**, with a **5 MB** download limit and **20-megapixel** raster limit. SVG imports require PHP DOM and are parsed/rebuilt with a static element/attribute allowlist: paths, gradients, clip paths, local references, and ordinary inline/class styling are preserved; scripts, event handlers, embedded HTML, animations, external references, and XML processing instructions are discarded. Only validated embedded raster data images are allowed. DTDs/entities, malformed SVGs, and excessive complexity are rejected. Stored SVGs are never inserted as HTML and are served as `image/svg+xml` with sandboxed CSP, blocked external resources, and `nosniff`. HTML files remain unsupported. Requests have a five-second total timeout and at most three redirects; every destination is checked for private/reserved IPs and DNS is pinned before connecting. No browser cookies or credentials are forwarded to image servers.

Make `api/db/` writable by PHP; the logo subdirectories are created automatically. Both the FTP workflow and manual SSH deployment exclude `api/db/logos/` from upload/deletion. Include that directory alongside SQLite in server backups; it is intentionally not committed or bundled.

### Retired invitations and calendar

Existing invitation and calendar URLs no longer serve their former functionality. Their routes are not registered, and neither links nor controls appear in the app. Existing invitation rows, encrypted payloads/key, calendar tokens, and historical comments are retained, not deleted. Both deployment methods still preserve `api/db/invite-links/`; include the entire directory, including `key.bin`, in backups. Never expose or replace the runtime encryption key during deployments.

## Checks

“Around the room” shows the latest 10 activity entries. Talk and submission forms currently omit abstracts, and submission-status choices omit “Attended”. Existing abstract/override fields and historical attended records are preserved in the database; editing notes or submission details does not clear them. No schema migration is required for these UI changes.

```bash
pnpm build
pnpm lint
pnpm format
pnpm test:api
pnpm test:deploy
pnpm test:logos
pnpm test:editions
pnpm exec playwright install chromium
pnpm test:ui
```

API tests use an isolated temporary SQLite database and PHP on port 8018. Browser tests use isolated temporary data, PHP on 8019 and Vite on 5179, without interrupting the usual dev server. They exercise setup, signup/login, onboarding, roles, proposals, conferences, friend-only reviews/counts/plans, crew requests, unfriend/block, suspension, retired endpoints, mobile layout, and profile saving. Edition tests on port 8020 verify preserved legacy data and repeat-safe upgrades. Screenshots and traces go to ignored `test-results/`.

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
| `APP_MAIL_FROM` | Optional sender, defaults to `purpleroom <noreply@nico.dev>` |
| `APP_SETUP_KEY` | Optional unique random secret of at least 32 characters; set only for first-user setup |

The workflow defaults to **explicit FTPS on port 21**, with strict certificate verification. Optional repository **Actions variables** `FTP_PROTOCOL` (`ftps`, `ftps-legacy`, or `ftp`) and `FTP_PORT` can match your host's requirements. Prefer encrypted FTPS; plain FTP exposes credentials and application files in transit.

Only production files are staged, including Apache `.htaccess` files. The live `api/db/db.sqlite*`, `api/db/sessions/`, `api/db/logos/`, and `api/db/invite-links/` are excluded from both upload and deletion. Do not enable the action's `dangerous-clean-slate` option. Deployments are serialized to avoid overlapping uploads.

After the frontend build, the workflow generates **`api/config.local.php` from the `APP_*` secrets**, forces production mode, and uploads it with the backend. GitHub secrets are the source of truth: **each deployment replaces manual server config changes**. Local config files from the checkout are never copied. Invalid or missing required settings fail the deployment before upload. Secrets are confined to this PHP config, not frontend bundles, build logs, or uploaded CI artifacts; the runner's generated file is removed afterward. Apache denies web access to the config.

Deleting `APP_SETUP_KEY` and redeploying writes `setup_key => null`, explicitly disabling web setup. The workflow does not change the database path or session storage. If your existing config contains other custom settings, account for those before switching to this generated config.

**FTP cannot run PHP commands.** For a first installation without SSH, use the one-time web setup below. Existing initialized installations apply trusted, bundled SQL migrations automatically on their next API request; there is no public migration endpoint and the first-user installer stays locked once a crew exists. `php api/db/migrate.php` remains available for manual SSH deployments. No deployment has been run merely by adding this workflow.

### First installation without command-line access

1. Configure the FTP and `APP_BASE_URL` GitHub secrets above.
2. Generate a unique random secret (preferably 64 characters) with a password manager and store it as `APP_SETUP_KEY`. Do not use an example password or put it in Git, a URL, or a support message.
3. Deploy the latest frontend and API files using GitHub Actions. The workflow generates and uploads the production config automatically.
4. Make `api/db/` writable by the PHP process using the hosting panel's ownership/permissions controls. If `db.sqlite` already exists, it must also be writable. Avoid world-writable (`777`) permissions.
5. Open **https://greenroom.nico.dev/setup**. Enter your setup key, your name, and your email (for example `mail@nico.dev`). This creates the schema and first user and signs you in immediately, without sending email.
6. Delete `APP_SETUP_KEY` from GitHub secrets and redeploy; changing secrets alone does not update the server. The setup endpoint also refuses all further bootstraps as soon as any user exists, even if you forget to remove the key. Future members join through verified email signup.

Setup is disabled by default, requires the same CSRF header as other writes, checks the secret before accessing the database, and uses a write transaction to prevent concurrent bootstraps. It does not reset or overwrite existing data. It can also create the first user when the schema exists but no users have been added yet.

If setup succeeds but future sign-in emails do not arrive, check PHP `mail()` delivery and the sender domain's SPF/DKIM in your hosting panel. Keep the production `base_url` set to your actual domain so magic links point to the right site.

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
5. Run `php api/db/seed.php "Nico" mail@nico.dev` over SSH, then open the link.
6. Configure SPF/DKIM for cyon's outgoing mail service. Magic links use PHP `mail()` in production.

Manual SSH deployment preserves the live database, SQLite sidecar files, stored logos, encrypted invite links and their key, sessions, and local config. It builds static assets, uploads frontend and API separately, and runs CLI migrations. No Node process is needed in production.

Verify after deployment:

```bash
curl -I https://greenroom.nico.dev/api/db/db.sqlite
curl -I https://greenroom.nico.dev/api/config.local.php
curl https://greenroom.nico.dev/api/me
```

The first two must return **403**; the third must return **401 JSON** when signed out. Check `/talks` redirects to sign-in, test real magic-link delivery/new signup, and verify member/admin permissions on the deployed host.

## Privacy and security

Proposals, titles, notes, abstracts, submission IDs/details, and outcomes are owner-only, including from admins. Friends only see distinct participating friends and manual attendance. Reviews and aggregates are friend-scoped. Catalog mutations/restoration and account administration require admin permissions in the API. Catalog entities are soft-deleted; private talk deletion is permanent and confirms first. Writes require the `X-Requested-With: green-room` header. Production sessions use Secure/HttpOnly/SameSite=Lax cookies; Secure is disabled only for local HTTP development.

Metadata and logo fetching reject private/reserved addresses, pin DNS using cURL, revalidate every redirect, and limit response size and time. Metadata is best-effort; fields always remain editable. Logo content is validated before storage and is never executed or served directly from its filesystem path.
