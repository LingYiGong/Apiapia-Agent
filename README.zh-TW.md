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
  <strong>简体中文 · 繁體中文 · English · 日本語</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v2.24.0-indigo?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Next.js-14%20(React%2018)-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/FastAPI-Python%203.12-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Mem0%20OSS-2.2.1-orange?style=flat-square" alt="Mem0">
  <img src="https://img.shields.io/badge/PostgreSQL-17%20(pgvector)-336791?style=flat-square&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/iOS%20PWA-Ready-007AFF?style=flat-square&logo=apple" alt="iOS PWA">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/i18n-4%20languages-006466?style=flat-square" alt="i18n">
</p>

---

## v2.24.0 發布說明

本版本是一次**全站國際化架構落地**的重要更新。自研輕量 i18n 框架，簡體中文 / 繁體中文 / English / 日本語 四語完整覆蓋前端介面、後端錯誤回應、AI 提示詞與記憶抽取；同時智能翻譯的目標語言不再寫死中文，改為跟隨介面語言。

### 1. 四語國際化框架（零第三方依賴）

- **自研 i18n，無 URL 前綴**：語言偏好存於 `localStorage` 與同名 Cookie，切換即時生效且不觸發路由跳轉；無國際化函式庫依賴，包體積與首屏開銷不受影響。
- **完整覆蓋四層**：前端介面文案、後端 HTTP 錯誤回應、AI 系統提示詞框架、長期記憶抽取與檢索觸發，全部依語言渲染。
- **型別層級鍵名校驗**：`t("...")` 的鍵是編譯期校驗的字面值聯合，寫錯一個字母立即編譯報錯，而不會在執行期悄悄渲染出 `nav.chta`。四張詞典表結構強制對齊，漏寫某種語言能一眼看出。
- **在地化格式化**：日期、星期名稱、數字、貨幣、檔案體積、相對時間（「3 小時前」/「3 hours ago」）全部跟隨介面語言。

### 2. 三處語言切換入口

- **登入頁頂欄**：未登入時的唯一入口 —— 一個英文使用者必須在**看到錯誤提示之前**就能換語言。
- **桌面頂欄**：緊鄰切換主題按鈕左側，登入後的常駐入口，無需先開啟設定。
- **偏好設定 · 介面外觀**：整行形式，帶說明文字，選項以母語自稱 + 英文名並列，便於交叉確認。

### 3. 智能翻譯目標語言跟隨介面語言

- **本端語言由介面決定**：英文介面譯成英文、日文介面譯成日文、繁體中文介面譯成繁體中文。此前提示詞把「中文 ⇋ 目標語言」寫死，導致英文使用者在英文介面裡輸入英文仍拿回中文。
- **同語自動退化為單向**：英文介面選英語、日文介面選日語時，自動切換為「任意外語 → 本端語言」的單向翻譯，而非產生「輸入英文則譯為英文」這類自相矛盾的指令。簡體中文與繁體中文按同語處理。
- **橫幅與語種晶片同步**：模式橫幅與語種按鈕的「本端 ⇋ 目標」標註即時跟隨介面語言，不再固定顯示「中」。

### 4. AI 提示詞的雙語策略

- **框架部分跟隨語言**：預設人設、小節標題、時基說明、聯網檢索引導、排版規範四語各自成句。時基說明直接決定模型回答「今天星期幾」時用中文的「星期三」還是英文的「Wednesday」。
- **護欄部分保留中文**：反推理陷阱護欄的 few-shot 範例是刻意挑選的中文特有歧義（《水滸傳》倒拔垂楊柳、「小美的弟弟有幾個姐妹」的中文語序歧義、漢字筆劃計數），換成英文範例等於換了一組錨點，該模組的價值恰恰全在那幾條範例上。
- **首尾各注入一份語言指令**：開頭那份壓住使用者人設與護欄中的中文表述，末尾那份利用近因效應壓住最後讀到的一小節。只放一份時，放末尾擋不住護欄，放開頭則會被後面近千字中文沖淡。
- **記憶抽取防止語言污染**：抽取提示詞的主語詞與長度單位跟隨語言（英文用 *words* 而非 *characters*）。這些文字會被原樣注入之後每一次對話的上下文，語言污染是累積的。

### 5. 後端錯誤文案全面在地化

- **錯誤碼 + 參數化文案**：拋錯處只宣告錯誤碼與參數，文案集中於 `core/messages.py` 依請求語言查詢；回應主體額外附帶 `code` 欄位，供前端二次在地化與日誌按碼彙總（而非以字串比對）。
- **新接入 24 處面向使用者的字串**：模型可用性與體驗模式限制、媒體存取鑑權、憑證管理、模型服務憑證缺少、管理員操作回執、模型同步結果。
- **修復 Pydantic 校驗漏出中文**：表單校驗失敗時 422 回應主體的 `msg` 欄位原本硬編碼中文，現已在地化。
- **接入 `Accept-Language` 標準標頭**：用標準標頭而非自訂標頭，因為它同時服務於搜尋引擎、CDN 與任何未來繞過本專案前端的呼叫方。

### 6. 生產環境 Docker 建置嚴謹性保障

- 修復 JSX 屬性缺花括號、Next.js `metadata` 與 `generateMetadata` 並存、已刪除模組殘留參照、元件作用域 hook 缺失等型別與語法問題。
- **詞典與插值型別治理**：四語鍵位一致性校驗腳本，以及將插值變數型別放寬以支援可選後端欄位，避免同一類建置失敗反覆出現。

### 7. 附件多選與上傳體積閘門對齊

- **多選形同虛設**：檔案選擇器其實早就帶 `multiple`，但 `input.files` 回傳的是瀏覽器會原地修改的**活物件**。各處 `onChange` 呼叫處理函數後緊接著把 `input.value = ""` 清空，正是把這份清單清掉了；而迴圈在每次非同步操作之後都要重讀 `files.length`，於是跑到第一個檔案就結束。貼上多張圖一直是好的，這也讓這個 bug 很難被發現——貼上路徑自己建構陣列，本來就是快照。
- **檔案與相簿現在都可一次選擇多個檔案或圖片**，每個都會在輸入框上方產生獨立附件卡片。
- **體積上限前移到前端，與後端對齊**：10 個附件、單檔案 20MB、合計 40MB。先前選取時沒有任何限制，超預算的附件會在傳送時被後端拒掉，而被拒的是**整則訊息連同正文**，使用者看到的只是「訊息傳不出去」，而非「附件選多了」。
- **修正後端閘門自身的矛盾**：請求本體上限 32MB，附件總量上限卻是 40MB，但附件以內嵌 base64 攜帶，體積會膨脹到 4/3。於是 40MB 的檔案送過來是約 53MB 的請求本體，永遠先被 32MB 那層攔下，40MB 成了一個永遠碰不到的配置。現將請求本體上限提至 56MB。

---

## v2.23.0 發布說明

本版本是一次**輸入框狀態記憶連動、工程建置嚴謹性與後端架構重構解耦**重要版本更新。實現了聊天輸入框與歷史會話狀態的精準還原回溯，徹底消除了生產環境 Docker build 階段的嚴格模式型別隱患，重構去重複了後端模型目錄服務並收斂了模型同步權限。

### 1. 聊天輸入框狀態記憶與歷史會話智慧回溯
- **會話狀態深度連動**：使用者在某條會話中啟用的智能翻譯模式、所選目標語種等專屬創作狀態，在切換會話時會被精準識別與回溯，無需反覆手動重新開啟。
- **新建對話一鍵還原**：點選「新建對話」時智慧恢復預設助理輸入狀態，多任務交替對話流暢自然。

### 2. 生產環境 Docker 容器建置嚴謹性保障
- **嚴格索引存取守衛**：針對生產環境 Docker build 階段在 TypeScript `noUncheckedIndexedAccess: true` 嚴格模式下暴露的物件解構存取隱患進行嚴謹守衛，確保自動化 CI/CD 與容器映像極速穩定建置。

### 3. 後端模型服務重構與啟動任務徹底解耦
- **統一模型目錄讀寫**：重構並抽出 `catalog.py` 通用 JSON 目錄持久化與快取輔助函式，語言、繪圖、影片、語音四大模型目錄實作標準一致的檔案 I/O 管理，消除樣板冗餘程式碼。
- **啟動任務徹底解耦**：將聊天模型全網同步邏輯下沉至服務層，解除 `main.py` 系統 Lifespan 啟動生命週期對 API 路由 Handler 的反向依賴與脆弱參數綁定。
- **核心邏輯模組合併**：合併 Media 模組中的圖片與影片串流回應邏輯，抽象通用模型驗證函式，精簡專案維護成本。

### 4. 模型同步介面權限收斂與介面適配
- **管理員權限限制**：所有全網模型即時同步介面（`POST /models/sync*`）皆提升為僅管理員可呼叫（`get_current_admin`），杜絕一般使用者高頻刷取遠端廠商介面。
- **前端設定頁同步按鈕適配**：僅管理員帳號可檢視並點選各模型列表的「同步列表」按鈕，一般使用者端介面保持極簡與純粹。

### 5. 專案冗餘程式碼清理
- 徹底清理移除了前端未參照的廢棄人設範本與無用設定，提升整個程式碼庫的整潔度與穩健性。

---

## v2.22.0 發布說明

本版本是一次**功能架構精簡與智能翻譯教學**重量級更新。將互動介面進一步收斂，將智能翻譯等拓展能力統一收納至「+」號創作選單，全面升級了文法變形拆解與日語振假名注音，並在設定中支援自訂全域通用系統提示詞。

### 1. 創作能力統一收納至「+」加號選單
- **輸入區域極簡純粹**：移除了輸入列外層獨立的模式切換氣泡，將「智能翻譯」與「生成圖片」、「生成影片」、「音訊轉文字」等創作拓展能力統一整合收納至輸入框左側的 `+`（加號）選單中。
- **狀態感知圓鈕**：當啟用智能翻譯時，加號按鈕自適應切換為多語言圖示高亮狀態，並支援一鍵隨時退出或恢復預設。

### 2. 智能翻譯與文法教學全面升級
- **日語假名振假名標註**：中日翻譯模式下，所有漢字後方嚴格緊隨平假名振假名（例如：`私(わたし)は日本語(にほんご)を勉強(べんきょう)しています`），徹底解決漢字發音難辨的問題。
- **深度文法剖析與動詞變型**：提取關鍵動詞的原型、變型規律（如連用形/過去式/進行時等）及句式時態，詳細拆解核心文法與固定搭配，並提供舉一反三分析。
- **結構化類似常用例句**：自動產生 2~3 組結構類似的同類型地道例句，附帶語境說明與搭配解析。

### 3. 單輪翻譯無上下文機制與極速模型切換
- **零干擾單輪互譯**：翻譯時自動開啟單輪隔離模式，不帶入漫長的歷史多輪會話背景，並強制關閉長期記憶擷取與網路檢索，實現最純淨的毫秒級即時翻譯。
- **推薦模型自動切換**：開啟智能翻譯時，自動優先推薦並置頂極速模型（`google/gemini-2.5-flash-lite` 與 `openai/gpt-4o-mini`）；退出翻譯或新建會話時，自動還原回使用者在設定中設定的首選模型。

### 4. 系統級通用提示詞 (System Prompt) 自訂
- **設定中心新增全域人設設定**：在「設定」中新增「系統提示詞」模組，使用者可依需求隨時自訂或編輯全域基礎指令，並支援一鍵恢復通用標準助理提示詞。

---

## 🐱 關於 Apiapia（品牌故事與靈感）

> 「她有一雙清澈如綠寶石般的眼睛，安靜地趴在鍵盤旁陪伴著日夜；而現在，她化身為你數位世界裡永不忘事的智慧助理。」

<p align="center">
  <img src="icons/apiapia-real.jpg" alt="真實貓咪 Apiapia" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-app-icon.jpg" alt="Apiapia App 圖示" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-avatar-circle.png" alt="Apiapia 品牌頭像" width="220" style="border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
</p>

<p align="center">
  <em>圖左：原型小貓真實生活照 · 圖中：iOS 原生質感 Web App 圖示 · 圖右：站內品牌圓形頭像</em>
</p>

**Apiapia** 的原型是一隻真實存在、有著可愛虎斑花紋與碧綠雙眸的家貓。在日常生活中，貓咪用敏銳的直覺和長久的陪伴給予家人溫暖與安心；在 **Apiapia 助理系統** 中，這份陪伴被賦予了前沿 AI 的長期記憶與邏輯推理能力：

- **永不忘記的溫度**：不同於常規大模型每次開啟新對話就「失憶」的局限，Apiapia 藉助自主向量記憶引擎（Mem0 OSS + pgvector），將你的工作偏好、生活習慣與事實碎片默默珍藏。
- **越聊越懂你**：跨裝置、跨時段自動召回關聯事實，無需反覆自我介紹，交流如同與相識已久的老友交談般默契順暢。
- **全端優雅呈現**：不僅擁有精心手繪的貓咪品牌標識，更針對行動版與桌面版進行全套視覺重構，帶來兼具科技質感與親和力的使用體驗。

---

## 📲 iOS 瀏覽器 Web App（PWA）全套圖示體系

系統現已全面適配 **Apple iOS Safari** 及現代主流瀏覽器的 Progressive Web App (PWA) 標準，支援從 Safari 一鍵「**加入主畫面**」，獲得媲美原生 App 的沉浸式無邊框獨立執行體驗（Standalone Mode）：

<p align="center">
  <img src="icons/apiapia-logo-dark.jpg" alt="Apiapia 品牌深色橫幅" width="720" style="border-radius: 16px; box-shadow: 0 12px 36px rgba(0,0,0,0.25);" />
</p>

### 📱 1. 全套圖示規格一覽

| 平台 / 場景 | 圖示檔案 | 尺寸 / 格式 | 用途說明與規範 |
| :--- | :--- | :--- | :--- |
| **iOS 主畫面** | `apple-touch-icon.png` | 180×180 PNG | iOS 裝置加入主畫面的預設圖示，適配 Retina 視網膜螢幕 |
| **iPhone Retina @3x** | `apple-touch-icon-180x180.png` | 180×180 PNG | 適配 iPhone 14/15/16 Pro 等 @3x 超清視網膜螢幕 |
| **iPad Pro @2x** | `apple-touch-icon-167x167.png` | 167×167 PNG | 專為 10.5" / 11" / 12.9" iPad Pro 定制的高清圖示 |
| **iPad / iPad mini** | `apple-touch-icon-152x152.png` | 152×152 PNG | 適配 iPad Air 與 iPad mini 的標準高清視網膜顯示 |
| **iPhone 標準 @2x** | `apple-touch-icon-120x120.png` | 120×120 PNG | 適配標準解析度 iPhone 顯示及 Spotlight 搜尋結果 |
| **Web App 啟動圖示** | `icon-192x192.png` | 192×192 PNG | PWA Manifest 標準通用圖示，行動版啟動畫面與捷徑 |
| **Web App 高清圖示** | `icon-512x512.png` | 512×512 PNG | PWA 高解析度圖示、應用市集展示及 Splash 載入頁 |
| **Android 自適應圖示** | `icon-maskable-192x192.png` | 192×192 PNG | 自帶 20% 安全邊距，適應圓形、圓角矩形等任意裁切 |
| **Android 高清自適應** | `icon-maskable-512x512.png` | 512×512 PNG | 遵循 W3C Maskable 規範，杜絕圖示邊緣被截斷 |
| **多解析度 Favicon** | `favicon.ico` | 16/32/48 ICO | 桌面瀏覽器標籤頁標準 ICO 格式，內嵌 16/32/48 三合一資料 |
| **現代瀏覽器 Favicon** | `favicon-32x32.png` / `16x16` | 32×32 / 16×16 | 現代化桌面與行動瀏覽器標籤頁高清點陣圖 |
| **向量高保真 Favicon** | `icon.svg` | Scalable SVG | 現代 Safari / Chrome 原生向量 Favicon，無限縮放不失真 |

### 🛠️ 2. iOS 極速安裝為 Web App 步驟

1. 在 iPhone 或 iPad 上使用 **Safari 瀏覽器** 開啟 Apiapia 網址（例如 `http://<your-server-ip>:3000`）。
2. 點選螢幕底部（或頂部）導覽列的 **「分享」按鈕（向上箭頭圖示 ⎋）**。
3. 在彈出選單中向下滑動，選擇 **「加入主畫面」（Add to Home Screen）**。
4. 確認應用程式名稱為 **Apiapia** 並點選右上角「加入」。
5. 返回手機桌面，即可看到帶有官方貓咪圖示的 **Apiapia App**。點選直接進入全螢幕沉浸模式，免去瀏覽器網址列與底部工具列干擾！

---

## 🌟 核心理念與架構特點

1. **前後端分離與解耦**：
   - 前端採用 **Next.js (React 18 + TypeScript + Tailwind CSS + shadcn/ui)**，基於 Radix 原語與 CSS 變數主題，負責 UI、互動、串流 SSE 渲染、行動版 Web App 適配及版本自動更新偵測。行動版為獨立全螢幕頁籤（含 iOS 安全區補償），桌面版為「導覽列 + 常駐會話側欄 + 對話區 + 關聯記憶欄」版面。
   - 後端採用 **FastAPI (Python 3.12)**，統一負責 LLM 路由調度、長期記憶擷取生命週期、全網即時檢索、文件解析、會話資料庫及敏感 API Key 加密。

1.1. **四語國際化與在地化 (v2.24.0)**：
   - **自研輕量框架，零第三方依賴**：無 URL 前綴，語言偏好存於 `localStorage` 與同名 Cookie；介面、後端錯誤、AI 提示詞、記憶擷取四層同步切換。語言狀態隨 `Accept-Language` 標準標頭下發，同時服務於搜尋引擎、CDN 與任何未來繞過本專案前端的呼叫方。
   - **鍵名編譯期校驗**：`t("...")` 的鍵是編譯期校驗的字面值聯合，寫錯一個字母立即編譯報錯；四張詞典表結構強制對齊，漏寫某種語言能一眼看出。
   - **三處切換入口**：登入頁頂欄、桌面頂欄（切換主題左側）、偏好設定 · 介面外觀。選項以母語自稱 + 英文名並列，便於使用者交叉確認。
   - **AI 提示詞雙語策略**：框架部分（人設、時基、檢索引導、排版規範）跟隨語言；反推理陷阱護欄保留中文單一版本（其 few-shot 範例是中文特有的推理歧義，換語言等於換錨點），並在提示詞首尾各注入一份語言指令，防止近千字中文沖淡輸出語言。
   - **智能翻譯目標語言跟隨介面語言**：英文介面譯成英文、日文介面譯成日文、繁中介面譯成繁中；同語種自動退化為單向翻譯，簡繁按同語處理。
   - **後端錯誤碼 + 參數化文案**：拋錯處只宣告錯誤碼與參數，文案依請求語言查詢；回應主體附帶 `code` 供前端二次在地化與日誌按碼彙總。

2. **全模型通用智能全自動聯網檢索 (Web Search Engine, v2.3.0)**：
   - **全模型普惠**：不依賴特定模型廠商的聯網功能，無論是 Claude、GPT、Gemini、DeepSeek，還是本地 Ollama 部署的模型，全部自動具備聯網搜尋能力。
   - **智能自動判定 (Auto-Decision)**：系統自主識別時效性新聞、天氣、匯率、股票行情、外部事實、最新技術資訊等需求，依需求自動搜尋；日常閒聊、純程式碼或邏輯運算保持零延遲免搜。
   - **三檔模式隨心控**：輸入框支援「自動判定 (預設) / 強制開啟 / 關閉」一鍵循環切換，並自動持久化使用者偏好。
   - **多級免 Key 高可用**：未設定 Key 時內建 DuckDuckGo 多級非同步搜尋引擎與解析器（html / lite / instant-answer 三級，純 httpx 零第三方依賴），100% 免費開箱即用；設定 `TAVILY_API_KEY` 後自動升級為 **Tavily AI 原生搜尋為主 + DuckDuckGo 兜底**，搜尋品質與 RAG 相關性更強（`/api/health` 的 `web_search` 欄位可檢視目前生效引擎）。
   - **即時檢索與網頁溯源**：串流生成過程中動態呈現檢索中動效及檢索詞；回答下方持久化提供「🌐 參考了 X 個網頁來源」互動式可摺疊卡片，顯示網頁標題、摘要與一鍵直達外連。

3. **長期記憶與聊天記錄嚴格分離**：
   - **聊天記錄**：完整儲存在 PostgreSQL `conversations` 與 `messages` 中，用於歷史溯源與恢復上下文。
   - **長期記憶 (Mem0 OSS 2.2.1)**：獨立儲存在 **pgvector** 向量資料庫中，跨會話自動召回使用者的個人偏好、生活習慣與事實。
   - **建立時間與倒序顯示 (v2.2.0)**：每筆長期記憶均自動記錄精確到年月日時分秒（`YYYY-MM-DD HH:mm:ss`）的時間戳記，預設依最新優先（倒序）排列。
   - **單欄完整清單檢視 (v2.2.0)**：專為大容量事實設計的單欄自適應寬螢幕清單，顯示最豐富的內容細節，支援行內快速編輯與單筆精準刪除。
   - **ADD-only 特性適配**：適配 Mem0 OSS 2.2.1 特性，不假設自動覆蓋舊事實，支援使用者於 Web 頁面直接檢視、編輯與刪除，並支援 **一鍵匯出 JSON** 實現個人資料完全自主。

4. **會話組織與置頂管理 (v2.6.0)**：
   - **置頂分組顯示**：支援對重要歷史會話進行一鍵置頂，置頂會話聚合在獨立分組中高亮呈現。
   - **彈性排序調整**：置頂會話支援拖曳排序以及上移 / 下移快捷微調，方便依優先級排列任務。
   - **輕量介面互動**：操作按鈕常駐可見，互動簡潔直觀。

5. **全站 shadcn/ui 元件規範與體驗重構 (v2.7.0)**：
   - **統一輕量 ActionTooltip**：全站側邊欄、工具列、操作氣泡與管理入口統一接入回應迅速、帶淡入微動效的 `<ActionTooltip>`。
   - **管理後台 (Usage & Audit) 規範化升級**：資料表格由原生 `<tr>`/`<td>` 全量升級為標準 shadcn `<Table>` 系列元件，整合稽核抽屜與平滑觸控容器。
   - **設定中心與無障礙體系 (A11y)**：引入符合標準規範的連續滑桿 `<Slider>`，模型選擇器採用 Popover Combobox，事件隔離最佳化，徹底杜絕下拉清單捲動穿透與卡頓。
   - **官方品牌與頭像系統**：全站導覽列、登入歡迎頁、空狀態引導及行動版頂欄全量接入 Apiapia 官方吉祥物徽章。

6. **模型解耦 (LLM Adapter) 與多模態能力**：
   - 抽象 `LLMProvider` 統一介面，原生適配 **OpenAI、OpenRouter、Anthropic Claude、Google Gemini、本地 Ollama** 等。
   - 原生支援 **OpenRouter**：只需一個 OpenRouter Key，即可在前端一鍵切換 Claude 3.7 / 3.5 Sonnet、GPT-4o、DeepSeek V3 / R1、Llama 3.3、Gemini 2.5 等海量大模型。
   - **多模態與檔案解析**：原生支援上傳圖片、PDF、Word、TXT、Markdown 等文件，自動完成文字擷取並注入對話上下文，圖片支援全螢幕燈箱放大與原圖下載。
   - 更換模型不遺失長期記憶。

7. **強制安全與隱私準則**：
   - **強制身分隔離**：所有 API 中的 `user_id` 均從經過驗證的 JWT 中取得，絕不信任前端傳遞的 `user_id`。
   - **不可信上下文防禦**：召回的長期記憶在 Prompt 層面作為不可信背景資料包裹，防止 Prompt Injection 劫持系統指令。
   - **API Key 加密持久化**：使用者設定的模型憑證在後端使用 Fernet 對稱加密入庫，前端永不回傳明文。

---

## 🚀 架構設計

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

## 📦 快速部署與啟動

專案已完全容器化，直接使用 Docker Compose 即可在伺服器或個人機器上一鍵啟動。編排中已整合標準健康檢查探針，保證服務平滑啟動。

### 1. 設定環境變數

複製環境變數範本：

```bash
cp .env.example .env
```

依你的實際情況在 `.env` 中填寫設定項（也可以在啟動後透過 Web 前端的設定頁面進行設定）。

**設定項的完整清單和逐項說明見 `.env.example`**，那裡同時標註了每一項的預設值與改動影響。原則是：**只有 `POSTGRES_PASSWORD` 是必填的**，其餘留空即採用 `backend/app/core/config.py` 中的預設值，刪掉一行等同於填預設值。因此你只需要改動真正想改的那幾行。

幾個值得單獨說明的：

- `POSTGRES_PASSWORD`: **唯一必填項**。資料庫連線字串由 `POSTGRES_*` 自動組裝，無需（也不應）再手寫 `DATABASE_URL`；密碼中的 `@` `/` `:` 會被自動跳脫。只有當應用程式需要連接本 compose 之外的資料庫時，才顯式設定 `DATABASE_URL` / `MEM0_DATABASE_URL`。
- `SECRET_KEY`: JWT 簽章密鑰，**輪換它會讓所有人被登出**
- `API_KEY_ENCRYPTION_KEY`: 資料庫 API Key 對稱加密密鑰，**輪換它會讓已存的所有 Key 無法解密，使用者必須重新填寫**
- `ADMIN_EMAIL` / `ADMIN_USERNAME`: 公開部署強烈建議設定，否則**第一個註冊的使用者會成為管理員**
- `POSTGRES_HOST_PORT` / `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT`: 主機連接埠對應，預設 `5432` / `8000` / `3000`。連接埠被占用時改這裡，不用動 `docker-compose.yml`
- `APP_VERSION`: 服務版本號，預設讀取 `VERSION` 檔案。**須與儲存庫根目錄 `VERSION`、`frontend/package.json` 保持一致**——三者作為同一份產物發布
- `OPENROUTER_API_KEY`: OpenRouter 統一大模型 API 密鑰，**同時供聊天、記憶、語音使用**
- `TAVILY_API_KEY`: Tavily 聯網搜尋 Key（https://tavily.com 免費申請，每月 1000 次；留空則只用免費 DuckDuckGo）
- `TAVILY_SEARCH_DEPTH`: 搜尋深度 `advanced`（準）/ `basic`（快），預設 `advanced`
- `NEXT_PUBLIC_API_URL`: 留空即使用同源代理 `/api/backend`，無需設定伺服器 IP，也無跨域問題。**只有純靜態匯出（Cloudflare Pages）才需要填**，那時後端 CORS 還需放行前端網域
- `STT_MODEL` / `TTS_MODEL`: **程式碼層級兜底常數，不是部署設定**（`backend/app/core/config.py`）。僅在帳號從未開啟過語音設定、或首次同步目錄之前有值可發。日常使用在設定頁挑選，無需也不應當改這裡
- `TTS_VOICE`: 選填，全域釘死某個音色（預設留空＝用目錄裡該模型的第一個音色）。**不需要設定**——不公布音色清單的模型（Fish Audio / Seed Audio 系）會自動省略 `voice` 欄位、由 provider 用自己的預設音色。與模型強綁定，若設了此項而目前模型不接受會被忽略而非報錯
- `FREE_AUDIO_MODELS`: 逗號分隔的免費語音模型，供體驗模式帳號使用（與 `FREE_IMAGE_MODELS` 同性質）。多數模型可由零定價自動識別，此項用於定價介面沒揭露的免費檔
- `SPEECH_MAX_AUDIO_BYTES`: 單次語音轉文字的音訊體積上限，預設 25MB（與 OpenRouter 的 multipart 上限一致）
- `SPEECH_MAX_TEXT_CHARS`: 單次語音合成的文字上限，預設 4000 字

> **設定只寫一處。** `docker-compose.yml` 現在只負責映像、連接埠、磁碟區、健康檢查和服務順序，業務設定一律來自 `.env`；`.env` 裡沒寫的項回落到 `backend/app/core/config.py` 的預設值。此前同一份預設值在 compose、`config.py`、`.env` 三處各寫一遍，資料庫密碼在三處重複，正是這種重複導致改密碼時漏改、連不上資料庫。

> **本機開發熱重載**：`docker-compose.yml` 不帶 `--reload`（伺服器不需要）。需要時新建 `docker-compose.override.yml` 覆寫 `backend.command` 即可，Compose 會自動合併，主檔案不用改。

> 語音辨識與語音合成是**兩族互不相交的模型**（OpenRouter 的 `output_modalities=transcription` 與 `=speech` 回傳的集合沒有交集），所以設定頁是兩個獨立下拉選單、資料庫是兩個欄位 `stt_model` / `tts_model`。
> **音訊格式由伺服器協商**：各模型支援的格式不一致（Gemini TTS 只接受 pcm，Mistral Voxtral 只接受 mp3），所以前端請求的 mp3 只是偏好。模型拒絕時會自動改用另一種格式並記住結果；回傳給瀏覽器的永遠是可播放的容器——裸 pcm 會被包成 WAV（取樣率取自回應標頭 `audio/pcm;rate=…;channels=…`，不猜）。
> 模型目錄持久化在 `backend/app/synced_audio_models.json`，只在設定頁點「同步列表」或後端啟動時刷新，與語言 / 繪圖 / 影片目錄的處理方式一致；請求鏈路上不做即時目錄查詢。
> 語音功能沿用既有的 `OPENROUTER_API_KEY`，無需額外申請密鑰。未設定時健康檢查的 `speech` 欄位顯示 `no OpenRouter key`。

### 2. 一鍵啟動 Docker 容器叢集

```bash
docker compose up --build -d
```

Compose 將依序拉起並協同三個服務：
- `postgres`: 帶有 pgvector 擴充功能的 PostgreSQL 17 容器，備有持久化磁碟區 `postgres_data`。
- `backend`: FastAPI 後端，具備健康檢查機制，自動完成擴充功能啟用、資料表結構同步與 Mem0 初始化。
- `frontend`: Next.js 獨立執行容器，自動等待後端服務 Healthy 後啟動，監聽 `3000` 連接埠。

### 3. 存取應用程式

- **Web 介面**：`http://localhost:3000`
- **後端 API 文件 (Swagger)**：`http://localhost:8000/docs`
- **健康檢查介面**：`http://localhost:8000/api/health`
  回傳真實探測結果：資料庫無法連線時回傳 **503**（`database` 欄位給出異常類型，`status` 為 `degraded`），Docker healthcheck 會據此把容器標記為 unhealthy。`mem0_oss` 欄位反映長期記憶是否已設定可用的 LLM 憑證。

> 生產部署建議在前面加一層反向代理並啟用 HTTPS，同時把 `.env` 中的 `SECRET_KEY` 與 `API_KEY_ENCRYPTION_KEY` 換成隨機值——`.env.example` 裡的兩個是公開的範例值，任何人拿到都能偽造登入權杖或解密資料庫裡的 API Key。

---

## 📱 核心功能與頁面路徑

| 頁面路由 | 功能說明 |
| :--- | :--- |
| `/login` | 現代化登入與註冊，基於安全雜湊與 JWT 權杖認證，呈現 Apiapia 官方徽章。頂欄提供**語言切換入口**，未登入使用者可在看到錯誤提示前切換介面語言。 |
| `/chat` | 核心對話介面。左側會話置頂與排序、可搜尋模型切換、**智能全自動全網檢索 (v2.3.0)**、多模態附件上傳、SSE 串流打字機渲染及關聯記憶面板。行動版以底部標籤列切換「對話 / 歷史 / 記憶 / 用量 / 設定」五個獨立頁籤，全部頂層頁面均可一步直達。 |
| `/memory` | **記憶庫管理 (v2.2.0)**。單欄清單顯示、建立時間精確到秒、倒序排序、語意向量搜尋、行內快速編輯、單筆刪除與 **JSON 一鍵匯出**。 |
| `/settings` | 偏好設定。**介面語言切換 (v2.24.0)**、自訂人設風格、創意度滑桿連續調節、外觀主題切換、長期記憶總開關及多廠商 API Key 安全託管。 |
| `/usage` | **用量與成本稽核看板 (v2.7.0)**。統計多模型/多時段呼叫明細、Token 消耗分布，管理員支援多使用者會話稽核、資源回收筒訊息檢視與一鍵還原。 |

---

## 💾 資料持久化與備份

專案在 `docker-compose.yml` 中定義了兩個具名資料磁碟區：
- `postgres_data`: 儲存 PostgreSQL 使用者資料表、會話資料表、訊息資料表以及 Mem0 pgvector 向量集合。
- `mem0_data`: 儲存 Mem0 本機歷史資料庫。

資料備份範例命令：
```bash
docker exec -t apiapia_postgres pg_dump -U postgres apiapia > backup_$(date +%Y%m%d).sql
```

資料還原範例命令：
```bash
cat backup_xxx.sql | docker exec -i apiapia_postgres psql -U postgres -d apiapia
```