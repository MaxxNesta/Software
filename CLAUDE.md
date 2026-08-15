# Working with Claude on this repo

Notes for any Claude Code session opened here — committed so they travel with
the repo across machines, not just the one they were written on.

## Read first

- [docs/04-development.md](docs/04-development.md) — setup, scripts, and the
  hard rules for touching the ledger (never write outside `lib/posting.ts`,
  never store a derived figure, corrections are reversals, never edit an
  applied migration)
- [docs/02-posting-matrix.md](docs/02-posting-matrix.md) — what every document
  type does to the ledger
- [docs/01-document-flow.md](docs/01-document-flow.md) — how documents chain
  together (Order → Delivery/Receipt → Invoice → Payment)
- [docs/03-decisions.md](docs/03-decisions.md) — resolved and open design
  decisions, with the reasoning behind each

## Git

- Never commit or push without an explicit instruction in that message
  ("commit", "push", "push commit"). An earlier approval doesn't carry
  forward to later changes.
- Never stage `Software/` — a stray untracked duplicate clone of this same
  repo, stuck on an old commit. Always `git add` explicit paths, never
  `-A`/`.`.

## Deployment

- GitHub: `SoftwareERPmm/Software`, `main` is both the working and
  production branch.
- Hosting: Vercel project "software" (`prj_4VHZiHWbYM79np3m5ogjsjDY5dKF`),
  team "Kaung Htet's projects" (`team_vPlcInd1S2X9k0g9oQveX4lc`).
- Database: Neon Postgres. No `DATABASE_URL` is kept in any local
  environment — ask for it fresh when a migration or a live check against
  production is actually needed.
- If Vercel MCP tools are connected, use `get_runtime_errors`/
  `get_runtime_logs` against the project/team above to diagnose a reported
  production error directly, rather than asking for server logs to be
  pasted in.

## Working style

- Long pasted "advice" or critique documents about this app's design come up
  often — they read like another AI's analysis of the codebase. Verify every
  specific claim against the actual code before implementing any of it.
  Several have contained real misconceptions (e.g. that AR/AP control
  accounts should be manually postable, which the schema deliberately
  blocks via `fn_journal_line_account_guard`).
- For a broad or ambiguous request, or one that touches a hard-to-reverse
  design fork, survey the code for the real options first, then offer a
  small set of concrete, grounded choices rather than guessing.
