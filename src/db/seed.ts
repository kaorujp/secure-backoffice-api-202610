import dotenv from "dotenv";
import { db } from "./index";
import { users } from "./schema";
import { hashPassword } from "../services/auth.service";

dotenv.config();

const seed = async () => {
  if (process.env.NODE_ENV === "production") {
    console.error("本番環境（NODE_ENV=production）ではシードスクリプトを実行できません。");
    process.exit(1);
  }

  console.log("初期ユーザーのシードを開始します...");

  const defaultUsers = [
    {
      email: "admin@example.com",
      password: process.env.SEED_ADMIN_PASSWORD || "AdminPassword123!",
      role: "admin" as const,
    },
    {
      email: "staff@example.com",
      password: process.env.SEED_STAFF_PASSWORD || "StaffPassword123!",
      role: "staff" as const,
    },
    {
      email: "auditor@example.com",
      password: process.env.SEED_AUDITOR_PASSWORD || "AuditorPassword123!",
      role: "auditor" as const,
    },
  ];

  for (const u of defaultUsers) {
    const passwordHash = await hashPassword(u.password);
    await db
      .insert(users)
      .values({
        email: u.email,
        passwordHash,
        role: u.role,
      })
      .onConflictDoNothing({ target: users.email });
  }

  console.log("シードが完了しました（既存ユーザーはスキップされました）。");
  process.exit(0);
};

seed().catch((err) => {
  console.error("シード実行中にエラーが発生しました:", err);
  process.exit(1);
});
