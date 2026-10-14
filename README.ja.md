<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md"><b>日本語</b></a>
</p>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="icons/apiapia-logo.svg">
    <source media="(prefers-color-scheme: light)" srcset="icons/apiapia-logo.svg">
    <img src="icons/apiapia-logo.svg" alt="Apiapia AI Logo" width="620">
  </picture>
</p>

<p align="center">
  <strong>長期記憶をもつ賢い猫のアシスタント · Personal AI Assistant with Long-Term Memory</strong>
</p>

<p align="center">
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v2.25.0-indigo?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Next.js-14%20(React%2018)-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/FastAPI-Python%203.12-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Mem0%20OSS-2.2.1-orange?style=flat-square" alt="Mem0">
  <img src="https://img.shields.io/badge/PostgreSQL-17%20(pgvector)-336791?style=flat-square&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/iOS%20PWA-Ready-007AFF?style=flat-square&logo=apple" alt="iOS PWA">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/i18n-4%20languages-006466?style=flat-square" alt="i18n">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome">
</p>

---

## 🐱 Apiapia について（ブランドストーリーと着想）

> 「エメラルドのように透き通った瞳で、夜昼問わずキーボードの傍らに静かに寄り添っていた猫。いま、あなたのデジタル世界で決して物事を忘れない賢いアシスタントへと生まれ変わりました。」

<p align="center">
  <img src="icons/apiapia-real.jpg" alt="実在の猫 Apiapia" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-app-icon.jpg" alt="Apiapia App アイコン" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-avatar-circle.png" alt="Apiapia ブランドアバター" width="220" style="border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
</p>

<p align="center">
  <em>左：モデルとなった愛猫の実写 · 中央：iOS ネイティブ質感 Web App アイコン · 右：ブランド円形アイコン</em>
</p>

**Apiapia** のモデルは、愛らしいトラ柄とエメラルドグリーンの瞳をもつ実在の飼い猫です。日々の暮らしで鋭い直感と静かな温もりを届けてくれる存在を、最先端 AI の長期ベクトル記憶とマルチモデル推論によってデジタルアシスタントとして具現化しました。

- **薄れることのない温もり**：新しい会話のたびに「記憶喪失」になる一般的な LLM とは異なり、独自のベクトル記憶エンジン（Mem0 OSS + pgvector）が仕事の好みや生活習慣、事実の断片を大切に蓄積します。
- **話すほどに深まる理解**：端末や時間をまたいで関連事実を自動で想起。会話のたびに自己紹介を繰り返す必要はありません。
- **全デバイスでの洗練された体験**：手描きのブランドシンボルに加え、モバイルとデスクトップの双方で使いやすさと親しみやすさを両立しました。

---

## ✨ 主な機能

- 🧠 **長期ベクトル記憶システム（Mem0 OSS 2.2.1 + pgvector）**：事実の自動抽出と想起、秒単位タイムスタンプ、ベクトル意味検索、インライン編集、JSON ワンクリック書き出し。
- 🌐 **全モデル対応の自律型ウェブ検索（Web Search）**：時事的なニーズを自律判定。Tavily AI ネイティブ検索と DuckDuckGo キー不要フォールバック、行内リアルタイム引用リンクをサポート。
- 🤖 **マルチベンダー LLM のシームレスルーティング**：OpenAI、Anthropic Claude（Extended Thinking 対応）、Google Gemini、OpenRouter、ローカル Ollama を統一サポート。
- 🎙️ **音声対話とスマート言語学習**：Whisper 音声認識（STT）、多言語音声合成（TTS）、日本語の振仮名（ルビ）表示や動詞活用分解を伴うスマート翻訳。
- 🌍 **第三者ライブラリ依存ゼロの 4 言語国際化 (i18n)**：UI、エラー応答、プロンプト枠組み、記憶抽出の 4 層すべてで 日本語 / 简体中文 / 繁體中文 / English に対応。
- 📱 **iOS PWA とレスポンシブ UI**：Safari から「ホーム画面に追加」するだけでスタンドアロン没入起動。ノッチ安全領域対応と 5 つの独立タブ。
- 🔒 **企業レベルのセキュリティと隔離**：JWT による厳格な本人確認、Fernet 対称暗号化による API キー保管、`<untrusted_document>` によるプロンプトインジェクション防御。

---

## 🚀 クイックスタートと導入手順

本プロジェクトは完全にコンテナ化されています。Docker Compose を使えばサーバーでもローカルでもコマンド一発で起動できます。

### 1. 環境変数の設定

テンプレートから設定ファイルをコピーします：

```bash
cp .env.example .env
```

`.env` を開き、**必須項目である `POSTGRES_PASSWORD`**（データベースのパスワード）を設定します：

```env
POSTGRES_PASSWORD=your_secure_password_here
# 任意：OpenRouter や Tavily などの API キー
OPENROUTER_API_KEY=
TAVILY_API_KEY=
```

### 2. Docker Compose での一括起動

```bash
docker compose up --build -d
```

Compose は 3 つのサービスを自動で連携起動します：
- `postgres`: pgvector 拡張を組み込んだ PostgreSQL 17 コンテナ。
- `backend`: FastAPI Python バックエンド（DB スキーマ同期と Mem0 初期化を自動実行）。
- `frontend`: Next.js コンテナ（バックエンドの健全性を確認後、ポート `3000` で待受）。

### 3. アプリケーションへのアクセス

- **Web UI**: `http://localhost:3000`
- **Swagger API ドキュメント**: `http://localhost:8000/docs`
- **ヘルスチェック**: `http://localhost:8000/api/health`

---

## 🛠️ ローカル開発ガイド

コントリビューターおよびローカル開発者向けの手順です：

### フロントエンド開発 (Next.js)

```bash
cd frontend
npm install # または pnpm install
npm run dev
```
`http://localhost:3000` で開発サーバーが起動します。

### バックエンド開発 (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
> **備考**: バックエンド開発には pgvector が有効な PostgreSQL が必要です（`docker compose up postgres -d` で起動可能）。

---

## 🏗️ アーキテクチャ

```text
                         Browser / iOS Safari Web App
                                     │
                                     ▼
                            ┌─────────────────┐
                            │     Next.js     │ (Port 3000)
                            │ React + TS 前端 │
                            └────────┬────────┘
                                     │ HTTP / SSE
                                     ▼
                            ┌─────────────────┐
                            │     FastAPI     │ (Port 8000)
                            │   Python 後端   │
                            └────────┬────────┘
                                     │
                   ┌─────────────────┼─────────────────┐
                   │                 │                 │
                   ▼                 ▼                 ▼
                LLM Layer         Mem0 Layer       PostgreSQL
                   │                 │                 │
            ┌──────┼──────┐          │           ┌─────┴─────┐
            ▼      ▼      ▼          ▼           ▼           ▼
           GPT   Claude  Gemini   pgvector    Chat Logs    Users
                                     │
                                     ▼
                              Long-term Memory
```

---

## 📱 主な機能と画面ルーティング

| ルート | 説明 |
| :--- | :--- |
| `/login` | セキュアな JWT 認証。ログイン前にトップバーで言語を切り替え可能。 |
| `/chat` | メイン対話画面。ピン留めソート、リアルタイム検索、添付ファイル解析、SSE ストリーミング。 |
| `/memory` | **記憶ダッシュボード**。ベクトル意味検索、秒単位のタイムスタンプ、インライン編集、JSON 書き出し。 |
| `/settings` | 4 言語切替、ペルソナ調整、創造性スライダー、テーマ切替、暗号化 API キー管理。 |
| `/usage` | **利用量とコスト分析**。モデル別・期間別のトークン消費分析、管理者向けのセッション監査。 |

---

## 💾 データの永続化とバックアップ

`docker-compose.yml` で定義されたボリューム：
- `postgres_data`: PostgreSQL テーブルと Mem0 pgvector コレクション。
- `mem0_data`: Mem0 ローカル履歴インデックス。

バックアップ例：
```bash
docker exec -t apiapia_postgres pg_dump -U postgres apiapia > backup_$(date +%Y%m%d).sql
```

リストア例：
```bash
cat backup_xxx.sql | docker exec -i apiapia_postgres psql -U postgres -d apiapia
```

---

## 📜 リリースノート (Release Notes)

### 🚀 最新リリース：v2.24.0 (2026-10-13)

本バージョンは**サイト全体の国際化アーキテクチャの着地**をみた重要なアップデートです。自作の軽量 i18n フレームワークにより、简体中文 / 繁體中文 / English / 日本語 の 4 言語でフロントエンド UI、バックエンドのエラー応答、AI プロンプト、記憶抽出をすべてカバーしました。また、スマート翻訳の翻訳先言語は UI 言語に追従するようになりました。

#### 1. 4 言語対応フレームワーク（第三者依存ゼロ）
- **自作 i18n、URL プレフィックスなし**：言語偏好は `localStorage` と Cookie に保存され、即時反映されます。
- **4 層を完全にカバー**：UI 文言、HTTP エラー応答、AI プロンプト枠組み、長期記憶抽出・検索トリガーのすべてを言語別に描画。
- **型レベルのキー名検証**：`t("...")` のキーはコンパイル時に検証されるリテラル union で、辞書テーブルの整合性を担保。
- **ローカライズ整形**：日付、数値、ファイルサイズ、相対時間が UI 言語に追従。

#### 2. 3 箇所の言語切り替え導線
- **ログインページのトップバー**：エラーメッセージを見る前に言語を切り替え可能。
- **デスクトップのトップバー**：テーマ切り替えの横に常設。
- **環境設定 · 外観**：自言語自称と英語名を併記。

#### 3. スマート翻訳の翻訳先言語が UI 言語に追従
- **自前の言語は UI で決定**：英語 UI は英語へ、日本語 UI は日本語へ、繁体字 UI は繁体字へ翻訳。
- **同一言語の自動単方向化**：同一言語選択時は「任意の外国語 → 自前言語」へ自動フォールバック。

#### 4. AI プロンプトの二言語戦略
- **枠組みは言語に追従**：ペルソナ、見出し、時刻基準、検索誘導、排版規約を言語ごとに記述。
- **推論ガードレールを維持**：推論の罠を防ぐアンカー例を厳格に保持。
- **二重の言語指示注入**：先頭と末尾に指示を配置し、出力言語を確実に統制。

#### 5. バックエンドエラーメッセージの全面ローカライズ
- **エラーコード + パラメータ化**：文言を `core/messages.py` に集約。
- **`Accept-Language` 標準ヘッダー対応**：CDN や外部連携でも自然に機能。

#### 6. 添付ファイルの複数選択とアップロード上限の統一
- **複数選択の修正**：ファイルやギャラリーから複数ファイルを一度に選択可能。
- **上限の統一**：添付 10 件、単体 20MB、合計 40MB を 56MB のリクエストボディゲートと整合。

<details>
<summary><b>📜 過去のリリースノートを展開（v2.23.0 ~ v2.22.0）</b></summary>

<br />

#### v2.23.0 リリースノート
- **チャット入力欄の状態記憶と過去セッションのスマート復元**：セッションごとの創作状態を記憶し、スムーズに復元。
- **本番環境 Docker ビルドの厳密性担保**：TypeScript strict モードにおけるインデックスアクセスの安全性を強化。
- **バックエンドモデルサービスの再構成**：モデルカタログ処理（`catalog.py`）を起動タスクから分離。
- **モデル同期権限の集約**：リアルタイム同期を管理者専用に制限。

#### v2.22.0 リリースノート
- **創作メニューの集約**：スマート翻訳、画像生成、動画生成、音声認識を `+` メニューへ統合。
- **スマート翻訳と語学学習の強化**：日本語の振仮名（ルビ）表示、動詞の活用形分解、類似例文の生成。
- **単方向翻訳の単一ターン隔離**：文脈を持ち越さない低遅延翻訳モード。
- **システムプロンプトのカスタム設定**：環境設定から全体ペルソナを自由に編集可能。

</details>

---

## 🤝 コントリビューション

Issue および Pull Request を歓迎します！
1. 本リポジトリをフォークし、ブランチを作成（`feature/amazing-feature` など）。
2. コードスタイルを整えてコミット。
3. 変更内容を詳しく記述して Pull Request を作成してください。

---

## 📄 ライセンスと商標について

- **コードライセンス**: 本プロジェクトのソースコードは [MIT License](LICENSE) のもとで公開されています。
- **ブランドおよびマスコットの権利**: 「Apiapia」のブランド名、公式ロゴ、猫のマスコットイラストおよび `icons/`、`frontend/public/` 内のオリジナル意匠は著作権で保護されており、MIT ライセンスの対象外です。

---

## ⚠️ 免責事項

1. 本プロジェクトは個人の日常アシスタント業務、学習・研究および技術交流を目的としています。
2. サードパーティ API（OpenAI、Anthropic、OpenRouter、Tavily など）を利用する際は、各サービスの利用規約および法令を遵守してください。
3. 本ソフトウェアの利用により生じたいかなる損害・費用・データ損失についても、作者は責任を負いません。