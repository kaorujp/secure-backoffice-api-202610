// src/validators/common.validator.ts
import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";

// ログイン入力スキーマ
export const loginSchema = z.object({
  email: z.string().trim().email("有効なメールアドレスを入力してください").max(255),
  password: z.string().min(8, "パスワードは8文字以上必須です").max(128),
});

// 顧客登録スキーマ（サニタイズを兼ねたtrimと形式・文字数上限）
export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, "氏名は必須です").max(255),
  email: z.string().trim().email("無効なメール形式です").max(255),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9-]+$/, "電話番号の形式が正しくありません")
    .max(50, "電話番号は50文字以内で入力してください"),
  address: z.string().trim().max(1000, "住所は1000文字以内で入力してください").optional(),
});

// 顧客更新スキーマ（部分更新を許可しつつ、空オブジェクトは拒否）
export const customerUpdateSchema = customerCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "更新する項目を1つ以上指定してください",
  });

// パスパラメータIDスキーマ（UUID検証によるIDOR・不正入力対策）
export const customerIdParamSchema = z.object({
  id: z.string().uuid("無効な顧客ID形式です"),
});

// 一覧取得ページネーションクエリスキーマ
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// 汎用リクエストボディバリデーションミドルウェア
export const validateBody = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "入力内容に不備があります",
        details: result.error.issues.map((issue) => issue.message),
      });
    }
    req.body = result.data;
    next();
  };
};

// 汎用パスパラメータバリデーションミドルウェア
export const validateParams = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: "パラメータが不正です",
        details: result.error.issues.map((issue) => issue.message),
      });
    }
    req.params = result.data as Record<string, string>;
    next();
  };
};
