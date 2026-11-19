import rateLimit from "express-rate-limit";

// ログインエンドポイント向けの厳格なブルートフォース対策
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 15分あたり最大5回まで
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "ログイン試行回数が上限を超えました。15分後に再度お試しください。",
  },
});

// API全体向けの汎用レートリミット
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 15分あたり最大100リクエストまで
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "リクエスト回数が上限を超えました。しばらく待ってから再度お試しください。",
  },
});
