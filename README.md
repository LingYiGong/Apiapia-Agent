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
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v2.30.0-indigo?style=flat-square" alt="Version"></a>
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

**Apiapia** is inspired by a real house cat with lovely tabby markings and emerald eyes. In daily life, cats offer comfort through intuitive empathy and silent companionship. In the **Apiapia Assistant System**, that companionship is paired with cutting-edge long-term vector memory and multi-model reasoning:

- **Warmth that Never Fades**: Unlike conventional LLMs that forget everything on every new session, Apiapia uses its own vector memory engine (Mem0 OSS + pgvector) to treasure your preferences, habits, and factual fragments.
- **Understands You More Over Time**: Cross-device and cross-session automatic recall of relevant facts eliminates repetitive introductions.
- **Polished Across All Form Factors**: Custom-crafted mascot visual system, designed for responsive desktop workflows and iOS/Android mobile screens.

---

## ✨ Key Features

- 🧠 **Vector Long-Term Memory (Mem0 OSS 2.2.1 + pgvector)**: Automated fact extraction and retrieval with second-accurate timestamps, semantic vector search, inline editing, and one-click JSON export.
- 🌐 **Autonomous Real-Time Web Search**: Intelligently decides when to search, supports Tavily AI native search + DuckDuckGo zero-key fallback, multi-query expansion, and inline citation links.
- 🤖 **Universal Multi-Model Routing**: Native adapters for OpenAI, Anthropic Claude (with Extended Thinking), Google Gemini, OpenRouter, and local Ollama — switch models anytime without losing memory.
- 🎙️ **Full-Stack Speech & Language Teaching**: Whisper speech-to-text (STT) recording, multi-voice text-to-speech (TTS), and smart translation with Japanese furigana readings and verb inflection breakdown.
- 🌍 **Zero-Dependency Four-Language i18n**: Lightweight self-developed framework covering UI, backend errors, prompt scaffolding, and memory extraction across English, 简体中文, 繁體中文, and 日本語.
- 📱 **Native-Grade iOS PWA & Mobile UX**: One-tap "Add to Home Screen" standalone immersion, full safe-area compensation, and 5 independent mobile tabs.
- 🔒 **Enterprise-Grade Privacy & Security**: Strict JWT identity isolation, Fernet symmetric API key encryption, and `<untrusted_document>` prompt injection defense.

---

## 🚀 Quick Start & One-Click Deployment

The project is fully containerized. Docker Compose starts all services on a server or local machine with one command:

### 1. Configure Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env`. **`POSTGRES_PASSWORD` is the only required key**:

```env
POSTGRES_PASSWORD=your_secure_password_here
# Optional: add your model credentials
OPENROUTER_API_KEY=
TAVILY_API_KEY=
```

### 2. Start Services via Docker Compose

```bash
# Local development: picks up docker-compose.override.yml (hot reload + separate dev volumes)
docker compose up --build -d

# Production deploy: name the file explicitly so no dev overrides are loaded
docker compose -f docker-compose.yml up --build -d
```

Compose launches three synchronized services:
- `postgres`: PostgreSQL 17 with the pgvector extension.
- `backend`: FastAPI Python backend with automatic migrations and Mem0 initialization.
- `frontend`: Next.js standalone container listening on port `3000`.

> **Deployment note**: unless you pass `-f`, Compose auto-loads `docker-compose.override.yml` from the same directory (the local development layer).
> Always deploy with `-f docker-compose.yml`, otherwise the stack picks up development hot reload and separate dev volumes.

### 3. Access the Application

- **Web UI**: `http://localhost:3000`
- **Swagger API Docs**: `http://localhost:8000/docs`
- **Health Check Probe**: `http://localhost:8000/api/health`

---

## 🛠️ Local Development Guide

For contributors and local developers:

### Separating Local from Production

The `docker-compose.override.yml` file at the repo root is the **local development layer**, and it rests on a single rule: Compose auto-loads it whenever you do not name your files with `-f`.

| | Local development | Production deploy |
|---|---|---|
| Command | `docker compose up` | `docker compose -f docker-compose.yml up -d` |
| Loads override | Yes | No |
| Backend hot reload | Yes (`--reload --reload-dir=/app/app`) | No |
| Database volume | `apiapia_postgres_dev_data` | `apiapia_postgres_data` |
| Memory / media volumes | `*_dev_data` | `apiapia_mem0_data` / `apiapia_media` |
| `SECRET_KEY` | Overridden with a throwaway dev key | From `.env` |
| `API_KEY_ENCRYPTION_KEY` | Overridden with a throwaway dev key | From `.env` |
| `POSTGRES_PASSWORD` | Overridden with `local-dev-password-not-a-secret` | From `.env` |

Worth knowing:

- **Secret isolation.** The override uses `environment`, which takes precedence over `env_file`. Copying a production `.env` onto a developer machine therefore never puts the production signing key, encryption key, or database password into actual use.
- **Data isolation.** Local runs on separately named volumes, so wiping or experimenting with the local database cannot reach deployment data.
- **Hot reload does not misfire.** Uvicorn watches its working directory by default, and that is `/app`, which also has `/app/data/mem0` and `/app/data/media` mounted. Mem0 writing snapshots and the app writing generated media both touch files there, so the override narrows the watch explicitly with `--reload-dir=/app/app`.
- **Hot reload on Windows.** `--reload` relies on `watchfiles` listening for kernel filesystem events, and a Docker Desktop bind mount does not reliably propagate host file-change events into the Linux container. Editing `backend/app` on a Windows host may therefore not trigger an automatic reload. That is a Docker Desktop limitation, not a misconfiguration — it behaves normally on a Linux host. On Windows, use `docker compose restart backend`, or run the backend natively in a venv as described under "Backend (FastAPI)" below.
- **Running both stacks on one machine.** The override leaves `ports` alone on purpose: a port's merge behaviour in an override file (appended on some Compose versions, replaced on others) can silently leave a service listening on two host ports. There is no clash when local and production are different machines. If you do need both on one host, use the `POSTGRES_HOST_PORT` / `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` variables already present in `.env`.

### Frontend (Next.js)

```bash
cd frontend
npm install # or pnpm install
npm run dev
```
Runs at `http://localhost:3000`.

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
> **Note**: Backend development requires a PostgreSQL instance with pgvector (start via `docker compose up postgres -d`).

---

## 🏗️ Architecture

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

## 📱 Page Routes & Capabilities

| Route | Description |
| :--- | :--- |
| `/login` | Secure JWT authentication with pre-login language switching. |
| `/chat` | Conversational workspace with pinned threads, real-time web search, multimodal attachments, and memory inspection. |
| `/memory` | **Memory Dashboard**: vector semantic search, second-precision timestamps, inline edits, and one-click JSON export. |
| `/settings` | Four-language toggle, custom personas, creativity slider, theme switcher, and encrypted provider key management. |
| `/usage` | **Usage & Cost Auditing**: token consumption breakdowns and administrative conversation inspection. |

---

## 💾 Data Persistence & Backup

Defined volumes in `docker-compose.yml`:
- `postgres_data`: user data, conversation history, and Mem0 pgvector collections.
- `mem0_data`: local Mem0 history index.

A local development run (`docker compose up`, with the override) uses a separate set of volumes named `apiapia_postgres_dev_data`, `apiapia_mem0_dev_data` and `apiapia_media_dev_data`. Back up the `docker-compose.yml` volumes shown above; the `_dev_data` ones hold throwaway local data.

Backup command:
```bash
docker exec -t apiapia_postgres pg_dump -U postgres apiapia > backup_$(date +%Y%m%d).sql
```

Restore command:
```bash
cat backup_xxx.sql | docker exec -i apiapia_postgres psql -U postgres -d apiapia
```

---

## 📜 Releases & Changelog

### 🚀 Latest Release: v2.30.0 (2026-10-19)

This release focuses on **Single Source of Truth (SSOT) architecture refactoring for default models, default model upgrade to NVIDIA Nemotron 3 Ultra, and memory retrieval isolation for Smart Translate**. It eliminates scattered hardcoded model ID strings across the entire codebase, ships NVIDIA's 550B open-weight frontier reasoning model out of the box, and ensures single-turn translate mode does not carry redundant conversational memory.

#### 1. Single Source of Truth (SSOT) for Default Model
- **One place to configure across the system**: eliminated over 10 hardcoded model ID strings previously scattered across user registration, user settings, access gating, database migrations, and frontend UI. The system default model is now configured in exactly one place: `DEFAULT_MODEL` in `.env` or `config.py`.
- **User preference precedence & dynamic inheritance**: `user_settings.default_model` is now nullable. Users who haven't customized their model setting dynamically inherit the system default; once a user chooses a custom model in settings, their preference always takes precedence. Changing the system default in `.env` immediately takes effect for all default-inheriting users without database migrations.
- **Backend-driven frontend**: the `/models/configured` endpoint dynamically marks `is_default: true` and sends `default_model`. The frontend model selector relies on dynamic flags rather than hardcoded client strings.

#### 2. Default Model Upgraded to NVIDIA Nemotron 3 Ultra
- **550B open-weight frontier reasoning model**: system default is now `nvidia/nemotron-3-ultra-550b-a55b:free` (MoE architecture with 55B active parameters).
- **Elevated logical planning and reasoning ceiling**: purpose-built for deep reasoning, multi-step agentic planning, and long-context orchestration, fully available out of the box at zero cost.

#### 3. Single-Turn Memory Isolation for Smart Translate
- **Clean translation context**: fixed an issue where personal long-term memories were unnecessarily retrieved and injected into translation prompts. Introduced `single_turn_mode` to ensure translation output remains pure, deterministic, and fast while reducing context token consumption.

---

### v2.29.0 (2026-10-17)

This release reworks the **mobile "+" panel into a bottom sheet** and cleans up dead code across the component library. On narrow screens the creation panel used to pop up over the conversation — nearly 300px tall with six entry points, covering most of a 360px-wide screen and putting the bottom rows out of thumb reach. It now rises from the bottom edge, matching the visual language of the memory drawer and the model picker, while wide screens keep the original dropdown. Both forms render one shared panel definition, so they cannot drift apart.

#### 1. Mobile "+" Panel: Bottom Sheet Instead of Dropdown
- **Thumb-reachable, tap-to-dismiss**: below the `md` breakpoint the panel opens as a bottom sheet (rounded top, drag handle, safe-area bottom padding) and closes by tapping the scrim. Desktop keeps the popover above the composer.
- **One shared panel body**: search/filter markup, click handlers and state live in a single `renderCreationPanel`; only the container and each row's element type differ.
- **Deliberate close behavior**: every one-off action (camera / gallery / file / audio / image / video / translate) dismisses the sheet on tap, while **web search stays open** because it cycles through three modes with live state in the row — on desktop the same effect comes from `e.preventDefault()` blocking Radix's select.

#### 2. Mobile Text Alignment Fix
- **Descriptions no longer drift to the center**: the UA stylesheet sets `text-align: center` on `<button>`, and an inherited `text-align` always loses to an element's own declaration. Writing `text-left` on an ancestor container therefore did nothing, and the description text under each feature silently centered itself. The `text-left` now lives on the row component itself. Desktop was never affected — `DropdownMenuItem` renders a `div`, which has no such default.

#### 3. Copy Trimmed to Single Lines
- **28 strings across four locales** reduced to fit one line (~20 CJK characters at the ~240px available on a 360px screen). Longer copy doubled each row's height; five rows pushed the sheet past one screen and the last row — **Smart translate** — was clipped by the bottom safe area.

#### 4. Touch Target & Dead Code
- **"Back to plain chat" hit area**: a pure-padding change lifts the target from 17px to 29px tall, meeting the WCAG 2.2 minimum target size.
- **18 unused exports removed**: shadcn primitives with zero references across the app (`SelectGroup` / `SelectLabel` / `SelectSeparator`, `TableFooter` / `TableCaption`, `DialogPortal` / `DialogOverlay` / `DialogTrigger`, `SheetPortal` / `SheetOverlay` / `SheetClose` / `SheetFooter`, `AvatarImage`, `PopoverAnchor`, `AlertTitle`, and the `badgeVariants` / `buttonVariants` cva handles), plus one dead import in `ChatArea`.

---

### v2.28.0 (2026-10-16)

This release focuses on **Mobile & Desktop Core UX Optimizations**: iOS safe area notch/Dynamic Island content resilience, virtual keyboard viewport avoidance, collapsible dual sidebars with keyboard shortcuts, rapid prompt recall, and modern developer typography standards.

#### 1. iOS Safe Area & Dynamic Island Resilience
- **Outer Header Padding Lift**: Moved top safe-area padding (`pt-[var(--sat)]`) to the outer `<header>` element so the toolbar expands naturally on notch/island devices while inner action items maintain an unconstrained 48px height with centered alignment, completely eliminating content squishing and bottom border clipping.

#### 2. Mobile Soft Keyboard Detection & TabBar Viewport Avoidance
- **Zero-Accidental-Tab-Switching**: Implemented `useIsKeyboardOpen` leveraging the Visual Viewport API and focus listeners. When the virtual keyboard pops up on mobile, `<MobileTabBar>` automatically hides (`hidden`), freeing 50–80px of vertical space and preventing accidental tab jumps while typing.

#### 3. Desktop Collapsible Dual Sidebars & Global ⌘B / Ctrl+B Shortcut
- **100% Screen Space Reclaim**: Desktop history and memory sidebars can now be toggled independently. Added a collapse button to the sidebar header and dual toggle buttons in the desktop toolbar with memory item badges. Sidebar open/collapsed state is persisted to `localStorage` and toggleable via `⌘B` / `Ctrl+B`.

#### 4. Prompt History Recall on Empty Input (ArrowUp)
- **ChatGPT / Discord-Style Prompt Recall**: Pressing the `↑` (ArrowUp) key on an empty composer instantly retrieves the last user message and sets the cursor at the end for rapid prompt tweaking and resending.

#### 5. Developer Monospace Font Stack & CJK Han Unification Standards
- **Modern Monospace Stack**: Enhanced `--font-mono` prioritizing `SF Mono`, `JetBrains Mono`, `Cascadia Code`, and `Fira Code`.
- **CJK Han Unification Glyph Fix**: Added `:root:lang(ja), [data-locale="ja"]` and `:root:lang(zh-TW), [data-locale="zh-TW"]` font overrides to ensure Japanese and Traditional Chinese glyphs render according to native typographic norms rather than falling back to Simplified Chinese glyph variants.

#### 6. CodeBlock Design Tokens & Zero-Dependency Streaming Syntax Highlighting
- **Token Convergence**: Replaced hardcoded `#0d0d0d` and `#1f1f23` with design tokens `bg-code`, `bg-code-header`, and `text-code-foreground`.
- **Zero-Dependency Highlighting**: Implemented a lightweight, synchronous regex-based tokenizer covering keywords, strings, comments, numbers, booleans, and functions with zero external bundle overhead and smooth streaming performance.

#### 7. Strict i18n Dictionary Alignment & ActionTooltip Shortcuts
- **Complete Four-Language Keys**: Wired `chat.sidebar` and `chat.recall` toggle keys across all 4 locales (zh-CN, zh-TW, en, ja).
- **Shortcut Badge Support**: Added optional `shortcut` prop to `ActionTooltip` for elegant shortcut rendering.

---

### v2.27.0 (2026-10-16)

This release rebuilds the **model selector for mobile**. The picker no longer floats as a cramped panel pinned to a narrow trigger in the top bar: on phones it now opens as a **full-width bottom sheet**, and the category filter — which previously consumed roughly half the screen height — is **compressed into a single row of chips**. Along the way we corrected a real defect in the "Free" filter and removed a layer of dead code.

#### 1. Mobile Form Refactor: Bottom Sheet Replaces the Top Sliver
- **Full-width bottom sheet**: below the `md` breakpoint the picker opens as a bottom sheet (`86dvh` fixed height, rounded top, drag handle, `env(safe-area-inset-bottom)` inset). It used to be anchored to a narrow trigger inside the top bar and float above the conversation, reading as "a thin board stuck to the top of the screen" while most of the phone's vertical space sat unused.
- **Desktop keeps the popover; both share one panel**: search, filtering, keyboard handling and ARIA wiring are literally the same markup, so the two forms cannot drift apart.
- **The soft keyboard no longer appears on open**: the dialog's default auto-focus is intercepted, which previously summoned the keyboard straight over the model list. Per-model use-case badges were reduced from three to two to stop them wrapping on narrow screens.

#### 2. Category Filter Compressed Into a Single Row
- **~335px → 32px**: the seven groups now render as one row of chips — horizontally scrollable and snapping per chip on phones, auto-wrapping on desktop (a hidden-scrollbar horizontal scroll on desktop amounts to "you can't reach it").
- **Nested scrolling eliminated**: the panel previously had *two* scroll areas, each capped at `38dvh`, so every single opening meant scrolling a tiny inner list just to reach "All". There is now **exactly one scroll area** in the whole panel, and the reclaimed height goes entirely to the model list — roughly 40% more room on a phone.
- **Opens already positioned**: the selected category is scrolled into view on open, so a choice parked at the far end of the row is never mistaken for a lost selection.

#### 3. Reordered Filters & a Corrected "Free" Group
- **New order**: Free → Recommended → Deep Reasoning → Writing & Translation → Vision & Docs → Coding & Dev → All.
- **"Fast & Free" → "Free"**: the predicate was tightened to plain `is_free`. The old one was "tagged `fastFree` **or** `is_free`", which swept in paid models whose price tier is merely *budget* (`GLM-Flash`, `Qwen-Flash`, `MiniMax-M3`, `MiMo`) — a user filtering for "Free" would still have had to pay.
- **Trimmed names**: `Writing & Translation` and `Vision & Docs` lost a word each in the Chinese locales.
- **No more guessing a default filter**: when the requested default group is unavailable the picker now shows the full list instead of silently landing in some category.

#### 4. Removed Misleading Colour Coding & the Fake Hierarchy Arrow
- **Dropped the green/amber/primary palette**: the seven groups span four *different* kinds — a price constraint (Free), four capability dimensions, a ranking (Recommended) and a fallback (All). Colour-coding them claimed they were mutually comparable, which is precisely the unscientific part. Selection is now a single primary-filled style; group semantics are carried by block dividers instead (Free / Recommended ｜ scenarios ｜ All).
- **Removed the rotating chevron**: it implied a disclosure hierarchy that does not exist — tapping it just swaps the result set.

#### 5. Dead Code Removal
- **Dropped uncalled implementations**: `sortByPinnedThenActivity` (all three call sites had moved to the grouped `groupByTimeBuckets`), the `UserAvatarDropdown` compatibility aliases (leftovers from the rename to `UserAvatarMenu`, whose comment claimed "5 views use it" while 0 did), and `RECOMMENDED_CHAT_MODELS` — an ordered recommendation list whose only consumer, the settings recommendation cards, had already been removed, leaving its own comment describing a UI that no longer exists.
- **Full import-graph audit**: every source file was checked for references, confirming no unused files, components or dependencies. `@radix-ui/react-slider` was never installed in the first place (the slider is hand-rolled) and stays that way.

---

### v2.26.0 (2026-10-16)

This release brings a comprehensive refactor of **site-wide typography and reading hierarchy across Mobile and PC**, systematic readability improvements for high-DPI screens, and a zero-redundancy audit of the multi-language (i18n) codebase.

#### 1. Typography Hierarchy Refactor & Markdown Heading Inversion Fix
- **Heading Scale Rationalization**: Completely resolved the legacy issue where `h3` (15px) and `h4-h6` (13px) rendered smaller than the 16px body text. Re-engineered a responsive heading scale from `h1` (24/28px) down to `h6` (14px).
- **Desktop Code Block Alignment**: Elevated code block font size to 14px on desktop, fully matching GitHub, VS Code, and ChatGPT desktop standards. Action badges and buttons scaled to 12px.
- **Enhanced Tables & Inline Code**: Upgraded table cells and inline code to responsive `text-xs sm:text-sm` for effortless scanning of dense tabular data.

#### 2. CJK Line-Height Optimization & Systematic Micro-Text Elevation
- **Breathing Room for CJK Glyphs**: Tuned `2xs` (11px) and `xs` (12px) line heights to 15px and 17px, preventing descender clipping and stroke collision for complex Chinese and Japanese characters.
- **Micro-Text Elevation to 12px/14px**: Upgraded chat message action bars, usage analytics, model rankings, cost trends, conversation histories, memory consolidation diffs, and media cards from 11px micro-text to legible 12px/14px.
- **Mobile Touch Interaction Enhancements**: Increased default opacity for metadata and action triggers on touchscreens to prevent washed-out text without hover capabilities.

#### 3. Elimination of Invalid CSS Classes & Design Token Unification
- **Eradication of `text-3xs`**: Replaced all instances of undefined `text-3xs` with standard design tokens across language switchers, slash commands, and audio speed buttons.
- **Arbitrary Pixel Cleanup**: Normalized non-standard `text-[10px]` into system tokens.

#### 4. Zero-Redundancy Multi-Language (i18n) Cleanup
- **Pruned 83 Unused i18n Keys**: Removed orphaned translation keys across all 4 locales (Simplified Chinese, Traditional Chinese, English, Japanese) using AST verification.
- **Backend Error Code Cleanup & Missing Key Wiring**: Pruned unreferenced `NO_LLM_CREDENTIALS` error code and properly wired missing login placeholder translations.

#### 5. Model Feature Guide Tags & Catalog Synchronization
- **Intuitive Guide Tags**: Integrated visual pricing tags and capability badges to facilitate seamless model selection.
- **Streamlined Catalog Fetching**: Optimized model synchronization flow, eliminating redundant local file fallbacks.

---

### v2.25.0 (2026-10-14)

This release introduces independent configuration for the **Memory Consolidation Model (Consolidation LLM)**, real-time stage progress animation during AI memory deduplication, zero-barrier default model scheduling with `openrouter/free`, and synchronized recommendation models.

#### 1. Independent Memory Consolidation Model Configuration
- **Consolidation LLM Configuration**: Dedicated selector under Memory Settings allowing administrators to configure custom models for memory timeline deduplication and conflict resolution.
- **Universal Model Picker**: Reuses the native `<ModelSelect>` component with full search, categorisation, and custom model ID inputs.

#### 2. Curated Recommendation Cards with One-Click Selection
- **Synchronized OpenRouter Catalog**: Curated 11 cutting-edge models from the latest catalog (e.g. `openrouter/free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `google/gemma-4-31b-it:free`, `deepseek/deepseek-v4.1-flash`, `anthropic/claude-sonnet-5.5`).
- **One-Click Quick Selection**: Card-style recommendations with detailed reasoning for memory summarization and click-to-select capability.

#### 3. Real-Time Stage State Machine for Memory Consolidation
- **Multi-Stage Visual Timeline**: 4-stage execution animation (Data Retrieval & Domain Clustering → Temporal Matrix Construction → Global LLM Reasoning & Denoising → Safety Threshold Validation & Diff Generation).
- **Elapsed Timer & Progress Bar**: Real-time second counter and stage-aligned progress indicator during analysis.

#### 4. Out-of-the-Box Zero-Barrier Default Model
- **`openrouter/free` as System Default**: Default language model and consolidation model set to OpenRouter's official aggregated free model router.
- **Legacy Compatibility & 404 Prevention**: Automatic endpoint alias normalization mapping retired model names to active catalog models with smooth database migration.

---

### v2.24.0 (2026-10-13)

This release is a major update that lands the **site-wide internationalization architecture**. A self-developed lightweight i18n framework gives full four-language coverage — Simplified Chinese / Traditional Chinese / English / Japanese — across the frontend UI, backend error responses, AI prompts and memory extraction. At the same time, the target language of smart translation is no longer hardcoded to Chinese and now follows the interface language.

#### 1. Four-Language i18n Framework (Zero Third-Party Dependencies)
- **Self-developed i18n, no URL prefix**: language preference is stored in `localStorage` and a same-named cookie; switching takes effect instantly without triggering a route change.
- **Full coverage of four layers**: frontend UI copy, backend HTTP error responses, the AI system prompt scaffold, and long-term memory extraction & retrieval triggers — all rendered per language.
- **Type-level key validation**: compile-time checked literal union keys for `t("...")`. Four dictionary tables are forced to align structurally.
- **Localized formatting**: dates, weekday names, numbers, currency, file sizes and relative times follow the interface language.

#### 2. Three Language-Switching Entry Points
- **Top bar on the login page**: signed-out users can change language before seeing any error messages.
- **Desktop top bar**: persistent entry adjacent to the theme switcher.
- **Preferences · Interface Appearance**: dedicated configuration row with dual-language labels.

#### 3. Smart Translation Target Language Follows UI Language
- **Local language decided by UI**: English UI translates to English, Japanese UI to Japanese, Traditional Chinese to Traditional Chinese.
- **Same-language degradation**: identical source-target pairs gracefully degrade to one-way "foreign language → local language" translation.

#### 4. Bilingual Strategy for AI Prompts
- **Scaffold follows the language**: persona, headings, time statements, search guidance, and formatting rules follow the selected language.
- **Guardrail preserved**: reasoning trap examples maintain the high-precision disambiguation anchors.
- **Two-sided language instructions**: opening and trailing prompts pin down output style and language recency.

#### 5. Backend Error Message Localization
- **Error code + parameterized copy**: exceptions specify codes while localized copy is resolved dynamically in `core/messages.py`.
- **Standard `Accept-Language` header**: seamlessly integrates with reverse proxies, CDNs, and custom API consumers.

#### 6. Multi-File Selection & Payload Budget Alignment
- **Fixed multi-file selection**: multi-file selection across documents and photos now processes every item reliably.
- **Budget alignment**: 10 attachments, 20MB per file, 40MB aggregate limit aligned with the 56MB request body gate.

<details>
<summary><b>📜 Click to expand past release notes (v2.23.0 ~ v2.22.0)</b></summary>

<br />

#### v2.23.0 Release Notes
- **Chat Input State Memory & Smart Conversation Restore**: Creative states (smart translation, target languages) are remembered per conversation and restored seamlessly.
- **Production Build Rigor**: Strict index-access guards eliminating `noUncheckedIndexedAccess: true` hazards during Docker container builds.
- **Backend Model Catalog Refactor**: Decoupled catalog persistence helpers (`catalog.py`) from server lifespan startup tasks.
- **Sync Permission Convergence**: Live model synchronization endpoints restricted to administrators.

#### v2.22.0 Release Notes
- **Consolidated Creation Menu**: Smart translation, image generation, video generation, and audio transcription unified into the `+` menu.
- **Smart Translation & Grammar Breakdown**: Added Japanese furigana readings, deep verb inflection analysis, and transferable example sentences.
- **Single-Turn Translation Isolation**: Instant translation runs context-free with recommended fast model auto-switching.
- **Custom Global System Prompt**: Configurable base system prompt module under Settings.

</details>

---

## 🤝 Contributing

Contributions are always welcome!
1. Fork the repository and create your feature branch (`git checkout -b feature/cool-feature`).
2. Commit your clean code changes.
3. Open a Pull Request with details about your updates.

---

## 📄 License & Trademark

- **Code License**: Licensed under the [MIT License](LICENSE).
- **Brand & Mascot Notice**: The name "Apiapia", project logos, mascot artwork, and graphical assets in `icons/` and `frontend/public/` are protected brand assets not covered by the MIT license.

---

## ⚠️ Disclaimer

1. This project is intended for personal assistant workflows, research, and technical exchange.
2. Users must comply with third-party providers' Terms of Service (OpenAI, Anthropic, OpenRouter, Tavily, etc.) and applicable local laws.
3. The authors assume no liability for API charges, data loss, or consequences arising from the use of this software.