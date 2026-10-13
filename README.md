<p align="center">
  <a href="README.md"><b>English</b></a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="icons/apiapia-logo.svg">
    <source media="(prefers-color-scheme: light)" srcset="icons/apiapia-logo.svg">
    <img src="icons/apiapia-logo.svg" alt="Apiapia AI Logo" width="620">
  </picture>
</p>

<p align="center">
  <strong>A smart cat assistant with long-term memory · Personal AI Assistant with Long-Term Memory</strong>
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

## v2.24.0 Release Notes

This release is a major update that lands the **site-wide internationalization architecture**. A self-developed lightweight i18n framework gives full four-language coverage — Simplified Chinese / Traditional Chinese / English / Japanese — across the frontend UI, backend error responses, AI prompts and memory extraction. At the same time, the target language of smart translation is no longer hardcoded to Chinese and now follows the interface language.

### 1. Four-Language i18n Framework (Zero Third-Party Dependencies)

- **Self-developed i18n, no URL prefix**: language preference is stored in `localStorage` and a same-named cookie; switching takes effect instantly without triggering a route change. No i18n library dependency, so bundle size and first-paint cost are unaffected.
- **Full coverage of four layers**: frontend UI copy, backend HTTP error responses, the AI system prompt scaffold, and long-term memory extraction & retrieval triggers — all rendered per language.
- **Type-level key validation**: the keys of `t("...")` are a compile-time-checked literal union. A single mistyped letter fails the build immediately instead of silently rendering `nav.chta` at runtime. The four dictionary tables are forced to share the same shape, so a missing language is obvious at a glance.
- **Localized formatting**: dates, weekday names, numbers, currency, file sizes and relative times ("3 hours ago") all follow the interface language.

### 2. Three Language-Switching Entry Points

- **Top bar on the login page**: the only entry point before sign-in — an English user must be able to switch language **before seeing any error message**.
- **Desktop top bar**: immediately to the left of the theme toggle, always present after sign-in, no need to open settings first.
- **Preferences · Interface Appearance**: a full-width row with explanatory text, where each option is labeled with its native name plus the English name for easy cross-checking.

### 3. Smart Translation Target Language Follows the Interface Language

- **The local language is decided by the UI**: an English UI translates into English, a Japanese UI into Japanese, a Traditional Chinese UI into Traditional Chinese. Previously the prompt hardcoded "Chinese ⇋ target language", so English users typing English on an English UI still got Chinese back.
- **Same-language pairs automatically degrade to one-way**: when English is selected on an English UI, or Japanese on a Japanese UI, it automatically switches to one-way "any foreign language → local language" translation, instead of emitting contradictory instructions like "translate English input into English". Simplified and Traditional Chinese are treated as the same language.
- **Banner and language chips stay in sync**: the mode banner and the "local ⇋ target" label on the language buttons now follow the interface language in real time instead of being pinned to "Chinese".

### 4. Bilingual Strategy for AI Prompts

- **The scaffold follows the language**: the default persona, section headings, the time-base statement, web-search guidance and the formatting rules are each written out in all four languages. The time-base statement directly decides whether the model answers "what day is it today" with Wednesday in English or with the Chinese equivalent.
- **The guardrail section stays Chinese**: the few-shot examples of the anti-reasoning-trap guardrail are deliberately chosen Chinese-specific ambiguities (the inverted-pendulum feat from *Water Margin*, the Chinese word-order ambiguity of 「小美的弟弟有几个姐妹」, Chinese character stroke counting). Swapping in English examples means swapping the anchor set, and the value of that module lies precisely in those few examples.
- **One language instruction injected at both ends**: the opening one pins down Chinese phrasing in the user persona and the guardrail; the trailing one exploits the recency effect to pin down the last section the model read. With only one, putting it at the end fails to hold the guardrail, while putting it at the start gets diluted by the thousand-odd Chinese characters that follow.
- **Memory extraction avoids language contamination**: the subject word and length unit in the extraction prompt follow the language (English uses *words*, not *characters*). This text is injected verbatim into the context of every subsequent conversation, so language contamination accumulates.

### 5. Full Localization of Backend Error Messages

- **Error code + parameterized copy**: the raise site only declares the code and the parameters; the copy is looked up per request language in `core/messages.py`. The response body carries an extra `code` field so the frontend can localize again and logs can aggregate by code rather than by string matching.
- **24 newly onboarded user-facing strings**: model availability and experience-mode limits, media access authorization, credential management, missing model-service credentials, admin action receipts, model sync results.
- **Fixed Pydantic validation leaking Chinese**: on form validation failure the `msg` field of the 422 response body was hardcoded Chinese and is now localized.
- **Standard `Accept-Language` header support**: a standard header rather than a custom one, because it also serves search engines, CDNs and any future caller that bypasses this project's frontend.

### 6. Rigor of Production Docker Builds

- Fixed type and syntax problems such as JSX attributes missing braces, Next.js `metadata` coexisting with `generateMetadata`, leftover references to deleted modules, and missing hooks in component scope.
- **Dictionary and interpolation type governance**: a consistency check script for the four-language key sets, plus loosening interpolation variable types to support optional backend fields, so this class of build failure stops recurring.

### 7. Multi-File Attachment Selection and Upload Budget Alignment

- **Multi-select that never selected more than one file**: the inputs already carried `multiple`, but `input.files` hands back a *live* object that the browser mutates in place. Each `onChange` called the handler and then reset `input.value = ""`, which empties that very list — and since the loop re-read `files.length` after every asynchronous step, it stopped after the first file. Pasting several images had always worked, which is what made this so easy to miss: the paste path builds its own array, so it was already a snapshot.
- **The file picker and the gallery now both accept several files or images at once**, each landing as its own chip in the composer tray.
- **Size caps moved into the frontend to match the server**: 10 attachments, 20MB per file, 40MB combined. Nothing stopped you at selection time before, and an over-budget set was rejected by the backend at send — taking the **message text down with it**, so the only symptom was "the message won't send" rather than "too many attachments".
- **Fixed a contradiction in the backend's own gates**: the request body was capped at 32MB while the attachment budget was 40MB, but attachments travel as inline base64, which inflates them by 4/3. Forty megabytes of files therefore arrived as a ~53MB body and was always rejected by the 32MB layer first, leaving the 40MB figure a limit nothing could ever reach. The body ceiling is now 56MB.

---

## v2.23.0 Release Notes

This release **decouples input-box state restore from engineering-grade build rigor and a backend architecture refactor**. Chat input state and historical conversation state are now restored precisely, strict-mode type hazards during the production Docker build are fully eliminated, the deduplicated backend model catalog service is refactored, and model sync permissions are tightened.

### 1. Chat Input State Memory & Smart Conversation Restore
- **Deep conversation state linkage**: creative state activated inside a conversation — smart translation mode, chosen target language and so on — is precisely recognized and restored when you switch conversations, with no need to re-enable it manually every time.
- **One-click reset for new chats**: clicking 「New Chat」 smartly restores the default assistant input state, so alternating between tasks flows naturally.

### 2. Rigor of Production Docker Container Builds
- **Strict indexed-access guards**: carefully guarded against the object-destructuring access hazards that surface under TypeScript's `noUncheckedIndexedAccess: true` strict mode during the production Docker build, ensuring automated CI/CD and container images build fast and stably.

### 3. Backend Model Service Refactor Fully Decoupled from Startup Tasks
- **Unified model catalog I/O**: refactored and extracted the generic JSON catalog persistence and cache helpers into `catalog.py`; the four model catalogs (language, image, video, speech) now implement a consistent file I/O layer, removing boilerplate duplication.
- **Startup tasks fully decoupled**: the all-network chat model sync logic is pushed down to the service layer, removing the reverse dependency of `main.py`'s system Lifespan startup lifecycle on API route handlers, along with fragile parameter binding.
- **Merged core logic modules**: the image and video streaming-response logic in the Media module is merged, a shared model validation function is abstracted, and maintenance cost is reduced.

### 4. Tightened Permissions on Model Sync Endpoints & UI Adaptation
- **Admin-only restriction**: every real-time all-network model sync endpoint (`POST /models/sync*`) is now admin-only (`get_current_admin`), putting an end to ordinary users hammering remote vendor APIs.
- **Sync button on the frontend settings page**: only admin accounts can see and click the 「Sync List」 button on each model list; the ordinary-user UI stays minimal and clean.

### 5. Redundant Code Cleanup
- Removed unused deprecated persona templates and dead configuration that the frontend never referenced, improving the tidiness and robustness of the whole codebase.

---

## v2.22.0 Release Notes

A major release that **simplifies the feature architecture and upgrades smart translation into a teaching tool**. The interface is further consolidated, smart translation and other extensions are unified into the 「+」 creation menu, grammatical inflection breakdown and Japanese kana annotation receive a full upgrade, and settings now supports a custom global system prompt.

### 1. Creation Capabilities Unified into the 「+」 Menu
- **Minimal, pure input area**: the standalone mode-switch bubbles around the input bar were removed; smart translation and other creation extensions (generate image, generate video, audio to text) are now consolidated into the `+` menu to the left of the input box.
- **State-aware round button**: when smart translation is active, the plus button switches to a highlighted multi-language icon and supports exiting or restoring the default at any time.

### 2. Full Upgrade of Smart Translation and Grammar Teaching
- **Japanese kana annotation**: in Chinese–Japanese translation mode, every kanji is strictly followed by its hiragana reading (e.g. `私(わたし)は日本語(にほんご)を勉強(べんきょう)しています`), completely solving the problem of hard-to-read kanji pronunciation.
- **Deep grammar analysis and verb inflection**: extracts the lemma of key verbs, inflection patterns (conunctive form, past tense, progressive, etc.) and sentence tense; breaks down core grammar and fixed collocations in detail, with transferable examples.
- **Structured similar example sentences**: automatically generates 2–3 idiomatic example sentences of similar structure, with context notes and collocation analysis.

### 3. Context-Free Single-Turn Translation & Lightning-Fast Model Switching
- **Zero-distraction single-turn mode**: translation automatically enables single-turn isolation, without carrying in the long multi-turn conversation history, and forcibly disables long-term memory extraction and web search for the cleanest millisecond-level instant translation.
- **Automatic recommended-model switching**: when smart translation is enabled, fast models (`google/gemini-2.5-flash-lite` and `openai/gpt-4o-mini`) are automatically recommended and pinned to the top; when you exit translation or start a new conversation, it falls back to the preferred model configured in settings.

### 4. Custom Global System Prompt
- **New global persona configuration in settings**: a 「System Prompt」 module is added under 「Settings」 so users can customize or edit the global base instructions at any time, with one-click restore of the standard assistant prompt.

---

## 🐱 About Apiapia (Brand Story & Inspiration)

> "She has clear emerald eyes and used to lie quietly beside the keyboard through days and nights; now she has become the ever-remembering assistant in your digital world."

<p align="center">
  <img src="icons/apiapia-real.jpg" alt="The real cat Apiapia" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-app-icon.jpg" alt="Apiapia App icon" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-avatar-circle.png" alt="Apiapia brand avatar" width="220" style="border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
</p>

<p align="center">
  <em>Left: real-life photo of the original cat · Center: iOS-native Web App icon · Right: circular brand avatar</em>
</p>

**Apiapia** is modeled on a real house cat with cute tabby markings and emerald-green eyes. In daily life the cat gives its family warmth and reassurance through sharp instinct and long companionship; in the **Apiapia assistant system** that companionship is endowed with the long-term memory and logical reasoning of cutting-edge AI:

- **Warmth that never fades**: unlike conventional LLMs that "forget" on every new conversation, Apiapia uses its own vector memory engine (Mem0 OSS + pgvector) to quietly treasure your work preferences, life habits and fragments of fact.
- **Understands you the more you talk**: related facts are recalled automatically across devices and across time, so you never have to reintroduce yourself — conversation flows as smoothly as with an old friend.
- **Elegant on every device**: beyond a hand-drawn cat brand mark, the whole visual system has been reworked for both mobile and desktop, delivering an experience that is both technological and approachable.

---

## 📲 Full Icon System for the iOS Browser Web App (PWA)

The system is now fully compliant with **Apple iOS Safari** and modern mainstream browser Progressive Web App (PWA) standards, supporting one-tap 「**Add to Home Screen**」 from Safari for an immersive, chrome-free standalone experience comparable to a native app (Standalone Mode):

<p align="center">
  <img src="icons/apiapia-logo-dark.jpg" alt="Apiapia brand dark banner" width="720" style="border-radius: 16px; box-shadow: 0 12px 36px rgba(0,0,0,0.25);" />
</p>

### 📱 1. Full Icon Specification

| Platform / Scenario | Icon File | Size / Format | Purpose & Specification |
| :--- | :--- | :--- | :--- |
| **iOS Home Screen** | `apple-touch-icon.png` | 180×180 PNG | Default icon when adding to the home screen on iOS, adapted for Retina displays |
| **iPhone Retina @3x** | `apple-touch-icon-180x180.png` | 180×180 PNG | For @3x ultra-high-resolution Retina screens such as iPhone 14/15/16 Pro |
| **iPad Pro @2x** | `apple-touch-icon-167x167.png` | 167×167 PNG | High-resolution icon custom-built for 10.5" / 11" / 12.9" iPad Pro |
| **iPad / iPad mini** | `apple-touch-icon-152x152.png` | 152×152 PNG | Standard high-resolution Retina display for iPad Air and iPad mini |
| **iPhone Standard @2x** | `apple-touch-icon-120x120.png` | 120×120 PNG | Standard-resolution iPhone displays and Spotlight search results |
| **Web App Launch Icon** | `icon-192x192.png` | 192×192 PNG | Standard generic PWA manifest icon, for mobile splash screens and shortcuts |
| **Web App HD Icon** | `icon-512x512.png` | 512×512 PNG | High-resolution PWA icon, app store showcase and splash loading page |
| **Android Adaptive Icon** | `icon-maskable-192x192.png` | 192×192 PNG | Includes a 20% safe margin, fits any mask shape (circle, rounded rect, etc.) |
| **Android HD Adaptive Icon** | `icon-maskable-512x512.png` | 512×512 PNG | Follows the W3C Maskable spec so icon edges are never clipped |
| **Multi-resolution Favicon** | `favicon.ico` | 16/32/48 ICO | Standard ICO for desktop browser tabs, embedding all three 16/32/48 sizes |
| **Modern Browser Favicon** | `favicon-32x32.png` / `16x16` | 32×32 / 16×16 | High-resolution bitmap favicon for modern desktop and mobile browser tabs |
| **Vector Hi-Fi Favicon** | `icon.svg` | Scalable SVG | Native vector favicon for modern Safari / Chrome, infinitely scalable without distortion |

### 🛠️ 2. Installing as a Web App on iOS

1. Open the Apiapia URL in **Safari** on your iPhone or iPad (e.g. `http://<your-server-ip>:3000`).
2. Tap the **「Share」button (up-arrow icon ⎋)** in the bottom (or top) navigation bar.
3. Scroll down in the popup menu and choose **「Add to Home Screen」**.
4. Confirm the app name is **Apiapia** and tap 「Add」 in the top right.
5. Back on the home screen you'll see the **Apiapia App** with its official cat icon. Tapping it opens full-screen immersive mode, free of the browser address bar and bottom toolbar!

---

## 🌟 Core Principles & Architecture

1. **Frontend/backend separation and decoupling**:
   - The frontend uses **Next.js (React 18 + TypeScript + Tailwind CSS + shadcn/ui)**, built on Radix primitives and CSS-variable theming, responsible for UI, interactions, streaming SSE rendering, mobile Web App adaptation and automatic version update detection. Mobile uses independent full-screen tabs (including iOS safe-area compensation); desktop uses a "top bar + persistent conversation sidebar + chat area + related-memory panel" layout.
   - The backend uses **FastAPI (Python 3.12)**, unified handling LLM routing, the long-term memory extraction lifecycle, real-time all-network search, document parsing, the conversation database and encryption of sensitive API keys.

1.1. **Four-Language i18n & Localization (v2.24.0)**:
   - **Self-developed lightweight framework, zero third-party dependencies**: no URL prefix; language preference lives in `localStorage` and a same-named cookie. Four layers — UI, backend errors, AI prompts, memory extraction — switch together. Language state is also sent via the standard `Accept-Language` header, which serves search engines, CDNs and any future caller that bypasses this project's frontend.
   - **Compile-time key validation**: the keys of `t("...")` are a compile-time-checked literal union, so one wrong letter fails the build immediately. The four dictionary tables are forced to align structurally, so a missing language is obvious at a glance.
   - **Three switch entry points**: login page top bar, desktop top bar (left of the theme toggle), Preferences · Interface Appearance. Options show the native name plus the English name side by side for easy cross-checking.
   - **Bilingual AI prompt strategy**: the scaffold (persona, time base, search guidance, formatting rules) follows the language; the anti-reasoning-trap guardrail keeps a single Chinese version (its few-shot examples are Chinese-specific reasoning ambiguities — changing the language changes the anchors), and one language instruction is injected at both ends of the prompt so the thousand-odd Chinese characters don't dilute the output language.
   - **Smart translation target follows the UI language**: an English UI translates into English, a Japanese UI into Japanese, a Traditional Chinese UI into Traditional Chinese; same-language pairs automatically degrade to one-way translation, with Simplified and Traditional treated as the same language.
   - **Backend error codes + parameterized copy**: the raise site only declares the code and parameters, with copy looked up per request language; the response body carries `code` so the frontend can localize again and logs can aggregate by code.

2. **Universal Fully-Automatic Web Search Engine (v2.3.0)**:
   - **Universal across all models**: no dependency on any specific vendor's web feature. Claude, GPT, Gemini, DeepSeek and locally deployed Ollama models all automatically gain web search.
   - **Smart auto-decision**: the system autonomously detects the need for time-sensitive news, weather, exchange rates, stock quotes, external facts, the latest technical updates and so on, searching as needed; everyday chat, pure code and logic stay zero-latency with no search.
   - **Three modes on demand**: the input box supports one-tap cycling through 「Auto-Decide (default) / Force On / Off」, persisted automatically.
   - **Multi-tier keyless high availability**: with no key configured, a built-in DuckDuckGo multi-tier async search engine and parser (html / lite / instant-answer, pure httpx with zero third-party dependencies) works out of the box at no cost. Once `TAVILY_API_KEY` is set it automatically upgrades to **Tavily AI native search as primary with DuckDuckGo as fallback**, giving stronger search quality and RAG relevance (the `web_search` field of `/api/health` shows the active engine).
   - **Real-time retrieval with page attribution**: during streaming generation it dynamically shows a searching animation and the query terms; below the answer it persistently renders an interactive collapsible card 「🌐 Referenced X web sources」 with page titles, summaries and one-click outbound links.

3. **Strict separation of long-term memory and chat logs**:
   - **Chat logs**: stored in full in PostgreSQL `conversations` and `messages`, used for historical traceability and context recovery.
   - **Long-term memory (Mem0 OSS 2.2.1)**: stored independently in a **pgvector** vector database, automatically recalling the user's personal preferences, life habits and facts across sessions.
   - **Creation time with reverse-chronological display (v2.2.0)**: every long-term memory automatically records a timestamp precise to the second (`YYYY-MM-DD HH:mm:ss`), newest first by default.
   - **Single-column full list view (v2.2.0)**: a single-column adaptive widescreen list designed for high-volume facts, showing the richest content detail, with inline quick editing and per-item precise deletion.
   - **ADD-only behavior**: matches Mem0 OSS 2.2.1 semantics, never assuming old facts are automatically overwritten. Users can view, edit and delete directly on the web page, and **export JSON with one click** for full ownership of their personal data.

4. **Conversation organization and pinning (v2.6.0)**:
   - **Pinned group display**: important historical conversations can be pinned with one click and are aggregated in a separate highlighted group.
   - **Flexible reordering**: pinned conversations support drag-and-drop sorting plus move-up / move-down fine tuning, making it easy to order tasks by priority.
   - **Light interaction**: action buttons are always visible, and the interaction is simple and intuitive.

5. **Site-wide shadcn/ui component standard and UX rework (v2.7.0)**:
   - **Unified lightweight ActionTooltip**: the site-wide sidebar, toolbar, action bubbles and management entries all use a responsive `<ActionTooltip>` with a subtle fade-in animation.
   - **Admin console (Usage & Audit) upgrade**: data tables upgraded from raw `<tr>`/`<td>` to standard shadcn `<Table>` components, integrated with an audit drawer and smooth touch containers.
   - **Settings center and accessibility (A11y)**: introduces a spec-compliant continuous `<Slider>`, moves the model picker to a Popover Combobox, and optimizes event isolation to eliminate dropdown scroll-through and jank.
   - **Official brand and avatar system**: the site-wide nav bar, login welcome page, empty-state guidance and mobile top bar all use the official Apiapia mascot badge.

6. **Model decoupling (LLM Adapter) and multimodal capability**:
   - Abstract `LLMProvider` interface with native adapters for **OpenAI, OpenRouter, Anthropic Claude, Google Gemini, local Ollama** and more.
   - **Native OpenRouter support**: a single OpenRouter key is all it takes to switch in the frontend between Claude 3.7 / 3.5 Sonnet, GPT-4o, DeepSeek V3 / R1, Llama 3.3, Gemini 2.5 and a huge range of other models.
   - **Multimodal and file parsing**: natively supports uploading images, PDF, Word, TXT, Markdown and other documents, automatically extracting text and injecting it into the conversation context; images support fullscreen lightbox zoom and original download.
   - Switching models never loses long-term memory.

7. **Enforced security and privacy rules**:
   - **Mandatory identity isolation**: `user_id` in every API is taken from the verified JWT; a `user_id` passed from the frontend is never trusted.
   - **Untrusted context defense**: recalled long-term memory is wrapped as untrusted background material at the prompt layer to prevent prompt injection from hijacking system instructions.
   - **Encrypted API key persistence**: user-configured model credentials are stored with Fernet symmetric encryption on the backend; plaintext is never returned to the frontend.

---

## 🚀 Architecture

```text
                          Browser / iOS Safari Web App
                                      │
                                      ▼
                          ┌─────────────────────┐
                          │       Next.js       │ (Port 3000)
                          │ React + TS Frontend │
                          └──────────┬──────────┘
                                      │ HTTP / SSE
                                      ▼
                          ┌─────────────────────┐
                          │       FastAPI       │ (Port 8000)
                          │   Python Backend    │
                          └──────────┬──────────┘
                                      │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
                 LLM Layer         Mem0 Layer       PostgreSQL
                    │                     │                     │
             ┌──────┼──────┐              │           ┌─────┴─────┐
             ▼      ▼      ▼          ▼           ▼           ▼
            GPT   Claude  Gemini   pgvector    Chat Logs    Users
                                      │
                                      ▼
                               Long-term Memory
```

---

## 📦 Quick Deployment & Startup

The project is fully containerized. Docker Compose starts everything on a server or a personal machine in one command, with standard health check probes already wired into the orchestration so services come up smoothly.

### 1. Configure Environment Variables

Copy the environment variable template:

```bash
cp .env.example .env
```

Fill in the values in `.env` according to your setup (or configure them later through the web frontend's settings page).

**The complete list of configuration keys with per-item explanations lives in `.env.example`**, where each key's default value and impact of changing it are noted. The principle: **only `POSTGRES_PASSWORD` is required**; leaving anything else blank adopts the default in `backend/app/core/config.py`, and deleting a line is equivalent to filling in its default. So you only need to touch the lines you actually want to change.

A few worth calling out:

- `POSTGRES_PASSWORD`: **the only required key**. The database connection string is assembled automatically from `POSTGRES_*`, so there is no need (and it would be wrong) to hand-write `DATABASE_URL`; `@` `/` `:` in the password are escaped automatically. Only set `DATABASE_URL` / `MEM0_DATABASE_URL` explicitly when the app must connect to a database outside this compose stack.
- `SECRET_KEY`: JWT signing key. **Rotating it logs everyone out.**
- `API_KEY_ENCRYPTION_KEY`: symmetric encryption key for API keys in the database. **Rotating it makes every stored key undecryptable, and users must re-enter them.**
- `ADMIN_EMAIL` / `ADMIN_USERNAME`: strongly recommended for public deployments, otherwise **the first registered user becomes the administrator**.
- `POSTGRES_HOST_PORT` / `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT`: host port mappings, default `5432` / `8000` / `3000`. Change these when a port is taken — no need to touch `docker-compose.yml`.
- `APP_VERSION`: service version, read from the `VERSION` file by default. **Must stay consistent with `VERSION` and `frontend/package.json` at the repo root** — all three ship as one artifact.
- `OPENROUTER_API_KEY`: OpenRouter unified LLM API key, **used by chat, memory and speech alike**.
- `TAVILY_API_KEY`: Tavily web search key (free at https://tavily.com, 1000 calls per month; leave blank to use only free DuckDuckGo).
- `TAVILY_SEARCH_DEPTH`: search depth `advanced` (accurate) / `basic` (fast), default `advanced`.
- `NEXT_PUBLIC_API_URL`: leave blank to use the same-origin proxy `/api/backend` — no server IP to configure and no cross-origin problems. **Only a purely static export (Cloudflare Pages) needs it**, and in that case backend CORS must also allow the frontend domain.
- `STT_MODEL` / `TTS_MODEL`: **code-level fallback constants, not deployment configuration** (`backend/app/core/config.py`). They only have a usable value before an account has ever opened speech settings or before the first catalog sync. In daily use you pick the model on the settings page, and this is neither needed nor appropriate to change.
- `TTS_VOICE`: optional, pins a single voice globally (blank by default = use the first voice in the catalog for that model). **No configuration needed** — models that don't publish a voice list (Fish Audio / Seed Audio families) automatically omit the `voice` field and the provider uses its own default voice. It is tightly bound to the model, so if it's set while the current model doesn't accept it, it is ignored rather than erroring.
- `FREE_AUDIO_MODELS`: comma-separated list of free speech models for experience-mode accounts (same nature as `FREE_IMAGE_MODELS`). Most models are auto-detected from zero pricing; this covers free tiers that the pricing API doesn't expose.
- `SPEECH_MAX_AUDIO_BYTES`: size cap for a single speech-to-text audio payload, default 25MB (matching OpenRouter's multipart limit).
- `SPEECH_MAX_TEXT_CHARS`: text cap for a single speech synthesis, default 4000 characters.

> **Configure in one place only.** `docker-compose.yml` is now responsible only for images, ports, volumes, health checks and service ordering; all business configuration comes from `.env`, and anything absent from `.env` falls back to the defaults in `backend/app/core/config.py`. The same defaults used to be written out three times — in compose, in `config.py` and in `.env` — so the database password was duplicated in three places, and it was exactly that duplication that led to missing an update when rotating the password and failing to connect.

> **Hot reload for local development**: `docker-compose.yml` does not carry `--reload` (servers don't need it). When you do, create a `docker-compose.override.yml` that overrides `backend.command`; Compose merges automatically and the main file stays untouched.

> Speech recognition and speech synthesis are **two disjoint model families** (the sets returned by OpenRouter's `output_modalities=transcription` and `=speech` do not overlap), so the settings page has two independent dropdowns and the database has two fields, `stt_model` / `tts_model`.
> **Audio format is negotiated server-side**: models support different formats (Gemini TTS accepts only pcm, Mistral Voxtral only mp3), so the frontend's mp3 request is merely a preference. When the model rejects it, the server automatically retries with another format and remembers the result; what reaches the browser is always a playable container — raw pcm is wrapped into WAV (sample rate taken from the `audio/pcm;rate=…;channels=…` response header, never guessed).
> The model catalog is persisted in `backend/app/synced_audio_models.json` and refreshed only when 「Sync List」 is clicked on the settings page or when the backend starts, exactly like the language / image / video catalogs; no real-time catalog lookups happen on the request path.
> The speech feature reuses the existing `OPENROUTER_API_KEY`; no extra key is needed. When it isn't configured, the `speech` field of the health check reports `no OpenRouter key`.

### 2. Start the Docker Container Stack with One Command

```bash
docker compose up --build -d
```

Compose brings up and wires together three services in order:
- `postgres`: a PostgreSQL 17 container with the pgvector extension and a persistent volume `postgres_data`.
- `backend`: the FastAPI backend, with a health check that automatically completes extension activation, schema sync and Mem0 initialization.
- `frontend`: a standalone Next.js container that waits for the backend to become Healthy before starting, listening on port `3000`.

### 3. Access the Application

- **Web UI**: `http://localhost:3000`
- **Backend API docs (Swagger)**: `http://localhost:8000/docs`
- **Health check endpoint**: `http://localhost:8000/api/health`
  Returns real probe results: when the database is unreachable it returns **503** (the `database` field reports the exception type and `status` is `degraded`), and the Docker healthcheck marks the container unhealthy accordingly. The `mem0_oss` field reflects whether long-term memory has a usable LLM credential configured.

> For production deployments, put a reverse proxy in front and enable HTTPS, and replace `SECRET_KEY` and `API_KEY_ENCRYPTION_KEY` in `.env` with random values — the two in `.env.example` are public sample values, and anyone who gets them can forge login tokens or decrypt the API keys in the database.

---

## 📱 Core Features & Page Routes

| Page Route | Description |
| :--- | :--- |
| `/login` | Modern login and registration, using secure hashing and JWT token authentication, presenting the official Apiapia badge. The top bar provides a **language switch entry**, so signed-out users can switch the interface language before seeing any error message. |
| `/chat` | The core chat interface. Conversation pinning and sorting on the left, searchable model switching, **smart fully-automatic all-network search (v2.3.0)**, multimodal attachment upload, SSE streaming typewriter rendering and a related-memory panel. On mobile, a bottom tab bar switches five independent tabs — Chat / History / Memory / Usage / Settings — with every top-level page reachable in one step. |
| `/memory` | **Memory library management (v2.2.0)**. Single-column list display, creation time precise to the second, reverse-chronological sorting, semantic vector search, inline quick editing, per-item deletion and **one-click JSON export**. |
| `/settings` | Preferences. **Interface language switching (v2.24.0)**, custom persona style, continuous creativity slider, appearance theme switching, the global long-term memory switch and secure hosting of multi-vendor API keys. |
| `/usage` | **Usage and cost audit dashboard (v2.7.0)**. Statistics on multi-model / multi-period call detail and token consumption distribution; administrators get multi-user session auditing, recycle-bin message inspection and one-click restore. |

---

## 💾 Data Persistence & Backup

The project defines two named data volumes in `docker-compose.yml`:
- `postgres_data`: stores the PostgreSQL user, conversation and message tables plus the Mem0 pgvector collection.
- `mem0_data`: stores the Mem0 local history database.

Example backup command:
```bash
docker exec -t apiapia_postgres pg_dump -U postgres apiapia > backup_$(date +%Y%m%d).sql
```

Example restore command:
```bash
cat backup_xxx.sql | docker exec -i apiapia_postgres psql -U postgres -d apiapia
```