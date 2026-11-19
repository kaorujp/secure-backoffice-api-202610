import { pgTable, varchar, timestamp, text } from "drizzle-orm/pg-core";

// users: ロール定義とUUID主キー
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().$type<"admin" | "staff" | "auditor">(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// customers: 顧客情報テーブル
export const customers = pgTable("customers", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// audit_logs: 改ざん防止（updated_atを持たせないAppend-Only設計）
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  target: varchar("target", { length: 100 }).notNull(),
  details: text("details"),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 型定義のエクスポート
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;