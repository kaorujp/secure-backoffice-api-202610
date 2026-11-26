# Secure Backoffice API (`secure-backoffice-api-202610`)

企業向けバックオフィス業務（顧客情報管理）を想定し、**多層防御・最小権限の原則・改ざん防止監査ログ**を軸に設計・実装したセキュアな REST API サーバーです。

---

## 🛠️ 技術スタック

- **言語 / ランタイム**: Node.js, TypeScript (`strict: true`, CommonJS), `tsx`
- **Web フレームワーク**: Express
- **データベース / ORM**: Neon (PostgreSQL), Drizzle ORM, `drizzle-kit`
- **認証 / セキュリティ**: Argon2 (`argon2id`), JSON Web Token (`HS256`), `cookie-parser`, `helmet`, `express-rate-limit`
- **バリデーション**: Zod（起動時環境変数・リクエストボディ・パスパラメータ・クエリ検証）

---

## 🛡️ 主なセキュリティ設計

- **認証とセッション保護**
  - パスワードは `Argon2id` でハッシュ化し、ユーザー不在時もダミーハッシュ検証を実行してタイミング攻撃を防止。
  - ログイン成功時に `HS256` 固定の JWT を発行し、`HttpOnly` / `SameSite=Strict` 属性付き Cookie で保持（`POST /api/auth/logout` によるログアウト対応）。
- **ロールベースアクセス制御（RBAC）& IDOR 対策**
  - `admin` / `staff` / `auditor` の3ロールで操作権限を厳格に分離（`auditor` は参照専用で変更・削除を `403` でブロック、`DELETE` は `admin` のみ許可）。
  - パスパラメータの UUID 形式を Zod で事前検証し、不正な識別子指定や IDOR を抑止。
- **ロール別・動的データマスキング**
  - `admin` 以外のロール（`staff` / `auditor`）へのレスポンスでは、メールアドレス（例: `t***@example.com` / 1文字ローカル部 `*@example.com`）および電話番号（ハイフンの位置を保持し末尾4桁以外を伏せる：`090-1234-5678` → `***-****-5678`）を自動でマスキング。
- **改ざん防止監査ログ（Append-Only）**
  - `audit_logs` テーブルは `updated_at` を持たない追記専用設計とし、`user_id`・`created_at`・`action` にインデックスを定義。
  - メインの API レスポンスを遅延させない非同期・非ブロッキング処理で 5W1H（誰が・いつ・どこから・何に・何をしたか）を記録。
- **多層防御（エラー隠蔽・ヘッダー・レートリミット）**
  - 統一エラーハンドラーでスタックトレースや DB エラー詳細を隠蔽し、クライアントには汎用エラーのみ返却。
  - `helmet` によるセキュリティヘッダー付与、`express.json({ limit: "100kb" })` によるペイロード制限、`/api/auth/login`（15分5回）および `/api` 全体（15分100回）のレートリミットを導入。

---

## 📡 API エンドポイント一覧

| メソッド | パス | 許可ロール | 概要 |
| --- | --- | --- | --- |
| `GET` | `/` | 全員 | ヘルスチェック |
| `POST` | `/api/auth/login` | 全員 | ログイン（レートリミット適用・Cookie発行） |
| `POST` | `/api/auth/logout` | 認証済み | ログアウト（Cookie削除・監査ログ記録） |
| `GET` | `/api/customers` | `admin`, `staff`, `auditor` | 顧客一覧取得（`limit`/`offset` ページネーション、非 `admin` はマスク） |
| `POST` | `/api/customers` | `admin`, `staff` | 顧客新規登録（`auditor` はブロック、非 `admin` はマスク返却） |
| `GET` | `/api/customers/:id` | `admin`, `staff`, `auditor` | 顧客詳細取得（UUID検証、非 `admin` はマスク） |
| `PUT` | `/api/customers/:id` | `admin`, `staff` | 顧客情報更新（UUID検証、`auditor` はブロック） |
| `DELETE` | `/api/customers/:id` | `admin` | 顧客情報削除（最小権限に基づき `admin` のみ許可） |

---

## 🚀 セットアップ ＆ 起動手順

### 1. 依存パッケージのインストール
```bash
npm install
```

### 2. 環境変数の設定
`.env.example` をコピーして `.env` を作成し、Neon の接続文字列（`DATABASE_URL`）と 32文字以上のランダムな `JWT_SECRET` を設定します。
```bash
cp .env.example .env
```

### 3. DB マイグレーション ＆ 初期ユーザー投入
```bash
npx drizzle-kit push
npm run seed
```
※ シードスクリプトは `NODE_ENV=production` での誤実行をブロックするガードを備えています。

### 4. 開発サーバーの起動・ビルド
```bash
# 開発サーバー起動（デフォルト: http://localhost:3001）
npm run dev

# 型チェック ＆ ビルド
npx tsc --noEmit
npm run build
```

---

## 📋 開発進捗・タスクチェックリスト

**目標期間**：2026年11月5日 〜 11月30日（1日1時間想定・全26時間）

### 🚀 フェーズ1：環境構築 ＆ DB設計（第1週：11/5 〜 11/9）
- [x] **1.1 プロジェクト初期化と基本設定**
  - [x] Node.js プロジェクトの作成（`npm init`）と TypeScript / `tsx` の導入
  - [x] `.gitignore` の設定（`node_modules/`, `.env`, `dist/` などの除外徹底）
  - [x] `package.json` のスクリプト整備（`dev`, `build`, `start`, `seed`）
- [x] **1.2 秘密情報・環境変数の安全管理**
  - [x] `.env` ファイルの作成と、Zod を用いた起動時環境変数バリデーションの実装
- [x] **1.3 Drizzle ORM ＆ Neon (PostgreSQL) 接続設計**
  - [x] `drizzle-orm` および `@neondatabase/serverless` のインストール
  - [x] Neon データベースへの接続確認
- [x] **1.4 データベース・スキーマ定義（Drizzle Schema）**
  - [x] `users` テーブル定義（UUID、ロール `admin`/`staff`/`auditor`、Argon2id ハッシュ保存）
  - [x] `customers` テーブル定義（UUID、顧客機密情報）
  - [x] `audit_logs` テーブル定義（Append-Only 構造、インデックス `user_id`・`created_at`・`action` の最適化）

### 🛡️ フェーズ2：共通基盤 ＆ セキュリティ設定（第2週：11/10 〜 11/16）
- [x] **2.1 統一セキュリティエラーハンドラー**
  - [x] 予期せぬシステム例外や DB エラーを隠蔽し、安全な汎用メッセージ（500 等）を返すミドルウェアの実装
- [x] **2.2 レートリミット（Rate Limiting）**
  - [x] ブルートフォース攻撃や過度なリクエストを防ぐレートリミットミドルウェアの導入
- [x] **2.3 Zod バリデーション共通モジュール**
  - [x] リクエストボディ・パラメータ・クエリの型検証および `.trim()` 等によるサニタイズ共通ルールの作成

### 🔑 フェーズ3：認証・認可（RBAC）の実装（第3週：11/17 〜 11/23）
- [x] **3.1 認証基盤（Argon2id ＆ JWT）**
  - [x] `argon2` を用いたパスワードハッシュ化・検証ロジックの実装（タイミング攻撃対策含む）
  - [x] ログイン成功時の JWT 発行（`HS256`）と、HttpOnly / SameSite=Strict Cookie によるセキュアな保存処理の実装
- [x] **3.2 ロールベースアクセス制御（RBAC）ミドルウェア**
  - [x] `admin` / `staff` / `auditor` のロールに応じた API アクセスコントロールの実装
  - [x] `auditor` のデータ変更・削除権限の完全排除（ブロック処理）の適用確認

### ⚙️ フェーズ4：コア機能（CRUD・マスキング・監査ログ） ＆ 仕上げ（第4週：11/24 〜 11/30）
- [x] **4.1 顧客情報 CRUD API ＆ IDOR 対策**
  - [x] UUID を活用した安全な顧客データの登録・取得・更新・削除エンドポイントの実装
  - [x] リクエストされたデータに対するアクセス権限（認可チェック・UUID 検証）の二重防御
- [x] **4.2 動的データマスキング機能**
  - [x] 非 `admin` ロールがレスポンスを受け取る際、メールアドレスや電話番号（ハイフン付き含む）を自動でマスキングする処理の実装
- [x] **4.3 自動監査ログ（Audit Log）非同期ミドルウェア**
  - [x] 5W1H（ユーザーID、タイムスタンプ、IP、リソース、操作種別、詳細）を自動記録する仕組みの構築
  - [x] メイン処理をブロックしない非同期・非ブロッキングなログ書き込み（Append-Only）の徹底
- [ ] **4.4 最終動作確認 ＆ ドキュメント・活動記録まとめ**
  - [ ] 全エンドポイントの動作テスト（全ロール・異常系・レートリミットの通し確認）
  - [x] インターンの活動記録・ポートフォリオ向けのドキュメント整理
