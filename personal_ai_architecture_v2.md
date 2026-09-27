# 私人 AI 助理开发需求与技术架构

#
> **开发前的强制约束（重要）**
>
> 1. MVP 固定使用 **Python Mem0 OSS `mem0ai==2.2.1`**；不要因为“最新版”自动升级。若开发时要升级 Mem0，先阅读对应版本 migration notes，再修改本需求文档。当前 2.2.1 于 2026-09-25 发布。
> 2. MVP 使用 **Mem0 Python SDK（嵌入 FastAPI）**，不是额外部署 Mem0 Server。Memory Service 是本项目自己的适配层。
> 3. Mem0 的长期记忆写入与“应用自己的聊天数据库”完全分离。Mem0 必须显式配置使用 PostgreSQL + pgvector，不能依赖默认存储。
> 4. Mem0 OSS 当前新的记忆提取算法是 **ADD-only**：自动提取阶段不会像旧版本那样自动 UPDATE/DELETE 旧 Memory。人工编辑/删除仍然可以通过 Memory API 完成。因此业务代码**不能假设“新事实会自动覆盖旧事实”**。
> 5. 所有涉及 `user_id` 的查询必须从已认证的 session/JWT 中取得，**绝不能信任请求体、URL 或前端传来的 `user_id`**。
> 6. 注入 LLM 的 Memory 必须作为“参考资料/不可信数据”处理，不能把 Memory 中的文本当成系统指令执行。

# 1. 项目目标

开发一个可以长期使用的私人 AI 助理 Web 应用。

核心目标：

- 浏览器网页聊天
- 后端统一管理 LLM
- 支持 GPT、Claude、Gemini、Qwen、本地模型等不同模型
- 使用独立的长期记忆系统
- 长期记忆与具体 LLM 解耦
- 用户可以查看、编辑、删除长期记忆
- 完整聊天记录与长期 Memory 分开保存
- 数据尽量由用户自己控制
- 第一阶段以单用户/个人使用为主，但架构应方便以后扩展
- 使用 Docker，保证以后可以方便迁移到其他电脑或服务器

---

# 2. 总体架构

推荐架构：

```text
                         Browser
                            │
                            ▼
                   ┌─────────────────┐
                   │     Next.js     │
                   │ React + TS 前端 │
                   └────────┬────────┘
                            │ HTTP / SSE
                            ▼
                   ┌─────────────────┐
                   │     FastAPI     │
                   │   Python 后端   │
                   └────────┬────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
       LLM Layer         Mem0 Layer       PostgreSQL
          │                 │                 │
   ┌──────┼──────┐          │           ┌────┴─────┐
   ▼      ▼      ▼          ▼           ▼          ▼
  GPT   Claude  Qwen     pgvector    Chat Logs   Users
                              │
                              ▼
                       Long-term Memory
```

核心原则：

> 前端只负责 UI 和用户交互；后端负责所有 AI、Memory、数据库和 API Key 管理。

---

# 3. 技术选型

## 前端

- Next.js
- React
- TypeScript
- Tailwind CSS

## 后端

- Python 3.12
- FastAPI
- Pydantic
- SQLAlchemy

## AI Memory

- Mem0 Open Source（`mem0ai==2.2.1`，MVP 固定版本）

## 数据库

- PostgreSQL
- pgvector

## LLM

通过统一的 LLM Adapter 接入：

- OpenAI / GPT
- Anthropic / Claude
- Google Gemini
- Qwen
- DeepSeek
- Ollama 本地模型

不要在业务代码中把具体模型写死。

## 部署

- Docker
- Docker Compose

---

# 4. 为什么使用 Next.js + FastAPI

## Next.js

负责：

- 登录页面
- 聊天页面
- 会话列表
- 消息显示
- Markdown 渲染
- 设置页面
- Memory 管理页面
- 模型选择
- 流式回答显示

## FastAPI

负责：

- 用户认证
- Chat API
- LLM 调用
- Memory 检索
- Memory 写入
- Chat History
- 数据库操作
- 模型切换
- API Key 管理
- 文件/知识库等未来功能

前端不能直接调用 LLM API。

API Key 必须只存在后端。

---

# 5. Memory 的核心理念

不要把 Memory 理解成“保存所有聊天记录”。

应该分成：

```text
完整聊天记录
        +
长期 Memory
```

例如：

```text
PostgreSQL
│
├── conversations
│
├── messages
│
├── users
│
└── settings

Mem0
│
├── 用户事实
├── 用户偏好
├── 用户长期目标
├── 重要事件
└── 行为习惯
```

完整聊天记录用于：

- 查看历史聊天
- 搜索聊天
- 恢复上下文
- 数据导出

Mem0 长期 Memory 用于：

- 跨会话记忆
- 个性化回答
- 用户偏好
- 长期事实
- 重要事件
- 行为习惯

---

# 6. Memory 与模型解耦

必须保证：

```text
                 Long-term Memory
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
         GPT          Claude         Qwen
```

换模型不能导致 Memory 丢失。

例如：

```text
2026:
GPT → 使用 Memory

2027:
Claude → 使用同一套 Memory

2028:
本地 Qwen → 使用同一套 Memory
```

因此：

> Memory 属于应用/用户的数据层，而不是属于某个 LLM。

---

# 7. Mem0 的作用

Mem0 负责：

- 从对话中提取值得长期保存的信息
- 添加 Memory
- 搜索相关 Memory
- 更新 Memory
- 合并 Memory
- 去重
- 删除 Memory

典型流程：

```text
用户消息
   ↓
FastAPI
   ↓
搜索相关 Memory
   ↓
构造 Context
   ↓
调用 LLM
   ↓
返回回答
   ↓
判断本次对话是否产生新的长期信息
   ↓
Mem0 更新 Memory
```

---

# 8. Chat 请求流程

用户发送：

```text
“帮我推荐一台适合编程的轻薄笔记本。”
```

后端流程：

```text
1. 接收用户消息
2. 获取当前 conversation
3. 获取最近聊天上下文
4. 使用 Mem0 搜索相关长期记忆
5. 组合 System Prompt + Memory + Chat History + User Message
6. 调用当前选择的 LLM
7. 通过 SSE 流式返回回答
8. 保存完整消息到 PostgreSQL
9. 将本次对话交给 Mem0 做长期记忆提取（不要阻塞用户可见的首屏回复）
10. Mem0 根据当前版本的处理模式完成 Memory 写入；写入可能是异步的，因此要正确处理提交成功与最终处理完成两个状态
```

---

# 9. Memory Retrieval

例如数据库中已经存在：

```text
用户正在找二手 Windows 11 笔记本
用户需要 USB-C 充电
用户主要用于编程
用户会连接外接显示器
用户希望电脑比较轻
```

用户现在问：

```text
“我最近想换一台电脑。”
```

后端首先搜索：

```text
“电脑 / 笔记本 / 编程 / 轻薄”
```

得到相关 Memory，然后加入 Prompt：

```text
相关用户长期记忆：

- 用户正在找二手 Windows 11 笔记本
- 用户需要 USB-C 充电
- 用户主要用于编程
- 用户会连接外接显示器
- 用户希望电脑比较轻
```

再发送给 LLM。

---

# 10. Memory 页面

必须提供一个用户可以直接查看长期 Memory 的页面。

建议：

```text
┌──────────────────────────────────────────┐
│                 AI Memory                │
├──────────────────────────────────────────┤
│                                          │
│ 个人信息                                  │
│ ─────────────────────────────────────── │
│ 居住地：日本                              │
│ 语言：中文 / 日语学习中                   │
│                                          │
│ 兴趣                                      │
│ ─────────────────────────────────────── │
│ AI                                       │
│ 编程                                      │
│ 投资                                      │
│                                          │
│ 偏好                                      │
│ ─────────────────────────────────────── │
│ 喜欢直接回答                              │
│ 日语翻译附带发音                          │
│                                          │
│ 重要事件                                  │
│ ─────────────────────────────────────── │
│ ……                                       │
│                                          │
│       [编辑] [删除] [搜索]                │
└──────────────────────────────────────────┘
```

必须支持：

- 查看
- 搜索
- 编辑
- 删除
- 分类
- 按时间查看
- 导出

---

# 11. Memory 数据原则

必须尽可能保证：

## 可见

用户知道 AI 记住了什么。

## 可修改

用户可以纠正错误 Memory。

## 可删除

用户可以删除某一条 Memory。

## 可导出

未来可以把 Memory 导出成 JSON/JSONL 等格式。

## 可迁移

未来更换 Mem0 或其他 Memory Framework 时，数据不能被锁死。

---

# 12. Chat History 与 Memory 必须分离

例如：

```text
Chat History：

2026-09-27 10:00
用户：最近开始找笔记本。
AI：……

2026-09-27 10:05
用户：主要用于编程。
AI：……
```

Memory：

```text
用户正在寻找笔记本
用户主要使用电脑编程
```

不要让 Mem0 替代完整聊天数据库。

---

# 13. 数据库设计

初始数据库建议至少包含：

## users

```text
id
email / username
password_hash
created_at
updated_at
```

## conversations

```text
id
user_id
title
model
created_at
updated_at
```

## messages

```text
id
conversation_id
role
content
model
token_usage
created_at
```

role：

```text
system
user
assistant
tool
```

## user_settings

```text
id
user_id
default_model
system_prompt
temperature
memory_enabled
created_at
updated_at
```

## model_configs

```text
id
user_id
provider
model
api_key_encrypted
enabled
created_at
updated_at
```

不要明文保存 API Key。

---

# 14. Vector Database

第一阶段：

```text
PostgreSQL
    +
pgvector
```

不要一开始同时引入：

```text
PostgreSQL
Qdrant
Redis
MongoDB
```

除非以后确实需要。

这样可以降低：

- 部署复杂度
- 备份复杂度
- 数据迁移复杂度
- 开发复杂度

---

# 15. LLM Adapter

不要把 OpenAI 写死在 Chat Service 中。

建议：

```text
backend/app/services/llm/
│
├── base.py
├── openai.py
├── anthropic.py
├── gemini.py
├── ollama.py
└── factory.py
```

统一接口：

```python
class LLMProvider:
    async def chat(
        self,
        messages,
        model,
        stream=True
    ):
        ...
```

然后：

```text
LLM Factory
     │
     ├── OpenAI
     ├── Anthropic
     ├── Gemini
     ├── Qwen
     └── Ollama
```

业务代码只调用统一接口。

---

# 16. Memory Service

建议封装：

```text
backend/app/services/memory/
│
├── service.py
├── retrieval.py
├── extraction.py
└── models.py
```

统一接口：

```python
add_memory(...)
search_memory(...)
update_memory(...)
delete_memory(...)
list_memories(...)
```

不要让业务代码到处直接调用 Mem0。

这样以后从：

```text
Mem0
```

切换成：

```text
Graphiti
```

或者其他 Memory Framework 时，只需要修改 Memory Service。

---

# 17. API 设计

## Chat

```http
POST /api/chat
```

请求：

```json
{
  "conversation_id": "xxx",
  "message": "你好",
  "model": "gpt-5.x"
}
```

返回：

使用 SSE 流式返回。

---

## Conversation

```http
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/{id}
PATCH  /api/conversations/{id}
DELETE /api/conversations/{id}
```

---

## Messages

```http
GET /api/conversations/{id}/messages
```

---

## Memory

```http
GET    /api/memories
GET    /api/memories/{id}
POST   /api/memories
PATCH  /api/memories/{id}
DELETE /api/memories/{id}
```

搜索：

```http
GET /api/memories/search?q=...
```

---

## Models

```http
GET    /api/models
POST   /api/models
PATCH  /api/models/{id}
DELETE /api/models/{id}
```

---

# 18. 前端页面

第一版至少：

```text
/
├── /login
├── /chat
├── /chat/[conversationId]
├── /memory
└── /settings
```

## Chat 页面

用户身份由后端认证态确定，前端不得通过 query/body 指定任意 `user_id`。

布局：

```text
┌───────────┬─────────────────────────────┬──────────────┐
│           │                             │              │
│ 会话列表  │          Chat               │ Memory       │
│           │                             │              │
│ + 新聊天  │                             │              │
│           │                             │              │
│ Chat 1    │       AI回答                │ 相关记忆     │
│ Chat 2    │                             │              │
│ Chat 3    │                             │              │
│           │                             │              │
│           │  [输入框]       [发送]       │              │
└───────────┴─────────────────────────────┴──────────────┘
```

---

# 19. 第一版不要做的功能

第一阶段暂时不要加入：

- Graphiti
- Cognee
- 多 Agent
- MCP
- RAG
- 文件知识库
- 自动任务
- 语音
- 图片生成
- 插件系统
- 多用户复杂权限
- 企业级权限系统

先把：

```text
Chat
+
LLM
+
Chat History
+
Mem0
+
Memory UI
```

做稳定。

---

# 20. Docker Compose

最终目标：

```text
docker-compose.yml

services:

  frontend:
    Next.js

  backend:
    FastAPI
    Mem0

  postgres:
    pgvector/pgvector:pg17

  # Mem0 的内部历史（如果该版本启用 SQLite history）
  # 必须使用持久化 volume，不能因 backend 容器重建而丢失。
```

目标：

```bash
docker compose up
```

即可启动整个项目。

**持久化要求：** PostgreSQL 必须使用 named volume；如果 Mem0 Python SDK 使用本地 SQLite history，也必须给其数据库路径绑定 named volume。容器重建不能导致 Memory 审计历史意外丢失。

---

# 21. 环境变量

使用：

```text
.env
```

例如：

```env
DATABASE_URL=postgresql://...

OPENAI_API_KEY=...

ANTHROPIC_API_KEY=...

GEMINI_API_KEY=...

MEM0_LLM_PROVIDER=openai

DEFAULT_MODEL=...

SECRET_KEY=...
API_KEY_ENCRYPTION_KEY=...
MEM0_VERSION=2.2.1
```

`.env`：

- 不提交 Git
- 不暴露到前端
- 不进入 Docker image
- 不放进客户端 JavaScript

提供：

```text
.env.example
```

给开发环境参考。

---

# 22. 安全要求

必须：

- API Key 只存后端
- 密码使用安全哈希
- 所有需要用户数据隔离的 API，都必须从已认证身份中得到 user_id；禁止信任客户端传入的 user_id
- 用户不能访问其他用户的数据
- SQL 使用 ORM/参数化查询
- 防止 XSS
- 防止 CSRF（如使用 Cookie Session）
- Memory / 历史消息 / 工具输出进入 Prompt 时，必须明确作为“不可信上下文”，不能自动变成系统指令
- 限制请求频率
- 日志不要打印 API Key
- 日志不要默认打印完整私人聊天内容
- API Key 数据库中加密保存
- Docker 网络合理隔离

---

# 23. 数据隐私

核心原则：

> 用户的聊天记录和长期 Memory 是用户自己的数据。

系统应该支持：

```text
查看
↓
修改
↓
删除
↓
导出
```

并且不要让 LLM Provider 自动成为永久数据存储。

LLM 只负责：

```text
理解
推理
生成
```

长期数据由：

```text
PostgreSQL
Mem0
```

控制。

---

# 24. 未来扩展：Graph Memory

第一阶段不加入。

以后如果发现 Memory 越来越复杂，可以加入：

```text
Mem0
+
Graphiti
```

Mem0：

```text
用户偏好
用户事实
用户长期目标
```

注意：当前 OSS 的 ADD-only 提取意味着“新事实覆盖旧事实”不是默认保证。时间敏感的事实需要应用层额外处理；不要把 Mem0 本身描述成完整的时间状态数据库。

Graphiti：

```text
人物
事件
关系
时间
状态变化
```

最终：

```text
                 Personal AI
                      │
          ┌───────────┴───────────┐
          │                       │
         Mem0                  Graphiti
          │                       │
     “用户是谁”             “发生过什么”
          │                       │
          └───────────┬───────────┘
                      │
                     LLM
```

但不要在第一版就加入。

---

# 25. 第一阶段 MVP

目标：

> 打开网页 → 输入问题 → LLM 回复 → 保存聊天 → Mem0 自动提取 Memory → 下次聊天可以调用 Memory。

完整流程：

```text
Browser
   ↓
Next.js
   ↓
POST /api/chat
   ↓
FastAPI
   ↓
PostgreSQL
   ↓
Mem0 Search
   ↓
构造 Prompt
   ↓
LLM
   ↓
SSE Streaming
   ↓
Browser
   ↓
保存 Chat History
   ↓
Mem0 Add/Update
```

---

# 26. MVP 验收标准

必须实现：

### Chat

- [ ] 可以创建新聊天
- [ ] 可以发送消息
- [ ] 可以流式显示 AI 回复
- [ ] 可以保存消息
- [ ] 可以重新打开历史聊天

### Model

- [ ] 至少接入一个 LLM
- [ ] LLM API Key 只存在后端
- [ ] 代码使用统一 LLM Adapter
- [ ] 后续可以增加其他模型

### Memory

- [ ] Mem0 正常工作
- [ ] 明确固定 Mem0 版本，并使用显式 pgvector 配置
- [ ] 可以自动提取/保存长期 Memory
- [ ] 可以搜索 Memory
- [ ] 聊天时自动检索 Memory
- [ ] Memory 作为不可信参考上下文注入 Prompt
- [ ] 对冲突/变化事实不假设 Mem0 自动覆盖旧值
- [ ] Memory 可以查看
- [ ] Memory 可以编辑
- [ ] Memory 可以删除

### Database

- [ ] PostgreSQL 正常运行
- [ ] pgvector 正常运行
- [ ] Chat History 持久化
- [ ] Memory 持久化
- [ ] 可以备份数据库

### Deployment

- [ ] Docker Compose 一键启动
- [ ] `.env` 配置
- [ ] `.env.example`
- [ ] README
- [ ] 数据持久化 Volume

---

# 27. 开发顺序

严格按照以下顺序开发。

## Phase 1

创建项目：

```text
frontend/
backend/
docker-compose.yml
```

---

## Phase 2

完成：

```text
Next.js
+
FastAPI
```

实现：

```text
GET /
GET /api/health
```

---

## Phase 3

接入 PostgreSQL。

实现：

```text
users
conversations
messages
settings
```

---

## Phase 4

接入一个 LLM。

优先先完成：

```text
OpenAI
```

实现：

```text
POST /api/chat
```

并支持 SSE。

---

## Phase 5

接入 Mem0。

实现：

```text
memory.add()
memory.search()
```

---

## Phase 6

实现完整 Memory Pipeline：

```text
User Message
 ↓
Memory Retrieval
 ↓
Prompt
 ↓
LLM
 ↓
Answer
 ↓
Memory Update
```

---

## Phase 7

开发 Memory UI：

```text
/memory
```

支持：

```text
List
Search
Edit
Delete
```

---

## Phase 8

增加模型切换。

例如：

```text
GPT
Claude
Gemini
Ollama
```

---

## Phase 9

完善 Docker：

```text
frontend
backend
postgres
```

---

# 28. 最终目标架构

最终项目应该能够达到：

```text
                         ┌───────────────┐
                         │    Browser    │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │    Next.js    │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │    FastAPI    │
                         └───────┬───────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
          LLM Adapter        Memory Service      Database
              │                  │                  │
       ┌──────┼───────┐          ▼                  │
       │      │       │         Mem0                │
       ▼      ▼       ▼          │                  │
      GPT   Claude   Qwen        ▼                  │
                              pgvector              │
                                 │                  │
                                 └────────┬─────────┘
                                          ▼
                                     PostgreSQL
```

核心原则：

1. **前后端分离**
2. **LLM 与 Memory 解耦**
3. **Chat History 与 Memory 分离**
4. **Memory 与具体数据库实现解耦**
5. **LLM 使用 Adapter，避免模型锁定**
6. **Memory 使用 Service，避免 Mem0 锁定**
7. **用户能够查看、修改、删除自己的 Memory**
8. **所有重要数据可以导出**
9. **API Key 只存在后端**
10. **第一版保持简单，后续再加入 Graphiti、RAG、MCP 等能力**

---

# 29. 给 AI 开发助手的直接任务

请按照以下目标开始开发：

> 创建一个个人私人 AI Web 应用。
>
> 技术栈：
>
> - Frontend：Next.js + TypeScript + Tailwind CSS
> - Backend：Python + FastAPI
> - Database：PostgreSQL + pgvector
> - Memory：Mem0 Open Source
> - Deployment：Docker Compose
>
> 第一阶段不要加入 Graphiti、Cognee、RAG、MCP、多 Agent 等复杂功能。
>
> 先完成一个可以实际运行的 MVP：
>
> 1. 用户打开网页
> 2. 创建聊天
> 3. 输入消息
> 4. FastAPI 接收消息
> 5. FastAPI 从 Mem0 搜索相关长期记忆
> 6. FastAPI 将 Memory + 最近聊天 + 当前问题发送给 LLM
> 7. LLM 通过 SSE 流式返回
> 8. 保存完整聊天记录到 PostgreSQL
> 9. 将对话交给 Mem0 提取/更新长期 Memory
> 10. 用户可以进入 Memory 页面查看、编辑、删除 Memory
>
> LLM 不要写死在业务代码中，创建统一 LLM Adapter。
>
> Memory 不要直接散落在业务代码中，创建 Memory Service。
>
> API Key 只能保存在后端。
>
> 使用 Docker Compose 管理 frontend、backend、postgres。
>
> 每完成一个阶段，都确保项目可以运行，不要一次生成一个无法调试的大型项目。
>
> 优先保证架构清晰、代码可维护、数据可迁移。

---

# 30. 后续可以增加的功能

完成 MVP 后，再逐步增加：

```text
Phase 2
├── 多模型
├── 本地 Ollama
├── 文件上传
└── Chat Search

Phase 3
├── RAG
├── 文档 Memory
├── 图片理解
└── Web Search

Phase 4
├── Graphiti
├── 时间 Memory
├── Relationship Memory
└── Entity Memory

Phase 5
├── MCP
├── Tools
├── Agent
├── 自动任务
└── Personal Automation
```

最终目标不是做一个简单 ChatGPT Clone，而是：

> **建立一个与具体 LLM 无关、由用户自己控制长期数据的 Personal AI System。**
