/**
 * Shared helper for the SAVEPOINT + 23505-catch idempotency pattern
 * used throughout this codebase (see src/server/discovery-draft.ts's
 * own copy, which predates this shared extraction and is left as-is).
 * Checks the specific unique-index name, not merely "was this a
 * conflict," so an unrelated unique-constraint violation is never
 * silently swallowed and mistaken for an idempotent replay.
 */
export function isUniqueConstraintConflict(err: unknown, constraintName: string): boolean {
  const cause = (err as { cause?: { code?: string; constraint?: string } } | undefined)?.cause;
  const code = cause?.code ?? (err as { code?: string } | undefined)?.code;
  const constraint = cause?.constraint ?? (err as { constraint?: string } | undefined)?.constraint;
  return code === "23505" && constraint === constraintName;
}
