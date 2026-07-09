# 《软件需求规格说明书（SRS）》

> 平台：新疆大学飞跃手册 **xju-feiyue**（内部代号 Aurash，站名"费阅"，生产域名 feiyue.selab.top）
> 文档类别：软件需求规格说明书（Software Requirements Specification）
> 编制依据：GB/T 9385-2008《计算机软件需求规格说明规范》，兼顾 GB/T 8567-2006《计算机软件文档编制规范》
> 编制方式：逆向工程——由已上线代码与《00-架构逆向总览》基线反推需求
> 版本：R1（对应代码 HEAD ≈ 2026-06-29）

---

## 1 引言

### 1.1 目的

本说明书规定新疆大学飞跃手册 xju-feiyue 全栈平台的**软件需求**：功能需求、核心用例、领域模型、非功能需求与外部接口需求。其目标读者为平台的维护开发者、测试工程师、运维人员及后续接手的架构评审人。

本文档是**逆向工程产物**：需求项并非事前拟定，而是从生产代码的实际行为反推、固化为可追溯、可验证的规格条目。故本说明书刻意与实现细节强绑定（引用真实文件路径、类名、常量），既作需求基线，也作实现契约的权威快照。

> **纪律声明**：仓库内 `BACKEND_SPEC.md`、`INTEGRATION_REPORT.md`、`docs/architecture.md`、`backend/README.md`、`frontend/README.md` 均已严重陈旧（停留在"19 路由 / 全 mock / v1"阶段）。凡历史文档与代码冲突，**一律以代码与《00-架构逆向总览》基线为准**。本 SRS 的全部需求项以代码为唯一事实来源。

### 1.2 范围

**软件产品名称**：xju-feiyue（费阅）。

**产品概述**：面向新疆大学在校生与校友的社区式知识沉淀平台，核心业务是围绕 7 分类（research / course / recommend / competition / kaggle / tools / life）的长文 Markdown 笔记，展开草稿→发布、点赞、锚点引用评论，并集成五个相对独立的业务纵切：共享课程资料库、CCF 会议截稿追踪、导师/院校招生情报检索、教务成绩单一键导入的学分自查、以及 DeepSeek 驱动的个性化问候与 AI 笔记润色/摘要。

**边界内（in-scope）**：`backend/app/`（FastAPI 单体，11 个 router、60 个路由装饰器 + `/health`）、`frontend/src/`（React 18 SPA）、`extension/`（浏览器扩展/用户脚本）、`scripts/`（内容管线与状态同步）。

**边界外（out-of-scope，属外部系统/依赖）**：DeepSeek 大模型服务、open-meteo 天气、ccfddl CFP 数据源、DuckDuckGo 搜索、新疆大学教务系统 jwxt、Hugging Face 私有 Dataset、生产 nginx 反代与 systemd 运维配置（`feiyue-backend.service`）、外部 supervisor-claw 导出的 schools.sqlite。

### 1.3 术语、定义与缩略语

| 术语 | 定义 |
|---|---|
| 执行者（Actor） | 与系统交互的角色，本平台含 anon / user / admin / superadmin 四类人类执行者与若干外部系统执行者 |
| sid | 11 位学号字符串，`users.sid`，用户表**自然主键**（非自增 id） |
| 笔记（Note） | 已发布的长文 Markdown 内容对象，7 分类之一 |
| 草稿（Draft） | 后端持久化的编辑中内容，`drafts` 表；发布时新建 Note 并删除自身，**不 FK 关联最终 Note** |
| 锚点评论 | 评论可携带 `anchor_text` / `anchor_offset_*`，引用笔记渲染正文的一段选区 |
| 共享资料库 | `/materials` 子系统，读全公开、写需 `owner_sid == user.sid` 的共享知识库 |
| transcript-stash | 未鉴权、内存、5 分钟 TTL 的成绩单 PDF 中转缓冲 |
| 只读域 | schools / conferences 两个 `mode=ro&immutable=1` 的外部导出 SQLite |
| CamelModel / SnakeModel | 全站 camelCase wire 格式（`schemas/_base.py`），仅 `/schools/*` 用 snake_case |
| HardenedStaticFiles | `/uploads` 静态挂载类，强制 `X-Content-Type-Options: nosniff` |
| dry-run | `deepseek_dry_run` 全局 AI kill-switch，令测试零联网 |
| SPA | 单页应用（Single Page Application） |
| SSE | Server-Sent Events，用于 AI 摘要流式输出 |
| JWT | JSON Web Token，HS256、7 天有效期 |
| FR / UC / NFR | 功能需求 / 用例 / 非功能需求编号前缀 |

### 1.4 参考资料

1. `/home/tyhlt/tyh-task/xju-feiyue/docs/reverse-engineering/00-架构逆向总览.md`（权威结构基线）
2. GB/T 9385-2008《计算机软件需求规格说明规范》
3. GB/T 8567-2006《计算机软件文档编制规范》
4. 代码事实来源：`backend/app/routes/*.py`、`backend/app/services/*.py`、`backend/app/db/models.py`、`backend/app/deps.py`、`backend/app/settings.py`、`frontend/src/api/*`、`frontend/src/features/*`、`extension/content.js`
5. 历史文档（**仅作陈旧参考，不作需求依据**）：`BACKEND_SPEC.md`、`docs/architecture.md` 等

---

## 2 总体描述

### 2.1 产品前景与定位

xju-feiyue 是一个**自持式社区知识平台**，不隶属于更大的产品族，但通过若干外部系统集成扩展能力。其定位为"新疆大学升学/保研/竞赛/求职经验的结构化沉淀站"，用长文笔记替代零散的群聊与文档，并以三类特色能力形成差异：

- **降低学生获取教务/招生数据的门槛**：教务成绩单一键导入（浏览器扩展 + 客户端 pdf.js 解析）、C9+ 导师/院校招生情报检索。
- **降低创作与协作成本**：DeepSeek 驱动的 AI 润色/摘要、锚点引用评论、共享课程资料库。
- **降低时效信息的追踪成本**：CCF 会议截稿日期的自动爬取与状态派生。

体系结构上，系统是一个 FastAPI 单体后端，前挂**三套物理隔离的存储域**：一个可写主库（`labnotes.db`，用户/笔记/草稿/点赞/评论/登录/资料）与两个只读、可热重载的外部导出 SQLite（schools / conferences）。前端为 React 18 SPA，经 nginx 反代访问后端与 `/uploads` 静态资源。

### 2.2 产品功能概述

系统功能按子系统组织如下：

```
                         xju-feiyue 功能地图
 ┌───────────────────────────────────────────────────────────────────┐
 │ 认证与资料      登录/登出/me/改密/头像/资料编辑（PATCH /auth/me）    │
 ├───────────────────────────────────────────────────────────────────┤
 │ 笔记子系统      列表(filter/sort/cursor)·hot/latest/liked·详情·     │
 │                 编辑(PATCH,作者自限,按需重摘要)·删除(级联)  ※无POST │
 ├───────────────────────────────────────────────────────────────────┤
 │ 草稿与发布      草稿 CRUD · /publish（校验+AI 摘要兜底 Draft→Note） │
 ├───────────────────────────────────────────────────────────────────┤
 │ AI 能力         润色 /ai/compose(无鉴权) · 摘要 SSE 流式 ·          │
 │                 个性化问候 /ai/greetings(3h 缓存, 永不硬失败)       │
 ├───────────────────────────────────────────────────────────────────┤
 │ 互动            点赞(幂等 upsert) · 锚点评论(keyset 分页, 双向授权删)│
 ├───────────────────────────────────────────────────────────────────┤
 │ 共享资料库      资源 CRUD · 文件树(flat SELECT 装配) · 上传(自动改名│
 │                 /魔术字节校验) · 文件夹 · 重命名 · 拖拽排序 · 下载 · │
 │                 在线预览(PDF/Word/Excel/图片/代码) · 致谢栏(admin)  │
 ├───────────────────────────────────────────────────────────────────┤
 │ 导师/院校检索   /schools/list(offset 分页, FTS5+拼音) · 详情 · meta │
 ├───────────────────────────────────────────────────────────────────┤
 │ CCF 会议追踪    /conferences/list · 72h 自动爬取 · reload/crawl     │
 ├───────────────────────────────────────────────────────────────────┤
 │ 学分自查        扩展抓取→transcript-stash 中转→pdf.js 客户端解析    │
 ├───────────────────────────────────────────────────────────────────┤
 │ 管理后台        用户列表/stats(14天登录火花线)/建用户/重置密码/     │
 │                 角色升降/登录审计（三级权限 · 非 admin 返 404）     │
 └───────────────────────────────────────────────────────────────────┘
```

### 2.3 用户类与特征

系统采用**三级角色 + 匿名 + 外部系统**的执行者模型。人类执行者的权限判定核心在 `backend/app/deps.py` 与 `backend/app/services/auth.py::effective_role()`。

| 执行者 | 定义与特征 | 鉴权机制 |
|---|---|---|
| **anon（匿名/游客）** | 未登录访问者。可浏览笔记列表/详情、共享资料库（读）、导师检索、会议追踪。经 `get_optional_user`（静默返回 None）访问公开+个性化端点 | 无 token；`get_optional_user` 不抛错 |
| **user（注册用户）** | 拥有 sid 的在校生/校友。可写草稿、发布笔记、点赞、评论、上传资料、导入成绩单、编辑本人资料 | `Authorization: Bearer <JWT>`，`get_current_user`（失败 401） |
| **admin（管理员）** | `users.role='admin'`。可访问 `/admin` 仪表盘、编辑资料库致谢栏、查看用户列表/登录审计、建用户、升降普通用户角色 | `require_admin`（**非管理员返 404 使 /admin 面不可发现**） |
| **superadmin（超级管理员）** | `users.role='superadmin'`，或 `settings.admin_sid` 指定的账号（**运行时恒 superadmin，无视 DB role 列**，见 `effective_role()`）。可重置管理员密码、任意升降角色 | `require_superadmin`（普通 admin 返 403、非 admin 返 404） |

**外部系统执行者**（详见第 7 章）：

| 外部执行者 | 交互角色 |
|---|---|
| 浏览器扩展 / 用户脚本（`extension/content.js`） | 在 jwxt 教务页抓取成绩单 PDF，`no-cors` POST 到 transcript-stash |
| DeepSeek | AI 润色/摘要/问候/会议信息抽取的上游模型 |
| open-meteo | 问候语的定性天气描述来源 |
| ccfddl.com | CCF 会议 CFP 主数据源 |
| DuckDuckGo（ddgs） | 会议信息的兜底搜索 |
| jwxt-443.webvpn.xju.edu.cn | 新疆大学教务系统，成绩单 PDF 的原始来源 |
| Hugging Face 私有 Dataset | 主库快照/uploads/只读参考库的备份与分发 |

### 2.4 运行环境

- **服务端**：Python 3.11 · FastAPI + Uvicorn · SQLAlchemy 2.x async ORM · aiosqlite（dev/prod 现均用 SQLite；asyncpg 备用未启用）· 华为云 VPS · nginx 反代（静态 dist + `/uploads` + API 前缀反代）· systemd（`feiyue-backend.service`）· Let's Encrypt/certbot。
- **客户端**：现代浏览器（支持 ES2020、`EditContext`、Service-Worker-free）。前端 React 18.3 + TypeScript 5.6 strict + Vite 5.4，经 CDN/nginx 分发 `dist/`。
- **浏览器扩展**：Chromium 系（MV3 content script，`world:MAIN`），仅注入 `jwxt-443.webvpn.xju.edu.cn` 与 feiyue/winbeau.top。
- **存储**：主库 SQLite（`labnotes.db`）+ 两只读 immutable SQLite；`uploads/` 本地磁盘目录。

### 2.5 设计与实现约束

| 编号 | 约束 |
|---|---|
| C-01 | 用户主键必须是 11 位学号 `sid`（`String(11)`），**非自增 id**；所有归属外键 `ondelete='CASCADE'` 指向 `users.sid` |
| C-02 | 全站 wire 格式为 camelCase（`CamelModel`），**唯一例外** `/schools/*` 为 snake_case（`SnakeModel`）；时间戳恒输出带尾 `Z` 的 ISO-8601（`UtcDateTime`） |
| C-03 | 7 分类以普通字符串列存储（`CATEGORY_VALUES`），非原生枚举，以保 SQLite 测试廉价 |
| C-04 | 一对多关系几乎全 `lazy='raise'` + `passive_deletes=True`，**禁用 SQLAlchemy 隐式懒加载**；级联全靠 DB 级 `ondelete='CASCADE'`，不用 `cascade='all, delete-orphan'` |
| C-05 | 每个 SQLite 连接必须发 `PRAGMA foreign_keys=ON`（`db/base.py` connect 监听器），否则 CASCADE 静默失效 |
| C-06 | 只读域引擎必须以 `mode=ro&immutable=1&uri=true` + `PRAGMA query_only=ON` 打开（三重防御）；写者遵循"临时文件 → `os.replace()` 原子换 → 重写 manifest" |
| C-07 | schools / conferences 的表结构**不在 `models.py` / Alembic 内**，仅能从服务层 raw SQL 反推 |
| C-08 | 前端数据层铁律：Component → TanStack Query hook（`api/index.ts`）→ `endpoints/*.ts`（必须 Zod `.parse()`）→ `client.ts request<T>()`（唯一 fetch 封装）；SSE/预览/下载等约 15 处为合法直 fetch 例外 |
| C-09 | 上传子系统必须执行扩展白名单 + `DENY_EXTS`（.svg/.html/.htm/.xml）+ 魔术字节交叉校验 + 服务端定 MIME；1MiB 分块流式、超限前中止 |
| C-10 | CodeMirror 6 须应用本地 patch（`patches/@codemirror__view.patch`）修中文 IME；`ime-patch.test.ts` 读 dist 断言 patch 已生效 |
| C-11 | 前端与后端刻意重复业务逻辑：`lib/tree.ts` 拖拽投影镜像 Python `reorder_file`、`isValidGreeting`/`familiarName` 镜像后端、diff 算法两端一致 |

### 2.6 假设与依赖

- **A-01**：生产 DB 实际使用 SQLite（`settings.database_url`），Postgres 分支代码存在但未启用（待 huawei2 `.env.local` 最终确认）。
- **A-02**：生产 nginx 已手工放行 `/materials`、`/schools`、`/conferences`、`/credits` 前缀反代；仓库内无对 prod nginx 权威的配置文件。
- **A-03**：更强的 doc 类 `Content-Disposition: attachment` 防护刻意推到 prod nginx，**仓库内不可验证**（在 `main.py` 与 `uploads_common.py` docstring 声明，须 huawei2 runbook 落实）。
- **A-04**：schools.sqlite 由外部 supervisor-claw 仓库离线导出，其权威 schema 契约在外部 `EXPORT_SCHEMA_v1.md`。
- **A-05**：托管用户脚本 `/feiyue-importer.user.js`（v1.6.2）不在本仓库，须与 `extension/content.js` 逻辑保持锁步。
- **A-06**：DeepSeek / open-meteo / ccfddl / DuckDuckGo / jwxt 等外部服务可用性不受本系统控制；AI 相关功能须对上游失败**永不硬失败降级**。
- **A-07**：`/ai/compose(/stream)` 无鉴权即可调用付费 DeepSeek，暂无速率限制（已知开放缺口）。

---

## 3 功能需求

需求项按子系统与执行者组织，编号 FR-XX。每条给出触发者 / 输入 / 处理 / 输出 / 异常。除注明外，"user"含 admin/superadmin。

### 3.1 认证与个人资料子系统（`routes/auth.py`，前缀 `/auth`）

**FR-01 用户登录**
- 触发者：anon
- 输入：`POST /auth/login {sid, password}`
- 处理：按 sid `SELECT User` → `services/auth.py verify_password`（bcrypt）→ `create_access_token(sid)`（HS256，`{sub,iat,exp}`，7 天）→ 插入 `LoginEvent`（`deps.client_ip()` 取 XFF 最左 IP + 截断 UA）
- 输出：`LoginOut{user, token}`
- 异常：sid 不存在或密码错误 → 401「学号或密码不正确」（不区分二者，防用户枚举）

**FR-02 登出**
- 触发者：user；输入：`POST /auth/logout`；处理：无状态（JWT 无服务端吊销）；输出：204；异常：无。前端负责清 `localStorage['labnotes.auth']`。

**FR-03 获取当前用户资料**
- 触发者：user；输入：`GET /auth/me`；处理：`get_current_user` 解签验期 + `db.get(User, sid)`；输出：`UserOut`（含 `sid/name/nickname/preferredName/avatar/avatarThumb/bio/wechat/phone/email/role/isAdmin/isSuperAdmin`）；异常：token 缺失/过期/用户不存在 → 401。用于 `App.tsx` 挂载复验。

**FR-04 编辑个人资料**
- 触发者：user；输入：`PATCH /auth/me`（nickname/preferredName/bio/wechat/phone/email 等，部分字段）；处理：仅更新非 None 字段，空串不覆盖（前端 `ProfileSettingsDialog` diff 后 PATCH）；输出：更新后的 `UserOut`；异常：未鉴权 401。

**FR-05 修改密码**
- 触发者：user；输入：`POST /auth/me/password {oldPassword, newPassword}`；处理：bcrypt 校验旧密码，通过则重算 hash；输出：204；异常：旧密码不符 → 400「当前密码不正确」。

**FR-06 上传头像**
- 触发者：user；输入：`POST /auth/me/avatar`（multipart 图片）；处理：格式白名单 png/jpg/webp/gif、≤2MB、非空校验、Pillow 解码、生成 160px 缩略图（`_make_thumbnail`）写 `avatar` + `avatar_thumb`；输出：更新后的 `UserOut`；异常：格式不符/超 2MB/空文件/无法解析 → 400。

### 3.2 笔记浏览子系统（`routes/notes.py`）

> **关键约束**：笔记**无 POST create 端点**，唯一发布路径是草稿发布（见 3.3）。

**FR-07 笔记分页列表**
- 触发者：anon / user
- 输入：`GET /notes?cat&q&sort&tags&cursor&limit&mine`（`limit` 默认 6，1..50；`sort ∈ {latest,hot,liked}`；`tags` 逗号分隔）
- 处理：`services/notes.py list_notes()`——全量载入后 Python 排序 / tag 过滤 / cursor 分页（明确标注仅适合数千量级）；`mine=true` 且已登录时按作者过滤；批量算点赞/评论计数与 `likedByMe`
- 输出：`PaginatedNotes{items, nextCursor}`
- 异常：无（空结果返回空列表）

**FR-08 热门/最新/我赞过的快捷列表**
- 触发者：anon / user；输入：`GET /notes/hot`（limit 6）、`GET /notes/latest`（limit 8）、`GET /notes/liked`（limit 6）；处理：以固定 sort 调 `list_notes`；输出：`list[NoteOut]`；异常：无。

**FR-09 笔记详情**
- 触发者：anon / user；输入：`GET /notes/get?id=<id>`；处理：`selectinload(Note.author)` 加载作者，批量算 likes/comments/`likedByMe`；输出：`NoteOut`（含 `content`）；异常：不存在 → 404「笔记不存在」。

**FR-10 编辑笔记（作者自限 + 按需 AI 重摘要）**
- 触发者：user（作者本人）
- 输入：`PATCH /notes/{note_id}`（title/category/tags/content/summary，部分字段）
- 处理：加载 Note，校验 `author_sid == user.sid`；逐字段更新；改 content 则重算 `read_minutes`（`read_minutes_from`，约 500 CJK 字/分）；**摘要逻辑**：`summary` 传非空串→直接采用；传空串→调 `ai_compose.summarize_or_fallback` 重生成；未传 `summary` 但改了 content→亦自动重摘要
- 输出：更新后的 `NoteOut`
- 异常：不存在 404；非作者 → 403「只能编辑自己的笔记」；title/content 传空白 → 422

**FR-11 删除笔记（级联）**
- 触发者：user（作者本人）；输入：`DELETE /notes/{note_id}`；处理：校验作者，`db.delete(note)`，DB 级 CASCADE 自动清 Like/Comment；输出：204；异常：不存在 404；非作者 403。

### 3.3 草稿与发布子系统（`routes/drafts.py`，前缀 `/notes/drafts`，全端点需鉴权）

**FR-12 创建草稿**
- 触发者：user；输入：`POST /notes/drafts {title?,summary?,content?,category?,tags?}`；处理：新建 `Draft`（id=uuid4，owner_sid=当前用户，各字段缺省空串/空列表）；输出：`DraftOut`（201）；异常：未鉴权 401。

**FR-13 列出/获取我的草稿**
- 触发者：user；输入：`GET /notes/drafts`（按 `updated_at desc`）/ `GET /notes/drafts/{id}`；处理：`_get_owned_draft` 校验 `owner_sid == user.sid`；输出：`list[DraftOut]` / `DraftOut`；异常：非本人/不存在 → 404「草稿不存在」（统一以 404 隐藏他人草稿存在性）。

**FR-14 更新草稿**
- 触发者：user（owner）；输入：`PATCH /notes/drafts/{id}`（部分字段）；处理：owner 校验后逐字段更新；输出：`DraftOut`；异常：404。

**FR-15 删除草稿**
- 触发者：user（owner）；输入：`DELETE /notes/drafts/{id}`；处理：owner 校验后删除；输出：204；异常：404。

**FR-16 发布草稿（Draft → Note，AI 摘要兜底）**
- 触发者：user（owner）
- 输入：`POST /notes/drafts/{id}/publish`
- 处理：owner 校验；强校验 title/content/category 非空；若 `summary` 为空 → 调 `ai_compose.summarize_or_fallback`（DeepSeek 失败降级首段启发式 `summary_from`）；新建 `Note`（id=uuid4，`created_at=now(utc)`，`read_minutes` 按长度算）；删除 Draft；单次 commit
- 输出：`NoteOut`（likes=0, comments=0）
- 异常：title/content/category 任一为空 → 422（分别提示）；非 owner/不存在 → 404

### 3.4 AI 能力子系统（`routes/ai.py`，前缀 `/ai`）

**FR-17 AI 文本润色（一次性）**
- 触发者：任意（**无鉴权**）
- 输入：`POST /ai/compose {mode, text, ...}`（mode ∈ polish/shorten/expand/tone/translate/custom/summarize，见 `ai_compose.build_prompt`）
- 处理：`ai_compose.compose()` 同步单次 DeepSeek 调用（temp 0.3，max 2000）→ `diff.compute_diff_segments` 产出 add/del/equal 段
- 输出：`AIComposeOut`（含 diff 段）
- 异常：DeepSeek 上游失败 → 502/504 上抛（此端点为少数硬失败点之一）；`deepseek_dry_run` 时 echo 假响应

**FR-18 AI 摘要流式生成（真 SSE）**
- 触发者：任意（无鉴权）；输入：`POST /ai/compose/stream`（SSE）；处理：先吐 `: ready` 注释行破 nginx 缓冲（`X-Accel-Buffering: no`）→ `stream_chunks()` 逐 chunk DeepSeek stream（max 300）；错误进 `{error}` SSE 事件而**不破 HTTP 状态**；输出：`text/event-stream`；异常：上游失败以 error 事件下发，前端有 3 层兜底（mock 合成 / 非 OK 回退一次性 / 5s 无首字节回退）。

**FR-19 个性化首页问候**
- 触发者：user（需鉴权）
- 输入：`GET /ai/greetings`
- 处理：`services/greeting.py`——每用户 3 条问候，进程内 3h 缓存；`familiar_name()` 从法定名派生称呼；open-meteo **只传定性天气描述不传数值**；最多 `min(6,2n)` 次 DeepSeek 调用 + `is_valid_greeting()` 去重校验
- 输出：`GreetingsOut`（3 条）
- 异常：**永不 503**——任何异常静默降级为 7 时段本地模板；未鉴权 401

### 3.5 互动子系统（`routes/interactions.py`）

**FR-20 点赞（幂等 upsert）**
- 触发者：user；输入：`POST /notes/{note_id}/like`；处理：校验 Note 存在，`db.get(Like, (note_id, user.sid))` 判存，未点则插入（复合主键 `(note_id, user_sid)`，方言无关幂等）；输出：204；异常：笔记不存在 404。

**FR-21 取消点赞（幂等）**
- 触发者：user；输入：`DELETE /notes/{note_id}/like`；处理：`DELETE WHERE note_id AND user_sid`（缺行亦 204）；输出：204；异常：无。

**FR-22 评论列表（真 keyset 分页）**
- 触发者：anon / user；输入：`GET /notes/{note_id}/comments?cursor&limit`（limit 默认 `DEFAULT_LIMIT`，1..100）；处理：`services/comments.py list_comments`——`(created_at, id)` 元组比较 over-fetch+1 的真 keyset 分页；输出：`PaginatedComments{items, nextCursor}`；异常：无。

**FR-23 发表评论（可含锚点引用）**
- 触发者：user；输入：`POST /notes/{note_id}/comments {content, anchorText?, anchorOffsetStart?, anchorOffsetEnd?}`；处理：校验 Note 存在，新建 Comment（id=uuid4），commit 后 `selectinload(author)` 重取以填作者；输出：`CommentOut`（201）；异常：笔记不存在 404。

**FR-24 删除评论（双向授权）**
- 触发者：user；输入：`DELETE /notes/{note_id}/comments/{comment_id}`；处理：**评论作者可删自己评论**；**笔记作者可删自己笔记下的任意评论**（`note.author_sid == user.sid`）；输出：204；异常：评论不存在/note_id 不匹配 404；两权限均不满足 → 403「只能删除自己的评论」。

### 3.6 共享资料库子系统（`routes/materials.py`，前缀 `/materials`）

> **共享语义**：list/detail/download 为 optional-auth，**返回所有人非删资源**；写操作需鉴权，且改删资源/文件额外需 `owner_sid == user.sid`（`svc.ensure_owner`，否则 403）。

**FR-25 资源列表（含文件树，可搜索）**
- 触发者：anon / user；输入：`GET /materials/resources?q`；处理：`deleted==False` 过滤，`q` ilike 匹配 title/description，按 `sort_order, created_at desc` 排；`svc.resources_with_trees` 批装文件树（2 查询）；输出：`list[ResourceOut]`；异常：无。

**FR-26 资源详情（组装文件树）**
- 触发者：anon / user；输入：`GET /materials/resources/{rid}`；处理：`list_resource_files` flat SELECT + `build_file_tree` 重建；输出：`ResourceOut`（含 tree）；异常：不存在 404。

**FR-27 创建资源**
- 触发者：user；输入：`POST /materials/resources {title, description?, tag?}`；处理：title 非空校验，新建 `MaterialResource`（id=uuid4 hex，owner=当前用户）；输出：`ResourceOut`（201）；异常：title 空 422；未鉴权 401。

**FR-28 更新资源元数据（owner-only）**
- 触发者：user（owner）；输入：`PATCH /materials/resources/{rid}`；处理：`ensure_owner`；`tag` 用 `model_fields_set` 区分"省略/显式 null"（省略保持不变，显式 null 清除徽标）；输出：`ResourceOut`；异常：非 owner 403，title 空 422。

**FR-29 软删除资源（级联 + 物理 unlink）**
- 触发者：user（owner）；输入：`DELETE /materials/resources/{rid}`；处理：`soft_delete_resource` 级联软删文件 + 物理 unlink blob；输出：204；异常：非 owner 403。

**FR-30 列出资源文件树**
- 触发者：anon / user；输入：`GET /materials/resources/{rid}/files`；处理：`build_file_tree`（flat SELECT 装配，避 `lazy='raise'` MissingGreenlet）；输出：`list[FileOut]`（递归树）；异常：资源不存在 404。

**FR-31 上传文件（自动改名，不 409）**
- 触发者：user（owner）
- 输入：`POST /materials/resources/{rid}/files?folderId=<可选>`（multipart 多文件）
- 处理：`ensure_owner`；校验目标 folder 属本资源且 `is_folder`；`save_upload`（50MB 上限、1MiB 分块、魔术字节 sniff、DENY_EXTS）流到 `uploads/materials/<sid>/<rid>/`；`unique_upload_name` 冲突自动改 `基名 (n).ext`；逐文件 `flush` 使批内同名探测生效；追加 `MaterialFile` 行含 `sort_order`
- 输出：重建后的 `list[FileOut]`
- 异常：非 owner 403；目标文件夹无效 400；超限/格式违规由 `save_upload` 抛

**FR-32 创建文件夹**
- 触发者：user（owner）；输入：`POST /materials/resources/{rid}/folders {name, parent_id?}`；处理：owner 校验；父文件夹合法性校验；`assert_name_free`（同级重名 409）；新建 `is_folder=True` 行；输出：`FileOut`（201）；异常：名空 422，父无效 400，重名 409。

**FR-33 重命名文件/文件夹（保留扩展名）**
- 触发者：user（owner）；输入：`PATCH /materials/files/{file_id}/rename {name}`；处理：owner 校验；文件强制保留原 `ext`（剥用户输入扩展再回贴规范扩展，只改 DB `name` 不 mv 物理文件）；`assert_name_free` 排除自身；输出：`FileOut`；异常：名空 422，同级重名 409，非 owner 403。

**FR-34 拖拽排序/移动（含环检测）**
- 触发者：user（owner）；输入：`POST /materials/files/reorder {drag_id, drop_id, position}`；处理：owner 校验；`reorder_file` 含祖先环检测（前端 `lib/tree.ts` 镜像同语义）；输出：204；异常：非 owner 403，祖先环 400。

**FR-35 删除文件 / 删除文件夹（递归软删）**
- 触发者：user（owner）；输入：`DELETE /materials/files/{file_id}`（拒文件夹）/ `DELETE /materials/folders/{folder_id}`（拒文件）；处理：owner 校验；`soft_delete_subtree` 递归软删 + unlink；输出：204；异常：类型错配 400，非 owner 403。

**FR-36 文件下载（RFC5987 + nosniff）**
- 触发者：anon / user；输入：`GET /materials/files/{file_id}/download`；处理：定位 `storage_path` 磁盘 blob，`FileResponse`（sendfile），`Content-Disposition: attachment` UTF-8 RFC5987 百分号编码 + ASCII 兜底，附 `X-Content-Type-Options: nosniff`；输出：文件流；异常：文件夹/无 storage_path 400，磁盘缺失 404。

**FR-37 致谢栏读取**
- 触发者：anon / user；输入：`GET /materials/notice`；处理：读单例行（`SINGLETON_ID='default'`），缺失返 `visible=False` 防御性对象；输出：`NoticeOut`；异常：无。

**FR-38 致谢栏编辑/隐藏（admin-only）**
- 触发者：admin；输入：`PUT /materials/notice {content}`（兼创建/编辑/恢复，恒置 `visible=True`）/ `DELETE /materials/notice`（软隐藏 `visible=False`，保留文本）；处理：`is_admin(user)` 校验，记 `updated_by_sid`；输出：`NoticeOut` / 204；异常：非 admin 403，content 空 422。

### 3.7 导师/院校检索子系统（`routes/schools.py`，只读域，snake_case）

**FR-39 检索元信息**
- 触发者：anon / user；输入：`GET /schools/meta`；处理：读独立只读引擎的 meta 与 sibling `manifest.json`；输出：`SchoolsMeta`；异常：只读库缺失 → 503。

**FR-40 导师分页检索（offset 分页 + FTS5 + 拼音）**
- 触发者：anon / user
- 输入：`GET /schools/list?...`（`ListAdvisorsParams`，**offset 分页 `page/page_size`**——站内第二套分页约定）
- 处理：`services/schools_query.py`——filter/sort/paginate 全下推 SQLite；`_build_where()` OR 合并 FTS5 MATCH + 转义 LIKE + `schools_pinyin.py` 内存拼音索引 id 集；含防注入转义；叠加主库 UGC（`schools_overlay.py` 现为硬编码桩 note_count=0）
- 输出：`PaginatedAdvisors{items, total, page, page_size}`
- 异常：只读库未同步 → 503（不影响 app 启动）

**FR-41 导师详情**
- 触发者：anon / user；输入：`GET /schools/{advisor_id}`；处理：只读引擎单行查询；输出：`AdvisorDetail`；异常：不存在 404，库缺失 503。

**FR-42 手动重载 schools 引擎（admin）**
- 触发者：admin；输入：`POST /admin/schools/reload`；处理：`force_reload()` 换新只读引擎 dispose 旧的；输出：`ReloadResult`；异常：非 admin 404。

### 3.8 CCF 会议追踪子系统（`routes/conferences.py`，只读域）

**FR-43 会议列表**
- 触发者：anon / user；输入：`GET /conferences/list`；处理：`conferences_query.py` 全表 dump（~230 行，前端 `classify.ts`/`filter.ts`/`sort.ts` 派生 tbd/closed/soon/open）；输出：`ConferencesOut`；异常：只读库未就绪 503。

**FR-44 手动重载 conferences 引擎（admin）**
- 触发者：admin；输入：`POST /admin/conferences/reload`；输出：`ReloadResult`；异常：非 admin 404。

**FR-45 手动触发会议爬取（admin）**
- 触发者：admin；输入：`POST /admin/conferences/crawl`；处理：`conferences_crawler.crawl_sync()`——ccfddl allconf/allacc.yml 主源（缩写匹配置信 0.95 无 LLM），DDG+主页抓取+DeepSeek JSON 抽取兜底；按 deadline 派生 crawl_state（unannounced/announced/closed）与 next_check_at（+1d/+5d/None）；临时文件→`os.replace()` 原子换→重写 manifest→`force_reload()`；输出：`CrawlResult`；异常：`DEEPSEEK_API_KEY` 未配置 503；非 admin 404。

> **自动爬取（后台）**：`main.py` lifespan 起 `_conf_crawl_loop`，每 `conf_crawl_interval_hours`（默认 72h，首轮 `full_scan=True`）自动执行 FR-45 的处理逻辑，无人工触发。

### 3.9 学分自查与成绩单导入子系统（`routes/transcript.py` + 前端 credits + 扩展）

**FR-46 成绩单 PDF 中转暂存（未鉴权 stash）**
- 触发者：浏览器扩展 / 用户脚本（外部执行者）
- 输入：`POST /notes/transcript-stash`（multipart PDF，`no-cors`，含从文件名解析的 sid）
- 处理：**故意未鉴权**（jwxt 页无 feiyue JWT，COOP 断 opener）；校验 `%PDF-` 魔术字节 + ≤10MB；存内存 `dict[sid] = (bytes, now+300s)`；`_gc` 清过期
- 输出：200（fire-and-forget）
- 异常：非 PDF/超 10MB → 400「无效或过大的 PDF」；缺 sid → 400「缺少学号」

**FR-47 成绩单取回（鉴权，取即删）**
- 触发者：user；输入：`GET /notes/transcript-stash`（Bearer）；处理：按当前用户 sid pop 内存条目（取走即删）；输出：PDF 流 / 无条目返 204；异常：未鉴权 401。前端 `credits/lib/stash.ts` 每 2.5s 主动轮询、180s 超时。

**FR-48 客户端成绩单解析与学分自查**
- 触发者：user（前端 `/credits`，纯客户端）；输入：取回的 PDF blob；处理：`parseTranscript.ts` 用 pdf.js 定位文本→按 y 聚行→列模型→'通识选修·X模块'正则→`rules.ts` 按模块学分与四史/美育/劳动子规则出通过/不通过报告；输出：学分自查报告（**PDF 全程不落服务器**）；异常：解析失败前端降级提示。

### 3.10 笔记图片/附件上传子系统（`routes/uploads.py`，前缀 `/notes`）

**FR-49 上传笔记内嵌图片**
- 触发者：user；输入：`POST /notes/images`（multipart）；处理：格式白名单 png/jpg/webp/gif、≤8MB、非空、Pillow 解码校验、流式写盘；输出：`UploadedImage{url}`；异常：格式/超 8MB/空/无法解析 → 400。（挂 `/notes/*` 前缀纯为落进 nginx allowlist。）

**FR-50 上传笔记附件文件**
- 触发者：user；输入：`POST /notes/files`（multipart，≤50MB）；处理：`uploads_common.save_upload`（白名单 + DENY_EXTS + 魔术字节 + 分块）；输出：`UploadedFile`；异常：格式/超限 400。

### 3.11 管理后台子系统（`routes/admin.py`，前缀 `/admin`，三级权限）

**FR-51 用户列表（聚合查询）**
- 触发者：admin；输入：`GET /admin/users`；处理：`require_admin`；聚合每用户笔记/草稿/点赞等计数；`effective_role_str` 计算显示角色（admin_sid 恒 superadmin）；输出：`list[AdminUserRow]`；异常：非 admin 404。

**FR-52 平台统计（14 天登录火花线）**
- 触发者：admin；输入：`GET /admin/stats`；处理：用户/笔记/草稿总量 + 14 天上海时区登录火花线；输出：`AdminStats`；异常：非 admin 404。前端 `charts.tsx` 手写 SVG donut/bar 渲染。

**FR-53 创建用户（默认密码 123456）**
- 触发者：admin；输入：`POST /admin/users {sid, name, ...}`；处理：`require_admin`；默认密码 123456（bcrypt）；输出：`AdminUserRow`（201）；异常：sid 已存在 409；非 admin 404。

**FR-54 重置用户密码（分级授权）**
- 触发者：admin / superadmin；输入：`POST /admin/users/{sid}/reset-password`；处理：**不能重置 superadmin 的密码（403）**；**只有 superadmin 能重置 admin 的密码（否则 403）**；重置为默认密码；输出：`ResetPasswordOut`；异常：用户不存在 404；越权 403；非 admin 404。

**FR-55 升降用户角色（superadmin-only 语义）**
- 触发者：superadmin；输入：`POST /admin/users/{sid}/role {role}`；处理：**不能改自己的角色（400）**；**不能修改 superadmin 的角色（403）**；写 `users.role`；输出：`AdminUserRow`；异常：改自身 400；目标为 superadmin 403；用户不存在 404；权限不足由 `require_superadmin`（普通 admin 403 / 非 admin 404）。

**FR-56 登录审计查询**
- 触发者：admin；输入：`GET /admin/login-events`；处理：`require_admin`；读 `login_events`（IP 来自 XFF、UA、时间戳）；输出：`list[LoginEventOut]`；异常：非 admin 404。

### 3.12 系统健康检查

**FR-57 健康探针**
- 触发者：运维 / nginx；输入：`GET /health`；处理：轻量存活检查；输出：200；异常：无。部署脚本以 `curl --noproxy 127.0.0.1 /health` 绕 GFW 代理验证。

---

## 4 核心用例场景

以下用例采用规范用例文字描述，覆盖任务要求的 6 个关键场景。

### UC-1 登录鉴权

- **用例名**：用户登录并建立会话
- **主执行者**：anon（登录后成为 user）
- **前置条件**：该 sid 已存在于 `users` 表；用户持有正确密码
- **触发**：用户在 `/login` 页提交 `LoginForm`
- **主成功场景**：
  1. 前端 `LoginForm`（react-hook-form + zodResolver）经 `endpoints/auth.ts login()` → `client.ts request()` 发 `POST /auth/login {sid, password}`。
  2. `routes/auth.py` 按 sid `SELECT User`。
  3. `services/auth.py verify_password` 用 bcrypt 校验密码通过。
  4. `create_access_token(sid)` 签发 HS256 JWT（`{sub:sid, iat, exp}`，7 天）。
  5. 插入 `LoginEvent`（`deps.client_ip()` 取 XFF 最左 IP + 截断 UA）。
  6. 返回 `LoginOut{user, token}`；前端 `authStore` persist 到 `localStorage['labnotes.auth']`，并 fire-and-forget 预取 `/ai/greetings` 写 3h 缓存。
  7. 此后每请求携带 `Authorization: Bearer <token>`。
- **扩展/异常流**：
  - 3a. 密码错误或 sid 不存在 → 401「学号或密码不正确」（不区分，防枚举），流程终止。
  - 6a. 应用挂载时 `hydrateFromToken()` 调 `GET /auth/me` 复验失败（token 过期/被改）→ 前端落 `anon` 模式。

### UC-2 笔记发布与 AI 润色

- **用例名**：撰写、AI 润色/摘要并发布一篇笔记
- **主执行者**：user；**次要执行者**：DeepSeek
- **前置条件**：用户已登录
- **触发**：用户在 `/write`（`WritePage.tsx`）撰写内容
- **主成功场景**：
  1. 用户编辑内容，经 `hooks/useAutoSave.ts` 存入本地 `draftStore`；同时可经 `endpoints/drafts.ts` 建后端 Draft（FR-12）。
  2. 用户划选 ≥4 字，`MarkdownEditor.tsx` 报选区矩形，`FloatingToolbar` 弹出润色。
  3. 选润色模式 → `useAICompose.ts` 发 `POST /ai/compose`（FR-17）→ `ai_compose.compose()`（DeepSeek，temp 0.3，max 2000）→ `diff.compute_diff_segments` 出 add/del/equal 段。
  4. 前端 `diffEngine.ts computeDiff` 同算法呈现 `DiffView`；用户**整块** accept/reject（无逐段）。
  5. 生成摘要走真流式：`SummaryField.tsx` → `useSummaryCompose.ts` → `composeStream()` 发 `POST /ai/compose/stream`（FR-18，SSE），逐 chunk 实时打字进摘要框。
  6. 发布：`POST /notes/drafts/{id}/publish`（FR-16）——校验 title/content/category，摘要空则 `summarize_or_fallback`；新建 Note、删 Draft、单次 commit。
  7. 返回 `NoteOut`，前端跳转至详情页。
- **扩展/异常流**：
  - 3a. DeepSeek 上游失败 → `/ai/compose` 502/504，前端提示润色失败，用户可重试或手动编辑。
  - 5a. SSE 5s 无首字节 / 非 OK → 前端 3 层兜底（mock 合成 / 回退一次性 / 回退重放），用户仍得到摘要。
  - 6a. title/content/category 任一为空 → 422，发布中止并高亮缺失字段。
  - 6b. 摘要为空且 DeepSeek 不可达 → 降级为首段启发式摘要，**仍成功发布**（AI 永不硬失败）。

### UC-3 教务成绩单一键导入

- **用例名**：从教务系统导入成绩单并做学分自查
- **主执行者**：user；**次要执行者**：浏览器扩展/用户脚本、jwxt 教务系统
- **前置条件**：用户已在浏览器登录 `jwxt-443.webvpn.xju.edu.cn`（真 session cookie）；已安装扩展或用户脚本；已登录 feiyue
- **触发**：用户在教务成绩页点击扩展注入的导入按钮
- **主成功场景**：
  1. `extension/content.js`（`world:MAIN`，守 `window.top!==window.self` 与 `__feiyueImporter` 防重入）`POST ?method=topdf`（credentials:'include'）→ 从 `j.result` 解析 `<sid>_<ts>.pdf` 路径得 sid（**不读 HttpOnly cookie**）。
  2. `GET ?method=download&fileSavePath=...` 取 PDF blob。
  3. `no-cors` multipart POST 到 `https://feiyue.selab.top/notes/transcript-stash`（FR-46）→ 后端验 `%PDF-` + ≤10MB，存内存 `dict[sid]=(bytes, now+300s)`。
  4. 用户切到 feiyue `/credits` 页；`credits/lib/stash.ts` 经 visibilitychange/focus + 每 2.5s 主动轮询 `GET /notes/transcript-stash`（Bearer，FR-47）→ 后端按本人 sid pop 即删。
  5. 同一 `parseTranscript.ts` + `rules.ts` 客户端 pdf.js 解析出学分报告（FR-48，**PDF 全程不落服务器**）。
- **扩展/异常流**：
  - 1a. sid 匹配 `/guest/i` → 视为未登录教务，扩展提示先登录 jwxt。
  - 3a. PDF 超 10MB 或非 PDF → 400，中转失败，用户重试。
  - 4a. 180s 内未取到 stash → 前端超时提示，引导用户重新点击导入。
- **设计动因**：feiyue 与 jwxt 跨源，CAS 的 COOP 在 WebVPN 登录重定向后切断 `window.opener`、postMessage 不可靠；故绕道未鉴权按 sid、5 分钟 TTL、内存 stash，并挂在既有 `/notes` nginx location 内免改反代。

### UC-4 资料上传与在线预览

- **用例名**：上传课程资料并在线预览
- **主执行者**：user（资源 owner）
- **前置条件**：用户已登录并拥有目标资源（或先创建）
- **触发**：用户在 `/materials` 资源详情点"上传"
- **主成功场景**：
  1. 用户经 `POST /materials/resources` 建自有资源（FR-27），或选已有本人资源。
  2. `UploadDialog` 经 `useMaterials` 发 `POST /materials/resources/{rid}/files`（FR-31，XHR 带上传进度）。
  3. 后端 `ensure_owner` → `save_upload`（50MB、1MiB 分块、`sniff_magic()` 魔术字节交叉校验、DENY_EXTS 挡 .svg/.html/.htm/.xml、服务端定 MIME）流到 `uploads/materials/<sid>/<rid>/`；`unique_upload_name` 冲突自动 `(n)`。
  4. 追加 `MaterialFile` 行含 `sort_order`；返回重建的文件树。
  5. 前端 `PreviewPane.tsx` 按扩展懒加载 viewer（`PdfViewer/DocxViewer/ExcelViewer/ImageViewer/CodeViewer`，各自裸 `fetch(resolveAssetUrl(url))`），`ErrorBoundary` 降级下载卡。
  6. 需下载时 `useDownload.ts`（fetch + ReadableStream 保同源 blob + 真进度）触发 `GET /materials/files/{id}/download`（FR-36）。
- **扩展/异常流**：
  - 2a. 非 owner 上传 → 403「」，UI 阻止。
  - 3a. 文件超 50MB / 命中 DENY_EXTS / 魔术字节不符 → `save_upload` 抛错，前端 toast 失败。
  - 5a. 预览器解码失败 → ErrorBoundary 降级为下载卡。
  - 拖拽排序：`lib/tree.ts projectDrop` 乐观改缓存（镜像后端 `reorder_file`）→ `POST /materials/files/reorder`（FR-34）→ onError 回滚。

### UC-5 会议截稿追踪

- **用例名**：追踪 CCF 会议截稿并自动刷新数据
- **主执行者**：user（浏览）/ admin（手动爬）/ 系统后台（自动爬）；**次要执行者**：ccfddl、DeepSeek、DuckDuckGo
- **前置条件**：conferences.sqlite 已就绪（否则 503）
- **主成功场景（浏览）**：
  1. 用户访问 `/conferences`；前端发 `GET /conferences/list`（FR-43）→ 全表 dump ~230 行。
  2. 前端 `classify.ts` 按运行时今天派生每会议状态（tbd/closed/soon/open），`filter.ts`/`sort.ts` 支持表/时间线视图筛排。
- **主成功场景（自动刷新）**：
  3. `main.py` lifespan 的 `_conf_crawl_loop` 每 72h（首轮 full_scan）触发 `crawl_sync()`。
  4. 取 ccfddl `allconf.yml`+`allacc.yml`（2 GET）；选 due 行（`crawl_state!='closed' AND next_check_at<=now`）。
  5. 逐会议：ccfddl 缩写匹配优先（置信 0.95 无 LLM）；否则 `ddgs` 搜 + httpx 抓主页 + stdlib 剥 script/style + DeepSeek JSON 抽取（temp 0），会间 1s 礼貌 sleep。
  6. 按 deadline 派生 crawl_state 与 next_check_at（+1d/+5d/None），`COALESCE` UPDATE 只覆盖抽到字段。
  7. commit → `os.replace()` 原子换 → 重写 manifest（sha256+计数）→ `conf_holder.force_reload()`；`conferences_engine.py` 侦测 mtime 换新只读引擎，下个请求即见新数据。
- **扩展/异常流**：
  - 1a. 只读库缺失/未同步 → 503「conferences data not ready」，app 不崩，其它子系统正常。
  - 手动触发（admin）`POST /admin/conferences/crawl`（FR-45）：若 `DEEPSEEK_API_KEY` 未配置 → 503。
  - 5a. 单会议抽取失败 → 跳过该会议不阻断整轮（尽力而为）。

### UC-6 管理员权限操作

- **用例名**：管理员管理用户与角色
- **主执行者**：admin / superadmin
- **前置条件**：执行者 `effective_role` 为 admin 或 superadmin（`settings.admin_sid` 账号恒 superadmin）
- **触发**：管理员经 URL 直达 `/admin`（无导航入口）
- **主成功场景**：
  1. 前端 `AdminPage`（URL-only，mirror 404-for-non-admin）加载，发 `GET /admin/users`（FR-51）与 `GET /admin/stats`（FR-52）。
  2. `require_admin` 放行；后端聚合用户计数与 14 天登录火花线；前端 `charts.tsx` 手写 SVG 渲染。
  3. admin 可 `POST /admin/users` 建用户（默认密码 123456，FR-53）、`GET /admin/login-events` 查审计（FR-56）。
  4. superadmin 可 `POST /admin/users/{sid}/role` 升降角色（FR-55）、`POST /admin/users/{sid}/reset-password` 重置密码（FR-54）。
- **扩展/异常流**：
  - 1a. 非 admin 访问任一 `/admin/*` → `require_admin` 返 **404**（非 401/403），使整个后台面**不可发现**；前端亦 mirror 404。
  - 4a. 普通 admin 尝试 superadmin-only 操作（改角色/重置 admin 密码）→ `require_superadmin` 返 **403**（他已知面存在）。
  - 4b. 试图改自己的角色 → 400「不能修改自己的角色」。
  - 4c. 试图改/重置 superadmin → 403（不能操作超级管理员）。
  - 3a. 建用户时 sid 已存在 → 409。

---

## 5 领域模型 / 分析类

领域模型依据 `backend/app/db/models.py`（主库唯一 schema 源）反推。schools / conferences 属只读域，其表结构不在 ORM 内，仅以只读实体列出。

### 5.1 主库实体类

| 实体类 | 关键属性 | 说明 |
|---|---|---|
| **User** | `sid`(PK,String(11),学号)、`name`、`nickname`、`preferred_name`(称呼,NULL 运行时派生)、`avatar`、`avatar_thumb`(160px)、`bio`、`wechat`、`phone`、`email`、`password_hash`、`role`('user'/'admin'/'superadmin')、`created_at` | 自然主键 sid 是全库枢纽；`admin_sid` 账号运行时恒 superadmin，无视 role 列 |
| **Note** | `id`(PK,uuid)、`title`、`summary`、`content`、`cover`、`category`(7 分类字符串,index)、`tags`(StringList)、`author_sid`(FK→users,CASCADE)、`created_at`(index)、`read_minutes` | 无 create 端点；仅经 Draft 发布产生 |
| **Draft** | `id`(PK,uuid)、`owner_sid`(FK→users,CASCADE,index)、`title`、`summary`、`content`、`category`(nullable)、`tags`、`updated_at`(onupdate,index) | 独立 id，**不 FK 关联最终 Note**；发布时新建 Note、删 Draft |
| **Like** | `note_id`(FK→notes,CASCADE,复合 PK)、`user_sid`(FK→users,CASCADE,复合 PK)、`created_at` | 复合主键 + 冗余 `uq_likes_note_user` 唯一约束（功能重复无害）；幂等 upsert |
| **Comment** | `id`(PK,uuid)、`note_id`(FK→notes,CASCADE,index)、`author_sid`(FK→users,CASCADE)、`content`、`anchor_text`(nullable)、`anchor_offset_start/end`(nullable)、`created_at`(index) | 锚点引用（MVP 仅用 anchor_text）；keyset 分页按 `(created_at,id)` |
| **LoginEvent** | `id`(PK,**唯一自增整型**)、`user_sid`(FK→users,CASCADE,index)、`ip`(String(45))、`user_agent`、`created_at`(index) | 管理员审计；IP 来自 XFF/X-Real-IP |
| **MaterialResource** | `id`(PK,uuid hex)、`title`、`description`、`tag`(New/Hot/Rec,nullable)、`owner_sid`(FK→users,CASCADE,index)、`sort_order`、`deleted`(软删,index)、`created_at`、`updated_at` | 共享资料库顶层容器；软删 + 物理 unlink |
| **MaterialFile** | `id`(PK,uuid hex)、`resource_id`(FK→material_resources,CASCADE,index)、`parent_id`(**自引用**FK→material_files,CASCADE,nullable,index)、`name`、`is_folder`、`ext`、`mime`、`size_bytes`、`url`、`storage_path`、`sort_order`、`deleted`(index)、`created_at` | 自引用递归树；同级重名唯一性**在服务层强制**（非 DB 约束，因 SQLite 视 NULL parent 两两不等） |
| **MaterialNotice** | `id`(PK,固定 `SINGLETON_ID='default'`)、`content`、`visible`、`updated_by_sid`(**无 FK 纯审计**)、`updated_at` | 单例致谢栏；软隐藏可恢复 |

### 5.2 只读域实体（不在 ORM，schema 从 raw SQL 反推）

| 只读实体 | 来源 | 关键（推断）属性 | 说明 |
|---|---|---|---|
| **Advisor（导师）** | schools.sqlite（supervisor-claw 外部导出） | advisor/appointment/school/研究方向等（4000+ 行） | offset 分页；FTS5 MATCH + LIKE + 拼音索引检索；`schools_overlay.py` UGC 叠加现为硬编码桩 |
| **Conference（会议）** | conferences.sqlite（ccfddl/DeepSeek 爬虫再生） | 会议缩写、deadline、crawl_state(unannounced/announced/closed)、next_check_at（~230 行） | 全表 dump 前端过滤；爬虫 `sqlite3` 直写、只读引擎读 |

### 5.3 实体关系与多重性（ER 逻辑 / 文字类图）

```
                     ┌─────────────────────────── User (sid PK) ───────────────────────────┐
                     │ 1                1                1               1              1     │ 1
                     │ author           owner            author          user_sid       owner │ updated_by
                     ▼ *                ▼ *              ▼ *             ▼ *            ▼ *    ▼ (无FK,审计)
                   Note              Draft            Comment          LoginEvent   Material   MaterialNotice
              (id PK, author_sid) (id PK,owner_sid) (id PK,note_id,  (id 自增PK,   Resource     (单例 'default')
                     │ 1               ✗(不关联Note)  author_sid)     user_sid)    (id PK,owner)
        ┌────────────┼────────────┐                     ▲ *                          │ 1
        │ 1          │ 1          │ 1                    │                            ▼ *
        ▼ *          ▼ *          └── note_id 1 ─────────┘ (Comment.note_id→Note)   MaterialFile
      Like        Comment                                                        (id PK, resource_id,
   (note_id+                                                                      parent_id 自引用)
    user_sid                        Like.note_id 1 ──▶ Note (CASCADE)              │ 1(parent)
    复合PK)                                                                        ▼ *(children)
                                                                                自身递归树
```

多重性与规则要点：
- User **1..\*** Note（`author_sid`）；User **1..\*** Draft（`owner_sid`）；User **1..\*** Comment / Like / LoginEvent / MaterialResource。
- Note **1..\*** Like、Note **1..\*** Comment；删 Note → DB 级 CASCADE 删其 Like/Comment（`passive_deletes=True`）。
- Like 为**多对多连接实体**（Note × User），复合主键保证每用户对每笔记至多一赞。
- Draft 与 Note **无外键关联**（发布是"新建 + 删除"，非状态迁移）。
- MaterialResource **1..\*** MaterialFile；MaterialFile 经 `parent_id` **自引用**构成递归树（根 parent_id=NULL）。
- MaterialNotice 为**单例聚合根**（固定 PK），`updated_by_sid` 是无外键的纯审计字段。
- 全库删除策略统一：DB 级 `ondelete='CASCADE'` + ORM `passive_deletes=True` + `lazy='raise'`（禁隐式懒加载，树端点须 flat SELECT 手搭响应）。

---

## 6 非功能需求

### 6.1 性能需求（NFR-P）

- **NFR-P-01（笔记全量载入排序的适用边界）**：`services/notes.py list_notes()` 采用"全量载入后 Python 排序/tag 过滤/cursor 分页"策略，**明确标注仅适合数千量级**。需求：在笔记规模 ≤ 数千（当前生产 ~85 篇）时列表响应可接受；一旦逼近万级须重构为 SQL 侧分页/索引下推。此为**已知规模边界约束**，非缺陷。
- **NFR-P-02（会议全表 dump）**：`/conferences/list` 全表返回 ~230 行由前端过滤/分类，规模受控，可接受。
- **NFR-P-03（导师检索下推）**：`/schools/list`（4000+ 行）**必须**将 filter/sort/paginate 下推 SQLite（FTS5 + LIKE + 拼音索引），不得全量载入。
- **NFR-P-04（上传流式）**：上传须 1MiB 分块流式写盘、超限前中止，避免大文件占满内存（`uploads_common.save_upload`）。
- **NFR-P-05（AI 缓存）**：问候语进程内缓存 3h、每用户最多 `min(6,2n)` 次 DeepSeek 调用，控制付费上游开销。
- **NFR-P-06（前端首屏）**：全路由 lazy + Suspense；TanStack Query staleTime 30s、关窗口聚焦刷新；问候首屏用 localStorage 3h 缓存同步渲染、后台补拉。

### 6.2 安全需求（NFR-S）

- **NFR-S-01（认证）**：密码以 bcrypt 存储（`password_hash`）；会话用 HS256 JWT（7 天，`{sub,iat,exp}`）。JWT 无服务端吊销，登出仅前端清 token。
- **NFR-S-02（授权分级）**：`get_current_user`(401)/`get_optional_user`(静默 None)/`require_admin`(**非 admin 404 不可发现**)/`require_superadmin`(普通 admin 403、非 admin 404)。`settings.admin_sid` 恒 superadmin，防迁移出错锁死运维。
- **NFR-S-03（上传防存储型 XSS，两层）**：①应用层 `uploads_common.DENY_EXTS` 挡 .svg/.html/.htm/.xml；②`HardenedStaticFiles` 对每个 `/uploads` 响应加 `X-Content-Type-Options: nosniff`；③更强的 doc 类 `Content-Disposition: attachment` 刻意推到 prod nginx（免破头像/PDF 内联预览，**仓库内不可验证**，见 A-03）。
- **NFR-S-04（上传内容校验）**：`sniff_magic()` 对 PDF/OOXML(zipfile)/OLE2/PNG/GIF/JPEG/WEBP 做魔术字节交叉校验，防改名可执行文件；服务端定 MIME 不信客户端。
- **NFR-S-05（未鉴权中转的权衡）**：transcript-stash **故意未鉴权**（jwxt 页无 feiyue JWT + COOP 断 opener），以按 sid、内存、5 分钟 TTL、取即删、10MB 上限、PDF 魔术字节、sid 从文件名解析（不读 HttpOnly cookie）、`/guest/i` 视未登录等多重收窄降低风险。此为受控的**有意缺口**。
- **NFR-S-06（注入防护）**：`schools_query._build_where()` 对 LIKE 通配转义、FTS5 MATCH 处理，含防注入转义。
- **NFR-S-07（IP 可信来源）**：`deps.client_ip()` 仅信任自家 nginx 的 `X-Forwarded-For` 最左 / `X-Real-IP`。
- **NFR-S-08（已知开放缺口）**：`/ai/compose(/stream)` 无鉴权即可调付费 DeepSeek 且无速率限制（A-07）；管理员建用户默认密码 123456 须首次登录后即改。

### 6.3 可靠性与可用性需求（NFR-R）

- **NFR-R-01（AI 永不硬失败降级）**：`/ai/greetings` 任何异常静默降级本地时段模板（**永不 503**）；发布/编辑摘要 DeepSeek 失败降级首段启发式（`summarize_or_fallback` 永不抛）；`/ai/compose/stream` 异常进 `{error}` SSE 事件不破 HTTP 状态。仅 `/ai/compose(/stream)` 处上游失败以 502/504 上抛（前端仍有 3 层兜底）。
- **NFR-R-02（只读库缺失不崩全局）**：schools/conferences 只读引擎在文件缺失时抛 `*DataMissing` → 路由译成 503，**不影响 app 启动与其它子系统**。
- **NFR-R-03（原子换库，读者不见半成品）**：只读库写者遵循"临时文件 → `os.replace()` 原子换 → 重写 manifest"，读者经轮询 mtime 热重载切换新引擎并 dispose 旧的。
- **NFR-R-04（幂等操作）**：点赞/取消赞、评论删除等对缺失状态仍返 204，保证客户端重试安全。
- **NFR-R-05（外键完整性）**：每 SQLite 连接强制 `PRAGMA foreign_keys=ON`，保证 CASCADE 生效。
- **NFR-R-06（测试可离线）**：`deepseek_dry_run` 全局 kill-switch 令测试零联网（echo/假 chunk）。

### 6.4 兼容性与可维护性需求（NFR-M）

- **NFR-M-01（wire 一致性）**：全站 camelCase（`CamelModel`，`populate_by_name` 兼收 snake_case），唯一例外 `/schools/*` snake_case；时间恒带尾 `Z`。前端每 API 边界 Zod `.parse()` 兜住契约漂移。
- **NFR-M-02（双库方言）**：`StringList` 在 Postgres 用 `ARRAY(Text)`、SQLite 用 JSON；7 分类用字符串列非原生枚举——保 SQLite 测试廉价、Postgres 可迁移。
- **NFR-M-03（迁移线性）**：Alembic 迁移链严格线性 0001→0009，async env.py 强制用 `settings.database_url` 覆盖 ini。
- **NFR-M-04（前后端逻辑镜像）**：`lib/tree.ts`↔`reorder_file`、`isValidGreeting`/`familiarName`、diff 算法均两端镜像；修改一侧须同步另一侧（否则拖拽/问候/diff 行为漂移）。
- **NFR-M-05（IME 兼容）**：CodeMirror 6 须应用本地 patch 修中文 IME，`ime-patch.test.ts` 读 dist 断言 patch 已生效。
- **NFR-M-06（浏览器兼容）**：SPA 依赖现代浏览器；扩展为 Chromium MV3。

---

## 7 外部接口需求

本章规定系统与外部实体的接口。所有外部依赖须满足"降级不崩、缺失可继续"的可靠性原则（NFR-R-01/R-02）。

### 7.1 DeepSeek 大模型接口（AI 润色/摘要/问候/会议抽取）

- **协议/客户端**：openai SDK 指向 DeepSeek（模型 `deepseek-v4-flash`），凭证经 `settings` 注入。
- **用途**：`/ai/compose`（temp 0.3，max 2000，非流式）、`/ai/compose/stream`（stream，max 300）、`/ai/greetings`（`min(6,2n)` 次）、`conferences_crawler` JSON 抽取（temp 0）。
- **失败策略**：问候/发布摘要降级本地兜底永不硬失败；`/ai/compose(/stream)` 上游失败 502/504（前端 3 层兜底）；`DEEPSEEK_API_KEY` 未配置时手动爬取返 503。
- **kill-switch**：`deepseek_dry_run` 全局关断，测试零联网。
- **约束**：`/ai/compose` 无鉴权、无速率限制（已知缺口）。

### 7.2 open-meteo 天气接口（问候语上下文）

- **用途**：`services/greeting.py` 取当地天气，**只传定性描述、剥离温度/坐标**给模型（防复述硬数据）。
- **失败策略**：取不到天气则省略该维度，问候仍生成（降级）。

### 7.3 ccfddl.com 接口（CCF 会议 CFP 主源）

- **用途**：`conferences_crawler.crawl_sync()` 取 `allconf.yml` + `allacc.yml`（2 GET），按会议缩写匹配（置信 0.95，无 LLM）。
- **失败策略**：主源匹配失败时逐会议走 7.4 兜底；单会议失败跳过不阻断整轮。

### 7.4 DuckDuckGo 搜索接口（会议信息兜底）

- **客户端**：`ddgs`。
- **用途**：ccfddl 未命中时搜会议主页 → httpx 抓取 → stdlib 剥 script/style → DeepSeek JSON 抽取；会间 1s 礼貌 sleep。
- **失败策略**：抽取失败该会议保持原值（`COALESCE` UPDATE 只覆盖抽到字段）。

### 7.5 新疆大学教务系统 jwxt 接口（成绩单来源）

- **地址**：`jwxt-443.webvpn.xju.edu.cn`（WebVPN）。
- **交互方**：浏览器扩展/用户脚本（非后端直连），用**学生自身 session cookie**（`credentials:'include'`），系统从不见教务密码。
- **调用**：`POST ?method=topdf`（生成 PDF，从返回文件名 `<sid>_<ts>.pdf` 解析 sid）→ `GET ?method=download`（取 PDF blob）。
- **约束**：扩展守 `window.top!==window.self`（jwxt 为 frameset）与 `__feiyueImporter` 防重入；sid 匹配 `/guest/i` 视为未登录。

### 7.6 浏览器扩展 / 用户脚本接口（教务→feiyue 中转）

- **形态**：MV3 content script（`extension/content.js`，`world:MAIN`）+ 托管用户脚本 `/feiyue-importer.user.js`（v1.6.2，**不在本仓库**，须与 content.js 逻辑锁步，A-05）+ bookmarklet。
- **对系统接口**：`no-cors` multipart `POST /notes/transcript-stash`（fire-and-forget，FR-46）。
- **注入范围**：仅 `jwxt-443.webvpn.xju.edu.cn`（按钮）与 feiyue/winbeau.top（自报）。

### 7.7 Hugging Face 私有 Dataset 接口（备份与分发）

- **用途**：`scripts/sync/`（labnotes-sync）注册表驱动——主库 `VACUUM INTO` 快照、uploads 确定性 tar、`.env` age 加密推 `state/` 命名空间；schools/conferences 独立镜像 `schools/`/`conferences/` 只读参考命名空间（各 `delete_patterns` 限前缀互不清除）。
- **调度**：cron `*/30`（`cron_install.sh`，烘焙 PATH 与代理环境变量）。
- **防脚约束**：deploy `--pull-data` **绝不拉 `state/`**（否则回滚生产 DB）。

### 7.8 浏览器客户端接口（SPA / 静态资源）

- **API**：Bearer JWT、camelCase JSON、cursor/offset 双分页制；baseURL 默认 `''`（同源直穿），`VITE_API_BASE` 仅跨源 dev/staging 需要。
- **静态**：`/uploads` 经 `HardenedStaticFiles`（nosniff）；`resolveAssetUrl()` 把绝对上传 URL 重写到当前 API origin 规避跨域。
- **反代前缀（生产 nginx，待确认 A-02）**：auth/notes/drafts/interactions/ai/health/uploads/admin/materials/schools/conferences。

---

*（本 SRS 为逆向工程产物，所有需求项以代码为唯一事实来源；与历史文档冲突处一律以代码与《00-架构逆向总览》基线为准。）*
