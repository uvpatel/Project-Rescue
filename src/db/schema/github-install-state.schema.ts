import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth.schema";
import { workspaces } from "./workspace.schema";
export const githubInstallStates = pgTable("github_install_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  stateHash: text("state_hash").notNull().unique(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("github_install_states_user_id_idx").on(table.userId),
  index("github_install_states_workspace_id_idx").on(table.workspaceId),
  index("github_install_states_expires_at_idx").on(table.expiresAt),
]);
export type GithubInstallState = typeof githubInstallStates.$inferSelect;
