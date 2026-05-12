# 飞跃 · Feiyue

> 新疆大学 SeLab 飞跃笔记平台 —— 把上一届的踩坑、保研经验、课程资料沉淀成可检索的长文笔记，留给下一届。

[![Python](https://img.shields.io/badge/python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

线上演示：<https://winbeau.top>

---

## 这是什么

**飞跃** 是 SeLab 的一个内部知识沉淀站。

- 长文 + Markdown（KaTeX 数学公式、围栏代码块、GFM Admonition、相对图片）
- 7 个分类：科研 / 课程 / 推荐 / 竞赛 / Kaggle / 工具 / 生活
- 学号登录 + 个人头像 / 简介 / 微信 + 服务端生成 160 px 缩略图
- 草稿自动保存 + DeepSeek AI 续写助手
- 标签 / 点赞 / 评论 / 时间线右栏
- 后台登录 IP 审计（仅站长可见）
- 状态备份：Hugging Face Dataset，DB + .env 一键拉取还原

内容真源是仓库里的 `content/notes/*.md`，每篇带 YAML frontmatter；后端启动时通过 `seed.py` 读 frontmatter → 写 DB。日常运营加篇笔记 = 提交一个 .md 文件。

---

## 技术栈

|              | 选型 |
|---|---|
| 后端          | FastAPI · SQLAlchemy 2 (async) · Alembic · Pydantic 2 · bcrypt · python-jose JWT |
| 前端          | React 19 · Vite · TypeScript · Tailwind · Radix UI · TanStack Query · react-hook-form · zod |
| Markdown 渲染 | remark-gfm · remark-math · rehype-katex · rehype-highlight · rehype-raw |
| 编辑器        | CodeMirror 6 (markdown mode) |
| 数据库        | SQLite (默认) ｜ PostgreSQL (生产可选) |
| AI            | DeepSeek `/v1/chat/completions` |
| 部署          | systemd + nginx + Let's Encrypt |
| 状态同步      | huggingface_hub + age 加密 |

---

## 仓库结构

```
.
├── backend/                FastAPI 后端（uv 管理依赖）
│   ├── app/
│   │   ├── routes/         auth / notes / drafts / interactions / ai / admin
│   │   ├── schemas/        Pydantic camelCase 出参（与前端 zod 对齐）
│   │   ├── services/       业务逻辑（auth / notes / ai / author_sync）
│   │   └── db/             models.py + session
│   ├── alembic/versions/   迁移
│   └── scripts/            seed.py / add_user.py / sync_authors.py / ...
├── frontend/               React 应用（pnpm 管理）
│   └── src/
│       ├── api/            axios / zod schema / mock / hooks
│       ├── features/       按页面切的 feature 包
│       ├── components/     ui / common / layout
│       └── pages/          路由顶层组件
├── content/notes/          ★ 真源笔记 markdown（带 frontmatter）
├── docs/                   架构记录 + 设计决策
├── scripts/                xju_wiki 导入 + HF 同步脚本
├── BACKEND_SPEC.md         前端↔后端契约（19 routes + 10 schemas）
├── CONTRIBUTING.md         开发规范 / Commit 规范
└── Makefile                sync-* 目标入口
```

---

## 快速开始（本地）

### 先决条件

- Python 3.11+
- Node 20+ · pnpm 9+
- [`uv`](https://docs.astral.sh/uv/)（推荐管理后端 venv）

### 后端

```bash
cd backend
uv sync                                    # 装依赖到 backend/.venv
cp .env.example .env.local                 # 改 jwt_secret / deepseek_api_key
uv run alembic upgrade head                # 建表
uv run python scripts/seed.py              # 用 content/notes/*.md 灌数据
uv run uvicorn app.main:app --reload       # http://localhost:8000
```

### 前端

```bash
cd frontend
pnpm install --prefer-offline
pnpm dev                                   # http://localhost:5173
```

> 小内存机器上 `pnpm install` 可能慢；可加 `--network-concurrency=1`。

默认登录账号见 `backend/scripts/seed.py`（学号 + 密码）。

---

## 加一个新用户

```bash
# 交互问询
uv run python backend/scripts/add_user.py

# 一行参数
uv run python backend/scripts/add_user.py --sid 20241401231 --name 张三

# 批量从 CSV / stdin（"sid,name" 一行一对）
uv run python backend/scripts/add_user.py --batch users.csv
```

默认初始密码 `123456`，已存在的用户重跑只刷新姓名，不会覆盖密码。

## 加一篇新笔记

1. 在 `content/notes/` 下新建 `<slug>.md`
2. 顶部写 YAML frontmatter（参考已有任何一篇）：
   ```yaml
   ---
   id: note_<category>_<author>_<i>
   slug: <kebab-case-slug>
   title: 标题
   summary: 摘要 80 字以内
   category: research | course | recommend | competition | kaggle | tools | life
   tags: [tag1, tag2]
   author: <已有用户的 nickname>
   createdAt: 2026-05-12T00:00:00Z
   readMinutes: 5
   ---
   ```
3. 后端会在下次 seed / 运行时把它读进 DB；后台有个每日 `author_sync` 任务把 DB 的作者 FK 自动校准回 frontmatter。

---

## 部署概览

生产部署见 `docs/` 与 `scripts/sync/README.md`，要点：

- 后端：`systemd` 守 `uv run uvicorn`，监 `127.0.0.1:8001`
- nginx：单 location 把 `/(auth|notes|drafts|interactions|ai|health|uploads|admin)/*` 反代给后端，其余 fall through 到前端 SPA `dist/`
- 证书：Let's Encrypt + certbot
- 状态备份：DB + `.env.local` 通过 `make sync-push` age-加密推到私有 HF Dataset
- 远端机一键还原：`make sync-bootstrap && make sync-pull`

---

## 文档

- [`BACKEND_SPEC.md`](BACKEND_SPEC.md) —— 前端↔后端 wire 契约（必读）
- [`CONTRIBUTING.md`](CONTRIBUTING.md) —— 分支 / commit / PR 规范
- [`docs/`](docs/) —— 架构决策与设计记录
- [`scripts/sync/README.md`](scripts/sync/README.md) —— HF Dataset 状态同步

---

## 致谢

- 课程笔记来自 [@SunSeaLucky/xju-course-wiki](https://github.com/SunSeaLucky/xju-course-wiki)（孙海洋学长）
- 设计参考 / 灵感来自小红书 / 知乎专栏 / Notion 长文
- 部署一砖一瓦的踩坑笔记会陆续整理进 `docs/`

## License

仓库内默认仅供 SeLab 内部使用；如需对外使用请先开 Issue 商榷。
