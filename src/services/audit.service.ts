// src/services/audit.service.ts
import { db } from "../db";
import { auditLogs } from "../db/schema";

// 追記専用（Append-Only）監査ログ書き込み処理
export const recordAuditLog = async (params: {
  userId: string;
  action: string;
  target: string;
  details?: Record<string, unknown>;
  ipAddress: string;
}) => {
  // 非同期でDBへ書き込み（メイン処理をブロックしない）
  await db.insert(auditLogs).values({
    userId: params.userId,
    action: params.action,
    target: params.target,
    details: params.details ? JSON.stringify(params.details) : null,
    ipAddress: params.ipAddress,
  });
};
