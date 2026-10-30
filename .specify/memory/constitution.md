# purpleroom Constitution

`AGENTS.md` is the authority for conventions; this file only restates what a spec or plan must never violate.

## Principles

### I. Single product reference
`docs/agent/app-logic.md` is the living product spec. Specs under `specs/` describe one feature and are historical. Any change to permissions, visibility, workflows, statuses or scope updates app-logic in the same change. No competing specification.

### II. Privacy is non-negotiable
Owner-only data (proposals, submission details and notes, speaker toolkit) stays owner-only, even for admins. Authorisation is enforced in SQL/API output, never only in React. If a spec conflicts with a documented privacy rule, report it; do not weaken the rule.

### III. Keep the lightweight stack
React 18 + strict TypeScript + Vite + Tailwind v4 on the front; framework-free PHP 8.3 + PDO SQLite on the back; pnpm only. No ORM, PHP framework, JWT, CORS deployment or new state/UI library without agreement.

### IV. Immutable schema, additive migrations
`api/db/schema.sql` and shipped migrations are never edited. Changes are new numbered migrations that preserve existing data.

### V. Tested and checked
Behaviour changes ship with regression tests. Relevant checks (`pnpm build`, `pnpm lint`, `pnpm test:*`, `php -l`) must actually run before work is called done.

### VI. Approval gates
Work happens on a non-main branch. Commit, push, PR, merge and deploy need explicit authorisation. Creating GitHub issues (e.g. `/speckit-taskstoissues`) is outward-facing and needs confirmation first.

**Version**: 1.0.0 | **Ratified**: 2026-10-31 | **Last Amended**: 2026-10-31
