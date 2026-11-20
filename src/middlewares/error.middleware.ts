// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from "express";

// サーバー内部の詳細エラーを隠蔽し、安全なレスポンスのみを返す統一エラーハンドラー
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // サーバー内部コンソールにのみスタックトレース等の詳細を出力
  console.error(`[SECURITY ERROR] ${new Date().toISOString()} - ${err.stack}`);

  // クライアント側には内部情報を漏洩させず固定メッセージのみを返却
  res.status(500).json({
    error: "予期せぬエラーが発生しました。管理者にお問い合わせください。",
  });
};