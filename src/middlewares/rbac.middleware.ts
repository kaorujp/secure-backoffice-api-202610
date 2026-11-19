// src/middlewares/rbac.middleware.ts
import { Request, Response, NextFunction } from "express";

// 認可ガードミドルウェア（許可されたロールのみ通過させる）
export const authorizeRoles = (...allowedRoles: Array<"admin" | "staff" | "auditor">) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "このリソースに対するアクセス権限がありません" });
    }
    next();
  };
};