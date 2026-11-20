// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ExpressのRequest型にuserプロパティを拡張
export interface AuthUserPayload {
  userId: string;
  role: "admin" | "staff" | "auditor";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

// Cookie内のJWTを検証してリクエストコンテキストにユーザー情報を注入
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ error: "認証が必要です" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string, {
      algorithms: ["HS256"],
    }) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "セッションの有効期限が切れているか無効です" });
  }
};
