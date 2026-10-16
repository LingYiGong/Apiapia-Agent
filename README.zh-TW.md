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
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v2.28.0-indigo?style=flat-square" alt="Version"></a>
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
docker compose up --build -d
```

Compose 將按序拉起並協同三個服務：
- `postgres`: 帶有 pgvector 擴充套件的 PostgreSQL 17 容器。
- `backend`: FastAPI 後端服務（自動完成資料表結構同步與 Mem0 初始化）。
- `frontend`: Next.js 獨立執行容器（等待後端健康檢查通過後監聽 `3000` 連接埠）。

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

### 🚀 最新版本：v2.27.0 (2026-10-16)

本版本是一次聚焦於**模型選擇器行動端互動重構**的重要更新。針對行動端「面板太窄、點選不便」的長期痛點，選擇器在手機端改為**通欄底部抽屜**，分類篩選由佔掉近半螢幕的直排列表**壓縮為單行膠囊**，並順帶修正了「免費」分組把低價付費模型混入其中的語義缺陷，同時完成一輪死程式碼清理。

#### 1. 行動端形態重構：底部抽屜取代頂部窄板
- **通欄底部抽屜**：`< md` 寬度下改用底部抽屜（`86dvh` 固定高度、圓角頂邊、拖曳指示條、`env(safe-area-inset-bottom)` 安全區內距）。此前面板錨定在頂部導覽列裡一個很窄的觸發器上，浮在對話內容之上，觀感近似「一條窄板貼在螢幕頂端」，而手機縱向空間本可大面積利用。
- **桌機端保留浮層，兩側共用同一份面板程式碼**：搜尋、分類篩選、鍵盤互動與無障礙標記完全一致，不存在兩份實作各自漂移的問題。
- **不再彈出軟體鍵盤**：攔截對話框預設的自動聚焦，避免一開啟面板就被鍵盤蓋掉模型列表；模型列內的需求標籤由 3 個收斂為 2 個以減少換行。

#### 2. 分類篩選區由直排列表壓縮為單行膠囊
- **高度從約 335px 降至 32px**：7 個分組在手機上排成一行膠囊，橫向可捲動並依顆粒對齊吸附，桌機端自動換行（隱藏捲軸的橫向捲動在桌機等同於「捲不到」）。
- **消除巢狀捲動**：面板此前存在「分類區」與「模型列表」兩個各自受限於 `38dvh` 的捲動區，使用者每次開啟面板都得先在小捲動區裡捲一次才夠得著「全部」。現在**全面板只剩一個捲動區**，省下的縱向空間全數讓給模型列表，手機端列表可用高度提升約 40%。
- **開啟即定位**：新增依選取態捲動邏輯，上次選中的分類即使位於列尾，重新開啟時也會自動進入可視區，不會被誤認為選擇遺失。

#### 3. 篩選分組重排與「免費」語義修正
- **新順序**：免費 → 綜合推薦 → 深度思考 → 寫作翻譯 → 看圖識文 → 程式開發 → 全部。
- **「極速與免費」→「免費」**：謂詞由「帶 `fastFree` 畫像 **或** `is_free`」收緊為**純 `is_free`**。此前的謂詞會把 `GLM-Flash`、`Qwen-Flash`、`MiniMax-M3`、`MiMo` 等價格檔為「低價」的**付費**模型一併納入，使用者按「免費」篩選後仍會為模型付費，與該分組的承諾相矛盾。
- **預設分組不再「猜」**：指定的預設分組不可用時改為顯示全量列表，而非悄悄落入某一類，避免使用者僅開啟面板就被誤認為篩選已生效。

#### 4. 移除分組多色編碼與誤導性層級箭頭
- **取消綠/琥珀/主色三色區分**：7 個分組分屬**價格維度**（免費）、**能力維度**（四類場景）、**排序地位**（綜合推薦）與**底線**（全部）四種不同性質，原配色在視覺上宣稱它們是同類可比的選項，而這正是「選型不科學」的根源。現選取態統一為主色實心，其餘一律中性灰；分組語義改由區塊分隔線表達（免費 / 綜合推薦 ｜ 四個場景 ｜ 全部）。
- **刪除旋轉箭頭**：右端那個旋轉 90° 的箭頭暗示存在層級展開，實際並不存在，點下只是換一批結果。

#### 5. 死程式碼清理
- **移除無呼叫端的實作**：`sortByPinnedThenActivity`（三個呼叫點均已改用分組版 `groupByTimeBuckets`）、`UserAvatarDropdown` 相容別名（改名為 `UserAvatarMenu` 後遺留，註解宣稱「5 個檢視都在用它」實則 0 個）、以及已失去呼叫端的 `RECOMMENDED_CHAT_MODELS` 推薦順序表（其依賴的設定頁推薦卡片早已移除，註解與現實不符）。
- **全量匯入圖掃描**：對全部原始檔做引用分析，確認無未引用檔案、元件與依賴套件；`@radix-ui/react-slider` 本就未安裝（滑桿為手寫實作），維持不變。

---

### v2.26.0 (2026-10-16)

本版本是一次聚焦於**全站字體排版層次重構、行動端與 PC 端高清晰閱讀體驗、以及多語言體系深度瘦身**的重要版本。修復了長久以來 Markdown 三級以下標題字號倒掛的歷史缺陷，系統性提升了高解析度螢幕與行動裝置上的微型文字辨識度，徹底消除無效 CSS 類名，並對全站四語字典進行了零冗餘清理。

#### 1. 全站排版層次重構與標題字號倒掛修正
- **Markdown 標題階梯體系化規範**：徹底修復 `h3`（15px）及 `h4~h6`（13px）小於 16px 內文的倒掛問題，規範重構 `h1`（24/28px）、`h2`（20/24px）、`h3`（18/20px）、`h4`（16/18px）、`h5`（15/16px）、`h6`（14px）自適應層級。
- **程式碼區塊閱讀標準對齊**：程式碼區塊桌面端內文由 13px 提升至 14px，與 GitHub、VS Code 及 ChatGPT 桌面端規範完全對齊；頂部語言標識與操作按鈕提升至 12px。
- **表格與行內程式碼增強**：資料表格儲存格與行內程式碼升級為響應式 `text-xs sm:text-sm`，寬螢幕閱讀長表格資料更清晰舒適。

#### 2. CJK 字元排版最佳化與微型文字系統性提升
- **字階行高舒展化**：調整 `2xs`（11px）與 `xs`（12px）行高至 15px / 17px，徹底解決中日文字元在小字號下筆畫沾黏或上下截斷的痛點。
- **核心面板告別 11px 模糊閱讀**：訊息下方操作列（複製/朗讀/重試/編輯等）、用量統計與排行卡片、費用與趨勢資料、對話歷史列表、記憶脫水 Diff 對比、AI 圖片與影片卡片、單字學習卡等全部微小字號升級為清晰的 12px/14px。
- **行動端觸控互動最佳化**：調整行動端操作列與時間戳記的預設透明度（從 50% 提高至 75%），消除觸控螢幕無滑鼠 hover 導致介面泛白淡化的體驗缺陷。

#### 3. 樣式健全性與無效類名根除
- **徹底消除 `text-3xs`**：排查並替換所有歷史遺留的未定義類名 `text-3xs`，確保正式環境打包後所有語言切換標籤、快捷命令提示、單字發音按鈕均擁有正規設計系統樣式。
- **全站任意像素字號統一**：消除散落在各處的 `text-[10px]` 等任意像素值，全部收攏至標準設計系統 Token。

#### 4. 多語言（i18n）字典零冗餘清理
- **清理 83 處歷史廢棄鍵**：經 AST 語法樹全量掃描，移除全部四語（簡中、繁中、英文、日文）中已不再調用的冗餘鍵，字典體積顯著縮減。
- **後端錯誤碼精簡與漏譯修復**：移除後端無引用的 `NO_LLM_CREDENTIALS` 錯誤碼，補齊登入頁占位符多語言動態綁定，多語言無用欄位徹底歸零。

#### 5. 模型特性引導與列表取得最佳化
- **直觀特性引導標籤**：支援模型價格標籤、特性標籤（多模態等），為使用者選模提供更直觀引導。
- **統一模型取得機制**：梳理模型初始化拉取邏輯，移除冗餘本地檔案存檔，保持資料流一致。

---

### v2.25.0 (2026-10-14)

本版本是一次聚焦於**記憶系統自洽整理與開箱即用體驗**的重要更新。新增了獨立的記憶整理合併模型（Consolidation LLM）自訂配置、AI 整理全流程多階段狀態機動態視覺化、系統預設模型全面遷移至 `openrouter/free` 官方免費智慧路由，並對齊最新同步模型目錄。

---

### v2.24.0 (2026-10-13)

本版本是一次**全站國際化架構落地**的重要更新。自研輕量 i18n 框架，簡體中文 / 繁體中文 / English / 日本語 四語完整覆蓋前端介面、後端錯誤回應、AI 提示詞與記憶抽取；同時智能翻譯的目標語言不再寫死中文，改為跟隨介面語言。

#### 1. 四語國際化框架（零第三方依賴）
- **自研 i18n，無 URL 前綴**：語言偏好存於 `localStorage` 與同名 Cookie，切換即時生效且不觸發路由跳轉；無國際化函式庫依賴，包體積與首屏開銷不受影響。
- **完整覆蓋四層**：前端介面文案、後端 HTTP 錯誤回應、AI 系統提示詞框架、長期記憶抽取與檢索觸發，全部依語言渲染。
- **型別層級鍵名校驗**：`t("...")` 的鍵是編譯期校驗的字面值聯合，寫錯一個字母立即編譯報錯。四張詞典表結構強制對齊。
- **在地化格式化**：日期、星期名稱、數字、貨幣、檔案體積、相對時間全部跟隨介面語言。

#### 2. 三處語言切換入口
- **登入頁頂欄**：未登入時的唯一入口 —— 英文使用者在看到錯誤提示之前就能換語言。
- **桌面頂欄**：緊鄰切換主題按鈕左側，登入後的常駐入口。
- **偏好設定 · 介面外觀**：整行形式，帶說明文字，選項以母語自稱 + 英文名並列。

#### 3. 智能翻譯目標語言跟隨介面語言
- **本端語言由介面決定**：英文介面譯成英文、日文介面譯成日文、繁體中文介面譯成繁體中文。
- **同語自動退化為單向**：英文介面選英語、日文介面選日語時，自動切換為「任意外語 → 本端語言」的單向翻譯。

#### 4. AI 提示詞的雙語策略
- **框架部分跟隨語言**：預設人設、小節標題、時基說明、聯網檢索引導、排版規範四語各自成句。
- **護欄部分保留中文**：反推理陷阱護欄的 few-shot 範例保留高精度錨點。
- **首尾各注入一份語言指令**：壓住使用者人設與護欄表述，並利用近因效應壓住末尾輸出。

#### 5. 後端錯誤文案全面在地化
- **錯誤碼 + 參數化文案**：拋錯處宣告錯誤碼與參數，文案集中於 `core/messages.py` 依請求語言查詢。
- **接入 `Accept-Language` 標準標頭**：同時服務於搜尋引擎、CDN 與自訂呼叫端。

#### 6. 附件多選與上傳體積閘門對齊
- **修復多選中斷**：檔案與相簿現均可一次選擇多個檔案或圖片。
- **體積上限對齊**：10 個附件、單檔案 20MB、合計 40MB，與 56MB 請求主體閘門嚴格對齊。

<details>
<summary><b>📜 點選展開歷史版本發布說明（v2.23.0 ~ v2.22.0）</b></summary>

<br />

#### v2.23.0 發布說明
- **聊天輸入框狀態記憶與歷史會話智慧回溯**：會話狀態深度連動，切換會話精準恢復翻譯狀態；新建對話一鍵還原。
- **生產環境 Docker 容器建置嚴謹性保障**：嚴格索引存取守衛，消除 TypeScript 嚴格模式下的物件解構存取隱患。
- **後端模型服務重構與啟動任務徹底解耦**：統一模型目錄讀寫（`catalog.py`），啟動任務與路由 Handler 解耦。
- **模型同步介面權限收斂**：即時同步介面提升為管理員專用。

#### v2.22.0 發布說明
- **創作能力統一收納至「+」加號選單**：收納智能翻譯、生成圖片、生成影片、音訊轉文字。
- **智能翻譯與語法教學全面升級**：日語假名標註、深度語法剖析與動詞變型、結構化類似常用例句。
- **單輪翻譯無上下文機制與極速模型切換**：自動開啟單輪隔離模式，優先推薦置頂極速模型。
- **系統級通用提示詞自訂**：設定中心新增「系統提示詞」模組。

</details>

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