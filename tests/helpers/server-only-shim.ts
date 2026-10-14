// Test-only shim for the `server-only` package.
//
// Next.js's own bundler (webpack/Turbopack) is what actually enforces
// the server/client import boundary in the real application build --
// it aliases `server-only` to a module that throws specifically when
// pulled into a *client* bundle, and does nothing on the server. That
// enforcement is untouched by this file; it only applies inside
// `next build`/`next dev`, which this shim is never part of.
//
// Vitest runs everything in plain Node, with no client/server bundle
// distinction, so importing the real `server-only` package there
// always throws ("This module cannot be imported from a Client
// Component module") regardless of context. This shim -- aliased in
// vitest.config.ts, and only there -- lets test files import
// server-only modules (src/auth/config.ts, src/server/session.ts,
// etc.) directly, which is necessary to test them at all, without
// weakening what the shipped app itself enforces.
export {};
