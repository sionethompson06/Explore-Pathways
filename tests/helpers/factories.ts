import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  user,
  studentPathwayRecord,
  guardianStudentAccess,
  discoverySession,
  consultationRequest,
  advisorAssignment,
  staffRole,
} from "@/db/schema";
import { generateId } from "@/server/ids";

/**
 * Fictional, minimal fixture builders for tests only. No production
 * code imports this module. Field values are deliberately
 * placeholder-obvious (test-*), matching the golden-profiles.json
 * convention of clearly synthetic data.
 */

export async function createTestUser(
  db: Database,
  overrides: Partial<{ email: string; name: string }> = {},
) {
  const id = generateId("user");
  await db.insert(user).values({
    id,
    email: overrides.email ?? `${id}@test.example`,
    name: overrides.name ?? "Test User",
    emailVerified: true,
  });
  return id;
}

export async function createTestStudent(db: Database) {
  const id = generateId("student");
  await db.insert(studentPathwayRecord).values({ id });
  return id;
}

export async function linkGuardianToStudent(
  db: Database,
  guardianUserId: string,
  studentPathwayRecordId: string,
) {
  const id = generateId("access");
  await db.insert(guardianStudentAccess).values({
    id,
    guardianUserId,
    studentPathwayRecordId,
  });
  return id;
}

export async function revokeGuardianAccess(db: Database, accessId: string) {
  await db
    .update(guardianStudentAccess)
    .set({ revokedAt: new Date() })
    .where(eq(guardianStudentAccess.id, accessId));
}

export async function attachStudentToSession(
  db: Database,
  discoverySessionId: string,
  studentPathwayRecordId: string,
) {
  await db
    .update(discoverySession)
    .set({ studentPathwayRecordId })
    .where(eq(discoverySession.id, discoverySessionId));
}

export async function createDiscoverySessionRow(
  db: Database,
  overrides: Partial<{
    tokenHash: string;
    studentPathwayRecordId: string | null;
    expiresAt: Date;
  }> = {},
) {
  const id = generateId("dsess");
  await db.insert(discoverySession).values({
    id,
    tokenHash: overrides.tokenHash ?? generateId("hash"),
    studentPathwayRecordId: overrides.studentPathwayRecordId ?? null,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
  });
  return id;
}

export async function createConsultationRequest(
  db: Database,
  studentPathwayRecordId: string,
) {
  const id = generateId("consult");
  await db.insert(consultationRequest).values({ id, studentPathwayRecordId });
  return id;
}

export async function assignAdvisor(
  db: Database,
  advisorUserId: string,
  consultationRequestId: string,
) {
  const id = generateId("assign");
  await db.insert(advisorAssignment).values({
    id,
    advisorUserId,
    consultationRequestId,
  });
  return id;
}

export async function unassignAdvisor(db: Database, assignmentId: string) {
  await db
    .update(advisorAssignment)
    .set({ unassignedAt: new Date() })
    .where(eq(advisorAssignment.id, assignmentId));
}

export async function grantStaffRole(
  db: Database,
  userId: string,
  role: "ADVISOR" | "ADMIN",
) {
  const id = generateId("staff");
  await db.insert(staffRole).values({ id, userId, role });
  return id;
}
