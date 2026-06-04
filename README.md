# 新疆大学飞跃手册

> 新疆大学学生社群驱动的飞跃笔记站——学长姐把踩过的坑、走通的路留给下一届。

**线上地址：** <https://winbeau.top> · 镜像：<https://feiyue.selab.top>

---

## 项目简介

**飞跃手册**是一个面向新疆大学在校生与毕业生的知识沉淀平台。学长姐在此记录科研、课程、升学、竞赛的第一手经验，后来者无需重复走弯路。

平台以 **Markdown 长文笔记**为核心，辅以：
- 课程资料共享库（PDF / Word / Excel 在线预览）
- CCF 会议截稿追踪（230+ 场次，72h 自动更新）
- 高校与导师信息库（C9 联盟及更多院校）
- 学分统计助手（教务成绩单一键导入）
- DeepSeek 驱动的个性化欢迎语与笔记润色

截至 2026-06-04，平台已有 **108 名注册用户**，积累 **85 篇笔记**、**8 类资料（55 个文件）**、**41 个点赞**、**2 条评论**，累计登录事件 79 次（去重活跃用户 25 名）。

---

## 功能特性

### 笔记系统

七大分类，全面覆盖新大生活的各个维度：

| 分类 | 内容方向 |
|------|----------|
| **科研** | 论文精读、方向选择、baseline 复现、导师选择 |
| **课程** | 离散数学、编译原理、408、数据库实验等复习笔记 |
| **推荐** | 读过的书 / 论文 / 教程，附一句为什么值得读 |
| **竞赛** | 数模、ICPC、挑战杯，从报名到答辩 |
| **Kaggle** | 入门路线、notebook 组织、上分策略 |
| **工具** | 服务器、Docker、Git、VS Code Remote |
| **生活** | 食堂、出国申请、心理健康、租房攻略 |

笔记支持 Markdown + KaTeX 公式 + 围栏代码块 + GFM；编辑器内置 AI 润色（DeepSeek Streaming，字词级差异对比，支持分块采纳/拒绝）；草稿自动保存（Zustand persist）；发布后支持评论（选段引用 + 双向跳转）与点赞。

### 学分统计 / 教务一键导入

`/credits` 页：

- **纯前端 pdf.js 解析**教务成绩单 PDF，自动检查通识选修各模块是否达标
- **浏览器扩展 / 脚本猫一键导入**：在教务系统页面同源抓取成绩单，通过 `transcript-stash` 中转端点（5 分钟 TTL）回传飞跃后端，`/credits` 页轮询取件后即删
- 安装引导向导（实时探测脚本管理器、全程动画）
- 支持手动上传本地 PDF 作兜底

### 资料库 `/materials`

- 课程资料文件树，支持 PDF / Word / Excel 在线预览（pdfjs-dist + docx-preview + @js-preview/excel）
- 拖拽重排（dnd-kit，乐观更新）、PDF 逐页懒加载与缩放平移
- XHR 真实进度条（含 100% → 服务端处理中状态）、上传重名自动改名
- 课程类型角标（专业课 / 通识课 / 实验课），超级管理员权限控制

### 高校与导师信息 `/schools`

- YAML 数据热加载，C9 联盟分组 Tab + 其余高校 Tab
- 导师列表支持拼音 / 汉字模糊搜索、详情抽屉展示
- Admin 一键热 reload，无需重启服务

### CCF 会议截稿 `/conferences`

- 覆盖 230+ CCF 会议，前端支持领域分组、级别筛选、时间线视图（只显示今日及之后截稿）、录取率统计
- 后端 `_conf_crawl_loop`：每 72h 以 ccfddl.com YAML 为主数据源，DuckDuckGo 联网搜索 + DeepSeek 知识兜底，全量扫描并原子写入 SQLite
- Admin 可触发手动 reload / crawl

### 首页智能欢迎语

- 已登录用户看到个性化问候：`preferred_name` 字段 + 外置 `greetings.json`（44 条）+ 上海时区随机时段兜底
- DeepSeek-3 缓存 3h 轮换生成热门词条（`GET /ai/greetings`），降低延迟与 API 消耗

### 其他功能

- **用户系统**：学号登录、头像上传（服务端 160px 缩略图）、个人资料页、我的笔记（已发布 + 草稿分标签）
- **互动**：点赞（幂等 POST / DELETE）、评论（游标翻页）、评论作者或笔记作者可删评
- **文件安全**：上传拦截 `.svg/.html/.htm/.xml`，`HardenedStaticFiles` 统一注入 `X-Content-Type-Options: nosniff`
- **管理后台**：登录事件审计、数据热 reload、会议爬取触发

---

## 技术栈

### 前端

| 层级 | 选型 |
|------|------|
| 语言 | TypeScript 5.6（strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes） |
| 框架 | React 18.3 + React DOM 18.3 |
| 构建 | Vite 5.4 + @vitejs/plugin-react |
| 路由 | React Router DOM 6.28（createBrowserRouter + lazy + Suspense） |
| 样式 | Tailwind CSS 3.4（锁 v3）+ PostCSS + tailwindcss-animate，tokens.css 单一色源 |
| UI | shadcn（17 个 Radix UI primitive）+ lucide-react |
| 状态 | TanStack Query v5（服务端数据）+ Zustand v5 persist（auth / draft） |
| 表单 | react-hook-form 7 + @hookform/resolvers + Zod 3 |
| Markdown | react-markdown 10 + remark-gfm + remark-math + rehype-highlight + rehype-katex + rehype-raw |
| 编辑器 | @uiw/react-codemirror 4 + @codemirror/lang-markdown + @codemirror/theme-one-dark |
| AI diff | diff-match-patch（字级 + cleanupSemantic） |
| PDF | pdfjs-dist 5.7 |
| 文件预览 | docx-preview + @js-preview/excel + pdfjs-dist |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities |
| Toast | sonner 2 |
| 测试 | Vitest 2 + @testing-library/react + jsdom，Playwright E2E |
| 代码质量 | ESLint 9 + typescript-eslint + Prettier + Husky 9 + lint-staged + commitlint（conventional） |

### 后端

| 层级 | 选型 |
|------|------|
| 语言 | Python 3.11+ |
| 框架 | FastAPI 0.115 + Uvicorn（standard） |
| ORM / 迁移 | SQLAlchemy 2.0（asyncio）+ Alembic + aiosqlite（SQLite，dev / prod 当前均用）；asyncpg 作备用 Postgres 驱动随包但未启用 |
| 鉴权 | python-jose（HS256 JWT，7 天）+ bcrypt |
| AI | openai SDK ≥ 1.50（指向 DeepSeek base_url） |
| 数据验证 | Pydantic 2.9 + pydantic-settings |
| 工具 | Pillow（图片处理）+ pypinyin（拼音排序）+ ddgs（DuckDuckGo，供会议爬取）+ PyYAML + httpx + python-multipart |
| 包管理 | pnpm（前端）+ uv（后端） |

---

## 架构概览

```
Aurash/
├── frontend/          # React 18 SPA（Vite 构建）
│   └── src/
│       ├── api/           # client.ts（唯一 fetch 点）+ endpoints/ + mock/
│       ├── features/      # 10 个业务模块（auth/browse/comments/conferences/credits/editor/home/materials/schools/settings）
│       ├── components/    # ui → common → layout（严格单向依赖）
│       └── styles/        # tokens.css 单一色源 → globals.css → tailwind.config.ts
├── backend/           # FastAPI + SQLAlchemy（asyncio）
│   └── app/
│       ├── routes/        # notes / drafts / auth / materials / schools / conferences / transcript …
│       ├── db/models.py   # User / Note / Draft / Like / Comment / LoginEvent / MaterialResource / MaterialFile
│       └── settings.py    # pydantic-settings，cors_origin_list property 解析多域名
├── extension/         # Chrome 扩展（content.js + manifest.json，教务成绩单抓取）
├── content/notes/     # Markdown 笔记真源（62 篇，seed 灌库；线上另有站内直接发布的笔记）
├── scripts/           # 数据导入 / 批量用户工具
└── docs/              # 架构 / 设计决策 / 各功能 plan 文档
```

**数据流铁律**：组件 → TanStack Query hooks → `endpoints/*.ts`（Zod parse）→ `client.ts`（唯一 fetch 点），组件禁止直接 import mock 数据；切换真后端只需设 `VITE_API_BASE`，业务代码零改动。

**性能预算**：首屏 JS gzip < 200 KB（main bundle ≈ 144 KB）；路由全部 React.lazy + Suspense；WritePage chunk 因 CodeMirror + diff-match-patch + katex 达 gzip 464 KB，已文档化为已知偏差。

**数据持久化**：私有库 `xju-feiyue-data` 分 `state/`（DB + uploads + secrets）与 `schools/` 两个命名空间，`make data-pull` 一键恢复。

---

## 开发历程亮点

### 起源：Claude 5 轮设计 + 同日工程化（2026-05-09）

项目始于 2026-05-09 一次完整的 AI 辅助全栈设计实验：

**第 0 步**（commit `1e05990`）：Claude 直接生成 6036 行可在浏览器运行的 React-via-CDN 静态设计稿，含 4 个完整 HTML 页面、一套 Notion 风格设计系统（Source Serif 4 / Inter Tight / JetBrains Mono 三套字体栈、7 个分类色、CSS token 全集），以及 774 行的完整 LCS 字符级 diff 引擎（`ai-drawer.jsx`）。这份设计稿是后续所有工程化的「图纸」。

**5 轮规格文档**（commit `86375c5`，Claude Opus 4.7，450 行；规格落地后已归档到代码与 INTEGRATION_REPORT，原 `docs/round*.md` 文件随之删除）定义了从 CDN 原型迁移为真实工程的完整路线：

| 轮次 | 代号 | 核心交付 |
|------|------|----------|
| Round 1 | infra-agent | Vite 5 + React 18 + TS strict 三件套 + shadcn/ui + ESLint flat + Playwright 骨架 |
| Round 2 | design-system-agent | tokens.css CSS 变量迁移、tailwind.config 映射、17 个 shadcn 组件、CategoryBadge / CodeBlock / Markdown |
| Round 3 | layout-agent | React Router v6 lazy + zustand authStore（三态）+ RequireAccess guard + Header + MegaMenu（Radix Popover）+ API client（mock/prod split）+ Round 4 contracts 冻结 |
| Round 4 | 4 个 subagent 并行（12 分钟内落地） | home / browse / editor / login 四页，含 useInfiniteQuery 游标分页、CodeMirror 6 + diff-match-patch、AIDrawer + FloatingToolbar + DiffView |
| Round 5 | qa-agent | 72 个单测、grep 一致性审计、Husky 接父 repo hookpath |

5 轮全在同一天内完成（06:24 → 09:04 UTC-7），commit 时间戳间隔约 3 小时。

### 后续成长（约 4 周，全程累计 182 次提交）

| 阶段 | 时间 | 里程碑 |
|------|------|--------|
| Phase 2 | 2026-05-09 下午 | FastAPI 后端 + SQLAlchemy + bcrypt 鉴权 + Alembic 迁移 + 42 个单测 |
| Phase 3 | 2026-05-09 ~ 10 | 44 篇 Notion 笔记 + 17 篇课程笔记 JSON-first 批量导入，品牌由 LabNotes 切换为「飞跃手册」 |
| Phase 4 | 2026-05-11 | 用户系统（头像 / 昵称 / IP 审计），sonner toast 严格模式兼容调试 |
| Phase 5 | 2026-05-12 | 编辑器功能密集期：评论（选段引用 + 双向高亮）、AI 流式摘要、图片三通道上传、点赞 |
| Phase 6 | 2026-05-20 ~ 22 | 高校信息页 `/schools`，YAML 热加载 + TypeScript strict 三件套兼容 |
| Phase 7 | 2026-05-26 ~ 27 | CCF 会议页 `/conferences` + DeepSeek 截稿爬虫（230 场次，72h 周期，原子写入） |
| Phase 8 | 2026-05-31 | 资料页 `/materials`：文件树 + dnd-kit 拖拽 + 三类在线预览 + XHR 进度条 |
| Phase 9 | 2026-05-31 | 首页欢迎语 v2：外置 greetings.json + DeepSeek-3 缓存 3h 轮换 |
| Phase 10 | 2026-06-03 ~ 04 | 学分统计 `/credits`：pdf.js 解析 + 浏览器扩展三轮方案演进（书签 → 后端中转 → 用户脚本） |

---

## 贡献者

| 贡献者 | 角色 | Commit 量级 |
|--------|------|-------------|
| [winbeau](https://github.com/winbeau) | 项目负责人，产品设计、功能验证（Playwright 截图 / 浏览器实测）、内容导入、部署与运维（huawei2 VPS + nginx） | 182 commits |
| Claude Opus 4.7 | AI 结对——完整设计稿、5 轮规格文档、每轮实现代码（round1-5）、后续各功能 PR 级别实现 | 132 co-authored commits |
| Claude Opus 4.8 (1M context) | AI 结对——后期功能实现（credits / materials / 欢迎语 v2 等） | 26 co-authored commits |
| Claude Opus 4.7 (1M context) | AI 结对——长上下文大范围重构任务 | 9 co-authored commits |

**结对方式**：Claude 负责完整实现代码；winbeau 在浏览器 / Playwright 中验证，发现视觉交互偏差后给精准指令让 Claude 修——典型 human-in-the-loop 结对模式。

---

## 规模数据

> 数字来源：2026-06-04 prod 数据库真实统计，未经修饰。

| 指标 | 数值 |
|------|------|
| 注册用户 | 108 |
| 笔记 | 85 篇 |
| 资料文件 | 55 个（共 8 类） |
| 点赞 | 41 |
| 评论 | 2 |
| 累计登录事件 | 79 次（去重活跃用户 25 名） |
| 总 commit 数 | 182 |
| 开发周期 | 约 26 天（2026-05-09 至今） |
| CCF 会议覆盖 | 230+ 场次 |
| 首屏 JS（gzip） | ≈ 144 KB |

---

## 部署

生产环境使用 huawei2 VPS（华为云），nginx 静态服 `frontend/dist` + 反代 FastAPI 后端：

```
winbeau.top        # 主域名，nginx 直接服 frontend/dist
feiyue.selab.top   # 镜像，同一 VPS 多域名配置
aurash-backend.service  # systemd 管理后端进程（uvicorn）
```

数据持久化通过私有 HuggingFace Dataset `winbeau/xju-feiyue-data` 同步（`make data-pull` 一键恢复）。

代码双库维护：
- `XjuSelab/xju-feiyue`（团队规范库）
- `winbeau/Aurash`（部署源）

---

## 本地开发

### 前提

- Node.js 20+，pnpm 9+
- Python 3.11+，[uv](https://docs.astral.sh/uv/)

### 前端

```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:5173
```

dev 模式下前端走内置 mock dispatcher（无需启动后端），切换真后端只需：

```bash
VITE_API_BASE=http://localhost:8000 pnpm dev
```

### 后端

```bash
cd backend
uv sync
uv run alembic upgrade head   # 初始化 SQLite（dev）
uv run uvicorn app.main:app --reload
```

### 代码规范

项目使用 Husky + lint-staged + commitlint（conventional commits）。commit message 需符合 `feat/fix/chore/docs/refactor/test/style` 前缀规范。

---

## 如何贡献 / 加笔记

**加笔记（推荐）：**

笔记真源是 `content/notes/*.md`，frontmatter 字段与流程参见 [`CONTRIBUTING.md`](CONTRIBUTING.md)：

```bash
# fork 本库后，在 content/notes/ 下新建 <slug>.md
# 顶部写 YAML frontmatter（参考已有任意一篇）
# 编辑正文后提 PR
```

也可联系 [@winbeau](https://github.com/winbeau) 申请站内账号，直接在网站发布草稿。

**代码贡献：**

1. Fork → 新建功能分支（`feat/xxx`）
2. `pnpm dev` 验证，`pnpm test` 通过
3. 提 PR，描述改动动机与测试方式

**数据 / 内容类问题：** 开 Issue，标注 `content` 标签。

---

## 致谢

- [孙海洋](https://github.com/SunSeaLucky)（[xju-course-wiki](https://github.com/SunSeaLucky/xju-course-wiki)）——课程笔记源材料
- 每一位愿意把踩过的坑、走过的路写下来留给下一届的作者
- [Anthropic Claude](https://claude.ai)——本项目从设计稿到每一个功能模块都是与 Claude 结对完成的

---

## License

默认仅供站点运营方使用；对外引用 / 二次分发请先开 Issue 商榷。
