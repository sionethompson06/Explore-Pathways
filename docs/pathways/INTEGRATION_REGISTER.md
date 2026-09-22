# Pathways Discovery App — Integration Register

Version: 0.2.0-phase0-corrected
No secrets, credentials, tokens, or account identifiers appear in this document. "CONFIRMED" means an owner-approved, specific choice exists and is recorded here by name/mode only (never a key or credential). "UNCONFIRMED" means no choice has been made yet. A CONFIRMED framework/library choice does not by itself imply a live external service is connected — see the "Mode" column.

| Integration | Status | Mode at Phase 1 | Notes |
|---|---|---|---|
| Source control / repository | CONFIRMED | — | `sionethompson06/Explore-Pathways` on GitHub, branch `claude/kind-gauss-f2d7ng`, owner-confirmed. |
| Hosting/deployment | UNCONFIRMED | Not deployed | No project connected or verified for this repository. No paid services, hosted accounts, or domains authorized in Phase 1. Preview deployments, if used later, do not count as production approval. |
| Application framework | **INSTALLED (DEC-E1)** | Local dev/build only | Next.js 16.3.5, App Router, TypeScript 6.0.3 (pinned below "latest" 7.0.2 for a real `typescript-eslint` peer-dependency constraint; see `PHASE_STATUS.md` Phase 1 evidence). React 19.3.0. |
| Database | **INSTALLED (DEC-E1)** | Local/test instance only | PostgreSQL 16.13 (`postgresql-16` package, already present in this sandbox). Two local databases exist: `pathways_dev`, `pathways_test`, owned by a local `pathways_app` role. Neither is a production database; no production instance exists. |
| Migration/ORM layer | **INSTALLED (DEC-E1)** | Local/test only | Drizzle ORM 0.45.3 + drizzle-kit 0.31.11. 19 tables migrated to both local databases (`drizzle/0000_tan_morlun.sql`). |
| Schema validation | **INSTALLED (DEC-E1)** | — | Zod 4.6.5, used at every server boundary (env validation, contract loading, public DTO shaping). |
| Package manager | **INSTALLED (DEC-E1)** | — | pnpm 10.33.0, lockfile committed (`pnpm-lock.yaml`). |
| Authentication | **INSTALLED (DEC-E1)**, library only | Groundwork only, live sending disabled | Better Auth 1.7.5 via its Drizzle adapter (`better-auth/adapters/drizzle`) and the `magicLink` plugin, implementing verified single-use email-link sign-in. Runtime-verified against real PostgreSQL in this session: a sign-in request creates a real `verification` row and logs (never sends) the link; no `user` row is created until verification completes. No real email is sent in Phase 1 (see Email row). No staff/advisor/admin area is exposed unsecured. No custom auth system, impersonation route, public role selector, or dev-login shortcut exists anywhere in this codebase. |
| Testing | **INSTALLED** | Local/CI only | Vitest 5.0.1. 32/32 tests pass against real local PostgreSQL; Postgres-dependent suites verified to report as honestly "skipped" (not "passed") when `TEST_DATABASE_URL` is unset. |
| CI | **AUTHORED, not yet dispatched** | — | `.github/workflows/ci.yml`: typecheck, lint, migrate, test, build, against an ephemeral `postgres:16` service container with CI-only placeholder credentials. YAML-validated locally; every step it runs was independently verified via a local clean-room simulation in this session. Not yet run by GitHub Actions itself (no push has triggered it). |
| Email delivery | UNCONFIRMED | UNCONFIGURED | No provider selected, no sending credential exists. Report/save flows must present an honest "not yet available" state for anything requiring real email until this is resolved (DEC-D3). |
| Scheduler / consultation booking | UNCONFIRMED | UNCONFIGURED | Adapter must support three modes end-to-end: `UNCONFIGURED`, `REQUEST_ONLY`, `LIVE_VERIFIED`. No provider selected. A browser redirect must never be treated as a confirmed booking; confirmation requires a validated provider API/webhook with signature and replay checks. |
| AI / LLM provider | UNCONFIRMED | DISABLED | Optional for launch (Phase 8). No provider, data-handling terms, or budget ceiling approved yet (DEC-D5). The full Discovery Report must work end-to-end with this in the DISABLED state — this is a hard MVP requirement, not a temporary placeholder. |
| Analytics | UNCONFIRMED (recommended, not yet owner-fixed) | — | First-party only; no third-party ad pixels or session-replay tooling permitted on intake/report/auth/booking/staff screens under any configuration. |
| Media / imagery rights | UNCONFIRMED | — | The two supplied homepage mockups are design reference only; no photography or copy from them may be treated as licensed or available for production use without separate confirmation (DEC-D6). |

## What each UNCONFIRMED integration means operationally right now

Per the master prompt's nonnegotiable behavior 9: "No real email, booking, AI request, child-data collection or production deployment until the relevant operational and privacy gates pass. Unconfigured features return honest unavailable/request states; do not fake success." Concretely, until each row above is resolved:

- No real email will be sent by the application under any circumstances.
- No real appointment will be presented as booked; at most a request can be recorded once an owner decision permits `REQUEST_ONLY` mode.
- No call to any AI/LLM provider will be made; the report generator runs in template-only mode unconditionally.
- No production deployment will occur; only prototype/synthetic-mode operation is in scope until the Section D launch decisions in `DECISION_LOG.md` are resolved.
- No real child or family data is collected in Phases 1-8; fixtures and synthetic test data only, per `fixtures/golden-profiles.json`'s own notice that its cases are fictional.

## Confirmed-safe to proceed without these

Foundation work (Phase 1: schema, access-control layer, guest-session handling, environment validation, migration tooling, CI, health checks) does not require any of the UNCONFIRMED rows above to be resolved first — it only requires the DEC-E1 database/ORM and auth-provider *pattern* to be chosen so code can be written against it. Everything else in this register can remain UNCONFIRMED through Phases 1-7 and still allow honest, fully-functional development against fixtures, exactly as the pack intends.
