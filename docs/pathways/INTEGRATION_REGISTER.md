# Pathways Discovery App — Integration Register

Version: 0.2.0-phase0-corrected
No secrets, credentials, tokens, or account identifiers appear in this document. "CONFIRMED" means an owner-approved, specific choice exists and is recorded here by name/mode only (never a key or credential). "UNCONFIRMED" means no choice has been made yet. A CONFIRMED framework/library choice does not by itself imply a live external service is connected — see the "Mode" column.

| Integration | Status | Mode at Phase 1 | Notes |
|---|---|---|---|
| Source control / repository | CONFIRMED | — | `sionethompson06/Explore-Pathways` on GitHub, branch `claude/kind-gauss-f2d7ng`, owner-confirmed. |
| Hosting/deployment | UNCONFIRMED | Not deployed | No project connected or verified for this repository. No paid services, hosted accounts, or domains authorized in Phase 1. Preview deployments, if used later, do not count as production approval. |
| Application framework | **CONFIRMED (DEC-E1)** | Local dev/build only | Next.js App Router + TypeScript. Exact installed version recorded below once scaffolded. |
| Database | **CONFIRMED (DEC-E1)** | Local/test instance only | PostgreSQL. This session's sandbox has `postgresql-16` (server + client) already installed; used as a local/test cluster only, never a production database. |
| Migration/ORM layer | **CONFIRMED (DEC-E1)** | Local/test only | Drizzle (schema + typed migrations). |
| Schema validation | **CONFIRMED (DEC-E1)** | — | Zod, used at every server boundary (request validation and public DTO shaping). |
| Package manager | **CONFIRMED (DEC-E1)** | — | pnpm, with a committed lockfile. |
| Authentication | **CONFIRMED (DEC-E1)**, library only | Groundwork only, live sending disabled | Better Auth via its Drizzle adapter, implementing verified single-use email-link sign-in. No real email is sent in Phase 1 (see Email row). No staff/advisor/admin area is exposed unsecured. No custom auth system, impersonation route, public role selector, or dev-login shortcut. |
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
