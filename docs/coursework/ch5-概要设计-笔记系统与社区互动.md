# 五、系统概要设计（增量模块：笔记系统与社区互动）

> 负责模块：笔记系统（写作 + 展示）+ 社区互动（评论、表态、收藏、举报、拉黑、等级）+ 笔记合集
> 撰写者：〔待填〕
> 本章为笔记系统与社区互动增量模块的概要设计，涵盖增量一（已交付）与增量二（本轮新增）全部功能的总体结构、功能—程序映射、数据库设计与接口概要。

## 1．引言

本章依据第 4 章需求分析中确立的 FR-01～FR-21 共 21 条功能需求、18 个用例与 10 个加工，对笔记系统与社区互动模块进行概要设计。设计遵循平台统一的"前后端分离、分层单体后端"架构，以 FastAPI 作为 API 服务、React 18 作为前端、SQLite 作为主库。

预期读者为项目团队成员、指导教师与课程评阅人；作为后续详细设计、编码与测试的共同基线。

## 2．总体设计

### 2.1 需求规定

本模块覆盖 21 条功能需求（详见表 4-1），按五个功能域组织：

| 功能域 | 核心功能 | 需求编号 |
|---|---|---|
| 写作域 | 草稿自动保存、AI 选段润色、AI 摘要流式生成、草稿发布 | FR-01～FR-04 |
| 浏览互动域 | 信息流浏览与检索、笔记详情、赞/踩、收藏、锚点评论、楼中楼回复（含图片）、评论赞/踩、评论删除 | FR-05～FR-14 |
| 合集域 | 创建与维护笔记合集、合集侧拉栏浏览 | FR-21 |
| 治理域 | 内容举报（8 类型）、AI 审查分类、管理员裁决、拉黑 | FR-15～FR-18 |
| 成长域 | 每日签到、经验与等级 | FR-19～FR-20 |

模块性能目标：信息流游标分页每页 6 条；AI 摘要 SSE 流式返回首字节尽快到达；AI 审查完全异步，发布响应 < 2s；签到/表态/举报以数据库约束保证幂等。

### 2.2 运行环境

- **服务器**：华为云 VPS 单机，nginx 反向代理 + systemd 托管后端进程（feiyue-backend.service）
- **后端**：Python 3.11 + FastAPI + SQLAlchemy 2.x（async）+ SQLite 主库（Alembic 管理迁移）
- **前端**：React 18 + TypeScript（strict）+ Vite 构建的 SPA，目标浏览器 Chrome/Edge/Firefox 近两年版本
- **AI 服务**：OpenAI 兼容协议接入；润色/摘要用 DeepSeek（deepseek-v4-flash）；审查分类先以 DeepSeek 提示词方案占位，规划切换至 Gemma4 12B 微调模型

### 2.3 基本设计概念和处理流程

本模块在平台总体架构中的位置如图 5-1 所示。总体架构遵循以下设计概念：

1. **前后端分离 + 分层单体后端**：React SPA 经 nginx 反向代理到达 FastAPI 单体，后端严格遵循 routes → services → db 的单向依赖分层；
2. **发布为唯一建笔记路径**：后端不存在独立的 `POST /notes` 创建接口，笔记仅能通过 `POST /notes/drafts/{id}/publish` 从草稿发布生成；
3. **AI 永不硬失败**：润色、摘要、审查一切 AI 依赖故障时降级而不阻断用户主流程；
4. **幂等设计**：点赞、点踩、收藏、签到、举报均以数据库复合主键或唯一约束保证幂等，允许客户端安全重试；
5. **合集单归属**：单篇笔记至多属于一个合集（collection_entries.note_id 唯一约束），仅合集创建者可维护合集内容。

〔此处插入图 5-1 —— 源文件 figures/ch5-fig1-module-structure.drawio，app.diagrams.net 编辑后导出插入〕

图 5-1 笔记系统与社区互动模块总体架构

### 2.4 软件结构设计

本模块涉及的后端路由模块及其职责分配如下：

| 路由模块 | 文件 | 职责 |
|---|---|---|
| notes | `backend/app/routes/notes.py` | 笔记列表（游标分页/分类/标签/搜索/排序）、笔记详情、笔记编辑与删除 |
| drafts | `backend/app/routes/drafts.py` | 草稿创建、更新、发布（唯一建笔记路径） |
| interactions | `backend/app/routes/interactions.py` | 笔记点赞/点踩、收藏、评论（含锚点/楼中楼/图片）、评论赞/踩、举报、拉黑 |
| ai | `backend/app/routes/ai.py` | AI 润色（一次性 + 流式）、AI 摘要生成、个性化欢迎语 |
| collections | `backend/app/routes/collections.py` | 合集 CRUD、合集内笔记管理、合集侧栏数据查询 |
| auth | `backend/app/routes/auth.py` | 登录/注册/个人信息、每日签到、经验流水查询、我的收藏列表 |

对应服务层模块：

| 服务模块 | 职责 |
|---|---|
| `services/notes.py` | 笔记列表查询、详情、编辑、删除；分类/标签/搜索/排序逻辑 |
| `services/comments.py` | 评论创建（含锚点/图片/楼中楼）、评论列表（两层树组装）、评论删除 |
| `services/ai_compose.py` | AI 润色、流式摘要生成（含降级兜底） |
| `services/interactions.py` | 点赞/点踩互斥、收藏幂等、举报创建、拉黑管理 |
| `services/collections.py` | 合集 CRUD、笔记加入/移出合集校验、合集侧栏数据组装 |
| `services/growth.py` | 签到幂等校验、经验加减与等级升级（对称扣回） |

前端对应 feature 模块结构：

| 前端页面/组件 | 路由 | 功能 |
|---|---|---|
| WritePage | `/write` | 草稿编辑与自动保存（Zustand + localStorage）、AI 润色触发与控制 |
| BrowsePage | `/browse` | 信息流浏览、分类/标签/搜索过滤、排序切换、游标分页 |
| NoteDetailPage | `/note/:id` | 笔记详情展示（Markdown 渲染）、赞/踩/收藏按钮组、锚点评论与楼中楼回复、合集侧拉栏 |
| ProfilePage | `/me` | 个人中心：已发布/草稿/收藏/合集 Tab、签到入口、经验等级展示、黑名单管理 |
| AdminPage | `/admin` | 管理后台：举报工单队列、AI 审查结论查看、人工裁决操作 |

### 2.5 功能需求与程序的关系

表 5-1 给出 21 条功能需求与后端路由模块的映射关系。

表 5-1 功能需求—程序映射

| 编号 | 功能需求 | 主要路由模块 | 主要服务模块 |
|---|---|---|---|
| FR-01 | 草稿创建与自动保存 | drafts | drafts |
| FR-02 | AI 选段润色 | ai | ai_compose |
| FR-03 | AI 摘要流式生成 | ai | ai_compose |
| FR-04 | 草稿发布 | drafts, ai | drafts, ai_compose |
| FR-05 | 笔记编辑与删除 | notes | notes |
| FR-06 | 信息流浏览与检索 | notes | notes |
| FR-07 | 笔记详情阅读 | notes | notes |
| FR-08 | 笔记表态（赞/踩） | interactions | interactions |
| FR-09 | 收藏笔记与我的收藏 | interactions, auth | interactions, growth |
| FR-10 | 锚点评论 | interactions | comments |
| FR-11 | 楼中楼回复 | interactions | comments |
| FR-12 | 评论图片 | interactions | comments |
| FR-13 | 评论表态（赞/踩） | interactions | interactions, growth |
| FR-14 | 评论删除 | interactions | comments |
| FR-15 | 内容举报 | interactions | interactions |
| FR-16 | AI 审查分类 | interactions | interactions |
| FR-17 | 管理员举报裁决 | interactions | interactions |
| FR-18 | 拉黑用户 | interactions | interactions |
| FR-19 | 每日签到 | auth | growth |
| FR-20 | 经验与等级 | auth, interactions | growth |
| FR-21 | 笔记合集 | collections | collections |

### 2.6 人工处理过程

本模块为自动化 Web 系统，无人工处理环节。管理员举报裁决为管理后台内交互操作，属系统内流程。

## 3．接口设计

### 3.1 用户接口

前端用户接口按功能域划分：

- **写作域**：Markdown 编辑器（支持草稿自动保存、AI 润色工具条与差异对照面板、摘要流式展示）、发布按钮（校验提示）
- **浏览互动域**：分类/标签/搜索筛选栏、笔记卡片列表（支持分类/标签/排序/游标分页）、笔记详情页（Markdown 渲染、点赞/点踩/收藏按钮、评论区含锚点引用与楼中楼回复、举报/拉黑操作菜单）、合集侧拉栏
- **合集域**：个人中心合集管理面板（创建/编辑/删除合集、向合集加入笔记）、详情页右侧合集侧拉栏（同合集笔记列表 + 当前笔记高亮）
- **治理域**：内容操作菜单中的举报入口（8 类型选择 + 补充说明）、管理后台举报工单队列（含 AI 结论展示与裁决按钮）、个人中心黑名单管理
- **成长域**：上线签到弹窗、个人中心经验等级展示与明细

### 3.2 外部接口

本模块的外部接口为 AI 服务：

- **AI 服务接口**：OpenAI 兼容 `/v1/chat/completions`，支持一次性（润色/审查）与流式（SSE 摘要）两种模式；
  - 润色/摘要：DeepSeek（deepseek-v4-flash）；
  - 审查分类：先以 DeepSeek 提示词方案占位，要求返回 JSON `{label, confidence, reason}`，后续以同一协议切换至 Gemma4 12B 微调模型。

### 3.3 内部接口

前端一律经统一请求封装（`frontend/src/api/client.ts`）访问后端 REST API，数据格式为 camelCase JSON，鉴权采用 `Authorization: Bearer <JWT>` 头。本模块涉及的资源域：

| 资源域 | 基础路径 | 说明 |
|---|---|---|
| 笔记 | `/notes` | 列表、详情、编辑、删除 |
| 草稿 | `/notes/drafts` | 创建、更新、发布 |
| 互动 | `/notes/{id}/like, /notes/{id}/dislike, /notes/{id}/favorite` | 笔记表态/收藏 |
| 评论 | `/notes/{id}/comments, /comments/{id}/like, /comments/{id}/dislike` | 评论 CRUD 与表态 |
| 举报 | `/reports` | 举报提交 |
| 拉黑 | `/blocks` | 拉黑/取消拉黑 |
| 合集 | `/collections` | 合集 CRUD、笔记加入/移出、侧栏查询 |
| 签到/成长 | `/auth/me/checkin, /auth/me/xp-events, /auth/me/favorites` | 签到/经验/收藏列表 |
| AI | `/ai/compose, /ai/compose/stream` | 润色/摘要 |

## 4．运行设计

### 4.1 运行模块组合

本模块与平台其他模块（共享资料库、导师院校库、CCF 会议追踪、管理后台基础设施）共同运行于同一 FastAPI 进程内。运行时的模块组合为：

- **笔记读写链路**：React SPA → nginx → FastAPI routes（notes/drafts/ai）→ services → SQLite 主库
- **互动通信链路**：React SPA → nginx → FastAPI routes（interactions）→ services → SQLite 主库
- **合集链路**：React SPA → nginx → FastAPI routes（collections）→ services → SQLite 主库
- **治理旁路**：React SPA → interactions → 异步 AI 审查任务 → SQLite 主库
- **成长旁路**：React SPA → auth → growth 服务 → 经验流水写入

### 4.2 运行控制

- 系统以 `feiyue-backend.service` 为 systemd 单元常驻运行
- 写操作全部要求登录态（Bearer JWT），前端通过 localStorage 持久化令牌
- 管理操作经服务端角色校验（非管理员返回 404 隐藏后台入口）
- AI 审查为后端进程内异步任务，失败自动降级不重试阻塞
- 签到、表态、收藏、举报均以数据库唯一约束/复合主键保证幂等

## 5．系统数据库设计

### 5.1 概念结构设计（E-R 图）

本模块的核心实体及关系如图 5-2 所示。核心实体包括 User（用户）、Note（笔记）、Draft（草稿）、Comment（评论）、Like（点赞）、NoteDislike（点踩）、Favorite（收藏）、Collection（合集）、CollectionEntry（合集条目）、CommentReaction（评论表态）、Report（举报）、Block（拉黑）、CheckIn（签到）、XpEvent（经验流水）、LoginEvent（登录事件）。

核心关系：
- User 1—N Note（发布）
- User 1—N Draft（草稿属主）
- User N—M Note（通过 Like 点赞）
- User N—M Note（通过 NoteDislike 点踩）
- User N—M Note（通过 Favorite 收藏）
- Note 1—N Comment（顶层评论）
- Comment 1—N Comment（楼中楼回复，自引用 parent_id）
- Comment N—M User（通过 CommentReaction 评论表态）
- User N—M User（通过 Block 拉黑）
- User 1—N Collection（合集创建者）
- Collection 1—N CollectionEntry（合集条目）
- CollectionEntry N—1 Note（笔记唯一归属合集）
- User 1—N Report（举报发起）
- User 1—N CheckIn（签到）
- User 1—N XpEvent（经验流水）

〔此处插入图 5-2 —— 源文件 figures/ch5-fig2-er-core-and-extensions.drawio，app.diagrams.net 编辑后导出插入〕

图 5-2 笔记系统与社区互动模块 E-R 图

### 5.2 逻辑结构设计

E-R 模型转换为以下关系模式（下划线表示主键，波浪线表示外键）：

**核心四表（增量一已实现）：**

1. **User**（<u>sid</u>, name, nickname, preferred_name, avatar, avatar_thumb, bio, wechat, phone, email, password_hash, role, exp, level, created_at）
2. **Note**（<u>id</u>, title, summary, content, cover, category, tags, ~author_sid~, created_at, read_minutes, status）
3. **Draft**（<u>id</u>, ~owner_sid~, title, summary, content, category, tags, updated_at）
4. **Like**（<u>~note_id~</u>, <u>~user_sid~</u>, created_at）
5. **Comment**（<u>id</u>, ~note_id~, ~author_sid~, ~parent_id~, ~reply_to_sid~, content, images, status, anchor_text, anchor_offset_start, anchor_offset_end, created_at）

**扩展表（增量二新增）：**

6. **NoteDislike**（<u>~note_id~</u>, <u>~user_sid~</u>, created_at）
7. **Favorite**（<u>~note_id~</u>, <u>~user_sid~</u>, created_at）
8. **CommentReaction**（<u>~comment_id~</u>, <u>~user_sid~</u>, kind, created_at）
9. **Report**（<u>id</u>, ~reporter_sid~, target_type, ~target_note_id~, ~target_comment_id~, target_snapshot, reason, description, status, ai_label, ai_confidence, ai_reason, resolution_action, resolution_comment, ~resolved_by_sid~, resolved_at, created_at, updated_at）
10. **Block**（<u>~blocker_sid~</u>, <u>~blocked_sid~</u>, created_at）
11. **CheckIn**（<u>~user_sid~</u>, <u>checkin_date</u>, created_at）
12. **XpEvent**（<u>id</u>, ~user_sid~, source_type, delta, ref_type, ref_id, note, created_at）
13. **Collection**（<u>id</u>, ~owner_sid~, title, description, created_at, updated_at）
14. **CollectionEntry**（<u>~collection_id~</u>, <u>~note_id~</u>, sort_order, created_at）

**辅助表（管理后台支撑）：**

15. **LoginEvent**（<u>id</u>, ~user_sid~, ip, user_agent, created_at）

### 5.3 物理结构设计

核心表结构如下（SQLite 物理存储，Alembic 管理迁移）：

**表 5-2 users 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | sid | 文本 | 11 | 否 | 学号，主键 |
| 2 | name | 文本 | 120 | 否 | 真实姓名 |
| 3 | nickname | 文本 | 120 | 否 | 显示昵称 |
| 4 | preferred_name | 文本 | 120 | 是 | 亲切称呼 |
| 5 | avatar | 文本 | 512 | 是 | 头像 URL |
| 6 | avatar_thumb | 文本 | 512 | 是 | 头像缩略图 URL |
| 7 | bio | 文本 | — | 是 | 个人简介 |
| 8 | wechat | 文本 | 64 | 是 | 微信号 |
| 9 | phone | 文本 | 32 | 是 | 手机号 |
| 10 | email | 文本 | 128 | 是 | 邮箱 |
| 11 | password_hash | 文本 | 255 | 否 | bcrypt 密码哈希 |
| 12 | role | 文本 | 16 | 否 | 角色：user/admin/superadmin |
| 13 | exp | 整数 | — | 否 | 经验值，默认 0 |
| 14 | level | 整数 | — | 否 | 等级，默认 0 |
| 15 | created_at | 时间戳 | — | 否 | 注册时间 |

**表 5-3 notes 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | id | 文本 | 64 | 否 | 笔记 ID（UUID），主键 |
| 2 | title | 文本 | 255 | 否 | 标题 |
| 3 | summary | 文本 | — | 否 | 一句话简介 |
| 4 | content | 文本 | — | 否 | Markdown 正文 |
| 5 | cover | 文本 | 512 | 是 | 封面图 URL |
| 6 | category | 文本 | 20 | 否 | 分类（7 类枚举），索引 |
| 7 | tags | JSON/ARRAY | — | 否 | 标签列表 |
| 8 | author_sid | 文本 | 11 | 否 | 作者学号，外键→users.sid |
| 9 | created_at | 时间戳 | — | 否 | 发布时间，索引 |
| 10 | read_minutes | 整数 | — | 否 | 阅读时长（分钟） |
| 11 | status | 文本 | 16 | 否 | 状态：visible/pending，索引 |

**表 5-4 comments 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | id | 文本 | 64 | 否 | 评论 ID（UUID），主键 |
| 2 | note_id | 文本 | 64 | 否 | 所属笔记 ID，外键→notes.id，索引 |
| 3 | author_sid | 文本 | 11 | 否 | 评论者学号，外键→users.sid |
| 4 | parent_id | 文本 | 64 | 是 | 父评论 ID（楼中楼），外键→comments.id |
| 5 | reply_to_sid | 文本 | 11 | 是 | @ 目标用户学号，外键→users.sid |
| 6 | content | 文本 | — | 否 | 评论内容 |
| 7 | images | JSON/ARRAY | — | 否 | 评论图片 URL 列表（0～9） |
| 8 | status | 文本 | 16 | 否 | 状态：visible/pending，索引 |
| 9 | anchor_text | 文本 | — | 是 | 引用原文片段 |
| 10 | anchor_offset_start | 整数 | — | 是 | 锚点起始偏移 |
| 11 | anchor_offset_end | 整数 | — | 是 | 锚点结束偏移 |
| 12 | created_at | 时间戳 | — | 否 | 评论时间，索引 |

**表 5-5 likes 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | note_id | 文本 | 64 | 否 | 笔记 ID，主键（复合），外键→notes.id |
| 2 | user_sid | 文本 | 11 | 否 | 用户学号，主键（复合），外键→users.sid |
| 3 | created_at | 时间戳 | — | 否 | 点赞时间 |

**表 5-6 note_dislikes 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | note_id | 文本 | 64 | 否 | 笔记 ID，主键（复合），外键→notes.id |
| 2 | user_sid | 文本 | 11 | 否 | 用户学号，主键（复合），外键→users.sid |
| 3 | created_at | 时间戳 | — | 否 | 点踩时间 |

**表 5-7 favorites 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | note_id | 文本 | 64 | 否 | 笔记 ID，主键（复合），外键→notes.id |
| 2 | user_sid | 文本 | 11 | 否 | 用户学号，主键（复合），外键→users.sid |
| 3 | created_at | 时间戳 | — | 否 | 收藏时间 |

**表 5-8 comment_reactions 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | comment_id | 文本 | 64 | 否 | 评论 ID，主键（复合），外键→comments.id |
| 2 | user_sid | 文本 | 11 | 否 | 用户学号，主键（复合），外键→users.sid |
| 3 | kind | 文本 | 16 | 否 | 表态种类：like/dislike |
| 4 | created_at | 时间戳 | — | 否 | 表态时间 |

**表 5-9 reports 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | id | 文本 | 64 | 否 | 工单 ID（UUID），主键 |
| 2 | reporter_sid | 文本 | 11 | 否 | 举报人学号，索引 |
| 3 | target_type | 文本 | 16 | 否 | 目标类型：note/comment |
| 4 | target_note_id | 文本 | 64 | 是 | 被举报笔记 ID，索引 |
| 5 | target_comment_id | 文本 | 64 | 是 | 被举报评论 ID，索引 |
| 6 | target_snapshot | 文本 | — | 否 | 举报时目标内容快照 |
| 7 | reason | 文本 | 32 | 否 | 举报类型（8 类枚举） |
| 8 | description | 文本 | — | 是 | 补充说明（≤200 字） |
| 9 | status | 文本 | 16 | 否 | 状态：pending/ai_flagged/resolved/dismissed，索引 |
| 10 | ai_label | 文本 | 32 | 是 | AI 审查分类标签 |
| 11 | ai_confidence | 浮点 | — | 是 | AI 审查置信度 [0,1] |
| 12 | ai_reason | 文本 | — | 是 | AI 审查理由 |
| 13 | resolution_action | 文本 | 16 | 是 | 裁决动作：hide/delete/dismiss |
| 14 | resolution_comment | 文本 | — | 是 | 裁决备注 |
| 15 | resolved_by_sid | 文本 | 11 | 是 | 裁决人学号 |
| 16 | resolved_at | 时间戳 | — | 是 | 裁决时间 |
| 17 | created_at | 时间戳 | — | 否 | 举报时间，索引 |
| 18 | updated_at | 时间戳 | — | 否 | 最后更新时间 |

**表 5-10 blocks 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | blocker_sid | 文本 | 11 | 否 | 拉黑者学号，主键（复合），外键→users.sid |
| 2 | blocked_sid | 文本 | 11 | 否 | 被拉黑者学号，主键（复合），外键→users.sid |
| 3 | created_at | 时间戳 | — | 否 | 拉黑时间 |

**表 5-11 check_ins 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | user_sid | 文本 | 11 | 否 | 用户学号，主键（复合），外键→users.sid |
| 2 | checkin_date | 日期 | — | 否 | 签到日期，主键（复合） |
| 3 | created_at | 时间戳 | — | 否 | 签到时间 |

**表 5-12 xp_events 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | id | 整数 | — | 否 | 主键（自增） |
| 2 | user_sid | 文本 | 11 | 否 | 用户学号，外键→users.sid，索引 |
| 3 | source_type | 文本 | 32 | 否 | 来源类型（daily_checkin/note_liked/note_favorited 等） |
| 4 | delta | 整数 | — | 否 | 经验变动值（正为加、负为扣回） |
| 5 | ref_type | 文本 | 32 | 是 | 关联对象类型 |
| 6 | ref_id | 文本 | 64 | 是 | 关联对象 ID |
| 7 | note | 文本 | — | 是 | 备注 |
| 8 | created_at | 时间戳 | — | 否 | 变动时间，索引 |

**表 5-13 collections 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | id | 文本 | 64 | 否 | 合集 ID（UUID），主键 |
| 2 | owner_sid | 文本 | 11 | 否 | 创建者学号，外键→users.sid，索引 |
| 3 | title | 文本 | 255 | 否 | 合集标题 |
| 4 | description | 文本 | — | 否 | 合集简介 |
| 5 | created_at | 时间戳 | — | 否 | 创建时间 |
| 6 | updated_at | 时间戳 | — | 否 | 最后更新时间 |

**表 5-14 collection_entries 表**

| 序号 | 列名 | 数据类型 | 长度 | 是否为空 | 说明 |
|---|---|---|---|---|---|
| 1 | collection_id | 文本 | 64 | 否 | 合集 ID，主键（复合），外键→collections.id |
| 2 | note_id | 文本 | 64 | 否 | 笔记 ID，主键（复合），外键→notes.id，唯一约束 |
| 3 | sort_order | 整数 | — | 否 | 排序序号 |
| 4 | created_at | 时间戳 | — | 否 | 加入时间 |

## 6．系统出错处理设计

### 6.1 出错信息

系统涉及的主要出错情形：

| 错误编号 | 错误描述 | HTTP 状态码 | 处理方式 |
|---|---|---|---|
| E-AUTH-001 | 未登录调用写接口 | 401 | 返回未授权，前端跳转登录页 |
| E-AUTH-002 | 非作者编辑/删除笔记 | 403 | 返回禁止操作，前端隐藏操作入口 |
| E-AUTH-003 | 非作者/非笔记作者删除评论 | 403 | 返回禁止操作 |
| E-AUTH-004 | 非管理员访问举报队列/裁决 | 404 | 返回不存在，隐藏管理入口 |
| E-DRAFT-001 | 发布时标题为空 | 422 | 提示"发布前必须填写标题" |
| E-DRAFT-002 | 发布时正文为空 | 422 | 提示"发布前必须填写正文" |
| E-DRAFT-003 | 发布时分类为空 | 422 | 提示"发布前必须选择分类" |
| E-AI-001 | AI 润色服务故障 | 503 | 提示"润色失败，请稍后重试"，不阻断编辑 |
| E-AI-002 | AI 摘要服务故障 | — | 降级为正文首段截断，发布继续 |
| E-AI-003 | AI 审查服务不可用 | — | 工单直接进入人工队列 |
| E-IMAGE-001 | 图片大小超过 8MB | 413 | 提示"单张图片不超过 8MB" |
| E-IMAGE-002 | 图片格式不在白名单 | 400 | 提示"仅支持 PNG/JPG/WebP/GIF" |
| E-IMAGE-003 | 单条评论图片超过 9 张 | 422 | 提示"每条评论最多 9 张图片" |
| E-COLLECTION-001 | 非本人笔记加入合集 | 403 | 提示"只能添加自己的笔记" |
| E-COLLECTION-002 | 草稿加入合集 | 422 | 提示"只有已发布笔记可以加入合集" |
| E-COLLECTION-003 | 笔记已属于其他合集 | 409 | 提示"该笔记已属于其他合集" |
| E-SIGN-001 | 当日已签到 | 409 | 提示"今日已签到"，不重复发放经验 |
| E-REPORT-001 | 同一用户重复举报同一内容 | — | 幂等合并到既有工单 |

### 6.2 补救措施

1. **AI 服务降级**：
   - 润色失败：返回错误提示，正文不受影响，用户可手动编辑
   - 摘要失败：取正文首段截断兜底，发布不阻塞
   - 审查失败：工单直接进入人工队列，不影响举报受理

2. **数据库灾备**：
   - 主库 cron 每 30 分钟快照至 Hugging Face 私有 Dataset
   - 上传文件与加密密钥同步备份
   - 恢复时从 Dataset 下载最新快照并重启服务

3. **幂等保护**：
   - 点赞/点踩/收藏/签到/举报均以数据库唯一约束保证幂等
   - 客户端网络重试不会产生重复数据

4. **数据一致性**：
   - 发布走"草稿→笔记"单事务原子操作，不允许中间态
   - 删除笔记级联清除点赞、评论（数据库 ondelete=CASCADE）
   - 经验加减对称扣回：取消赞/收藏时扣回对应经验值