import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getPrincipal } from "./principal";
import { getStaffRole, type StaffRoleValue } from "./access-control";

/**
 * Phase 6C -- the shared staff-page authorization entry point (section
 * 12). No interactive staff sign-in exists in this deployment (Better
 * Auth magic-link initiation is blocked at the source in every real
 * environment -- see src/auth/config.ts); an unauthenticated or
 * unauthorized visitor to any staff route therefore receives the same
 * honest, non-revealing `notFound()` a nonexistent route would, never
 * a "please sign in" page that would otherwise disclose that a staff
 * area exists at all.
 */
export interface StaffPrincipal {
  userId: string;
  email: string;
  role: StaffRoleValue;
}

export async function requireStaffPrincipal(
  allowedRoles: readonly StaffRoleValue[],
): Promise<StaffPrincipal> {
  const requestHeaders = await headers();
  const principal = await getPrincipal(requestHeaders);
  if (!principal) notFound();

  const role = await getStaffRole(db, principal.userId);
  if (!role || !allowedRoles.includes(role)) notFound();

  return { userId: principal.userId, email: principal.email, role };
}
