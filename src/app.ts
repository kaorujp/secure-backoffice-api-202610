import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { users, customers } from "./db/schema";
import { authenticateJWT } from "./middlewares/auth.middleware";
import { authorizeRoles } from "./middlewares/rbac.middleware";
import { errorHandler } from "./middlewares/error.middleware";
import { apiLimiter, loginLimiter } from "./middlewares/rateLimit.middleware";
import { verifyPassword } from "./services/auth.service";
import { maskCustomerData } from "./services/customer.service";
import { recordAuditLog } from "./services/audit.service";
import {
  loginSchema,
  customerCreateSchema,
  customerUpdateSchema,
  customerIdParamSchema,
  paginationQuerySchema,
  validateBody,
  validateParams,
} from "./validators/common.validator";

dotenv.config();

// 起動時環境変数バリデーション
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  console.error("環境変数の設定が不正です:", envResult.error.flatten().fieldErrors);
  process.exit(1);
}

// ユーザー不在時のタイミング差を防ぐためのダミーArgon2idハッシュ
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZTEyMw$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api", apiLimiter);

// 不正JSONボディ（SyntaxError）を400として扱う
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "リクエストボディのJSON形式が不正です" });
  }
  return next(err);
});

// ヘルスチェック ＆ ブラウザのfavicon自動リクエスト対策
app.get("/", (_req: Request, res: Response) => {
  return res.status(200).json({ status: "ok", service: "secure-backoffice-api" });
});
app.get("/favicon.ico", (_req: Request, res: Response) => {
  return res.status(204).end();
});

// 監査ログをメイン処理をブロックせずに非同期記録するヘルパー
const logAuditAsync = (params: Parameters<typeof recordAuditLog>[0]) => {
  void recordAuditLog(params).catch((err) => {
    console.error("[AUDIT LOG ERROR]", err);
  });
};

// POST /api/auth/login
app.post(
  "/api/auth/login",
  loginLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        // タイミング攻撃対策としてダミーハッシュの検証を実行し処理時間を揃える
        await verifyPassword(DUMMY_PASSWORD_HASH, password).catch(() => false);
        return res.status(401).json({ error: "メールアドレスまたはパスワードが正しくありません" });
      }

      const isValid = await verifyPassword(user.passwordHash, password);
      if (!isValid) {
        logAuditAsync({
          userId: user.id,
          action: "LOGIN_FAILED",
          target: "auth",
          details: { reason: "invalid_password" },
          ipAddress,
        });
        return res.status(401).json({ error: "メールアドレスまたはパスワードが正しくありません" });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET as string,
        { algorithm: "HS256", expiresIn: "1d" }
      );

      res.cookie("auth_token", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });

      logAuditAsync({
        userId: user.id,
        action: "LOGIN_SUCCESS",
        target: "auth",
        ipAddress,
      });

      return res.status(200).json({
        message: "ログインに成功しました",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/logout
app.post("/api/auth/logout", authenticateJWT, (req: Request, res: Response) => {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  logAuditAsync({
    userId: req.user!.userId,
    action: "LOGOUT",
    target: "auth",
    ipAddress,
  });

  return res.status(200).json({ message: "ログアウトしました" });
});

// GET /api/customers（ページネーション対応）
app.get(
  "/api/customers",
  authenticateJWT,
  authorizeRoles("admin", "staff", "auditor"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryResult = paginationQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({
          error: "クエリパラメータが不正です",
          details: queryResult.error.issues.map((issue) => issue.message),
        });
      }

      const { limit, offset } = queryResult.data;
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const customerList = await db
        .select()
        .from(customers)
        .limit(limit)
        .offset(offset);

      const responseData =
        req.user!.role === "admin"
          ? customerList
          : customerList.map(maskCustomerData);

      logAuditAsync({
        userId: req.user!.userId,
        action: "READ_CUSTOMERS",
        target: "customers",
        details: {
          count: customerList.length,
          limit,
          offset,
          masked: req.user!.role !== "admin",
        },
        ipAddress,
      });

      return res.status(200).json({
        customers: responseData,
        pagination: { limit, offset },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/customers
app.post(
  "/api/customers",
  authenticateJWT,
  authorizeRoles("admin", "staff"),
  validateBody(customerCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const { name, email, phone, address } = req.body as z.infer<
        typeof customerCreateSchema
      >;

      const [created] = await db
        .insert(customers)
        .values({
          name,
          email,
          phone,
          address: address ?? null,
        })
        .returning();

      const responseData =
        req.user!.role === "admin" ? created : maskCustomerData(created);

      logAuditAsync({
        userId: req.user!.userId,
        action: "CREATE_CUSTOMER",
        target: `customers:${created.id}`,
        details: { customerId: created.id },
        ipAddress,
      });

      return res.status(201).json({ customer: responseData });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/customers/:id（IDOR対策: UUID検証 + RBAC + 動的マスキング）
app.get(
  "/api/customers/:id",
  authenticateJWT,
  authorizeRoles("admin", "staff", "auditor"),
  validateParams(customerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, id))
        .limit(1);

      if (!customer) {
        return res.status(404).json({ error: "顧客が見つかりません" });
      }

      const responseData =
        req.user!.role === "admin" ? customer : maskCustomerData(customer);

      logAuditAsync({
        userId: req.user!.userId,
        action: "READ_CUSTOMER",
        target: `customers:${id}`,
        details: { masked: req.user!.role !== "admin" },
        ipAddress,
      });

      return res.status(200).json({ customer: responseData });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/customers/:id（admin / staffのみ。auditorはブロック）
app.put(
  "/api/customers/:id",
  authenticateJWT,
  authorizeRoles("admin", "staff"),
  validateParams(customerIdParamSchema),
  validateBody(customerUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const updates = req.body as z.infer<typeof customerUpdateSchema>;

      const [updated] = await db
        .update(customers)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "顧客が見つかりません" });
      }

      const responseData =
        req.user!.role === "admin" ? updated : maskCustomerData(updated);

      logAuditAsync({
        userId: req.user!.userId,
        action: "UPDATE_CUSTOMER",
        target: `customers:${id}`,
        details: { updatedFields: Object.keys(updates) },
        ipAddress,
      });

      return res.status(200).json({ customer: responseData });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/customers/:id（最小権限の原則に基づきadminのみ許可）
app.delete(
  "/api/customers/:id",
  authenticateJWT,
  authorizeRoles("admin"),
  validateParams(customerIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

      const [deleted] = await db
        .delete(customers)
        .where(eq(customers.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "顧客が見つかりません" });
      }

      logAuditAsync({
        userId: req.user!.userId,
        action: "DELETE_CUSTOMER",
        target: `customers:${id}`,
        ipAddress,
      });

      return res.status(200).json({
        message: "顧客情報を削除しました",
        deletedId: deleted.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 未定義ルート向けのJSON 404ハンドラー（Express既定HTML/CSPを回避）
app.use((_req: Request, res: Response) => {
  return res.status(404).json({ error: "エンドポイントが見つかりません" });
});

// 統一エラーハンドラー
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;
