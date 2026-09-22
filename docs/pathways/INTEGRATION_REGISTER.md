# Pathways Discovery App — Integration Register

Version: 0.1.0-phase0-candidate
No secrets, credentials, tokens, or account identifiers appear in this document. "CONFIRMED" means an owner-approved, specific choice exists and is recorded here by name/mode only (never a key or credential). "UNCONFIRMED" means no choice has been made yet. Nothing in this register implies a service is connected, live, or tested — Phase 0 performed no integration work.

| Integration | Status | Mode at Phase 1 start | Notes |
|---|---|---|---|
| Source control / repository | CONFIRMED | — | `sionethompson06/Explore-Pathways` on GitHub, branch `claude/kind-gauss-f2d7ng`, owner-confirmed. |
| Hosting/deployment | UNCONFIRMED | Not deployed | Pack proposes Vercel as a default; no project has been connected or verified for this repository. Preview deployments, if used later, do not count as production approval. |
| Application framework | UNCONFIRMED (recommended, not yet owner-fixed) | — | Next.js App Router + TypeScript recommended per master prompt default (repository is greenfield — no existing framework to preserve or conflict with). Exact version to be pinned at Phase 1 start by checking official documentation, not invented here. |
| Database | UNCONFIRMED | Not provisioned | PostgreSQL recommended per master prompt default. No instance provisioned; no connection string exists. |
| Migration/ORM layer | UNCONFIRMED | — | A typed migration layer is required (e.g. Drizzle or Prisma migrate); specific choice is DEC-E1 in `DECISION_LOG.md`. |
| Schema validation | UNCONFIRMED (recommended) | — | Zod or equivalent runtime validator recommended for both request validation and public DTO shaping. |
| Authentication | UNCONFIRMED | Not configured | Must be an established, supported provider implementing verified single-use email sign-in (e.g. Auth.js or a managed provider) — never bespoke auth. Google sign-in, if added, is optional. Specific provider is DEC-E1. Until configured, no staff/advisor/admin area may be exposed unsecured. |
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
