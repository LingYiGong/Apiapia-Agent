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
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v2.41.0-indigo?style=flat-square" alt="Version"></a>
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
# ローカル開発: docker-compose.override.yml が自動的に読み込まれます
# (ホットリロード + 開発専用のボリューム)
docker compose up --build -d

# 本番デプロイ: ファイルを明示し、開発用の上書きを読み込まない
docker compose -f docker-compose.yml up --build -d
```

Compose は 3 つのサービスを自動で連携起動します：
- `postgres`: pgvector 拡張を組み込んだ PostgreSQL 17 コンテナ。
- `backend`: FastAPI Python バックエンド（DB スキーマ同期と Mem0 初期化を自動実行）。
- `frontend`: Next.js コンテナ（バックエンドの健全性を確認後、ポート `3000` で待受）。

> **デプロイ時の注意**: `-f` を明示しない限り、Compose は同じディレクトリの `docker-compose.override.yml`（ローカル開発レイヤー）を自動的に読み込みます。
> 本番デプロイでは必ず `-f docker-compose.yml` を使用してください。指定しないと開発用のホットリロード設定と開発専用ボリュームが適用されます。
> （リリース ZIP にはこの override ファイルは含まれないため、解凍後に `docker compose up` を実行しても安全です。）

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

### 🚀 v2.41.0 (2026-10-25)

**モデルカタログ刷新 · 記憶整理の移行 · 4 言語同期**

- **モデル**: 無料マルチモーダルのフラッグシップを Gemma 4 31B から NVIDIA Nemotron 3.5 Super VL へ変更。標準枠に GPT-6 Luna、最上位枠に Claude Fable 5.1 を追加。DeepSeek は `deepseek-v4.1-flash-1017`、GPT-6 Astra は `gpt-6-astra-pro` に更新。
- **記憶**: `consolidation_model` の既定値を Nemotron 3 Ultra 550B へ移行。フォールバックは Nemotron 3 Ultra → Nemotron 3.5 Super VL → `openrouter/free`。Gemma 4 の再試行・推奨 UI を削除。
- **i18n**: 4 言語辞書から Gemma 4 の残存キーを削除し、3 つの新モデルにローカライズ済みの選定理由を追加。

---

### v2.40.0 (2026-10-24)

**フロントエンド視覚監査 · Tailwind 強化 · 4 言語同期**

- **Tailwind**: スキャンパスを補完し、`text-3xs` を追加。無効なブラー/シャドウ構文とスライダーのドラッグ拡大を修正。
- **整列**: KPI カードの二重ボーダーを削除し、チャットヘッダーと記憶サイドバーの高さを統一。記憶カードの余白とダイアログタイトルの重なりを修正。
- **整理と i18n**: 重複するサイドバー/モバイル保存ボタンを削除し、インライン編集を簡素化。不要なスタイル/import を整理し、残りのハードコード文言を 4 言語辞書に統合（`891` キー × 4 言語）。

---

### v2.39.0 (2026-10-23)

**ストリーミング信頼性 · 即時停止 · データベース保護**

- **生成停止**: 中断シグナルを Next.js プロキシから FastAPI SSE まで伝播し、クライアントの読み取りブロックを即時解除。入力状態も復帰。
- **応答の整合性**: `done` 後に応答が消えない。ストリーム中断時は生成済み内容を保持。バックグラウンドのタイマーを分離。
- **推論と永続化**: `<thinking>` の解析を先頭の推論ブロックに限定。`parent_message_id` を検証し、長すぎるカラムを切り詰め。

---

### v2.38.0 (2026-10-22)

**ChatGPT 式ブランチ · カスタム指示 · 記憶バッジ**

- **ブランチ**: メッセージを親子ツリーで管理。再生成は `< 1 / 2 >` ページング付きの代替ブランチを作成し、履歴を切り捨てない。
- **カスタム指示**: 「あなたについて」と「応答スタイル」を PostgreSQL に保存し、毎回のモデル呼び出しに注入。
- **体験**: リアルタイム記憶バッジ/Toast、16ms タイプライター、長文の自動添付カード化。

---

### v2.37.0 (2026-10-22)

**バックグラウンドストリーミング · LaTeX 環境 · コンテナビルド**

- **マルチセッション**: ビューとストリームを分離。会話を切り替えてもバックグラウンドで生成を継続し、完了後に保存。
- **LaTeX**: フェンスなしのアルゴリズム、プリアンブル、定理/証明環境、QED 記号をネイティブ対応。ドル記号の正規表現と Windows フォント描画を修正。
- **安定性**: ReAct パイプラインと本番コンテナビルドを強化。

---

### v2.36.0 (2026-10-21)

**ChatGPT 級のインタラクション強化**

- **推論 UI**: 回答トークン到着時に推論ブロックを自動折りたたみ。純粋な推論中はカーソルを非表示。コードブロックをサニタイズ時に保護。
- **Web 検索**: クリーンなドメインと高解像度 Favicon を表示するソースカード、インライン引用バッジ。
- **チャットフロー**: プロバイダー間の LaTeX 正規化、不要な前置きを省くシステムプロンプト、タイトルのリアルタイム更新、3 つのフォローアップ候補。

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