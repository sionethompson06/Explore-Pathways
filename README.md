# Pathways Discovery App

An education pathways ecosystem: guest-safe Discovery, a preliminary Discovery Report, and (Phase 2, this build) the public marketing site. See `docs/pathways/` for the full phase-by-phase specification, decision log, and evidence record; `docs/pathways/PHASE_STATUS.md` is the authoritative status of what's actually built versus planned.

This is a development build. It is not deployed anywhere public (see `docs/pathways/INTEGRATION_REGISTER.md`) and is not indexable by search engines (`app/robots.ts`).

## Requirements

- Node.js >= 20.9.0
- pnpm 10.33.0 (`packageManager` pinned in `package.json`)
- PostgreSQL 16 (local, for the app's own auth/session tables -- the marketing site itself makes no database calls)

## Local setup

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL / BETTER_AUTH_SECRET for your local Postgres
pnpm db:migrate
pnpm dev
```

Then open `http://localhost:3000/` for the marketing site (`/`, `/how-it-works`, `/pathways/athletes`, `/pathways/homeschool`, `/pathways/flexible-learning`, `/pathways/academic-opportunities`, `/for-partners`, `/discover`, `/privacy`, `/terms`).

## Tests

```bash
pnpm typecheck              # tsc --noEmit
pnpm lint                   # eslint .
pnpm test                   # vitest -- unit + PostgreSQL integration tests (needs DATABASE_URL/TEST_DATABASE_URL)
pnpm build                  # next build -- production build, all routes
pnpm test:e2e                # playwright test -- browser smoke tests + responsive screenshots (see below)
```

`pnpm test:e2e` starts its own `next dev` server on port 3100 and runs against the Chromium already installed in most sandboxed dev environments at `PLAYWRIGHT_BROWSERS_PATH` (see `playwright.config.ts`). On a machine without a pre-installed Chromium, run `pnpm exec playwright install chromium` first, then remove the hardcoded `executablePath` in `playwright.config.ts` (or point it at your own install).

Playwright screenshots are written to `screenshots/` (git-ignored -- they're local inspection evidence, not committed).
