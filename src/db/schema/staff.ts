import { pgTable, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

/**
 * Staff role assignment. Deliberately a separate table from `user`,
 * never a self-service field: nothing in application code lets a
 * user set their own row here. Per the master prompt's nonnegotiable
 * behavior 8 and the Phase 1 acceptance criterion "no public account
 * can select staff role," the only way a row is created is a
 * server-side/DB action performed by someone already authorized (or,
 * for the very first admin, a manual operational step -- never a
 * public signup path).
 */
export const staffRoleEnum = pgEnum("staff_role_type", ["ADVISOR", "ADMIN"]);

export const staffRole = pgTable(
  "staff_role",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: staffRoleEnum("role").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    assignedByUserId: text("assigned_by_user_id").references(() => user.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("staff_role_user_unique_idx").on(table.userId)],
);

export const staffRoleRelations = relations(staffRole, ({ one }) => ({
  user: one(user, { fields: [staffRole.userId], references: [user.id] }),
  assignedBy: one(user, {
    fields: [staffRole.assignedByUserId],
    references: [user.id],
  }),
}));
