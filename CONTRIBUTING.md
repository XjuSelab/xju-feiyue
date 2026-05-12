# 贡献指南 · Contributing to Feiyue

谢谢愿意参与。这里集中放**开发上手 + 写作规范 + 代码门槛**。
项目愿景 / 分类 / "为什么写这个站" 见根目录 [`README.md`](README.md)。

---

## 目录

- [仓库结构](#仓库结构)
- [技术栈](#技术栈)
- [本地开发](#本地开发)
  - [先决条件](#先决条件)
  - [后端](#后端)
  - [前端](#前端)
- [运营脚本](#运营脚本)
  - [加一个用户](#加一个用户)
  - [加一篇笔记](#加一篇笔记)
- [前端代码门槛](#前端代码门槛)
- [Git / Commit / PR](#git--commit--pr)
- [设计 Token 铁律](#设计-token-铁律)
- [数据层铁律](#数据层铁律)
- [A11y 检查清单](#a11y-检查清单)
- [部署 & 状态同步](#部署--状态同步)

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
├── archive/design-refs/    早期 design 稿（已冻结）
├── BACKEND_SPEC.md         前端↔后端契约（19 routes + 10 schemas）
├── Makefile                根 make 入口（目前主要是 sync-* 目标）
└── .github/PULL_REQUEST_TEMPLATE.md
```

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

## 本地开发

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

默认登录账号见 `backend/scripts/seed.py`（学号 + 密码）。

### 前端

```bash
cd frontend
pnpm install --prefer-offline
pnpm dev          # http://localhost:5173
```

> 资源提示：在 < 2 GB 内存的小机器上 pnpm install 约 5–10 分钟；
> 如失败用 `pnpm install --network-concurrency=1`。

---

## 运营脚本

### 加一个用户

```bash
# 交互问询
uv run python backend/scripts/add_user.py

# 一行参数
uv run python backend/scripts/add_user.py --sid 20241401231 --name 张三

# 批量从 CSV / stdin（"sid,name" 一行一对）
uv run python backend/scripts/add_user.py --batch users.csv
```

默认初始密码 `123456`；已存在的用户重跑只刷新姓名，不会覆盖密码。

### 加一篇笔记

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
3. 后端会在下次 seed / 运行时把它读进 DB；后台有个每日 `author_sync`
   任务把 DB 的作者 FK 自动校准回 frontmatter。

---

## 前端代码门槛

每个 PR / 直推 main 之前 **必须**：

```bash
cd frontend
pnpm typecheck   # 0 错误
pnpm lint        # 0 错误
pnpm test        # 全绿
pnpm build       # 成功 + 主 bundle gzip < 200 KB
```

如果 build 警告 chunk > 500 KB，看是 lazy 路由（可接受）还是首屏（必须修）。

文件规模：
- 单文件超 250 行就拆。`features/editor/WritePage.tsx`
  是当前最大单文件，再加东西必拆。
- 测试覆盖底线：`lib/*` 100% / `api/schemas/*` 边界 /
  关键 utility（`diffEngine`）中英混合 case

---

## Git / Commit / PR

- 主开发分支：`main`（小团队 / solo project，直推 main）
- 大改动（接真后端、暗色模式、i18n）开 feature 分支：
  `feat/<area>` / `fix/<area>` / `chore/<area>`
- Commit 走 [Conventional Commits](https://www.conventionalcommits.org/)：
  - `feat(frontend/<area>): <subject>`
  - `fix(frontend/<area>): <subject>`
  - `feat(backend/<area>): <subject>`
  - `docs(...): <subject>`
  - `chore(...): <subject>`
  - 大轮次用 `feat(frontend/round-<N>): …`
- header 长度上限 100 字符（commitlint 强制）；body 解释「为什么」而不是「做了什么」

### Hooks

`pre-commit` 跑 lint-staged（eslint --fix + prettier --write 改动文件）；
`commit-msg` 跑 commitlint。
通过 `git config core.hooksPath frontend/.husky` 接到本仓 `.git/hooks/`。
新克隆后 `cd frontend && pnpm install` 会触发 husky 的 prepare 脚本自动激活。

如需绕过（不推荐）：`git commit --no-verify`。

### PR 模板

`.github/PULL_REQUEST_TEMPLATE.md` 已存。提交前过一遍：

- [ ] typecheck / lint / test / build 全绿
- [ ] commit message 符合 conventional commits
- [ ] 改动了 token / schema / endpoint 签名？同步更新
      `docs/architecture.md` 或 `design-decisions.md`
- [ ] 添加 / 修改了组件？是否需要补单测？
- [ ] 截图或交互说明（如果是视觉改动）

---

## 设计 Token 铁律

- 颜色 / 圆角 / 阴影 / 间距 / 过渡 → CSS 变量。
  **禁止硬编码 hex** 在 `tokens.css` 之外
- 类别色用 `var(--cat-<id>)`，tag 12% tint 用 `var(--tag-<id>-bg)`
- AI diff add/del 颜色已在 `--ai-add-*` / `--ai-del-*` 暴露，
  新组件不要再造一套

---

## 数据层铁律

- 组件 / hook 不允许直接 `import` `mock/notes.json` 或调用 `fetch`
- 任何后端调用都通过 `src/api/endpoints/*.ts` 中的函数；进出过 zod schema
- 切真后端：改 `.env` 设 `VITE_API_BASE`，删 `api/index.ts` 中的
  dev mock import；业务代码 0 改动
- Zustand stores 限定在 `src/stores/`，目前 2 个（auth / draft），
  uiStore 按需

---

## A11y 检查清单

- 交互元素 `aria-label`
- 表单 `aria-invalid` + `aria-describedby` 串错误信息
- 数据组件三态完整：
  `<LoadingSkeleton>` / `<EmptyState>` / `<ErrorState onRetry>`
- 路由 fallback 走 `<Suspense>`，errorElement 走 `<ErrorState>`
- 键盘可达：Tab 走完所有按钮 + Enter 触发 / Esc 关闭浮层

---

## 部署 & 状态同步

生产部署见 [`scripts/sync/README.md`](scripts/sync/README.md) 与 `docs/`，要点：

- 后端：`systemd` 守 `uv run uvicorn`，监 `127.0.0.1:8001`
- nginx：单 location 把
  `/(auth|notes|drafts|interactions|ai|health|uploads|admin)/*`
  反代给后端，其余 fall through 到前端 SPA `dist/`
- 证书：Let's Encrypt + certbot
- 状态备份：DB + `.env.local` 通过 `make sync-push` age-加密推到私有 HF Dataset
- 远端机一键还原：`make sync-bootstrap && make sync-pull`

### 状态同步流程

`backend/labnotes.db` 和两个 `.env.local` 不进 git，
但需要在 WSL/服务器之间共享。通过私有 HF Dataset 同步，
secrets 用 age 对称加密。

新机器恢复：

```bash
git clone <repo>
cd Feiyue
sudo apt install age bsdextrautils sqlite3   # 一次
make sync-bootstrap                          # 输 HF token + age passphrase
make sync-pull                               # 拉回 DB + .env.local
cd backend && uv sync && uv run alembic upgrade head
```

日常：

```bash
make sync-push           # 手动推送当前状态
make sync-cron-install   # 装 */30 自动推
make sync-status         # 看上次推送是谁、什么时候
```

铁律（与 `MEMORY.md` 一致）：

- **代码** 仍走 git push/pull，不走 HF
- **运行时状态**（DB + secrets）走 HF
- 不要 rsync / scp 直接覆盖另一台机器
