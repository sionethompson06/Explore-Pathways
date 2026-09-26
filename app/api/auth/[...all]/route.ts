import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/config";

/**
 * Standard Better Auth catch-all route. This exposes the library's
 * own endpoints (session inspection, sign-out, magic-link
 * verification) -- it does not itself expose any Pathways domain
 * data, staff area, or public report. No dev-login shortcut or
 * impersonation route is added here or anywhere in this codebase.
 *
 * Magic-link *initiation* (POST /api/auth/sign-in/magic-link) is
 * currently blocked by src/auth/config.ts's before-hook, since no
 * EMAIL_MODE this app implements can actually deliver a sign-in link
 * yet. See tests/magic-link.test.ts for the request/response
 * behavior this route currently exhibits; a passing health check or
 * an empty get-session response elsewhere is not evidence of a
 * working end-to-end sign-in flow.
 */
export const { GET, POST } = toNextJsHandler(auth);
