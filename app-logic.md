# Green Room — Build Spec

> A private app for a small crew (5–10 people) of conference speakers to share hand-picked conferences, CFP deadlines, speaker-perspective reviews, and who is submitting to / going where.

- **URL:** https://green-room.nico.dev
- **Hosting:** cyon (Apache, PHP 8.3, `.htaccess` enabled, PDO SQLite)
- **Repo layout:** one folder, frontend at root, backend in `api/`, DB at `api/db/db.sqlite`

This document is the source of truth for the coding agent. When something is unspecified, choose the simplest option that fits the constraints below and leave a `// TODO(spec):` comment.

---

## 1. Product summary

### The USP
Not a conference directory. It is **trusted speaker intel among friends**: every conference in the app was added on purpose by someone in the group, and the reviews answer "is this worth my time *as a speaker*?"

### Core concepts
| Concept | Shared or private | Description |
|---|---|---|
| **Conference** | Shared | The brand, e.g. "JSNation". Holds reviews and long-lived context. |
| **Edition** | Shared | One instance of a conference, e.g. "JSNation 2027, Amsterdam, 20 May". Holds dates, CFP info, submissions, attendance. |
| **Review** | Shared, owned | One per user per conference. Structured tags + free text. |
| **Paper** | Private | A talk in a user's personal library. Title + abstract. |
| **Submission** | Shared status, owned | A paper submitted to an edition, with a status. Group sees paper title + status, never the abstract. |
| **Attendance** | Shared, owned | "Going without a talk" marker for an edition. |
| **Comment** | Shared, owned | Discussion on a conference or edition. |
| **Invite** | Shared | Link that lets a new person join. |

### Permission model (deliberately flat)
- **One group. No roles. No admin.**
- Every logged-in user can create/read/update/delete **conferences** and **editions** (soft delete).
- Every logged-in user can create **invites**.
- Users can only modify things they own: **papers, submissions, reviews, attendance, comments**.
- **Papers are private**: only the owner can read them. Other users only see a paper's **title** through a submission (unless `hide_title` is set on that submission, then show "Untitled talk").

---

## 2. Tech stack

### Backend
- PHP 8.3, **no framework, no Composer dependencies**
- SQLite via PDO
- Single front controller `api/index.php` with a tiny hand-written router
- JSON in / JSON out
- PHP native sessions (cookie-based)

### Frontend
- React 18 + TypeScript + Vite + Tailwind CSS
- React Router for client-side routing
- No state management library; use a small `api.ts` fetch wrapper + React hooks (optionally TanStack Query if it clearly simplifies things — keep it to that one extra dependency)
- No UI component library; plain Tailwind

### Not allowed
- No ORM, no PHP framework, no Node server in production, no JWT, no CORS (same origin only).

---

## 3. Folder structure

```
green-room/
├── api/
│   ├── index.php              # front controller: bootstrap, route, dispatch
│   ├── .htaccess              # rewrite everything under /api to index.php
│   ├── config.php             # reads config.local.php if present
│   ├── config.local.php       # NOT committed (secrets, env-specific)
│   ├── lib/
│   │   ├── db.php             # PDO connection + pragmas + helpers
│   │   ├── router.php         # minimal method+path router with {params}
│   │   ├── http.php           # json(), body(), error(), validation helpers
│   │   ├── auth.php           # session start, current_user(), require_login()
│   │   ├── mail.php           # send magic link mail
│   │   └── ics.php            # iCalendar builder
│   ├── routes/
│   │   ├── auth.php
│   │   ├── invites.php
│   │   ├── dashboard.php
│   │   ├── conferences.php
│   │   ├── reviews.php
│   │   ├── editions.php
│   │   ├── attendance.php
│   │   ├── papers.php
│   │   ├── submissions.php
│   │   ├── comments.php
│   │   ├── users.php
│   │   └── calendar.php
│   └── db/
│       ├── .htaccess          # Require all denied
│       ├── schema.sql
│       ├── migrate.php        # CLI: php api/db/migrate.php
│       ├── seed.php           # CLI: creates first user + prints login link
│       └── db.sqlite          # NOT committed
├── src/
│   ├── main.tsx
│   ├── App.tsx                # routes + auth gate
│   ├── api.ts                 # typed fetch wrapper
│   ├── types.ts               # mirrors schema
│   ├── lib/                   # date formatting, constants (tags, statuses)
│   ├── components/
│   └── pages/
├── public/
│   └── .htaccess              # copied into dist/: SPA fallback
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── deploy.sh
└── .gitignore
```

`.gitignore` must include: `node_modules/`, `dist/`, `api/db/db.sqlite*`, `api/db/logos/`, `api/config.local.php`.

---

## 4. Database

### Connection (every request, in `lib/db.php`)
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```
- PDO: `ERRMODE_EXCEPTION`, `FETCH_ASSOC`.
- Always prepared statements.
- Timestamps: ISO 8601 UTC strings (`strftime('%Y-%m-%dT%H:%M:%SZ','now')`). Dates without time: `YYYY-MM-DD`.

### Schema (`api/db/schema.sql`)
```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  avatar_url    TEXT,
  cal_token     TEXT NOT NULL UNIQUE,          -- random, for .ics feed
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE login_tokens (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,          -- sha256 of token, never store raw
  expires_at    TEXT NOT NULL,                 -- 15 minutes
  used_at       TEXT
);

CREATE TABLE invites (
  id            INTEGER PRIMARY KEY,
  token_hash    TEXT NOT NULL UNIQUE,
  email         TEXT,                          -- optional, prefill only
  invited_by    INTEGER NOT NULL REFERENCES users(id),
  accepted_by   INTEGER REFERENCES users(id),
  expires_at    TEXT NOT NULL,                 -- 14 days
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE conferences (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  website       TEXT,
  logo_url      TEXT,                          -- legacy remote URL or cached /api/conference-logos/{id}/{slug-hash}.{ext}
  description   TEXT,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  deleted_at    TEXT
);

CREATE TABLE reviews (
  id                  INTEGER PRIMARY KEY,
  conference_id       INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tags                TEXT NOT NULL DEFAULT '[]',   -- JSON array of tag keys
  would_submit_again  INTEGER,                      -- NULL | 0 | 1
  text                TEXT,
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (conference_id, user_id)
);

CREATE TABLE editions (
  id             INTEGER PRIMARY KEY,
  conference_id  INTEGER NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  year           INTEGER NOT NULL,
  city           TEXT,
  country        TEXT,                        -- ISO 3166-1 alpha-2, e.g. "NL"
  online         INTEGER NOT NULL DEFAULT 0,
  starts_on      TEXT,                        -- YYYY-MM-DD
  ends_on        TEXT,
  website        TEXT,
  cfp_url        TEXT,
  cfp_opens_on   TEXT,
  cfp_closes_on  TEXT,
  notes          TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  deleted_at     TEXT
);
CREATE INDEX idx_editions_cfp ON editions(cfp_closes_on);
CREATE INDEX idx_editions_start ON editions(starts_on);

CREATE TABLE papers (
  id          INTEGER PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  abstract    TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE submissions (
  id                INTEGER PRIMARY KEY,
  paper_id          INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  edition_id        INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'interested'
                    CHECK (status IN ('interested','submitted','accepted','rejected',
                                      'waitlisted','confirmed','declined','attended')),
  abstract_override TEXT,                    -- private, like paper.abstract
  hide_title        INTEGER NOT NULL DEFAULT 0,
  submitted_on      TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (paper_id, edition_id)
);

CREATE TABLE attendance (
  id          INTEGER PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('maybe','going')),
  UNIQUE (edition_id, user_id)
);

CREATE TABLE comments (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conference_id  INTEGER REFERENCES conferences(id) ON DELETE CASCADE,
  edition_id     INTEGER REFERENCES editions(id) ON DELETE CASCADE,
  text           TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  CHECK ((conference_id IS NULL) <> (edition_id IS NULL))
);

CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);
```

### Soft delete
- `conferences` and `editions` use `deleted_at`. All list/detail queries filter `deleted_at IS NULL`.
- Editions of a soft-deleted conference are hidden as well.
- Provide `GET /api/trash` and `POST /api/{conferences|editions}/{id}/restore`.
- No hard delete via the API for shared entities.

### Migrations
- `migrate.php` applies `schema.sql` as version 1 on an empty DB, then any `api/db/migrations/NNN_name.sql` in order, recording them in `schema_migrations`.
- Must be runnable via CLI and via a one-off protected HTTP endpoint is **not** wanted; cyon has SSH, use CLI.

---

## 5. Domain constants

Keep these in one place on each side (`api/lib/constants.php`, `src/lib/constants.ts`) and keep them in sync.

### Review tags
| Key | Label |
|---|---|
| `covers_travel` | Covers travel |
| `covers_hotel` | Covers hotel |
| `pays_speakers` | Pays an honorarium |
| `great_speaker_care` | Great speaker care |
| `speaker_dinner` | Speaker dinner / social |
| `recorded` | Talks recorded & published |
| `big_audience` | Big audience (500+) |
| `senior_audience` | Experienced audience |
| `transparent_cfp` | Transparent CFP / feedback |
| `anonymous_review` | Anonymous CFP review |
| `know_organizers` | I know the organizers |
| `spoke_there` | I've spoken there |
| `attended_there` | I've attended |
| `heard_good_things` | Heard good things |
| `disorganized` | Disorganized |
| `poor_communication` | Poor communication |

Unknown tags in input are rejected with 422.

### Submission statuses (in pipeline order)
`interested → submitted → accepted | rejected | waitlisted → confirmed | declined → attended`

Transitions are **not enforced**; any status may be set. The UI shows them in this order.
The `attended` value remains supported in the schema/API for historical records but is no longer offered as a selectable status in the UI. Existing attended submissions show a disabled legacy option until changed to another status.

### Derived "who's going" for an edition
A user counts as **going** if they have attendance `going`, or a submission with status `confirmed` or `attended`. A user counts as **maybe** if attendance is `maybe` or a submission is `accepted`. Speaking is shown separately from attending.

---

## 6. Auth

### Model
- Passwordless: **invite link** to join, **magic link** to log in.
- PHP sessions, cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, name `gr_session`, lifetime **180 days** (`session.gc_maxlifetime` and cookie lifetime both set; store sessions in a directory outside the web root if possible, otherwise `api/db/sessions/` which is covered by the deny rule).
- Regenerate session ID on login.
- CSRF: all state-changing requests must send header `X-Requested-With: green-room`; reject otherwise. Combined with SameSite=Lax and same-origin JSON this is sufficient.

### Tokens
- Generate with `bin2hex(random_bytes(32))`.
- Store only `hash('sha256', $token)`.
- Login tokens expire after 15 min, single use.
- Invite tokens expire after 14 days, single use.

### Flows
1. **Bootstrap:** `php api/db/seed.php "Nico" nico@example.com` creates the first user and prints a one-time login URL.
2. **Invite:** logged-in user calls `POST /api/invites` → gets `https://green-room.nico.dev/invite/{token}`. They share it however they like (no email sent).
3. **Accept invite:** visitor opens `/invite/{token}` → form with name + email → `POST /api/invites/{token}/accept` → user created, session started, redirect to dashboard. If email already exists → 409.
4. **Login:** `/login` → email → `POST /api/auth/request`. Always respond 200 (do not reveal whether the email exists). If the user exists, send mail with `https://green-room.nico.dev/auth/{token}`.
5. **Verify:** frontend route `/auth/{token}` calls `POST /api/auth/verify` with the token → session started.
6. **Dev mode:** when `config.env === 'dev'`, `auth/request` also returns the link in the JSON response and logs it, so no mail is needed locally.

### Mail
- Use PHP `mail()` (cyon delivers via its own MTA).
- From: `Green Room <noreply@nico.dev>` (configurable). Plain text body, short.
- Note for setup: SPF/DKIM for nico.dev must allow cyon's servers, otherwise links land in spam.

---

## 7. API

All endpoints are under `/api`, JSON request/response, `Content-Type: application/json; charset=utf-8`.

### Conventions
- Success: `200` with JSON body; `201` on create with the created object; `204` on delete.
- Errors: `{ "error": { "code": "not_found", "message": "…", "fields": { "name": "required" } } }`
  - `400` malformed, `401` not logged in, `403` not owner, `404` not found, `409` conflict, `422` validation.
- All routes except `auth/*`, `invites/{token}*`, and `cal/*` require a session.
- Field names in JSON are `snake_case`, matching the DB.
- Embed related data where listed below to avoid N+1 requests from the frontend.
- User objects embedded anywhere are the public shape: `{ id, name, avatar_url }` (no email).

### Auth & users
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/request` | `{ email }` → `{ ok: true }` |
| POST | `/auth/verify` | `{ token }` → `{ user }` |
| POST | `/auth/logout` | |
| GET | `/me` | `{ user (incl. email), cal_url }` |
| PATCH | `/me` | `{ name?, avatar_url? }` |
| POST | `/me/cal-token` | rotate calendar token → `{ cal_url }` |
| GET | `/users` | list of group members (public shape) |

### Invites
| Method | Path | Notes |
|---|---|---|
| POST | `/invites` | `{ email? }` → `{ url, expires_at }` |
| GET | `/invites` | open invites created by anyone (for visibility) |
| GET | `/invites/{token}` | public: `{ valid, invited_by: {name}, email? }` |
| POST | `/invites/{token}/accept` | public: `{ name, email }` → `{ user }` + session |

### Dashboard
`GET /dashboard` →
```jsonc
{
  "open_cfps": [            // editions with cfp_closes_on >= today, sorted asc
    { "edition": Edition, "conference": ConferenceSummary,
      "days_left": 5, "submitters": [User], "my_submissions": [Submission] }
  ],
  "upcoming": [             // editions with starts_on >= today, sorted asc, limit 20
    { "edition": Edition, "conference": ConferenceSummary,
      "speaking": [{ "user": User, "status": "accepted" }],
      "going": [User], "maybe": [User] }
  ],
  "recent_activity": [      // last 10 events: new conference, new edition, status change, review, comment
    { "type": "submission_status", "at": "…", "user": User, "summary": "…", "link": "/editions/12" }
  ]
}
```
`recent_activity` may be computed with a UNION query over `created_at`/`updated_at` columns; no separate events table needed for v1.

### Conferences
| Method | Path | Notes |
|---|---|---|
| GET | `/conferences` | list; each item incl. `review_count`, `tag_counts`, `next_edition` |
| POST | `/conferences` | `{ name*, website?, logo_url?, description? }` |
| GET | `/conferences/{id}` | incl. `editions[]`, `reviews[]` (with user), `comments[]` (with user), `created_by` user |
| PATCH | `/conferences/{id}` | any field |
| DELETE | `/conferences/{id}` | soft delete |
| POST | `/conferences/{id}/restore` | |
| PUT | `/conferences/{id}/review` | upsert own review `{ tags[], would_submit_again?, text? }` |
| DELETE | `/conferences/{id}/review` | delete own review |
| POST | `/conferences/metadata` | `{ url }` → best-effort `{ name?, logo_url?, description? }` from `<title>`, `og:title`, `og:image`, `og:description`, favicon. 5s timeout, max 1 MB, only http(s), never follow to private IP ranges. |

### Editions
| Method | Path | Notes |
|---|---|---|
| GET | `/editions?from=&to=&cfp_open=1` | filters optional |
| POST | `/editions` | `{ conference_id*, year*, city?, country?, online?, starts_on?, ends_on?, website?, cfp_url?, cfp_opens_on?, cfp_closes_on?, notes? }` |
| GET | `/editions/{id}` | incl. `conference` (with reviews summary), `submissions[]` (public shape), `attendance[]`, `comments[]` |
| PATCH | `/editions/{id}` | |
| DELETE | `/editions/{id}` | soft delete |
| POST | `/editions/{id}/restore` | |
| PUT | `/editions/{id}/attendance` | `{ status: 'maybe'|'going' }` |
| DELETE | `/editions/{id}/attendance` | |

Validation: `ends_on >= starts_on`, `cfp_closes_on >= cfp_opens_on` when both set.

**Public submission shape** (what other users see):
```jsonc
{ "id": 1, "status": "accepted", "user": User, "paper_title": "My Talk" | null, "updated_at": "…" }
```
`paper_title` is `null` when `hide_title = 1` and the viewer is not the owner. Never include abstracts.

### Papers (owner only)
| Method | Path | Notes |
|---|---|---|
| GET | `/papers` | own papers, each incl. `submissions[]` with edition + conference summary |
| POST | `/papers` | `{ title*, abstract?, notes? }` |
| GET | `/papers/{id}` | 404 if not owner (do not leak existence) |
| PATCH | `/papers/{id}` | |
| DELETE | `/papers/{id}` | hard delete, cascades submissions; frontend must confirm |

### Submissions (owner only for writes)
| Method | Path | Notes |
|---|---|---|
| POST | `/submissions` | `{ paper_id*, edition_id*, status?, abstract_override?, hide_title?, submitted_on? }`; paper must be own |
| PATCH | `/submissions/{id}` | |
| DELETE | `/submissions/{id}` | |

When status changes to `submitted` and `submitted_on` is empty, set it to today.

### Comments
| Method | Path | Notes |
|---|---|---|
| POST | `/comments` | `{ conference_id | edition_id, text* }` (exactly one target) |
| DELETE | `/comments/{id}` | own only |

### Trash
| Method | Path | Notes |
|---|---|---|
| GET | `/trash` | soft-deleted conferences and editions, last 90 days |

### Calendar
`GET /cal/{cal_token}.ics` — public, no session.
- Events (all-day):
  - **CFP deadline** for every non-deleted edition where the user has a submission (any status) or attendance, or `cfp_closes_on` is set and the user has no submission yet but has marked interest via a submission with status `interested`. Simplest rule for v1: **all editions with a `cfp_closes_on` in the future** + **all editions the user speaks at or attends**. Title: `CFP closes: JSNation 2027`.
  - **Conference dates** for editions the user is speaking at or going to. Title: `🎤 JSNation 2027 (Amsterdam)` or `JSNation 2027 (Amsterdam)`.
- Stable `UID`s: `cfp-{edition_id}@green-room.nico.dev`, `conf-{edition_id}@green-room.nico.dev`.
- `Content-Type: text/calendar; charset=utf-8`, CRLF line endings, fold lines > 75 octets, escape `,;\` and newlines.

---

## 8. Frontend

### Routes
| Path | Page | Auth |
|---|---|---|
| `/` | Dashboard | yes |
| `/conferences` | Conference list | yes |
| `/conferences/new` | Create conference (paste URL → prefill via metadata) | yes |
| `/conferences/:id` | Conference detail | yes |
| `/editions/new?conference=:id` | Create edition | yes |
| `/editions/:id` | Edition detail | yes |
| `/talks` | My talks (paper library + submissions) | yes |
| `/talks/:id` | Paper detail/edit | yes |
| `/crew` | Members + create invite link | yes |
| `/settings` | Name, avatar, calendar URL (copy + rotate) | yes |
| `/trash` | Restore deleted items | yes |
| `/login` | Email form | no |
| `/auth/:token` | Verify magic link | no |
| `/invite/:token` | Accept invite | no |

On app load call `GET /api/me`; on 401 redirect to `/login` (preserving the intended path).

### Pages — what matters
**Dashboard**
- "Open CFPs" first: sorted by deadline, urgency colour (≤7 days red, ≤21 amber), avatars of submitters, quick action "Add my talk" (opens submission modal with paper picker).
- "Upcoming conferences": date, city, flag, who speaks, who goes.
- "Recent activity" feed in a side column (stacks below on mobile).

**Conference detail**
- Header: logo, name, website.
- Tag summary: each tag with count ("Covers travel · 4"), and "Would submit again: 5 👍 / 1 👎".
- Reviews list (avatar, tags as chips, text). "Write/edit my review" with tag checkboxes.
- Editions list (newest first) with a "New edition" button that prefills the previous edition's data with year+1.
- Comments.

**Edition detail**
- Dates, location, CFP window with countdown, CFP link button.
- "Speaking" list (user + talk title + status chip) and "Going / Maybe" list.
- My actions: submit a talk (choose existing paper or create new inline), change my status, set my attendance.
- Conference review summary pulled in.
- Comments.

**My talks**
- List of papers; each expands to show submissions as a small table (edition, deadline, status dropdown editable inline).
- Create/edit paper: title and private notes. Abstracts and edition-specific abstract overrides are retained in the database/API for compatibility but are not displayed or edited in the UI. Frontend saves omit these fields so existing values are preserved.

### UX rules
- Mobile-first; works well on a phone.
- Dates displayed as `20 May 2027`; relative for deadlines (`in 5 days`). Use `Intl.DateTimeFormat`, locale `en-GB`.
- Logos: if `logo_url` missing, show initials on a coloured tile derived from the name.
- Conference forms no longer include the "A little context" field. Preserve existing descriptions when saving.
- Conference logos are imported from a public image URL on save and stored in `api/db/logos/{id}/`. Serve them via authenticated `/api/conference-logos/{id}/{slug-hash}.{ext}` URLs; never expose the storage directory directly.
- Existing external logos migrate lazily on the next conference save (including PATCH without logo_url). Reuse local images thereafter; no schema change or bulk migration is needed. On download/storage failure, return an error and leave the conference unchanged. Clearing the logo skips migration. Preserve files across soft deletion, restore, and deployment.
- Validate image bytes (PNG/JPEG/GIF/WebP/AVIF/ICO/SVG, maximum 5 MB and 20 megapixels for raster images); reject HTML. SVGs must be parsed and rebuilt as static, self-contained artwork, stripping active content and external references, rejecting DTDs/entities, and served via `<img>` with sandboxed CSP and `nosniff`. Use a five-second network budget, at most three redirects, public-IP validation on every hop, and pinned DNS. Do not forward browser credentials.
- Avatars: if missing, initials.
- Optimistic UI not required; show loading/disabled states on buttons.
- All destructive actions confirm.
- Visual tone: calm, dark-green accent (fits the name), lots of whitespace. Light and dark mode via Tailwind `dark:` + `prefers-color-scheme`.

### `api.ts`
- Base path `/api`.
- Always send `credentials: 'same-origin'`, `Content-Type: application/json`, and `X-Requested-With: green-room`.
- Throw a typed `ApiError { status, code, message, fields }` on non-2xx.
- On 401 from any call, redirect to `/login`.

### `types.ts`
Hand-written, mirrors the schema and API shapes above (`User`, `Conference`, `ConferenceSummary`, `Review`, `Edition`, `Paper`, `Submission`, `PublicSubmission`, `Attendance`, `Comment`, `Invite`, `Dashboard`, `ReviewTag`, `SubmissionStatus`).

---

## 9. Local development

```bash
pnpm install
php api/db/migrate.php
php api/db/seed.php "Nico" nico@example.com   # prints login link
php -S localhost:8000 -t . api/dev-router.php   # serves /api/*
pnpm dev                                        # Vite on :5173 + PHP on :8000
```

- `vite.config.ts`: proxy `/api` → `http://localhost:8000`.
- `api/dev-router.php`: for the PHP built-in server, routes `/api/*` to `api/index.php` (the built-in server ignores `.htaccess`).
- `config.local.php` for dev: `['env' => 'dev', 'base_url' => 'http://localhost:5173']`.

---

## 10. Deployment on cyon

### Server layout
Subdomain `green-room.nico.dev` → document root e.g. `~/public_html/green-room/`. That directory contains:
```
index.html            # from dist/
assets/               # from dist/
.htaccess             # from dist/ (originates in public/.htaccess)
api/                  # copied from repo, excluding db.sqlite and config.local.php
```
`api/db/db.sqlite` and `api/config.local.php` exist only on the server and are never overwritten by deploys.

### `.htaccess` files

`public/.htaccess` (SPA fallback, HTTPS):
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

RewriteRule ^api/ - [L]
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
RewriteRule ^ index.html [L]
```

`api/.htaccess`:
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.php [QSA,L]

<FilesMatch "^(config\.local\.php|config\.php)$">
  Require all denied
</FilesMatch>
```
(Ensure `lib/` and `routes/` are also not directly executable: either deny them or make each file `return` early when not included via `index.php`, e.g. check a `GREEN_ROOM` constant.)

`api/db/.htaccess`:
```apache
Require all denied
```

### `deploy.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="user@server.cyon.net"          # TODO: fill in
DEST="~/public_html/green-room"

pnpm build
rsync -avz --delete \
  --exclude 'api/' \
  dist/ "$HOST:$DEST/"
rsync -avz --delete \
  --exclude 'db/db.sqlite*' \
  --exclude 'db/sessions/' \
  --exclude 'db/logos/' \
  --exclude 'config.local.php' \
  api/ "$HOST:$DEST/api/"
ssh "$HOST" "cd $DEST && php api/db/migrate.php"
```
Note: the first `rsync` must not delete `api/` on the server; `--exclude 'api/'` protects it.

### Post-deploy checks
- `curl -I https://green-room.nico.dev/api/db/db.sqlite` → **403**
- `curl -I https://green-room.nico.dev/api/config.local.php` → **403**
- `curl https://green-room.nico.dev/api/me` → **401 JSON**
- Deep link `https://green-room.nico.dev/talks` loads the app.

---

## 11. Security checklist
- [ ] Prepared statements everywhere.
- [ ] Ownership checks on papers, submissions, reviews, attendance, comments; papers return 404 to non-owners.
- [ ] Abstracts never appear in any response to non-owners.
- [ ] Tokens stored hashed; login tokens single-use, 15 min.
- [ ] `X-Requested-With` header required on POST/PATCH/PUT/DELETE.
- [ ] Session cookie `Secure`, `HttpOnly`, `SameSite=Lax`.
- [ ] Metadata fetcher: http(s) only, timeout, size cap, no private/loopback IPs.
- [ ] DB, sessions, config not web-accessible (verified with curl).
- [ ] Output in React is escaped by default; never use `dangerouslySetInnerHTML` for user content.
- [ ] Basic rate limit on `/auth/request` (e.g. max 5 per email per hour, tracked in `login_tokens`).

---

## 12. Build order (milestones)

1. **Skeleton** — folder structure, Vite + Tailwind, PHP router, `/api/health`, dev proxy working.
2. **DB + auth** — schema, migrate, seed, magic link (dev mode), sessions, `/me`, login + auth gate in React.
3. **Conferences & editions** — CRUD, soft delete, detail pages, metadata prefill.
4. **Papers & submissions** — My talks page, submit to edition, status changes, public submission shape.
5. **Reviews, attendance, comments.**
6. **Dashboard** — open CFPs, upcoming, activity.
7. **Invites + crew page.**
8. **Calendar feed.**
9. **Trash/restore, polish, dark mode.**
10. **Deploy to cyon** with `deploy.sh` and run post-deploy checks.

Each milestone should leave the app runnable.

---

## 13. Out of scope for v1
- Multiple groups, roles, admin
- Email notifications other than magic links (calendar feed covers reminders)
- Public pages, SEO, sharing outside the group
- File uploads (conference logos are imported from URLs and cached locally; avatars remain URLs)
- Numeric ratings
- Importing from Sessionize/Papercall
- Real-time updates
