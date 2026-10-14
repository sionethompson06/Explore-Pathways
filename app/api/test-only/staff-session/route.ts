import "server-only";
import { eq, and, isNull } from "drizzle-orm";
import { env } from "@/env";
import { db } from "@/db/client";
import { buildAuth } from "@/auth/config";
import { generateId } from "@/server/ids";
import { staffRole, type staffRoleEnum } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Phase 6C test-only staff sign-in (docs/pathways instruction section
 * 18/25). Lets a Playwright test establish a REAL, verified Better
 * Auth session -- the same magic-link mechanism Phase 1/1A already
 * built, never a new or invented authentication path -- without a
 * real email provider, by reusing `buildAuth`'s existing, documented
 * "test-harness override only" parameters (see src/auth/config.ts).
 *
 * Gated exclusively by `env.ALLOW_TEST_FIXTURES`, the same
 * narrowly-scoped escape hatch Phase 1 already established for
 * exactly this purpose ("seeding a... session without a real browser
 * flow"). `src/env.ts` already refuses to even start the process if
 * this flag is true under `NODE_ENV=production` -- and a deployed
 * Vercel build (Preview or LIVE) always runs with
 * `NODE_ENV=production` -- so this route is structurally unreachable
 * in any deployed environment, never merely disabled by convention.
 * It is never linked from any page, and the REAL `auth` singleton
 * used by `/api/auth/[...all]` (and its magic-link block) is
 * completely untouched -- this route builds its own, separate,
 * short-lived auth instance purely to drive the existing sign-in
 * flow to completion server-side.
 */
type RequestedStaffRole = (typeof staffRoleEnum.enumValues)[number];

function isRequestedStaffRole(value: unknown): value is RequestedStaffRole {
  return value === "ADVISOR" || value === "ADMIN";
}

export async function POST(request: Request) {
  if (!env.ALLOW_TEST_FIXTURES) {
    return new Response("Not Found", { status: 404 });
  }

  let body: { email?: unknown; staffRole?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  }
  const email = typeof body.email === "string" && body.email.length > 0 ? body.email : null;
  if (!email) {
    return Response.json({ ok: false, error: "EMAIL_REQUIRED" }, { status: 400 });
  }

  let capturedToken: string | undefined;
  const testAuth = buildAuth({
    db,
    blockMagicLink: false,
    sendMagicLink: (ctx) => {
      capturedToken = ctx.token;
    },
  });

  await testAuth.api.signInMagicLink({ body: { email }, headers: new Headers() });
  if (!capturedToken) {
    return Response.json({ ok: false, error: "SIGNIN_FAILED" }, { status: 500 });
  }

  const verifyResponse = await testAuth.api.magicLinkVerify({
    query: { token: capturedToken },
    headers: new Headers(),
    asResponse: true,
  });
  const setCookies = verifyResponse.headers.getSetCookie?.() ?? [];
  if (setCookies.length === 0) {
    return Response.json({ ok: false, error: "VERIFY_FAILED" }, { status: 500 });
  }

  if (isRequestedStaffRole(body.staffRole)) {
    const session = await testAuth.api.getSession({
      headers: new Headers({ cookie: setCookies.join("; ") }),
    });
    const userId = session?.user.id;
    if (userId) {
      const [existing] = await db
        .select({ id: staffRole.id })
        .from(staffRole)
        .where(and(eq(staffRole.userId, userId), isNull(staffRole.revokedAt)))
        .limit(1);
      if (!existing) {
        await db.insert(staffRole).values({
          id: generateId("staffrole"),
          userId,
          role: body.staffRole,
        });
      }
    }
  }

  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
