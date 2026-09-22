import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/config";

/**
 * Standard Better Auth catch-all route. This exposes the library's
 * own endpoints (session, sign-in/out, magic-link verification) --
 * it does not itself expose any Pathways domain data, staff area, or
 * public report. No dev-login shortcut or impersonation route is
 * added here or anywhere in this codebase.
 */
export const { GET, POST } = toNextJsHandler(auth);
