# purpleroom

**{ where speakers swap notes }**

> **v0 / early beta:** Expect bugs and rough edges. Your feedback helps shape what comes next.

purpleroom is a members-only space for conference speakers to find their next stage, keep track of proposals, and see where their friends are heading. The name is an homage to CSS [`rebeccapurple`](https://developer.mozilla.org/en-US/docs/Web/CSS/named-color#rebeccapurple) (`#663399`).

## What you can do

- **Explore conferences and editions.** Find event dates, locations, CFP links, and deadlines in an admin-maintained catalog. Filter by topic tags or open CFPs, and sort by name or next event date.
- **Keep a private talk library.** Reuse a proposal across editions and track each submission's progress in one place.
- **Leave room for a conversation.** Use “Topic to be agreed” when a speaking opportunity has no specific talk yet. Attach a new or existing talk later without losing its status or submission date.
- **Build your crew.** Browse the member directory, send a request, and connect when the other person accepts.
- **Make plans together.** Mark an edition Going or Maybe, and see your friends' plans—even if you haven't submitted a talk.
- **Share speaker experience.** Leave conference reviews with practical tags, a return recommendation, and your own take, visible to your friends.
- **Make your profile yours.** Add a profile image, homepage, and links to GitHub, LinkedIn, X, Bluesky, Instagram, YouTube, and Mastodon. Profile images are saved with purpleroom instead of hotlinked after import.
- **Leave on your terms.** Permanently delete your account and personal content under **Settings → Danger**. Shared conferences and editions remain without your attribution. The last active admin must appoint another admin first.

## Privacy by design

Nothing inside the app is publicly browsable. Anyone can join by entering a six-digit code from email in the login screen; new members choose a display name before appearing in the directory. Codes work once and expire after 15 minutes—no email link or in-app browser required.

Your crew consists only of accepted friends. They can see your Going/Maybe plans and speaker reviews. They can also see **that you submitted** to an edition, but not your talk titles, how many proposals you submitted, or the results. Three proposals from one friend still count as one friend who submitted.

Your proposal content and submission details stay private, including from admins through the app. Admins maintain the conference catalog and manage account access; the role does not grant access to private proposals.

Attendance is always your choice. A CFP acceptance, rejection, or other status change never changes Going or Maybe for you.

## Getting started

1. Enter your email on the sign-in screen, then paste the six-digit code from your email into the same screen.
2. Choose a display name if you're new.
3. Find friends under **The crew → All members** and send crew requests.
4. Browse conferences, add talks to editions, and set your attendance independently.

No password or signup invitation is needed. Light, Dark, and System appearance options are available; your preference is saved only in your current browser.

## Try it locally

Requirements: Node.js 22.12+, pnpm 11.1.1, and PHP 8.3+ with PDO SQLite. PHP cURL and DOM support conference metadata and logo imports.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`. One command starts both the React frontend and PHP API and applies local database migrations. In development, the email form shows the sign-in code instead of sending mail. No sample conferences are created automatically.

With the dev server running, generate a local account and one-use sign-in link in another terminal:

```bash
PURPLEROOM_ENV=dev php api/db/seed.php "Testuser" local@testuser.com
```

Open the printed URL within 15 minutes. This creates the local account if needed; `mail@nico.dev` receives admin access when created. Other names/emails can be used to create member accounts. Existing accounts keep their current role.

For a local admin account and development checks, see [AGENTS.md](AGENTS.md#local-development). For hosting, first-admin setup, and upgrades, see the [deployment guide](docs/deployment.md).

## Built with

React, TypeScript, Vite, Tailwind CSS, and a framework-free PHP API backed by SQLite. Production runs on PHP/Apache hosting; no Node.js server is required.

Passwordless sign-in emails include branded HTML and a plain-text alternative, delivered through an optional SMTP provider or the host's mail service.

## Project documentation

- [Contributing](CONTRIBUTING.md): branch/PR workflow, test coverage, and guidelines for contributors and coding agents.
- [App logic](docs/agent/app-logic.md): the living reference for how the app works, including permissions, privacy, and edge cases.
- [Codebase guide](AGENTS.md): architecture, conventions, commands, and safety rules for contributors and coding agents.
- [Deployment guide](docs/deployment.md): configuration, FTP/FTPS deployment, backups, and troubleshooting.

When contributing a behaviour change, update the app-logic document and relevant tests alongside the implementation.
