# Working in purpleroom

## Documentation and change discipline

- Read [the app logic](docs/agent/app-logic.md) before changing behaviour. It is the single living product reference, not a historical build plan.
- Update that document alongside changes to permissions, visibility, workflows, statuses, or feature scope. Update regression tests in the same change. Do not create a competing specification or leave obsolete rules marked as current.
- Keep [README.md](README.md) aimed at people evaluating or using the project: purpose, features, privacy, and getting started. Put contributor/agent instructions here and hosting procedures in [docs/deployment.md](docs/deployment.md).
- [docs/agent/design.png](docs/agent/design.png) is a visual reference, not authority to restore old branding or behaviour. Use the current **purpleroom** brand and Rebecca Purple (`#663399`) palette, including dark mode.
- Inspect `git status --short` before editing. Preserve unrelated work, existing data, and runtime files. Do not commit, push, deploy, or mutate a live database without explicit authorisation.
- When implementation and documented privacy rules conflict, report the discrepancy; do not silently weaken the rule or turn an unimplemented idea into a promise.

## Stack and architecture

- Frontend: React 18, strict TypeScript, Vite, React Router, Tailwind CSS v4, and `lucide-react`.
- Backend: PHP 8.3+, framework-free, no Composer dependencies, PDO SQLite, and native cookie sessions. Production has no Node server.
- Keep the existing lightweight architecture. Do not introduce an ORM, PHP framework, JWT, CORS/cross-origin deployment, or a new state/UI library without agreement.
- Use **pnpm** and `pnpm-lock.yaml`, not npm/yarn or competing lockfiles. `package.json` pins the package-manager version.

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Routes and admin-only page wrappers. |
| `src/pages/` | Routed views. |
| `src/components/` | Domain components, forms, crew actions, and onboarding. |
| `src/theme/` | Reusable, business-logic-free UI primitives, exported through `src/theme/index.ts`. |
| `src/index.css` | Named colour/font tokens and light/dark overrides. |
| `src/hooks/`, `src/api.ts` | Fetch/mutation/session helpers and same-origin API client. |
| `src/types.ts`, `src/lib/` | Response types, status/tag constants, formatting. |
| `public/color-scheme.js` | Pre-render appearance application and browser theme events. |
| `api/index.php`, `api/lib/router.php` | Bootstrap, registered routes, migration hook, auth/profile/admin guards. |
| `api/routes/` | Resource handlers and ownership checks. |
| `api/lib/social.php`, `api/lib/domain.php` | Viewer-scoped friendship, review, attendance, and submitted-friend logic. |
| `api/lib/` | Database, auth, validation, profile links/local avatars (`profiles.php`), metadata transport, logo/SVG safety, migration helpers. |
| `api/db/schema.sql`, `api/db/migrations/` | Immutable version-1 schema and ordered upgrades. |
| `scripts/`, `tests/` | Local tooling, isolated integration tests, and Playwright tests. |
| `.github/workflows/deploy.yml` | Production build, config generation, incremental FTP/FTPS deployment. |

## Local development

Requires Node.js 22.12+, pnpm 11.1.1, PHP 8.3+ with PDO SQLite. cURL supports metadata/logo downloads; DOM is needed for SVG sanitisation and HTML metadata parsing.

```bash
pnpm install
pnpm dev
```

`pnpm dev` applies migrations and starts Vite on `http://localhost:5173` plus PHP on `127.0.0.1:8000`. Vite proxies `/api`; keep browser requests same-origin. Ctrl+C stops both processes. `pnpm preview` alone is not a PHP server.

After migrations, this local CLI helper creates Nico's account if missing and prints a one-use login link:

```bash
PURPLEROOM_ENV=dev php api/db/seed.php "Nico" mail@nico.dev
```

The seed grants admin on creation only for `mail@nico.dev`; arbitrary seeded/publicly registered addresses are members. It does not reset an existing account's role. The protected `/setup` route is the first-admin path for fresh hosted installations; see the deployment guide.

- Email signup/login sends six-digit codes; only development responses expose the code (never log it). Production uses authenticated TLS SMTP when the `SMTP_*` settings are complete, otherwise PHP `mail()`; both send multipart HTML/plain-text messages. Local CLI seed links and already-issued links remain supported, but public requests never issue new links.
- `api/config.local.php` is ignored and overrides defaults. Never switch a public site to development mode.
- Use `PURPLEROOM_ENV` for runtime mode (`dev` locally; production by default). Other environment names remain `GREEN_ROOM_DB`, `GREEN_ROOM_API_PORT`, and `GREEN_ROOM_SETUP_KEY`. Use an isolated database/ports for tests; do not run migrations against user data just to inspect it.

## Frontend conventions

- Follow surrounding component naming, props, hooks, and formatting. Keep shared utility UI in `src/theme/` and export it through its index; keep business logic in domain components/hooks.
- Use named Tailwind design tokens and standard utilities instead of arbitrary bracket values or ad-hoc colours. Legacy green-named accent aliases currently resolve to the purple palette; preserve compatibility unless deliberately refactoring all consumers.
- Reuse controls, notices, cards, dialogs, and loading/empty states. Preserve accessible labels, keyboard/focus behaviour, responsive layouts, and light/dark support.
- Keep `src/types.ts` aligned with API response shapes. Public member identity must not accidentally become a private account payload.
- Use `editionLabel()`/`edition_label()` for edition names; never append a year. Do not restore overview logos or removed fields merely because an old design image shows them.
- Conference topic `tags` are admin-managed JSON arrays, not review `tag_counts`. Keep create/edit, cached-logo saves, summaries, and nested conference response shapes consistent. The directory filters locally using shared summaries' `has_open_cfp` flag (any active edition, not only `next_edition`), with URL-backed controls. `src/lib/conferences.ts` keeps missing next-edition dates last in both date-sort directions.
- Profile link labels/field keys live in `src/lib/profile.ts` and `api/lib/profiles.php`; keep all eight fields aligned. Avatar sources are downloaded on save, not rendered directly as previews of untrusted replacement URLs. Stored local paths must not be put into a `type="url"` field; show a blank replacement field and an explicit remove action.
- Appearance lives in the host-only `gr_theme` cookie (`Path=/`, `SameSite=Lax`, one year, Secure over HTTPS), not on the account or in local storage. Keep the pre-render script and React event handling consistent.
- Use the API helper for credentials, headers, errors, and redirects. Never render untrusted content with `dangerouslySetInnerHTML`; render sanitised SVG logos as images, not inline markup.
- The shared footer displays the version on signed-in and login/verification pages, not below the sidebar profile. `src/lib/version.ts` produces `dev-local` for development/local builds without metadata, or `dev-HASH` for CI builds using the checked-out commit's short hash in `VITE_APP_VERSION`. `src/components/AppFooter.tsx` adds the visible `version: ` prefix. This is public build metadata, not a runtime PHP setting; the footer also contains shared project credits.

## Backend and privacy rules

- Use prepared PDO queries and existing validation/response helpers. Keep JSON responses free of SQL/stack traces; report actionable errors without exposing secrets.
- New PHP implementation files must deny direct execution unless bootstrapped through `api/index.php`; retain Apache protections for config, database, libraries, and routes.
- Mutations require `X-Requested-With: green-room`. Keep same-origin cookies and production Secure/HttpOnly/SameSite=Lax sessions.
- Authenticate and enforce profile completion server-side. Verify admin permissions for every catalog mutation/import/restore, trash access, and account-management route. Guard patterns must match the router's arbitrary ID segments, not only numeric strings, because handlers cast IDs.
- Preserve owner-only proposals and submission details **even for admins**. Shared edition responses expose only the viewer's own submissions plus eligible friend identities, never friends' proposal titles, proposal/submission IDs, per-person totals, submission dates, or outcomes. Member IDs are part of the allowed public identity.
- Reuse viewer-scoped social/domain helpers for reviews, summaries, plans, and counts. Authorised fields must be filtered in SQL/API output, not merely hidden in React. Personalised JSON is `no-store`; do not introduce global caches for friend-scoped responses.
- Do not infer attendance from submission status. Review summaries must filter the same authors as full reviews. Retired routes must stay retired unless a product change is approved.
- Submissions have their own `owner_id`; `paper_id` is nullable for “Topic to be agreed”. Do not infer submission ownership or participation through an inner join to `papers`: that drops unassigned opportunities. Validate any linked proposal against the owner. Keep owner-only lists, edition/dashboard data, and friend counts consistent. Attaching a talk must update the existing submission without resetting its status/date or creating a placeholder library entry.
- Submission `notes` are owner-only and distinct from proposal notes. Preserve them on status-only updates and talk attachment; never add them to shared participation/attendance/activity payloads. They are edited through `SubmissionEditor` for linked and unassigned submissions alike.
- Use transactions/constraints for verification, crossed requests, blocking, migrations, and last-admin safeguards. Suspension increments session versions so old sessions remain invalid after restoration.
- Preserve throttling: email requests 5/address/hour and 30/IP/hour; verification 100/IP/hour; crew request actions 30/member/hour. Rate-limit keys are hashed. Login codes expire in 15 minutes, allow at most five wrong guesses, and require the high-entropy request ID. Store only request/code hashes, atomically increment attempts/consume codes, and invalidate older codes on resend. Never expose production codes, sign-in links, or tokens in client responses/logs. Keep pending email/request IDs (not codes) only in tab-scoped session storage.
- Email rendering and transport live in `api/lib/mail.php`. Use inline-styled, purple-branded HTML with a plain-text MIME alternative, no remote tracking assets, and a selectable six-digit code (validate strictly before rendering). SMTP uses PHP cURL, required STARTTLS/implicit TLS, certificate/hostname verification, TLS 1.2+, and bounded timeouts. Never add plaintext/verification-off fallbacks or verbose SMTP logging. Failed delivery discards the pending code while preserving the generic public auth response. Validate complete SMTP settings in the production config generator and keep secrets out of frontend build environments.
- Metadata/logo fetching must retain private/reserved-IP rejection, pinned DNS, redirect revalidation, size/time limits, and no forwarded cookies/credentials. Logo imports allow validated image formats, at most 5 MB and 20 megapixels for raster images. SVGs require allowlist sanitisation, no active/external content, and restrictive CSP/sandbox/nosniff serving headers. See `api/lib/remote.php`, `logos.php`, and `svg.php` before changing this boundary.
- Avatar imports reuse that same image validator and transport. `api/lib/profiles.php` handles member-owned, hash-named local storage and lazy remote-avatar migration. Reject another member's stored path; validate before updating any profile fields. `api/routes/avatars.php` checks member/block/suspension visibility and serves only the current avatar with private/no-store image headers. Do not expose stored avatars directly or fetch profile social URLs server-side.

## Database, upgrades, and runtime storage

- **Never edit `api/db/schema.sql` to change an installed database.** It is immutable version 1. Add the next numbered SQL migration under `api/db/migrations/`; do not rewrite already-shipped migrations.
- Initialised databases apply bundled migrations automatically on normal API requests under a write lock and migration ledger. `/health` does not migrate; an uninitialised production database requires secret-protected setup. Local `pnpm db:migrate` remains available.
- SQLite uses foreign keys, WAL, a busy timeout, and prepared statements. Timestamps are UTC ISO-8601; date-only fields use `YYYY-MM-DD`.
- Preserve IDs, relationships, stored field values omitted by forms, and compatibility identifiers. Feature removal or rebranding does not authorise a data purge. Catalog deletion is soft; proposals/submissions have their own owner-controlled deletion semantics.
- Runtime paths to preserve/exclude from deployment and Git:
  - `api/db/db.sqlite*`, including SQLite sidecars;
  - `api/db/sessions/`;
  - `api/db/logos/`;
  - `api/db/avatars/`;
  - `api/db/invite-links/`, including historical `key.bin`;
  - local `api/config.local.php` (production config is generated separately).
- The retired invitation/calendar helpers and stored tokens do not mean those features are active. Keep encrypted payloads/key and legacy fields intact unless explicitly authorised otherwise.
- Migration 002 backfills edition titles. Migration 003 adds social roles/relationships and promotes only the existing `mail@nico.dev` account; it creates no friendships. Confirm account mapping before deploying that upgrade. Fresh public signup must never automatically grant admin.
- Migration 004 adds optional homepage/social link columns without changing existing avatars or other account data. Avatar downloads remain lazy on profile save.
- Migration 005 rebuilds `submissions` with explicit ownership and an optional proposal, backfilling owners and retaining every existing ID/field. It preserves unique proposal/edition pairs, permits one unassigned row per owner/edition, and enforces matching proposal ownership with triggers. Retain linked-proposal cascade deletion, but do not delete unassigned opportunities when unrelated talks are removed.
- Migration 006 adds nullable per-submission private notes without rewriting existing submission data.
- Migration 007 adds conference topic tags with an empty-array default, preserving existing catalog records. Only admins may change tags; omission must not clear stored values.
- Migration 008 adds request-bound login codes with expiry/attempt limits. Preserve accounts and previously issued legacy tokens; do not repurpose short codes as legacy URL tokens.
- Existing `gr_session`, `gr_theme`, `green-room` request/browser identifiers, and legacy environment variables are intentional compatibility details, not unfinished branding work.

## Checks

Run the relevant checks for each change, and the full suite for broad product/privacy work:

```bash
pnpm build
pnpm lint
pnpm test:api
pnpm test:editions
pnpm test:logos
pnpm test:deploy
pnpm test:mail
pnpm exec playwright install chromium  # first browser-test setup
pnpm test:ui
```

`pnpm format` writes formatting across `src`; prefer targeted formatting if unrelated files have user changes. PHP has no transpile step: run `php -l` on changed PHP files as well.

| Test suite | Isolation / coverage |
| --- | --- |
| API | Temporary SQLite, PHP port 8018; signup, roles, ownership, crew/privacy, attendance, suspension, retired routes, and storage protection. |
| Editions | Temporary legacy database, PHP port 8020; automatic upgrades, retained data, titles, restore, and migration idempotency. |
| UI | Temporary data, PHP port 8019 and Vite port 5179; actual user flows, authorisation, crew, appearance, and responsive layouts. |
| Logos | Isolated logo/avatar storage and transport fixtures; import validation, SVG safety, SSRF/redirect constraints, lazy migration, and rollback. |
| Deployment config | Generated PHP configuration, validation, secret handling, and defaults. |
| Mail | Isolated local SMTP fixtures and an OpenSSL-generated test certificate; HTML/plain codes, STARTTLS/implicit TLS, certificate/auth failures, PHP mail fallback via a recorder, generic auth failure/code cleanup, and successful production delivery without response/log disclosure on PHP port 8022. Requires the `openssl` command and SMTP-enabled PHP cURL; sends no external emails. |

Do not interrupt the normal backend on port 8000 to run tests. Browser screenshots/traces are generated in ignored `test-results/`. Do not claim checks passed unless actually run; documentation-only edits normally need link/path checks and `git diff --check`, not a full application test run.

## Deployment constraints

Production uses the GitHub Actions FTP/FTPS workflow, not an SSH deployment script. Preserve incremental state tracking, serialised uploads, strict FTPS defaults, and protected runtime exclusions. Do not enable `dangerous-clean-slate`, add Matomo/`repository_dispatch`, or introduce server-CLI requirements.

GitHub `APP_*` and optional `SMTP_*` settings generate production `api/config.local.php` on every deployment; manual server edits are overwritten. `APP_BASE_URL`, `APP_MAIL_FROM`, `SMTP_HOST`, and `SMTP_USERNAME` use Actions variables; `APP_SETUP_KEY` and `SMTP_PASSWORD` remain secrets. `APP_BASE_URL` controls live links; do not invent a new production domain or FTP target from the project name. Removing `APP_SETUP_KEY` or SMTP settings requires redeployment. Only built frontend assets and the PHP backend are uploaded—not these docs or the development server.

For secrets, first-admin setup, backups, upgrade checks, and hosting diagnostics, follow [docs/deployment.md](docs/deployment.md). Never expose secrets to frontend bundles or logs, overwrite live storage, or deploy without authorisation.
