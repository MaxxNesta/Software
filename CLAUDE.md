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
- Database: Neon Postgres, two branches. **`main` is production** — what
  Vercel serves and what the pilot tester enters real data into. **`dev` is a
  branch off it** (created 2026-08-18 at head), and local `.env` points there,
  so `npm run dev` and any test script hit `dev` by default.
  - Never let a local command write to `main`. Anything destructive or
    schema-changing against production is a deliberate, one-off act: pass
    that URL explicitly on the command line, never from `.env`.
  - The `dev` branch was taken immediately before production was cleared for
    the pilot, so it also holds the full pre-wipe dataset (41 documents) if
    an old case ever needs reproducing.
- Wiping data: `node scripts/clear.mjs` (dry run) → add `--confirm` to act,
  `--all` to take demo master data too. It keeps everything needed to post
  (company, chart of accounts, system accounts, posting rules, fiscal
  calendar, locations, units, tax codes, FOC reasons) and restarts document
  numbering at 1. `scripts/test-empty.mjs` then proves a cleared database
  still posts end to end — but it writes data, so re-clear after running it.
  Do not use `migrate.mjs --reset --seed` for a fresh start: `db/seed.sql`
  contains demo *transactions*, not just foundation.
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
