import { randomUUID } from "node:crypto";

/** Prefixed opaque IDs -- never sequential, never guessable-by-enumeration. */
export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
