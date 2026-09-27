# Personal AI Assistant (私人 AI 助理)

基于 **Next.js + FastAPI + Mem0 OSS (2.2.1) + PostgreSQL (pgvector) + Docker Compose** 的私人 AI 助理系统。

---

## 🌟 核心理念与架构特点

1. **前后端分离与解耦**：
   - 前端采用 **Next.js (React 18 + TypeScript + Tailwind CSS)**，仅负责 UI、交互与流式 SSE 渲染。
   - 后端采用 **FastAPI (Python 3.12)**，统一负责 LLM 路由、长期记忆生命周期、会话数据库及敏感 API Key 加密。

2. **长期记忆与聊天记录严格分离**：
   - **聊天记录**：完整保存在 PostgreSQL `conversations` 与 `messages` 中，用于历史溯源与恢复上下文。
   - **长期记忆 (Mem0 OSS 2.2.1)**：独立存储在 **pgvector** 向量数据库中，跨会话自动召回用户的个人偏好、生活习惯与事实。
   - **ADD-only 特性适配**：适配 Mem0 OSS 2.2.1 特性，不假设自动覆盖旧事实，支持用户在 Web 页面直接查看、编辑与删除。

3. **模型解耦 (LLM Adapter)**：
   - 抽象 `LLMProvider` 统一接口，原生适配 **OpenAI、OpenRouter、Anthropic Claude、Google Gemini、本地 Ollama** 等。
   - 原生支持 **OpenRouter**：只需一个 OpenRouter Key，即可在前端一键切换 Claude 3.5 Sonnet、GPT-4o、DeepSeek V3、Llama 3.1 等海量大模型。
   - 更换模型不丢失长期记忆。

4. **强制安全与隐私准则**：
   - **强制身份隔离**：所有 API 中的 `user_id` 均从经过验证的 JWT 中获取，绝不信任前端传递的 `user_id`。
   - **不可信上下文防御**：召回的长期记忆在 Prompt 层面作为不可信背景资料包裹，防止 Prompt Injection 劫持系统指令。
   - **API Key 加密持久化**：用户配置的模型凭证在后端使用 Fernet 对称加密入库，前端永不返回明文。

---

## 🚀 架构设计

```text
                         Browser
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
  GPT   Claude  Ollama   pgvector    Chat Logs    Users
                            │
                            ▼
                     Long-term Memory
```

---

## 📦 快速部署与启动

项目已完全容器化，无需在本地搭建复杂的 Python/Node 环境，直接使用 Docker Compose 即可在服务器或个人机器上一键启动。

### 1. 配置环境变量

复制环境变量模版：

```bash
cp .env.example .env
```

根据你的实际情况在 `.env` 中填写 API Key 或配置项（也可以在启动后通过 Web 前端的设置页面进行配置）：

- `OPENAI_API_KEY`: OpenAI 密钥（若使用 Mem0 提取与默认模型）
- `SECRET_KEY`: JWT 签名密钥（生产环境请更换为复杂随机字符串）
- `API_KEY_ENCRYPTION_KEY`: 数据库 API Key 加密密钥

### 2. 一键启动 Docker 容器集群

```bash
docker compose up --build -d
```

Compose 将自动按序拉起三个服务：
- `postgres`: 带有 pgvector 扩展的 PostgreSQL 17 容器，配备持久化卷 `postgres_data`。
- `backend`: FastAPI 后端，自动完成 pgvector 扩展激活、数据表迁移与 Mem0 初始化。
- `frontend`: Next.js 独立运行容器，监听 `3000` 端口。

### 3. 访问应用

- **Web 界面**：`http://localhost:3000`
- **后端 API 文档 (Swagger)**：`http://localhost:8000/docs`
- **健康检查**：`http://localhost:8000/api/health`

---

## 📱 核心功能与页面路径

| 页面路由 | 功能说明 |
| :--- | :--- |
| `/login` | 现代化登录与注册，基于安全哈希与 JWT 令牌。 |
| `/chat` | 核心对话界面。左侧会话历史、中间 SSE 流式回答、右侧实时召回的长期记忆展示。 |
| `/memory` | 长期记忆专属管理。支持语义搜索、事实列表审查、手动修正编辑、单条删除与 **JSON 一键导出**。 |
| `/settings` | 全局偏好设置。自定义 System Prompt、回答温度、长期记忆总开关及多厂商 API Key 托管。 |

---

## 💾 数据持久化与备份

项目在 `docker-compose.yml` 中定义了两个具名数据卷：
- `postgres_data`: 存储 PostgreSQL 用户表、会话表、消息表以及 Mem0 pgvector 向量集合。
- `mem0_data`: 存储 Mem0 本地历史数据库。

数据备份示例命令：
```bash
docker exec -t personal_ai_postgres pg_dump -U postgres personal_ai > backup_$(date +%Y%m%d).sql
```
