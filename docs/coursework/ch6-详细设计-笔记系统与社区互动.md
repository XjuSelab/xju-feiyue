# 六、系统详细设计（增量模块：笔记系统与社区互动）

> 负责模块：笔记系统（写作 + 展示）+ 社区互动（评论、表态、收藏、举报、拉黑、等级）+ 笔记合集
> 撰写者：赵文彪
> 本章为笔记系统与社区互动增量模块的详细设计，以第 5 章概要设计为基础，给出模块的程序结构、核心类/函数设计说明、界面设计与实现结果。

## 1．引言

本章对笔记系统与社区互动模块进行详细设计。设计遵循第 5 章确立的"前后端分离、分层单体后端"架构，以后端 FastAPI（routes → services → db 三层单向依赖）和前端 React 18 SPA 为主要技术栈。

## 2．程序系统的结构

本模块的程序结构如图 6-1 所示，包括后端 6 个路由模块、若干服务/查询模块与前端 5 个主要页面组件。

〔此处插入图 6-1 —— 源文件 figures/ch6-fig1-class-diagram-note-community.drawio，app.diagrams.net 编辑后导出插入〕

图 6-1 程序结构图（类图）

**表 6-1 模块和代码对应关系**

| 模块定义 | 模块说明 | 负责人 |
|---|---|---|
| `routes/notes.py` | 笔记列表查询（游标分页/分类/标签/搜索/排序）、详情、编辑与删除 | 陶语涵 |
| `routes/drafts.py` | 草稿创建、更新与发布（唯一建笔记路径） | 陶语涵 |
| `routes/interactions.py` | 笔记点赞/点踩、收藏、评论（含锚点/楼中楼/图片）、评论赞/踩；举报与拉黑尚未实现接口 | 陶语涵 |
| `routes/ai.py` | AI 选段润色（一次性）、流式摘要生成 | 陶语涵 |
| `routes/collections.py` | 合集 CRUD、合集内笔记管理、合集上下文数据查询 | 陶语涵 |
| `routes/auth.py` | 登录/注册/个人信息、每日签到、经验流水、收藏列表 | 石建华 |
| `services/notes.py` | 笔记列表查询、详情、编辑、删除；分类/标签/搜索/排序逻辑 | 陶语涵 |
| `services/comments.py` | 评论列表查询：按 created_at/id 倒序游标分页返回平铺 CommentOut 列表 | 陶语涵 |
| `services/ai_compose.py` | AI 润色、流式摘要生成（含降级兜底） | 陶语涵 |
| `routes/interactions.py` | 点赞/点踩互斥、收藏幂等、评论创建与评论表态；举报和拉黑当前未实现 | 陶语涵 |
| `routes/collections.py` | 合集 CRUD、笔记加入/移出校验（归属/草稿/权限） | 陶语涵 |
| `routes/auth.py` | 签到幂等校验、经验发放、等级计算与经验流水查询 | 石建华 |
| `NoteDetailPage.tsx` | 笔记详情展示、点赞按钮、评论显示模式切换、锚点评论高亮与评论抽屉；点踩、收藏、合集入口/展示尚未接入前端 | 陶语涵 |
| `WritePage.tsx` | 草稿编辑与自动保存、AI 润色工具条与差异对照、AI 摘要流式展示、发布 | 陶语涵 |
| `BrowsePage.tsx` | 信息流浏览、分类/标签/搜索过滤、排序切换、游标分页 | 陶语涵 |
| `ProfilePage.tsx` | 个人中心：已发布笔记与草稿两个 Tab；收藏、合集、签到入口和经验等级尚未接入该页面 | 陶语涵 |
| `AdminPage.tsx` | 管理后台：用户、登录、资料库等管理能力；举报工单队列尚未接入 | 石建华 |

## 3．设计说明

### 3.1 评论相关模块

评论相关代码分布在 `routes/interactions.py` 与 `services/comments.py` 中。路由层负责评论创建、删除、评论表态及鉴权；`services/comments.py` 负责评论列表的游标分页查询。后端 `CommentIn/CommentOut` 已支持锚点引用、二层回复标识、图片 URL 列表与评论表态字段，但前端当前主要使用锚点评论、平铺列表与删除能力。

#### 3.1.1 评论创建函数 create_comment

| 项目 | 内容 |
|---|---|
| 函数名 | `routes/interactions.py::create_comment` |
| 设计人 | 陶语涵 |
| 参数 | 参数名称 | 数据类型 |
| | `db` | `AsyncSession` |
| | `note_id` | `str` |
| | `author_sid` | `str` |
| | `content` | `str` |
| | `parent_id` | `str \| None` |
| | `reply_to_sid` | `str \| None` |
| | `images` | `list[str]` |
| | `anchor_text` | `str \| None` |
| | `anchor_offset_start` | `int \| None` |
| | `anchor_offset_end` | `int \| None` |
| 返回值 | 名称 | 数据类型 |
| | `CommentOut` | `CommentOut` |
| 功能描述 | 创建一条笔记评论或楼内回复 |
| 算法描述 | 1. 校验笔记存在；2. 若 parent_id 非空，校验父评论存在、属于同一笔记且为顶层评论（parent_id is NULL），否则拒绝三层嵌套；3. 由 Pydantic 校验 content 长度、images 列表长度 ≤ 9、锚点起止偏移成对且 end > start；4. 若显式传入 reply_to_sid，则校验目标用户存在；若回复未传 reply_to_sid，则默认指向父评论作者；5. 生成 UUID，构造 Comment 对象并写入 note_id / author_sid / parent_id / reply_to_sid / images / anchor_*；6. INSERT 入库；7. 当前代码未触发 AI 审查分类；8. 返回 CommentOut |
| 输入 | note_id: 目标笔记 ID；author_sid: 当前登录用户学号；content: 评论文本；parent_id: 父评论 ID（顶层为 None）；reply_to_sid: @ 目标用户学号；images: 图片 URL 列表；anchor_*: 锚点信息 |
| 输出 | 新创建的评论对象（含 id、created_at） |
| 存储分配 | 1 条 comments 表记录 |
| 测试要点 | 1. 未登录报 401；2. 笔记不存在报 404；3. 三层嵌套报 422；4. 正常创建顶层评论和二层回复返回 201；5. reply_to_sid 与 images 字段在返回体中正确落地 |

#### 3.1.2 评论列表查询函数 list_comments

| 项目 | 内容 |
|---|---|
| 函数名 | `list_comments` |
| 设计人 | 陶语涵 |
| 参数 | 参数名称 | 数据类型 |
| | `db` | `AsyncSession` |
| | `note_id` | `str` |
| | `cursor` | `str \| None` |
| | `limit` | `int` |
| 返回值 | 名称 | 数据类型 |
| | 评论列表 + nextCursor | `PaginatedComments` |
| 功能描述 | 按时间倒序返回某篇笔记下所有 visible 评论；当前返回平铺列表，parent_id/reply_to_sid 字段保留二层回复关系 |
| 算法描述 | 1. 查询 comments WHERE note_id = ? AND status = 'visible' ORDER BY created_at DESC, id DESC LIMIT limit + 1；2. 若 cursor 非空，先读取游标评论作为锚点，追加 created_at/id 小于锚点的 keyset 条件；3. over-fetch 一条用于判断是否存在下一页；4. 预加载 author 与 reply_to；5. 返回 rows[:limit] 与 nextCursor |
| 输入 | note_id: 目标笔记 ID；cursor: 分页游标（上一页最后一条评论的 ID）；limit: 每页条数（默认 20，最大 100） |
| 输出 | 平铺 CommentOut 列表与下一游标 |
| 存储分配 | 无额外存储 |
| 测试要点 | 1. 空笔记返回空列表；2. 分页游标正确位移；3. 按 created_at/id 倒序返回；4. 被隐藏（pending）评论不返回 |

### 3.2 routes/interactions 模块

互动路由负责笔记表态（赞/踩）的互斥逻辑、收藏幂等、评论创建与评论表态。当前代码尚未实现举报创建与拉黑管理接口。

#### 3.2.1 笔记点赞/点踩互斥函数 toggle_interaction

| 项目 | 内容 |
|---|---|
| 函数名 | `toggle_note_like` / `toggle_note_dislike` |
| 设计人 | 陶语涵 |
| 参数 | 参数名称 | 数据类型 |
| | `db` | `AsyncSession` |
| | `note_id` | `str` |
| | `user_sid` | `str` |
| | `action` | `"add" \| "remove"` |
| 返回值 | 名称 | 数据类型 |
| | 无响应体 | `204 No Content` |
| 功能描述 | 添加/取消笔记点赞或点踩，自动维护赞踩互斥关系；当前实现不因点赞/点踩发放或扣回作者经验 |
| 算法描述 | 赞：1. 检查 dislike 表——若存在点踩记录，先 DELETE；2. 若尚未点赞，则 INSERT like；3. 若已点赞（重复 add），幂等返回，不报错。取消赞时 DELETE like。点踩逻辑对称：先移除 like，再按需 INSERT note_dislikes；取消踩时 DELETE note_dislikes |
| 输入 | note_id: 笔记ID；user_sid: 用户学号；action: 添加/取消 |
| 输出 | HTTP 204；列表/详情中的计数与用户状态由 `NoteOut` 查询接口重新计算 |
| 存储分配 | 点赞时最多 1 条 likes 记录，点踩时最多 1 条 note_dislikes 记录；当前不写入 xp_events |
| 测试要点 | 1. 点赞自动取消点踩；2. 点踩自动取消点赞；3. 重复操作幂等；4. 取消时对应记录删除；5. 前端不公开展示踩计数 |

### 3.3 routes/collections 模块

合集服务负责合集 CRUD 与笔记归属管理。

#### 3.3.1 向合集加入笔记 add_to_collection

| 项目 | 内容 |
|---|---|
| 函数名 | `routes/collections.py::add_collection_entry` |
| 设计人 | 陶语涵 |
| 参数 | 参数名称 | 数据类型 |
| | `db` | `AsyncSession` |
| | `collection_id` | `str` |
| | `note_id` | `str` |
| | `user_sid` | `str` |
| 返回值 | 名称 | 数据类型 |
| | `CollectionDetailOut` | `CollectionDetailOut` |
| 功能描述 | 将一篇已发布笔记加入合集，执行三重校验 |
| 算法描述 | 1. 校验合集存在；2. 校验当前用户为合集创建者；3. 校验笔记存在且 status = 'visible'；4. 校验笔记作者为当前用户；5. 若笔记已属于其他合集则返回 409；6. 若尚未加入当前合集则 INSERT collection_entry，若已在当前合集且传入 sort_order 则更新排序；7. 返回合集详情 |
| 输入 | collection_id: 合集 ID；note_id: 笔记 ID；user_sid: 当前用户 |
| 输出 | 更新后的合集详情（含 entries） |
| 存储分配 | 1 条 collection_entries 记录 |
| 测试要点 | 1. 非本人笔记报 403；2. 非 visible 笔记加入报 422；3. 笔记已属于其他合集报 409；4. 正常加入返回 200 并包含 entryCount |

#### 3.3.2 合集上下文查询 get_note_collection_context

| 项目 | 内容 |
|---|---|
| 函数名 | `routes/collections.py::get_note_collection_context` |
| 设计人 | 陶语涵 |
| 参数 | note_id: 笔记 ID；db: 数据库会话 |
| 返回值 | 合集基本信息 + 同合集笔记列表 + 当前笔记位置 |
| 功能描述 | 查询笔记所属合集及同合集全部笔记；后端接口已实现，前端详情页侧栏尚未接入 |
| 算法描述 | 1. 在 collection_entries 中查找 note_id → 获取 collection_id；2. 若无归属返回 200/null；3. 查询该合集下全部 visible entry（含 note 与 author 联查），按 sort_order、created_at 排序；4. 组装返回数据，标记当前笔记位置 |
| 测试要点 | 1. 未归属合集返回 null；2. 同合集笔记按序排列；3. 当前笔记高亮标记正确 |

### 3.4 routes/auth 签到与经验模块

认证路由中的签到与经验接口负责每日签到幂等校验、经验发放、等级计算和经验流水查询。

#### 3.4.1 每日签到 checkin

| 项目 | 内容 |
|---|---|
| 函数名 | `daily_checkin` |
| 设计人 | 石建华 |
| 参数 | `db`, `user_sid`, `today`（date） |
| 返回值 | 签到结果（含经验值、连续签到天数） |
| 功能描述 | 执行每日签到，幂等保护 |
| 算法描述 | 1. 检查 (user_sid, today) 是否已存在 —— 若存在返回"今日已签到"（幂等），gained_exp=0；2. 首次签到 INSERT check_ins；3. 固定追加经验 +5；4. INSERT xp_events(source_type=daily_checkin, delta=5)；5. UPDATE users SET exp += 5，并按阈值更新 level；6. 查询连续签到天数并返回 |
| 输入 | user_sid: 当前用户；today: 当前日期 |
| 输出 | {checkedInDate, streak, gainedExp, exp, level, alreadyCheckedIn} |
| 测试要点 | 1. 同一天重复签到幂等不重复加经验；2. 首次签到写入 check_ins 与 xp_events；3. /auth/me/xp-events 可查询经验流水 |

### 3.5 前端核心组件设计

#### 3.5.1 评论组件 CommentSection

评论组件负责笔记详情页评论区的渲染与交互，当前前端支持：
- 平铺评论列表（按键集游标分页，每页 20 条）
- 普通评论创建与锚点引用评论创建
- 原文 mark 与评论项之间的双向 hover/click 高亮
- 评论删除（评论作者 / 笔记作者可见删除按钮）
- inline / drawer / off 三种评论显示模式

后端 CommentOut 已返回 parentId、replyTo、images、likes/dislikes 等扩展字段，但前端 schema 与组件当前未展示楼中楼树、评论图片和评论赞/踩按钮。状态管理使用 TanStack Query，评论创建与删除使用 optimistic 更新。

#### 3.5.2 合集上下文接口与前端接入状态

后端 `GET /notes/{noteId}/collection` 已返回合集标题、描述、同合集全部可见笔记列表、当前笔记位置，并在无归属时返回 `200 null`。

前端当前未实现独立合集侧栏组件、合集管理 Tab 或详情页合集入口；这些属于下一步前端接入工作。

## 4．界面设计

本模块的主要界面如下（按功能域分组）：

### 写作域

**图 6-x 写作页界面**（/write 路由）：上半部分为 Markdown 编辑器（标题/分类/标签/正文输入区域），支持草稿自动保存指示器；正文选区浮动 AI 润色工具条（模式选择 + diff 差异对照面板）；右侧为摘要生成区（流式展示 + AI 生成按钮）；底部为发布按钮。

### 浏览互动域

**图 6-x 信息流浏览页界面**（/browse 路由）：左侧为分类/标签筛选侧栏；顶部为搜索栏与排序切换；中部为笔记卡片网格（2 列布局，封面图 + 标题 + 摘要 + 作者 + 互动计数）；底部为游标分页"加载更多"。

**图 6-x 笔记详情页界面**（/note/:id 路由）：正文区（Markdown 渲染，支持代码高亮）；操作栏包含评论显示模式切换、点赞按钮和评论数；评论区支持锚点引用高亮、平铺列表、创建与删除；点踩、收藏、合集入口、评论图片展示、评论赞/踩、举报/拉黑菜单尚未接入前端。

### 合集域

**图 6-x 个人中心合集管理界面**（规划项）：后端已有合集 CRUD 和条目管理接口，当前 `/me` 页面尚未接入合集 Tab。

### 治理域

**图 6-x 举报工单管理界面**（规划项）：当前管理后台未接入举报 Tab，后续实现时应提供工单列表、目标内容快照、AI 审查结论、置信度与人工裁决按钮。

### 成长域

**图 6-x 签到弹窗界面**：首屏弹窗；展示当前经验+5、连续签到天数；一键签到按钮。

## 5. 实现结果

### 5.1 后端实现

#### 评论创建（含楼中楼校验）

核心逻辑（`routes/interactions.py::create_comment`）：
```
1. 校验笔记存在且 visible
2. 若 parent_id 非空：
   - 查父评论，不存在 → 404
   - 父评论的 parent_id 非空 → 422（禁止三层嵌套）
3. 校验 images ≤ 9 张
4. INSERT comment（含 parent_id / reply_to_sid / images / anchor_*）
5. 当前不触发 AI 审查
6. 返回 CommentOut
```

#### 点赞/点踩互斥

核心逻辑（`routes/interactions.py`）：
```
add_like:
  1. DELETE FROM note_dislikes WHERE (note_id, user_sid)  -- 先取消点踩
  2. INSERT INTO likes ... ON CONFLICT DO NOTHING         -- 幂等
  3. 不写入 xp_events

remove_like:
  1. DELETE FROM likes WHERE (note_id, user_sid)
  2. 不写入 xp_events
  3. 不扣回经验
```

#### 合集归属校验

核心逻辑（`routes/collections.py::add_collection_entry`）：
```
1. 校验合集存在且 owner = current_user
2. 校验笔记存在且 status = 'visible' 且 author_sid = current_user
3. 校验 note_id 不在 collection_entries 中（唯一约束）
4. INSERT collection_entry
```

### 5.2 前端实现

#### 评论区平铺渲染

核心逻辑（`CommentSection.tsx`）：
```
1. useInfiniteQuery: GET /notes/{id}/comments?limit=20&cursor=...
2. pages.flatMap(p => p.items) 形成 flatComments
3. 对每条评论渲染作者、时间、锚点引用、正文和可见删除按钮
4. 点击原文 mark 或评论引用时互相滚动并高亮
5. 点击"加载更多" → fetchNextPage
```

#### 合集前端接入状态

后端接口（`routes/collections.py::get_note_collection_context`）：
```
1. GET /notes/{noteId}/collection
2. 若无 collection_entries 记录 → 200/null
3. 若有归属 → 返回 collection、entries、currentIndex
4. 前端合集侧栏组件/合集管理 Tab 尚未实现
```

### 5.3 测试覆盖

后端已实现以下测试文件（pytest + 内存 SQLite）：

| 测试文件 | 覆盖范围 | 关键断言 |
|---|---|---|
| `test_comments.py` | 评论列表、创建、锚点、删除权限、分页、删除级联 | 未登录 401；分页 nextCursor；评论作者/笔记作者可删除 |
| `test_note_reactions.py` | 点赞互斥、点踩互斥、赞踩互斥 | like → auto-remove dislike；重复 like 幂等；取消时计数递减 |
| `test_comment_replies.py` | 楼中楼创建、三层嵌套拒绝、评论赞踩切换 | parent_id 约束校验；comment_reactions kind 互斥更新 |
| `test_collections.py` | 合集 CRUD、加入笔记三重校验、唯一归属 | 非本人、草稿、重复归属均报错 |
| `test_checkin.py` | 签到幂等、经验发放、连续天数 | 同日重复签到幂等；首次签到写入 +5 经验 |

## 6．核心顺序图

以下给出本模块最核心的 3 条交互顺序图。

### 6.1 草稿发布与 AI 摘要降级顺序图

（图 6-2）用户点击发布 → 前端校验标题/正文/分类 → 调用 POST /notes/drafts/{id}/publish → 后端检验草稿 → 摘要为空时调用 AI → AI 超时/失败取首段截断 → 事务建笔记删草稿 → 返回新笔记 → 前端跳转详情页。

〔此处插入图 6-2 —— 源文件 figures/ch6-fig2-seq-publish-with-summary-fallback.drawio〕

图 6-2 草稿发布与 AI 摘要降级顺序图

### 6.2 举报—AI 审查—人工裁决规划顺序图

（图 6-3）该链路为后续治理能力设计，当前代码尚未实现。规划流程为：用户点击举报 → 前端弹出举报面板选择类型 → POST /reports → 后端创建工单 → 返回"已受理" → 异步送 AI 审查 → AI 返回 {label, confidence, reason} → 高置信自动隐藏目标内容 → 管理员打开举报队列 → 查看工单 + AI 结论 → 裁决删除/恢复 → 更新工单状态。

〔此处插入图 6-3 —— 源文件 figures/ch6-fig6-seq-report-review.drawio〕

图 6-3 举报—AI 审查—人工裁决规划顺序图

### 6.3 合集上下文查询顺序图

（图 6-4）后端已实现合集上下文查询：前端或调试客户端请求 GET /notes/{id}/collection → 后端查询 collection_entries 并 JOIN notes/author → 排序组装 → 返回合集信息 + 笔记列表 + currentIndex；若无归属则返回 200/null。详情页侧栏展示与导航仍为前端待接入项。

〔此处插入图 6-4 —— 源文件 figures/ch6-fig10-seq-collection-sidebar.drawio〕

图 6-4 合集上下文查询顺序图

## 7．核心状态图

### 7.1 笔记生命周期状态图

（图 6-5）当前已实现的笔记状态迁移为：草稿（Draft）→ 发布（visible）→ 作者删除。pending 隐藏态、AI 高置信标记与管理员裁决为治理扩展规划。

〔此处插入图 6-5 —— 源文件 figures/ch6-fig7-state-note-lifecycle.drawio〕

图 6-5 笔记生命周期状态图

### 7.2 评论状态图

（图 6-6）当前已实现的评论状态迁移为：创建（visible）→ 评论作者或笔记作者删除。pending 隐藏态、AI 高置信标记与管理员裁决为治理扩展规划。

〔此处插入图 6-6 —— 源文件 figures/ch6-fig-comment-state.drawio〕

图 6-6 评论状态图

### 7.3 举报工单状态图

（图 6-7）举报工单状态迁移为规划项：pending（待处理）→ ai_flagged（AI 已标记）→ resolved（已裁决删除/隐藏） / dismissed（驳回恢复）。

〔此处插入图 6-7 —— 源文件 figures/ch6-fig-report-state.drawio〕

图 6-7 举报工单状态图

## 8．核心活动图

### 8.1 笔记信息流筛选/排序/分页活动图

（图 6-8）用户选择分类 → 输入关键词 → 选择标签 → 切换排序 → 调用 GET /notes → 后端应用层过滤 → 游标分页 → 返回列表 → 前端渲染卡片 → 滚动触发"加载更多" → 更新游标 → 追加列表。

〔此处插入图 6-8 —— 源文件 figures/ch6-fig8-activity-browse-filter-sort-pagination.drawio〕

图 6-8 信息流筛选/排序/分页活动图

### 8.2 AI 流式摘要三层降级活动图

（图 6-9）触发生成 → SSE 流式接收 → 首个 chunk 到达即展示 → 逐字写入 → 完成。分支：Stream 失败 → 回退 one-shot → 成功则回填；失败 → mock 伪流式 → 生成静态文本。

〔此处插入图 6-9 —— 源文件 figures/ch6-fig9-activity-ai-streaming-fallback.drawio〕

图 6-9 AI 流式摘要三层降级活动图
