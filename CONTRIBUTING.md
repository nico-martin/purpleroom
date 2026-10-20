# Contributing to Purple Room

Thanks for helping build a useful, trusted space for conference speakers. Small, focused contributions are welcome. These guidelines apply to human contributors **and their coding agents**.

## Before you start

1. Read [AGENTS.md](AGENTS.md) for architecture, coding conventions, privacy requirements, and safe development practices.
2. Read [the app logic](docs/agent/app-logic.md) before changing behaviour. It is the reference for current product rules—not a feature wishlist.
3. Check existing issues and pull requests. For new features, dependencies, architectural changes, or changes to permissions/data retention, agree the scope in an issue before implementing.
4. Run `git status --short`. Identify and preserve existing work, including changes made by someone else or another agent.

If implementation and documented privacy rules disagree, raise the discrepancy rather than silently weakening the rule.

## Branches and pull requests

**Never commit directly to `main`, and never push working changes directly to it.** Work on a dedicated branch and submit a pull request. Maintainers integrate reviewed pull requests into `main`; a push to `main` triggers production deployment.

GitHub enforces a pull-request-only ruleset for `main`, with no bypass actors (including admins), no force-pushes, and no branch deletion. An external approval is not required, so a solo maintainer can still integrate a PR after reviewing it. Do not disable or bypass these protections to finish a task. These are repository settings, not protections installed automatically by cloning this repository.

Use a short, descriptive, lowercase branch name:

| Prefix | Use | Example |
| --- | --- | --- |
| `fix/` | Bug fixes | `fix/cfp-column-alignment` |
| `security/` | Security hardening and vulnerability fixes | `security/login-rate-limits` |
| `feat/` | New features | `feat/conference-subscriptions` |
| `docs/` | Documentation-only changes | `docs/contributing-guidelines` |
| `chore/` | Tooling, maintenance, and dependency updates | `chore/update-playwright` |

- Start from an up-to-date `main` unless the work explicitly depends on another branch. Keep dependent branches/PRs clearly identified.
- Keep one concern per branch/PR. Avoid unrelated refactoring, bulk formatting, or dependency churn.
- Use short, descriptive commit messages. Review the staged diff so secrets, runtime files, and unrelated work do not slip in.
- Do not force-push shared branches or rewrite other contributors' history without agreement.
- Worktrees are separate checkouts, not files to include in a commit. Never stage nested repositories; keep `.claude/worktrees/` and other local worktree directories out of Git.
- Resolve conflicts deliberately and rerun affected tests after integrating upstream changes. Do not merge another branch merely because an agent finds it locally.

### Required agent workspace

For **every new task**, coding agents must create both a **fresh branch** with the appropriate prefix and a **separate Git worktree** before editing. Git worktrees are local checkouts; their branches and PRs are hosted on GitHub. Do not reuse another task's branch/worktree or edit in the shared primary checkout.

For example, after checking the existing work and confirming the task's base branch:

```bash
git fetch origin
git worktree add -b feat/short-description ../purpleroom-short-description origin/main
```

Run edits, dependency installation, checks, and any authorised commits from the new worktree. Use a unique directory and branch name; if the task explicitly depends on unmerged work, agree the base branch first. Keep databases, runtime storage, and development-server ports isolated as well—do not automatically copy secrets or live data into the worktree.

If a new worktree/branch cannot be created, stop and ask rather than silently using `main` or another agent's checkout. Do not remove existing worktrees or branches without authorisation.

## Development conventions

Follow the setup and commands in [AGENTS.md](AGENTS.md#local-development). Use the pinned **pnpm** version and `pnpm-lock.yaml`; do not add npm/yarn lockfiles.

- Keep the existing React/TypeScript frontend and framework-free PHP/SQLite backend lightweight. Discuss new frameworks, libraries, services, or database engines first.
- Reuse theme primitives, design tokens, API helpers, and domain utilities. Support keyboard navigation, accessible labels, responsive layouts, and light/dark appearance.
- Enforce permissions and filter private fields on the server, not just in the UI. Admin access must not reveal another member's private proposals or submission details.
- Preserve existing data and compatibility identifiers. Never rewrite `api/db/schema.sql` or a shipped migration; add the next numbered migration and test upgrades from existing data.
- Keep behaviour documentation current in the same PR. Put hosting procedures in [docs/deployment.md](docs/deployment.md), and keep the README focused on users and project evaluation.

## Test coverage is part of the change

There is no blanket percentage target: cover the behaviour and risks introduced by the change. A passing build alone is not sufficient.

- **Bug fixes:** add a regression test that reproduces the failure and passes with the fix. Where practical, confirm it fails without the fix.
- **New features:** cover the main workflow, validation failures, empty/error states, and applicable permission boundaries. Test the API as well as the interface when both change.
- **Security/privacy changes:** test denial and non-disclosure, not just successful requests. Include relevant owner/non-owner, member/admin, friend/non-friend, suspended, and anonymous cases. Preserve throttling and atomicity; test races/rollback where relevant.
- **Database changes:** verify existing IDs, field values, relationships, constraints, and migration idempotency. Use legacy fixtures, not only a fresh database.
- **UI changes:** add/update browser regressions for the affected interaction or layout. Check narrow screens, both themes, and keyboard/focus behaviour where applicable. Screenshots help review but do not replace assertions.
- Never delete, skip, or weaken a failing test just to make a change pass. If an expectation genuinely changes, explain the agreed product change and update the test accordingly.
- Use synthetic fixtures and isolated databases/storage/ports. Automated tests must never run deletion, migrations, sign-in delivery, or imports against production data or real recipients. Any explicitly authorised production verification follows the deployment guide instead.

### Checks to run

Run the relevant checks and report their actual results in the PR. Run the full suite for broad product, database, or privacy changes:

```bash
pnpm build
pnpm lint
pnpm test:api
pnpm test:editions
pnpm test:logos
pnpm test:deploy
pnpm test:mail
pnpm test:ui
git diff --check
```

Run `php -l path/to/file.php` for every changed PHP file. Browser tests require Chromium (`pnpm exec playwright install chromium` on first setup); mail tests require OpenSSL and SMTP-enabled PHP cURL. See [AGENTS.md](AGENTS.md#checks) for test isolation and coverage details. Do not stop the normal backend on port 8000 to run tests.

Documentation-only changes normally need link/path checks and `git diff --check`, not the full application suite. Clearly disclose checks that failed or were not run and why; never describe unrun checks as passing.

## Additional rules for coding agents

- Follow this guide and `AGENTS.md`; being asked to implement a feature is **not** permission to commit, push, merge, deploy, or modify a live database.
- Always start a new task in a fresh, appropriately prefixed branch and a separate Git worktree as described above. Never commit on `main`, even when asked to commit a change, and never bypass GitHub's branch protections. Use the PR workflow.
- Work within the requested scope. Ask before resolving ambiguous product/privacy decisions, adding dependencies, deleting retained data, or expanding a feature.
- Do not discard someone else's edits, run destructive resets, remove worktrees, or broadly delete runtime storage. Avoid repository-wide formatting when targeted formatting will do.
- Use isolated fixtures and local services. Do not send real emails or change hosting settings without explicit authorisation. Never expose secrets, login codes, session cookies, private account data, or database contents in logs, screenshots, issues, or PRs.
- Before handing over, inspect the final diff, identify tests actually run, and explain remaining risks or blockers. Leave unrelated changes intact and do not claim a deployment or successful test run without evidence.

## Pull request checklist

- [ ] The branch uses the appropriate prefix, agent work was isolated in a task-specific Git worktree, and the PR has one clear purpose.
- [ ] The description explains the problem, intended behaviour, and any linked issue.
- [ ] Relevant regression tests and negative/permission cases are included.
- [ ] Check results are listed, including anything not run or still failing.
- [ ] UI changes include useful screenshots; schema changes explain upgrade safety and data preservation.
- [ ] Behaviour changes update the living app logic; operational changes update the deployment guide.
- [ ] No secrets, local files, runtime data, nested repositories, or unrelated changes are included.
- [ ] Any new dependencies or significant scope changes were agreed before implementation.

## Reporting vulnerabilities

Do not publish exploitable details, real account data, or secrets in a public issue. Use the repository's private vulnerability-reporting feature if enabled; otherwise contact the maintainer privately to agree a safe disclosure channel before sharing details. Use synthetic reproduction data wherever possible.
