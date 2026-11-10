import { NextResponse } from "next/server";
import { env } from "@/env";

/**
 * Minimal health check. Reports process liveness and which
 * integrations are configured vs. not -- by mode name only, never a
 * secret, connection string, or other sensitive diagnostic. This
 * route is intentionally unauthenticated (it must work before any
 * auth/session infrastructure is reachable) and intentionally
 * uninformative beyond "is the process up and what mode is each
 * integration in."
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      integrations: {
        email: env.EMAIL_MODE,
        scheduler: env.SCHEDULER_MODE,
        ai: env.AI_MODE,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
