// src/services/auth.service.ts
import * as argon2 from "argon2";

// パスワードのハッシュ化（登録時）
export const hashPassword = async (plainPassword: string): Promise<string> => {
  return await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64MB
    timeCost: 3,
  });
};

// パスワードの照合（ログイン時）
export const verifyPassword = async (hash: string, plainPassword: string): Promise<boolean> => {
  return await argon2.verify(hash, plainPassword);
};
