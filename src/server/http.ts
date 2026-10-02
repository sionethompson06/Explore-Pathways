import { NextResponse } from "next/server";

/**
 * Every response carrying account-scoped or otherwise sensitive data
 * must use this, not a bare NextResponse.json -- per Specification 07
 * "sensitive private responses use private/no-store cache policy and
 * cannot be reused in public RSC/CDN caches."
 */
export function privateJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
