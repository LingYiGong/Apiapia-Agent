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

### 🚀 v2.41.0 (2026-10-25)

**Model catalog refresh · memory consolidation migration · four-language sync**

- **Models**: Free multimodal flagship moves from Gemma 4 31B to NVIDIA Nemotron 3.5 Super VL; Normal tier adds GPT-6 Luna; Smart tier adds Claude Fable 5.1; DeepSeek updates to `deepseek-v4.1-flash-1017`; GPT-6 Astra moves to `gpt-6-astra-pro`.
- **Memory**: `consolidation_model` defaults to Nemotron 3 Ultra 550B; fallback chain becomes Nemotron 3 Ultra → Nemotron 3.5 Super VL → `openrouter/free`; obsolete Gemma 4 retry/recommended UI is removed.
- **i18n**: Retired Gemma 4 keys are removed from all four locales; native rationales are added for the three new models.

---

### v2.40.0 (2026-10-24)

**Frontend visual audit · Tailwind hardening · four-language sync**

- **Tailwind**: Restored missing content scan paths, added the `text-3xs` token, and fixed invalid blur/shadow syntax and slider drag scaling.
- **Alignment**: Removed duplicate KPI card borders, matched chat toolbar/memory sidebar header height, and fixed memory card spacing and dialog header overlap.
- **Cleanup & i18n**: Removed duplicate sidebar/mobile save buttons, simplified inline editing, pruned dead styles/imports, and localized all remaining hardcoded strings (`891` keys × 4 locales).

---

### v2.39.0 (2026-10-23)

**Streaming reliability · instant Stop Generating · database safeguards**

- **Stop Generating**: Abort signals propagate from the Next.js proxy to the FastAPI SSE stream and unblock the client immediately; UI state always unlocks.
- **Reply integrity**: Completed replies no longer disappear after `done`; partial content is preserved on mid-stream errors; background timers stay isolated.
- **Reasoning & persistence**: `<thinking>` parsing is scoped to the leading block; `parent_message_id` is validated and long columns are truncated.

---

### v2.38.0 (2026-10-22)

**ChatGPT-style branching · Custom Instructions · memory badges**

- **Branching**: Messages form a parent-child tree; Regenerate creates an alternative branch with `< 1 / 2 >` pagination instead of truncating history.
- **Custom Instructions**: "About You" and "Response Style" are persisted in PostgreSQL and injected into every model call.
- **Experience**: Real-time memory badges/toasts, a 16ms typewriter, and automatic folding of long pastes into attachments.

---

### v2.37.0 (2026-10-22)

**Background streaming resilience · LaTeX environments · container builds**

- **Multi-session streaming**: The view is decoupled from the stream; switching chats or starting a new one leaves generation running and persists the final reply.
- **LaTeX**: Native support for unfenced algorithms, preambles, theorem/proof environments and QED symbols; fixed dollar-sign regex and Windows font rendering.
- **Stability**: Hardened the ReAct pipeline and production container builds.

---

### v2.36.0 (2026-10-21)

**ChatGPT-grade interaction upgrade**

- **Reasoning UI**: Reasoning blocks auto-fold when answer tokens arrive; the caret stays hidden during pure reasoning; fenced code is protected during sanitization.
- **Web search**: Rich source cards with clean domains and high-res favicons, plus inline citation pills.
- **Chat flow**: LaTeX normalization across providers, zero-fluff system prompt, real-time title push, and 3 follow-up suggestion chips.

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