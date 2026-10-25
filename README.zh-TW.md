<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md"><b>繁體中文</b></a> · <a href="README.ja.md">日本語</a>
</p>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="icons/apiapia-logo.svg">
    <source media="(prefers-color-scheme: light)" srcset="icons/apiapia-logo.svg">
    <img src="icons/apiapia-logo.svg" alt="Apiapia AI Logo" width="620">
  </picture>
</p>

<p align="center">
  <strong>一隻有長期記憶的智能貓咪助理 · Personal AI Assistant with Long-Term Memory</strong>
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

## 🐱 關於 Apiapia（品牌故事與設計靈感）

> 「她有一雙清澈如綠寶石般的眼睛，安靜地趴在鍵盤旁陪伴著日夜；而現在，她化身為你數位世界裡永不忘事的智慧助理。」

<p align="center">
  <img src="icons/apiapia-real.jpg" alt="真實貓咪 Apiapia" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-app-icon.jpg" alt="Apiapia App 圖示" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-avatar-circle.png" alt="Apiapia 品牌頭像" width="220" style="border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
</p>

<p align="center">
  <em>圖左：原型小貓真實生活照 · 圖中：iOS 原生質感 Web App 圖示 · 圖右：站內品牌圓形頭像</em>
</p>

**Apiapia** 的原型是一隻真實存在、有著可愛虎斑花紋與碧綠雙眸的家養貓咪。在日常生活中，貓咪用敏銳的直覺和長久的陪伴給予家人溫暖與安心；在 **Apiapia 助理系統** 中，這份陪伴被賦予了前沿 AI 的長期記憶與邏輯推理能力：

- **永不遺忘的溫度**：不同於常規大模型每次開啟新對話就「失憶」的局限，Apiapia 借助自主向量記憶引擎（Mem0 OSS + pgvector），將你的工作偏好、生活習慣與事實碎片默默珍藏。
- **越聊越懂你**：跨裝置、跨時間段自動召回關聯事實，無需反覆自報家門，交流如同與相識已久的老友交談般默契順暢。
- **全端優雅呈現**：精心手繪貓咪品牌標識，針對行動端與桌面端進行全套視覺適配，兼具科技質感與親和力。

---

## ✨ 核心特性

- 🧠 **長期記憶系統（Mem0 OSS 2.2.1 + pgvector）**：全自動提取並召回事實記憶，具備倒序精準時間戳、語意檢索、行內編輯與一鍵 JSON 匯出功能。
- 🌐 **全模型智能全自動聯網檢索（Web Search）**：自主研判時效性需求，支援 Tavily AI 原生檢索與 DuckDuckGo 零配置免 Key 降級，提供多詞並發與行內來源即時引用。
- 🤖 **多廠商大模型無縫路由**：統一適配 OpenAI、Anthropic Claude（支援 Extended Thinking）、Google Gemini、OpenRouter、本地 Ollama，統一切換且不丟記憶。
- 🎙️ **全端語音與智慧翻譯教學**：基於 OpenRouter 提供麥克風 Whisper 即時轉寫（STT）與多音色朗讀（TTS）；支援帶日語假名標註和動詞變形拆解的智能互譯。
- 🌍 **零第三方依賴的四語國際化 (i18n)**：全自研輕量框架，前端 UI、後端錯誤、AI 提示詞骨幹、記憶抽取四層同源適配簡體中文 / 繁體中文 / English / 日本語。
- 📱 **原生級 iOS PWA 與全端響應式**：支援 Safari 一鍵「加入主畫面」全螢幕沉浸執行，內建全套 Retina/Maskable 圖示體系與行動端 5 大獨立標籤頁。
- 🔒 **企業級安全與隱私隔離**：伺服器端強校驗 JWT `user_id`，Fernet 對稱加密託管 API Key，記憶與外鏈上下文採用 `<untrusted_document>` 防提示詞注入。

---

## 🚀 快速開始與一鍵部署

專案已實現全面容器化。使用 Docker Compose 即可在雲端伺服器或本地機器上一鍵啟動：

### 1. 配置環境變數

從範本複製環境變數檔案：

```bash
cp .env.example .env
```

打開 `.env` 檔案，**唯一必填項為 `POSTGRES_PASSWORD`**（設定你的資料庫密碼），其餘選項保持預設即可正常啟動：

```env
POSTGRES_PASSWORD=your_secure_password_here
# 可選：填入你的 OpenRouter 或 OpenAI 金鑰以開啟全部功能
OPENROUTER_API_KEY=
TAVILY_API_KEY=
```

### 2. 一鍵啟動 Docker 叢集

```bash
# 本機開發：會自動載入 docker-compose.override.yml（熱重載 + 獨立開發資料卷）
docker compose up --build -d

# 正式部署：明確指定檔案，不載入任何開發覆寫
docker compose -f docker-compose.yml up --build -d
```

Compose 將按序拉起並協同三個服務：
- `postgres`: 帶有 pgvector 擴充套件的 PostgreSQL 17 容器。
- `backend`: FastAPI 後端服務（自動完成資料表結構同步與 Mem0 初始化）。
- `frontend`: Next.js 獨立執行容器（等待後端健康檢查通過後監聽 `3000` 連接埠）。

> **部署注意**：只要沒有明確指定 `-f`，Compose 就會自動讀取同目錄下的 `docker-compose.override.yml`（本機開發層）。
> 正式部署請務必使用 `-f docker-compose.yml`，否則會意外帶上開發用的熱重載設定與獨立的資料卷。
> （發佈壓縮檔不會包含這個 override 檔，因此在解壓後的目錄中直接執行 `docker compose up` 仍是安全的。）

### 3. 存取應用

- **Web 介面**：`http://localhost:3000`
- **後端 API 文件 (Swagger)**：`http://localhost:8000/docs`
- **健康檢查介面**：`http://localhost:8000/api/health`

---

## 🛠️ 本地開發指南

如果您希望在本地進行二次開發或除錯程式碼：

### 前端開發 (Next.js)

```bash
cd frontend
npm install # 或 pnpm install
npm run dev
```
前端開發伺服器將啟動在 `http://localhost:3000`。

### 後端開發 (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
> **提示**：本地單獨執行後端需確保已啟動帶 pgvector 的 PostgreSQL 實例（可透過單獨執行 `docker compose up postgres -d` 提供）。

---

## 🏗️ 架構設計

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

## 📱 核心功能與頁面路徑

| 頁面路由 | 功能說明 |
| :--- | :--- |
| `/login` | 現代化登入與註冊，基於安全雜湊與 JWT 權杖認證，頂欄支援未登入狀態語言切換。 |
| `/chat` | 核心對話介面。置頂排序、全網即時檢索、多模態附件上傳、SSE 串流打字機渲染及關聯記憶面板。 |
| `/memory` | **記憶庫管理**。單列自適應清單展示、時間精確到秒、語意向量搜尋、行內編輯與 **JSON 一鍵匯出**。 |
| `/settings` | 偏好設定。四語切換、人設風格、連續創意度滑桿、外觀主題切換及多廠商 API Key 安全託管。 |
| `/usage` | **用量與成本審計看板**。統計多模型呼叫明細、Token 消耗分布，管理員支援多使用者會話審計。 |

---

## 💾 資料持久化與備份

專案在 `docker-compose.yml` 中定義了兩個持久化資料卷：
- `postgres_data`: 儲存 PostgreSQL 核心資料表與 Mem0 pgvector 向量庫。
- `mem0_data`: 儲存 Mem0 本地歷史索引。

資料備份範例命令：
```bash
docker exec -t apiapia_postgres pg_dump -U postgres apiapia > backup_$(date +%Y%m%d).sql
```

資料還原範例命令：
```bash
cat backup_xxx.sql | docker exec -i apiapia_postgres psql -U postgres -d apiapia
```

---

## 📜 版本發布與更新說明 (Release Notes)

### 🚀 v2.41.0 (2026-10-25)

**模型目錄刷新 · 記憶整理遷移 · 四語同步**

- **模型**：免費多模態旗艦由 Gemma 4 31B 切換為 NVIDIA Nemotron 3.5 Super VL；正常檔新增 GPT-6 Luna；聰明檔新增 Claude Fable 5.1；DeepSeek 更新為 `deepseek-v4.1-flash-1017`；GPT-6 Astra 更新為 `gpt-6-astra-pro`。
- **記憶**：`consolidation_model` 預設遷移至 Nemotron 3 Ultra 550B；備援鏈路為 Nemotron 3 Ultra → Nemotron 3.5 Super VL → `openrouter/free`；移除 Gemma 4 相關重試與推薦入口。
- **國際化**：四語字典清除 Gemma 4 殘留鍵，並為三款新模型補齊在地化選型理由。

---

### v2.40.0 (2026-10-24)

**前端視覺巡檢 · Tailwind 加固 · 四語同步**

- **Tailwind**：補全掃描路徑，新增 `text-3xs` 字階，修正失效的模糊/陰影語法與滑桿拖曳縮放。
- **對齊**：移除 KPI 卡片重複邊框，統一聊天頂欄與記憶側欄高度，修正記憶卡片間距與彈窗標題防撞。
- **清理與 i18n**：移除重複的側欄/行動端儲存按鈕，簡化行內編輯，清理死樣式/無用匯入，並將剩餘硬編碼文案全部納入四語字典（`891` 鍵 × 4 語種）。

---

### v2.39.0 (2026-10-23)

**串流可靠性 · 即時停止生成 · 資料庫保護**

- **停止生成**：中斷訊號從 Next.js 代理貫通到 FastAPI SSE，立即解除客戶端讀取阻塞並恢復輸入狀態。
- **回覆完整性**：`done` 之後不再遺失回覆；串流中斷時保留已生成內容；背景串流計時器相互隔離。
- **推理與持久化**：`<thinking>` 解析限定在開頭推理塊；校驗 `parent_message_id` 並截斷超長欄位。

---

### v2.38.0 (2026-10-22)

**ChatGPT 式分支 · 自訂指令 · 記憶徽章**

- **分支**：訊息改為父子樹結構；重新生成會建立帶 `< 1 / 2 >` 翻頁的替代分支，不再截斷歷史。
- **自訂指令**：支援「關於你」與「回覆風格」，持久化到 PostgreSQL 並注入每次模型呼叫。
- **體驗**：即時記憶徽章/Toast、16ms 打字機、長文字自動折疊為附件卡片。

---

### v2.37.0 (2026-10-22)

**背景串流韌性 · LaTeX 環境 · 容器建置**

- **多會話串流**：檢視與串流解耦，切換會話或新建對話時背景繼續生成，並在完成後持久化。
- **LaTeX**：原生支援無圍欄演算法、導言區、定理/證明環境與 QED 符號；修正美元符號正則與 Windows 字型渲染。
- **穩定性**：加固 ReAct 管線與生產容器建置。

---

### v2.36.0 (2026-10-21)

**ChatGPT 級互動升級**

- **推理介面**：答案到達時推理塊自動折疊；純推理階段隱藏游標；程式碼塊在清洗時受到保護。
- **聯網搜尋**：來源卡片顯示乾淨網域與高解析 Favicon，並支援行內引用徽章。
- **對話流**：跨供應商 LaTeX 正規化、零廢話系統提示、標題即時推送與 3 條追問建議。

---

## 🤝 參與貢獻

歡迎提交 Issue 與 Pull Request！
1. Fork 本倉庫並新建分支（例如：`feature/amazing-feature`）。
2. 提交您的修改並確保程式碼風格整潔。
3. 發起 Pull Request，詳細描述修改的內容與驗證結果。

---

## 📄 開源許可證與商標聲明

- **程式碼開源協議**：本專案程式碼採用 [MIT License](LICENSE) 授權。
- **品牌與吉祥物版權聲明**：「Apiapia」品牌名稱、官方 Logo、小貓吉祥物形象及 `icons/` 與 `frontend/public/` 目錄下的所有原創美術設計資產保留所有權利，不屬於 MIT 授權範圍。未經原作者事先書面同意，不得將上述素材直接用於商業品牌宣傳或冒用官方名義。

---

## ⚠️ 免責聲明

1. 本專案僅供學習研究、技術交流與個人日常助理使用。
2. 使用者在配置並呼叫任何第三方模型服務（如 OpenAI、Anthropic、OpenRouter、Tavily 等）時，須自行確保遵守該服務商的使用條款（Terms of Service）與所在地相關法律法規。
3. 開發者不對因使用本系統產生的任何直接或間接法律責任、API 資費扣費或資料損失承擔責任。