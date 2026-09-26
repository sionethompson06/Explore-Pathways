import { pgTable, text, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Minimal audit/workflow events (Phase 1 scope) and the aggregate
 * analytics event shape (table exists now; Phase 7 builds the actual
 * tracked events). Per Specification 07 "Ownership and privacy": log
 * privileged access without copying raw answers. Per "Analytics":
 * allowlisted properties only, no child name/free text/exact
 * location/email/health-academic detail/auth token/raw URL.
 * Application code is what actually enforces the allowlist when it
 * writes a row (Phase 7); this table only bounds the shape.
 */

export const actorTypeEnum = pgEnum("actor_type", [
  "GUEST",
  "GUARDIAN",
  "ADVISOR",
  "ADMIN",
  "SYSTEM",
]);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorType: actorTypeEnum("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_event_target_idx").on(table.targetType, table.targetId),
    index("audit_event_actor_idx").on(table.actorUserId),
  ],
);

export const aggregateEvent = pgTable(
  "aggregate_event",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    // Allowlisted properties only (stage, coarse interest category,
    // viewport class, experiment version, aggregate error code,
    // public campaign code, timestamp) -- see Specification 07
    // "Analytics". No child data, free text, or identifiers belong
    // here; enforced by the Phase 7 write path, not by this column.
    properties: jsonb("properties").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("aggregate_event_name_idx").on(table.eventName)],
);
