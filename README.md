# Personal AI Assistant (私人 AI 助理)

基于 **Next.js + FastAPI + Mem0 OSS (2.2.1) + PostgreSQL (pgvector) + Docker Compose** 的全功能私人 AI 助理系统。当前系统版本：**v2.3.0**。

---

## 🌟 核心理念与架构特点

1. **前后端分离与解耦**：
   - 前端采用 **Next.js (React 18 + TypeScript + Tailwind CSS)**，负责 UI、交互、流式 SSE 渲染、移动端 Web App 适配及版本自动更新检测。
   - 后端采用 **FastAPI (Python 3.12)**，统一负责 LLM 路由调度、长期记忆提取生命周期、全网实时检索、文档解析、会话数据库及敏感 API Key 加密。

2. **全模型通用智能全自动联网检索 (Web Search Engine, v2.3.0)**：
   - **全模型普惠**：不依赖特定模型厂商的联网功能，无论是 Claude、GPT、Gemini、DeepSeek，还是本地 Ollama 部署的模型，全部自动具备联网搜索能力。
   - **智能自动判定 (Auto-Decision)**：系统自主识别时效性新闻、天气、汇率、股票行情、外部事实、最新技术资讯等需求，按需自动搜索；日常闲聊、纯代码或逻辑运算保持零延迟免搜。
   - **三档模式随心控**：输入框支持「自动判定 (默认) / 强制开启 / 关闭」一键循环切换，并自动持久化用户偏好。
   - **多级免 Key 高可用**：内置 DuckDuckGo 多级异步搜索引擎与解析器，100% 免费、免配置任何第三方付费搜索 Key，开箱即用。
   - **实时检索与网页溯源**：流式生成过程中动态呈现检索中动效及检索词；回答下方持久化提供「🌐 参考了 X 个网页来源」交互式可折叠卡片，展示网页标题、摘要与一键直达外链。

3. **长期记忆与聊天记录严格分离**：
   - **聊天记录**：完整保存在 PostgreSQL `conversations` 与 `messages` 中，用于历史溯源与恢复上下文。
   - **长期记忆 (Mem0 OSS 2.2.1)**：独立存储在 **pgvector** 向量数据库中，跨会话自动召回用户的个人偏好、生活习惯与事实。
   - **创建时间与倒序展示 (v2.2.0)**：每条长期记忆均自动记录精准到年月日时分秒（`YYYY-MM-DD HH:mm:ss`）的时间戳，默认按最新优先（倒序）排列。
   - **单列完整列表视图 (v2.2.0)**：专为大容量事实设计的单列自适应宽屏列表，展示最丰富的内容细节，支持行内快速编辑与单条精准删除。
   - **ADD-only 特性适配**：适配 Mem0 OSS 2.2.1 特性，不假设自动覆盖旧事实，支持用户在 Web 页面直接查看、编辑与删除，并支持 **一键导出 JSON** 实现个人数据完全自主。

4. **模型解耦 (LLM Adapter) 与多模态能力**：
   - 抽象 `LLMProvider` 统一接口，原生适配 **OpenAI、OpenRouter、Anthropic Claude、Google Gemini、本地 Ollama** 等。
   - 原生支持 **OpenRouter**：只需一个 OpenRouter Key，即可在前端一键切换 Claude 3.7 / 3.5 Sonnet、GPT-4o、DeepSeek V3 / R1、Llama 3.3、Gemini 2.5 等海量大模型。
   - **多模态与文件解析**：原生支持上传图片、PDF、Word、TXT、Markdown 等文档，自动完成文字提取并注入对话上下文，图片支持全屏灯箱放大与原图下载。
   - 更换模型不丢失长期记忆。

5. **强制安全与隐私准则**：
   - **强制身份隔离**：所有 API 中的 `user_id` 均从经过验证的 JWT 中获取，绝不信任前端传递的 `user_id`。
   - **不可信上下文防御**：召回的长期记忆在 Prompt 层面作为不可信背景资料包裹，防止 Prompt Injection 劫持系统指令。
   - **API Key 加密持久化**：用户配置的模型凭证在后端使用 Fernet 对称加密入库，前端永不返回明文。

---

## 🚀 架构设计

```text
                         Browser / Mobile Web App
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

## 📦 快速部署与启动

项目已完全容器化，直接使用 Docker Compose 即可在服务器或个人机器上一键启动。编排中已集成标准健康检查探针，保证服务平滑启动。

### 1. 配置环境变量

复制环境变量模版：

```bash
cp .env.example .env
```

根据你的实际情况在 `.env` 中填写配置项（也可以在启动后通过 Web 前端的设置页面进行配置）：

- `POSTGRES_USER`: PostgreSQL 用户名（默认 `postgres`）
- `POSTGRES_PASSWORD`: PostgreSQL 密码（请确保 `DATABASE_URL` 与 `MEM0_DATABASE_URL` 里的密码与之保持一致）
- `POSTGRES_DB`: 数据库名称（默认 `personal_ai`）
- `SECRET_KEY`: JWT 签名密钥（生产环境请更换为复杂随机字符串）
- `API_KEY_ENCRYPTION_KEY`: 数据库 API Key 对称加密密钥
- `OPENROUTER_API_KEY`: OpenRouter 统一大模型 API 密钥

### 2. 一键启动 Docker 容器集群

```bash
docker compose up --build -d
```

Compose 将按序拉起并协同三个服务：
- `postgres`: 带有 pgvector 扩展的 PostgreSQL 17 容器，配备持久化卷 `postgres_data`。
- `backend`: FastAPI 后端，具备健康检查机制，自动完成扩展激活、数据表结构同步与 Mem0 初始化。
- `frontend`: Next.js 独立运行容器，自动等待后端服务 Healthy 后启动，监听 `3000` 端口。

### 3. 访问应用

- **Web 界面**：`http://localhost:3000`
- **后端 API 文档 (Swagger)**：`http://localhost:8000/docs`
- **健康检查接口**：`http://localhost:8000/api/health`

---

## 📱 核心功能与页面路径

| 页面路由 | 功能说明 |
| :--- | :--- |
| `/login` | 现代化登录与注册，基于安全哈希与 JWT 令牌。 |
| `/chat` | 核心对话界面。左侧会话历史、模型即时切换与持久化记忆、**智能全自动全网检索 (v2.3.0)**、多模态附件上传、SSE 流式回答及右侧实时召回的长期记忆抽屉。 |
| `/memory` | **长期记忆专属管理 (v2.2.0)**。全新单列列表展示、创建时间（精确到秒）展示、倒序排序、语义向量搜索、行内修正编辑、单条删除与 **JSON 一键导出**。 |
| `/settings` | 全局偏好设置。自定义 System Prompt、回答温度、长期记忆总开关、记忆提取模型指定及多厂商 API Key 托管。 |
| `/usage` | Token 消耗与成本用量看板。统计不同模型、不同时间段的调用次数与花费明细。 |

---

## 💾 数据持久化与备份

项目在 `docker-compose.yml` 中定义了两个具名数据卷：
- `postgres_data`: 存储 PostgreSQL 用户表、会话表、消息表以及 Mem0 pgvector 向量集合。
- `mem0_data`: 存储 Mem0 本地历史数据库。

数据备份示例命令：
```bash
docker exec -t personal_ai_postgres pg_dump -U postgres personal_ai > backup_$(date +%Y%m%d).sql
```

数据还原示例命令：
```bash
cat backup_xxx.sql | docker exec -i personal_ai_postgres psql -U postgres -d personal_ai
```
