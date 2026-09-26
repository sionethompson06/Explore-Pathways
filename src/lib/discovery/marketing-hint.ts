import { isGoalInterest, type GoalInterest } from "@/content/goals";

/**
 * Marketing-level interest id (src/content/goals.ts) -> canonical
 * DISC_006 enum value. Never the reverse; never used to redefine a
 * canonical value's meaning. Deliberately framework/database
 * independent (no `server-only` import, no `@/db` import anywhere in
 * this file's own graph) so it can be shared, unduplicated, by both
 * the real server-backed Discovery flow (src/server/discovery-draft.ts)
 * and the DB-free Preview Demo Mode (app/discover/demo/*) -- the demo
 * route must never import anything that touches a database, and this
 * lookup has no reason to require one.
 */
export const INTEREST_HINT_MAP: Record<GoalInterest, string> = {
  athletics: "ATHLETICS",
  flexible_schedule: "SCHEDULE_FLEXIBILITY",
  homeschool_support: "HOMESCHOOL",
  academic_challenge: "ACADEMIC_ACCELERATION",
  different_environment: "DIFFERENT_ENVIRONMENT",
  unsure: "EXPLORING",
};

export function mapMarketingInterestToHint(interest: string | null | undefined): string | null {
  if (!interest || !isGoalInterest(interest)) return null;
  return INTEREST_HINT_MAP[interest];
}
