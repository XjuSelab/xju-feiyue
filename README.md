<div align="center">

# 飞跃手册

### 新疆大学 · 学生社群驱动的飞跃笔记站

<sub>Feiyue Handbook · Xinjiang University</sub>

> 踏前人之路，追未尽之远。<br/>
> _Tread the paths of those before, chase the distance yet unreached._

[![飞跃手册](https://img.shields.io/badge/飞跃手册-feiyue.selab.top-0F7B6C?style=flat-square&logo=cloudflare&logoColor=white)](https://feiyue.selab.top)
[![发展历程](https://img.shields.io/badge/发展历程-Pages-9065B0?style=flat-square&logo=githubpages&logoColor=white)](https://xjuselab.github.io/xju-feiyue/)
[![License](https://img.shields.io/badge/License-MIT-37352F?style=flat-square&logo=git&logoColor=white)](./LICENSE)
![Stars](https://img.shields.io/github/stars/XjuSelab/xju-feiyue?style=flat-square&color=D9730D&logo=github&logoColor=white&label=Stars)

</div>

---

### 项目简介 · About

**飞跃手册**是一个面向新疆大学在校生与毕业生的知识沉淀平台。学长姐在此记录科研、课程、升学、竞赛的第一手经验，后来者无需重复走弯路。

平台以 **Markdown 长文笔记**为核心，围绕它生长出：

- 社区互动 —— 楼中楼评论、点赞点踩、收藏与笔记合集、举报工单（AI 预审）
- 班级空间 `/class` —— 点名、小组、组内文件与甘特图、分组任务、班委管理
- 课程资料共享库 —— PDF / Word / Excel 在线预览、拖拽整理
- CCF 会议截稿追踪 —— 230+ 场次，72h 自动更新
- 高校与导师信息库 —— C9 联盟及更多院校
- 学分统计助手 —— 教务成绩单一键导入
- DeepSeek 驱动的个性化欢迎语与笔记润色

---

### 功能特性 · Features

#### 笔记系统

七大分类，覆盖新大生活的各个维度：

| 分类 | 内容方向 |
| :-- | :-- |
| **科研** | 论文精读、方向选择、baseline 复现、导师选择 |
| **课程** | 离散数学、编译原理、408、数据库实验等复习笔记 |
| **推荐** | 读过的书 / 论文 / 教程，附一句为什么值得读 |
| **竞赛** | 数模、ICPC、挑战杯，从报名到答辩 |
| **Kaggle** | 入门路线、notebook 组织、上分策略 |
| **工具** | 服务器、Docker、Git、VS Code Remote |
| **生活** | 食堂、出国申请、心理健康、租房攻略 |

笔记支持 Markdown + KaTeX 公式 + 围栏代码块 + GFM；编辑器内置 AI 润色（DeepSeek Streaming，字词级差异对比，分块采纳/拒绝）；草稿自动保存；发布后支持评论（选段引用 + 双向跳转）与全套社区互动。

#### 社区互动

- **评论**：楼中楼两层回复（`回复 @某人`）、评论配图、点赞点踩表态；作者与被评作者可删评
- **点踩 / 收藏**：点赞点踩互斥；收藏在个人主页「收藏」tab 汇总
- **笔记合集**：作者把自己的笔记按主题结集、拖拽排序；读者在文末看到「收录于合集 X · 第 i/N 篇」和上一篇/下一篇导航
- **治理**：举报（7 类理由）进入管理端工单队列，DeepSeek 后台预审打标；处理动作有下架/删除/驳回；被隐藏内容读写双向封锁；支持拉黑作者
- **防滥用**：交互/评论/举报三档滑动窗口限流（单机内存实现，可换 Redis）

#### 班级空间 `/class`

AppShell 之外的独立页面（仅 URL 直达）：课堂点名、小组管理与审批、组内空间（文件共享 + 甘特图）、分组任务、班委职务体系（班长/团支书等，权限仅限本班）、班级分组信息导出（对齐学校 docx 版式）。

#### 学分统计 `/credits`

- **纯前端 pdf.js 解析**教务成绩单 PDF，自动检查通识选修各模块是否达标
- **浏览器扩展 / 脚本猫一键导入**：教务系统页面同源抓取，经 `transcript-stash` 中转端点（5 分钟 TTL）回传，轮询取件后即删
- 安装引导向导（实时探测脚本管理器），手动上传 PDF 兜底

#### 资料库 `/materials`

- 课程资料文件树，PDF / Word / Excel 三类在线预览（pdfjs-dist + docx-preview + @js-preview/excel）
- 拖拽重排（dnd-kit，乐观更新）、PDF 逐页懒加载与缩放平移
- XHR 真实进度条、上传重名自动改名、课程类型角标与管理员权限控制

#### 高校信息 `/schools` 与 CCF 会议 `/conferences`

- 高校 / 导师库：YAML 热加载、C9 分组 Tab、拼音汉字模糊搜索、详情抽屉
- CCF 会议：230+ 场次、领域分组、级别筛选、时间线视图；后端 72h 周期爬虫（ccfddl.com YAML 主源 + DuckDuckGo + DeepSeek 兜底，原子写入）

#### 平台基座

- **用户系统**：学号登录（HS256 JWT）、头像上传（服务端 160px 缩略图）、个人主页五 tab（已发布/草稿/收藏/合集/已拉黑）
- **三级角色**：user / admin / superadmin；隐藏管理后台 `/admin` 四 tab（概览 / 用户 / 资料 / 工单），对非管理员整面 404 不泄露存在
- **首页欢迎语**：`preferred_name` + 44 条外置语料 + 上海时区时段兜底；DeepSeek 缓存 3h 轮换
- **文件安全**：上传拦截 `.svg/.html/.htm/.xml`，`HardenedStaticFiles` 注入 `X-Content-Type-Options: nosniff`

---

### 技术栈 · Tech Stack

<div align="center">

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/nginx-009639?style=flat-square&logo=nginx&logoColor=white)

</div>

#### 前端

| 层级 | 选型 |
| :-- | :-- |
| 语言 | TypeScript 5.6（strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes） |
| 框架 | React 18.3 + Vite 5.4 |
| 路由 | React Router DOM 6.28（createBrowserRouter + lazy + Suspense） |
| 样式 | Tailwind CSS 3.4（锁 v3）+ tokens.css 单一色源 |
| UI | shadcn（17 个 Radix UI primitive）+ lucide-react |
| 状态 | TanStack Query v5（服务端数据）+ Zustand v5 persist（auth / draft） |
| 表单 | react-hook-form 7 + Zod 3 |
| Markdown | react-markdown 10 + remark-gfm/math + rehype-highlight/katex/raw |
| 编辑器 | CodeMirror 6（@uiw/react-codemirror）+ diff-match-patch（AI diff） |
| 文件 | pdfjs-dist 5.7 + docx-preview + @js-preview/excel + dnd-kit |
| 测试 | Vitest 2 + Testing Library + jsdom，Playwright E2E |
| 质量 | ESLint 9 + Prettier + Husky + lint-staged + commitlint（conventional） |

#### 后端

| 层级 | 选型 |
| :-- | :-- |
| 语言 | Python 3.11+ |
| 框架 | FastAPI 0.115 + Uvicorn |
| ORM / 迁移 | SQLAlchemy 2.0（asyncio）+ Alembic + aiosqlite（SQLite，dev / prod 均用） |
| 鉴权 | python-jose（HS256 JWT，7 天）+ bcrypt |
| AI | openai SDK（指向 DeepSeek base_url）：润色 / 欢迎语 / 会议爬虫 / 举报预审 |
| 数据验证 | Pydantic 2.9 + pydantic-settings |
| 工具 | Pillow + pypinyin + ddgs + PyYAML + httpx |
| 包管理 | pnpm（前端）+ uv（后端，`uv.lock` 锁定） |

---

### 架构概览 · Architecture

```
xju-feiyue/
├── frontend/          # React 18 SPA（Vite 构建）
│   └── src/
│       ├── api/           # client.ts（唯一 fetch 点）+ endpoints/ + mock/
│       ├── features/      # 业务模块（notes/comments/collections/reports/growth/class/admin/…）
│       ├── components/    # ui → common → layout（严格单向依赖）
│       └── styles/        # tokens.css 单一色源 → globals.css → tailwind.config.ts
├── backend/           # FastAPI + SQLAlchemy（asyncio）
│   └── app/
│       ├── routes/        # notes / auth / interactions / collections / reports / blocks / classes / groups / admin …
│       ├── services/      # 业务逻辑层（moderation / classes / notes / …）
│       ├── db/models.py   # User / Note / Comment / Favorite / Collection / Report / StudentClass / Group …
│       └── ratelimit.py   # 滑动窗口限流（interaction / comment / report 三桶）
├── extension/         # Chrome 扩展（教务成绩单抓取）
├── content/notes/     # Markdown 笔记真源（seed 灌库）
├── site/              # GitHub Pages 发展历程页（自包含单文件）
├── scripts/           # 数据导入 / 批量用户工具
└── docs/              # 架构 / 设计决策 / 课程设计文档
```

**数据流铁律**：组件 → TanStack Query hooks → `endpoints/*.ts`（Zod parse）→ `client.ts`（唯一 fetch 点）；切换真后端只需设 `VITE_API_BASE`，业务代码零改动。

**性能预算**：首屏 JS gzip < 200 KB（main bundle ≈ 144 KB）；路由全部 React.lazy + Suspense。

---

### 开发历程 · Milestones

项目始于 2026-05-09 一次完整的 AI 辅助全栈设计实验：Claude 先生成 6036 行可直接在浏览器运行的 React-via-CDN 设计稿（含完整 Notion 风设计系统与 774 行 LCS diff 引擎），再以 5 轮规格文档（infra → design-system → layout → 4 页并行 → QA）在同一天内完成工程化落地。此后以「Claude 写实现、人在浏览器验收」的结对模式持续迭代：

| 阶段 | 时间 | 里程碑 |
| :-- | :-- | :-- |
| Phase 1 | 2026-05-09 | 设计稿 + 5 轮规格 + 前端工程化（同日完成） |
| Phase 2 | 2026-05-09 | FastAPI 后端 + SQLAlchemy + 鉴权 + Alembic |
| Phase 3 | 2026-05-09 ~ 10 | 61 篇笔记批量导入，品牌定名「飞跃手册」 |
| Phase 4 | 2026-05-11 | 用户系统（头像 / 昵称 / IP 审计） |
| Phase 5 | 2026-05-12 | 评论（选段引用 + 双向高亮）、AI 流式摘要、点赞 |
| Phase 6 | 2026-05-20 ~ 22 | 高校信息页 `/schools`（YAML 热加载） |
| Phase 7 | 2026-05-26 ~ 27 | CCF 会议页 `/conferences` + DeepSeek 截稿爬虫 |
| Phase 8 | 2026-05-31 | 资料库 `/materials`（文件树 + 拖拽 + 三类预览） |
| Phase 9 | 2026-05-31 | 首页欢迎语 v2（外置语料 + 缓存轮换） |
| Phase 10 | 2026-06-03 ~ 04 | 学分统计 `/credits` + 教务一键导入 |
| Phase 11 | 2026-07-04 ~ 07 | 班级空间 `/class`（点名 / 小组 / 甘特 / 分组任务 / 班委） |
| Phase 12 | 2026-07-09 | 社区互动（楼中楼 / 点踩收藏 / 合集 / 举报工单 + AI 预审）——首批同学 PR 合入 |

完整叙事见 [发展历程页](https://xjuselab.github.io/xju-feiyue/)。

---

### 贡献者 · Contributors

| 贡献者 | 角色 | Commit |
| :-- | :-- | :--: |
| [winbeau](https://github.com/winbeau) | 项目负责人：产品设计、功能验证、内容导入、部署运维 | 236 |
| [tyhlt114514-stack](https://github.com/tyhlt114514-stack) | 社区互动 / 合集功能首版（PR #1）+ 课程设计文档 | 44 |
| [wyiting235-creator](https://github.com/wyiting235-creator) | 课程设计 drawio 图集（PR #2） | 1 |
| Wenbiao Zhao | 课程设计文档 | 1 |

**AI 结对**（co-authored commits）：Claude Opus 4.7 ×132 · Claude Opus 4.8 (1M) ×55 · Claude Fable 5 ×15 · Claude Opus 4.7 (1M) ×9。结对方式：Claude 负责完整实现；人在浏览器 / Playwright 中验收，发现偏差后给精准指令让 Claude 修。

---

### 规模数据 · Stats

> 数字来源：2026-07-10 生产数据库真实统计，未经修饰。

| 指标 | 数值 |
| :-- | :-- |
| 注册用户 | 111 |
| 笔记 | 89 篇 |
| 资料文件 | 139 个（共 15 类） |
| 点赞 / 评论 | 41 / 7 |
| 班级 / 小组 | 1 / 11 |
| 累计登录事件 | 306 次（去重活跃用户 68 名） |
| CCF 会议覆盖 | 230+ 场次 |
| 总 commit 数 | 283（62 天，2026-05-09 起） |
| 后端测试 | pytest 281 passed |
| 前端测试 | vitest 448 passed |
| 首屏 JS（gzip） | ≈ 144 KB |

---

### 部署 · Deployment

生产环境使用云 VPS，nginx 静态服 `frontend/dist` + 反代 FastAPI：

```
feiyue.selab.top        # 主域名，nginx 直接服 frontend/dist
feiyue-backend.service  # systemd 管理后端进程（uvicorn）
```

数据持久化经私有 HuggingFace Dataset 同步（`make data-pull` 一键恢复）。代码托管于 [`XjuSelab/xju-feiyue`](https://github.com/XjuSelab/xju-feiyue)，部署机拉同一仓库，`./deploy.sh` 一键部署（拉取 → 迁移 → 重启 → 健康检查 → 前端构建）。发展历程页由 GitHub Actions 自动部署（`site/**` 变更触发）。

---

### 本地开发 · Development

前提：Node.js 20+ / pnpm 9+，Python 3.11+ / [uv](https://docs.astral.sh/uv/)。

```bash
# 前端（dev 模式内置 mock，无需后端）
cd frontend && pnpm install && pnpm dev        # http://localhost:5173

# 切真后端
VITE_API_BASE=http://localhost:8000 pnpm dev

# 后端
cd backend && uv sync
uv run alembic upgrade head                     # 初始化 SQLite
uv run uvicorn app.main:app --reload
```

commit message 需符合 conventional commits（`feat/fix/chore/docs/refactor/test/style` 前缀，Husky + commitlint 强制）。

---

### 如何贡献 · Contributing

**加笔记（推荐）**：笔记真源是 `content/notes/*.md`，fork 后新建 `<slug>.md`（frontmatter 参考已有任意一篇）提 PR，字段说明见 [`CONTRIBUTING.md`](CONTRIBUTING.md)；也可联系 [@winbeau](https://github.com/winbeau) 申请站内账号直接发布。

**代码贡献**：Fork → 功能分支（`feat/xxx`）→ `pnpm test` / `uv run pytest` 通过 → 提 PR 描述改动动机与测试方式。

**数据 / 内容类问题**：开 Issue，标注 `content` 标签。

---

### 致谢 · Acknowledgements

- [孙海洋](https://github.com/SunSeaLucky)（[xju-course-wiki](https://github.com/SunSeaLucky/xju-course-wiki)）——课程笔记源材料
- 每一位愿意把踩过的坑、走过的路写下来留给下一届的作者
- [Anthropic Claude](https://claude.ai)——本项目从设计稿到每一个功能模块都是与 Claude 结对完成的

---

<div align="center">
<sub><a href="https://github.com/XjuSelab">XjuSelab</a> · 新疆大学软件开发实验室 · <a href="./LICENSE">MIT</a> © 2026 winbeau</sub>
</div>
