<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md"><b>简体中文</b></a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a>
</p>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="icons/apiapia-logo.svg">
    <source media="(prefers-color-scheme: light)" srcset="icons/apiapia-logo.svg">
    <img src="icons/apiapia-logo.svg" alt="Apiapia AI Logo" width="620">
  </picture>
</p>

<p align="center">
  <strong>一只有长期记忆的智能猫咪助理 · Personal AI Assistant with Long-Term Memory</strong>
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

## 🐱 关于 Apiapia（品牌故事与设计灵感）

> “她有一双清澈如绿宝石般的眼睛，安静地趴在键盘旁陪伴着日夜；而现在，她化身为你数字世界里永不忘事的智慧助理。”

<p align="center">
  <img src="icons/apiapia-real.jpg" alt="真实猫咪 Apiapia" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-app-icon.jpg" alt="Apiapia App 图标" width="220" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
  <img src="icons/apiapia-avatar-circle.png" alt="Apiapia 品牌头像" width="220" style="border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.12); margin: 0 10px;" />
</p>

<p align="center">
  <em>图左：原型小猫真实生活照 · 图中：iOS 原生质感 Web App 图标 · 图右：站内品牌圆形头像</em>
</p>

**Apiapia** 的原型是一只真实存在、有着可爱虎斑花纹与碧绿双眸的家养猫咪。在日常生活中，猫咪用敏锐的直觉和长久的陪伴给予家人温暖与安心；在 **Apiapia 助理系统** 中，这份陪伴被赋予了前沿 AI 的长期记忆与逻辑推理能力：

- **永不遗忘的温度**：不同于常规大模型每次开启新对话就“失忆”的局限，Apiapia 借助自主向量记忆引擎（Mem0 OSS + pgvector），将你的工作偏好、生活习惯与事实碎片默默珍藏。
- **越聊越懂你**：跨设备、跨时间段自动召回关联事实，无需反复自报家门，交流如同与相识已久的老友交谈般默契顺畅。
- **全端优雅呈现**：精心手绘猫咪品牌标识，针对移动端与桌面端进行全套视觉适配，兼具科技质感与亲和力。

---

## ✨ 核心特性

- 🧠 **长期记忆系统（Mem0 OSS 2.2.1 + pgvector）**：全自动提取并召回事实记忆，具备倒序精准时间戳、语义检索、行内编辑与一键 JSON 导出功能。
- 🌐 **全模型智能全自动联网检索（Web Search）**：自主研判时效性需求，支持 Tavily AI 原生检索与 DuckDuckGo 零配置免 Key 降级，提供多词并发与行内来源实时引用。
- 🤖 **多厂商大模型无缝路由**：统一适配 OpenAI、Anthropic Claude（支持 Extended Thinking）、Google Gemini、OpenRouter、本地 Ollama，统一切换且不丢记忆。
- 🎙️ **全栈语音与智能翻译教学**：基于 OpenRouter 提供麦克风 Whisper 实时转写（STT）与多音色朗读（TTS）；支持带日语振假名注音和动词变形拆解的智能互译。
- 🌍 **零第三方依赖的四语国际化 (i18n)**：全自研轻量框架，前端 UI、后端错误、AI 提示词骨架、记忆抽取四层同源适配简体中文 / 繁體中文 / English / 日本語。
- 📱 **原生级 iOS PWA 与全端响应式**：支持 Safari 一键「添加到主屏幕」全屏沉浸运行，内置全套 Retina/Maskable 图标体系与移动端 5 大独立页签。
- 🔒 **企业级安全与隐私隔离**：服务端强校验 JWT `user_id`，Fernet 对称加密托管 API Key，记忆与外链上下文采用 `<untrusted_document>` 防提示词注入。

---

## 🚀 快速开始与一键部署

项目已实现全面容器化。使用 Docker Compose 即可在云服务器或本地机器上一键启动：

### 1. 配置环境变量

从模版复制环境变量文件：

```bash
cp .env.example .env
```

打开 `.env` 文件，**唯一必填项为 `POSTGRES_PASSWORD`**（设置你的数据库密码），其余选项保持默认即可正常启动：

```env
POSTGRES_PASSWORD=your_secure_password_here
# 可选：填入你的 OpenRouter 或 OpenAI 密钥以开启全部功能
OPENROUTER_API_KEY=
TAVILY_API_KEY=
```

### 2. 一键启动 Docker 集群

```bash
# 本地开发：会自动加载 docker-compose.override.yml（热重载 + 独立开发数据卷）
docker compose up --build -d

# 正式部署：显式指定文件，不加载任何开发覆盖
docker compose -f docker-compose.yml up --build -d
```

Compose 将按序拉起并协同三个服务：
- `postgres`: 带有 pgvector 扩展的 PostgreSQL 17 容器。
- `backend`: FastAPI 后端服务（自动完成数据表结构同步与 Mem0 初始化）。
- `frontend`: Next.js 独立运行容器（等待后端健康检查通过后监听 `3000` 端口）。

> **部署注意**：只要不显式指定 `-f`，Compose 就会自动读取同目录下的 `docker-compose.override.yml`（本地开发层）。
> 正式部署请务必使用 `-f docker-compose.yml`，否则会意外带上开发用的热重载配置和独立的数据卷。

### 3. 访问应用

- **Web 界面**：`http://localhost:3000`
- **后端 API 文档 (Swagger)**：`http://localhost:8000/docs`
- **健康检查接口**：`http://localhost:8000/api/health`

---

## 🛠️ 本地开发指南

如果您希望在本地进行二次开发或调试代码：

### 本地与正式环境的隔离

仓库根目录下的 `docker-compose.override.yml` 是**本地开发层**，机制只有一条：只要不显式指定 `-f`，Compose 就会自动加载它。

| | 本地开发 | 正式部署 |
|---|---|---|
| 启动命令 | `docker compose up` | `docker compose -f docker-compose.yml up -d` |
| 加载 override | 是 | 否 |
| 后端热重载 | 是（`--reload --reload-dir=/app/app`） | 否 |
| 数据库卷 | `apiapia_postgres_dev_data` | `apiapia_postgres_data` |
| 记忆/媒体卷 | `*_dev_data` | `apiapia_mem0_data` / `apiapia_media` |
| `SECRET_KEY` | 覆盖为一次性开发密钥 | 取自 `.env` |
| `API_KEY_ENCRYPTION_KEY` | 覆盖为一次性开发密钥 | 取自 `.env` |
| `POSTGRES_PASSWORD` | 覆盖为 `local-dev-password-not-a-secret` | 取自 `.env` |

几个要点：

- **密钥隔离**：override 通过 `environment` 覆盖 `.env`，所以即使把正式服的 `.env` 拷到本地机器，正式服的签名密钥、加密密钥和数据库密码也不会被本地环境真正使用。
- **数据隔离**：本地使用独立命名的卷，本地清库或做实验不会碰到部署环境的数据。
- **热重载不会误触发**：uvicorn 默认监听工作目录 `/app`，而该目录同时挂载了 `/app/data/mem0` 和 `/app/data/media`。Mem0 写快照、生成图片时都会触发文件变化，因此 override 显式指定 `--reload-dir=/app/app` 收窄监听范围。
- **Windows 上的热重载限制**：`--reload` 依赖 `watchfiles` 监听内核文件系统事件，而 Docker Desktop 的 bind mount 不会可靠地把宿主机文件变更事件传进 Linux 容器。因此在 Windows 上编辑 `backend/app` 可能不会触发自动重载——这是 Docker Desktop 的限制，不是配置错误，Linux 主机上表现正常。Windows 上请用 `docker compose restart backend`，或按下方「后端开发」一节在本地 venv 里原生运行。
- **同一台机器同时跑两套**：override 不改动 `ports`，因为 `ports` 在 override 中的合并语义（追加还是替换）随 Compose 版本而异，容易变成同时监听两个端口。本地与正式服是不同机器时本无冲突；若确需同机并行，请改用 `.env` 中既有的 `POSTGRES_HOST_PORT` / `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` 三个变量。

### 前端开发 (Next.js)

```bash
cd frontend
npm install # 或 pnpm install
npm run dev
```
前端开发服务器将启动在 `http://localhost:3000`。

### 后端开发 (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
> **提示**：本地单独运行后端需确保已启动带 pgvector 的 PostgreSQL 实例（可通过单独运行 `docker compose up postgres -d` 提供）。

---

## 🏗️ 架构设计

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
                            │   Python 后端   │
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

## 📱 核心功能与页面路径

| 页面路由 | 功能说明 |
| :--- | :--- |
| `/login` | 现代化登录与注册，基于安全哈希与 JWT 令牌认证，顶栏支持未登录状态语言切换。 |
| `/chat` | 核心对话界面。置顶排序、全网实时检索、多模态附件上传、SSE 流式打字机渲染及关联记忆面板。 |
| `/memory` | **记忆库管理**。单列自适应列表展示、时间精确到秒、语义向量搜索、行内编辑与 **JSON 一键导出**。 |
| `/settings` | 偏好设置。四语切换、人设风格、连续创意度滑块、外观主题切换及多厂商 API Key 安全托管。 |
| `/usage` | **用量与成本审计看板**。统计多模型调用明细、Token 消耗分布，管理员支持多用户会话审计。 |

---

## 💾 数据持久化与备份

项目在 `docker-compose.yml` 中定义了两个持久化数据卷：
- `postgres_data`: 存储 PostgreSQL 核心数据表与 Mem0 pgvector 向量库。
- `mem0_data`: 存储 Mem0 本地历史索引。

本地开发（`docker compose up`，会加载 override）使用另一组独立的数据卷：`apiapia_postgres_dev_data`、`apiapia_mem0_dev_data`、`apiapia_media_dev_data`。备份请针对上面 `docker-compose.yml` 中定义的数据卷，`_dev_data` 里只是一次性的本地数据。

数据备份示例命令：
```bash
docker exec -t apiapia_postgres pg_dump -U postgres apiapia > backup_$(date +%Y%m%d).sql
```

数据还原示例命令：
```bash
cat backup_xxx.sql | docker exec -i apiapia_postgres psql -U postgres -d apiapia
```

---

## 📜 版本发布与更新说明 (Release Notes)

### 🚀 v2.41.0 (2026-10-25)

**模型目录刷新 · 记忆整理迁移 · 四语同步**

- **模型**：免费多模态旗舰由 Gemma 4 31B 切换为 NVIDIA Nemotron 3.5 Super VL；正常档新增 GPT-6 Luna；聪明档新增 Claude Fable 5.1；DeepSeek 更新为 `deepseek-v4.1-flash-1017`；GPT-6 Astra 更新为 `gpt-6-astra-pro`。
- **记忆**：`consolidation_model` 默认迁移至 Nemotron 3 Ultra 550B；兜底链路为 Nemotron 3 Ultra → Nemotron 3.5 Super VL → `openrouter/free`；移除 Gemma 4 相关重试与推荐入口。
- **国际化**：四语字典清除 Gemma 4 残留键，并为三款新模型补齐本地化选型理由。

---

### v2.40.0 (2026-10-24)

**前端视觉巡检 · Tailwind 加固 · 四语同步**

- **Tailwind**：补全扫描路径，新增 `text-3xs` 字阶，修复失效的模糊/阴影语法与滑块拖拽缩放。
- **对齐**：移除 KPI 卡片重复边框，统一聊天顶栏与记忆侧栏高度，修正记忆卡片间距与弹窗标题防撞。
- **清理与 i18n**：移除重复的侧栏/移动端保存按钮，简化行内编辑，清理死样式/无用导入，并将剩余硬编码文案全部纳入四语字典（`891` 键 × 4 语种）。

---

### v2.39.0 (2026-10-23)

**流式可靠性 · 即时停止生成 · 数据库保护**

- **停止生成**：中断信号从 Next.js 代理贯通到 FastAPI SSE，立即解除客户端读取阻塞并恢复输入状态。
- **回复完整性**：`done` 之后不再丢回复；流式中断时保留已生成内容；后台流计时器相互隔离。
- **推理与持久化**：`<thinking>` 解析限定在开头推理块；校验 `parent_message_id` 并截断超长字段。

---

### v2.38.0 (2026-10-22)

**ChatGPT 式分支 · 自定义指令 · 记忆徽章**

- **分支**：消息改为父子树结构；重新生成会创建带 `< 1 / 2 >` 翻页的替代分支，不再截断历史。
- **自定义指令**：支持「关于你」与「回复风格」，持久化到 PostgreSQL 并注入每次模型调用。
- **体验**：实时记忆徽章/Toast、16ms 打字机、长文本自动折叠为附件卡片。

---

### v2.37.0 (2026-10-22)

**后台流式韧性 · LaTeX 环境 · 容器构建**

- **多会话流式**：视图与流解耦，切换会话或新建对话时后台继续生成，并在完成后持久化。
- **LaTeX**：原生支持无围栏算法、导言区、定理/证明环境与 QED 符号；修复美元符号正则与 Windows 字体渲染。
- **稳定性**：加固 ReAct 管线与生产容器构建。

---

### v2.36.0 (2026-10-21)

**ChatGPT 级交互升级**

- **推理界面**：答案到达时推理块自动折叠；纯推理阶段隐藏光标；代码块在清洗时受到保护。
- **联网搜索**：来源卡片显示干净域名与高清 Favicon，并支持行内引用徽章。
- **对话流**：跨供应商 LaTeX 归一化、零废话系统提示、标题实时推送与 3 条追问建议。

---

## 🤝 参与贡献

欢迎提交 Issue 与 Pull Request！
1. Fork 本仓库并新建分支（例如：`feature/amazing-feature`）。
2. 提交您的修改并确保代码风格整洁。
3. 发起 Pull Request，详细描述修改的内容与验证结果。

---

## 📄 开源许可证与商标声明

- **代码开源协议**：本项目代码采用 [MIT License](LICENSE) 授权。
- **品牌与吉祥物版权声明**：「Apiapia」品牌名称、官方 Logo、小猫吉祥物形象及 `icons/` 与 `frontend/public/` 目录下的所有原创美术设计资产保留所有权利，不属于 MIT 授权范围。未经原作者事先书面同意，不得将上述素材直接用于商业品牌宣传或冒用官方名义。

---

## ⚠️ 免责声明

1. 本项目仅供学习研究、技术交流与个人日常助理使用。
2. 用户在配置并调用任何第三方模型服务（如 OpenAI、Anthropic、OpenRouter、Tavily 等）时，须自行确保遵守该服务商的使用条款（Terms of Service）与所在地相关法律法规。
3. 开发者不对因使用本系统产生的任何直接或间接法律责任、API 资费扣费或数据损失承担责任。
