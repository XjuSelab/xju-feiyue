# LabNotes — Frontend

Notion-style minimal shell + Claude-style prose container for browsing & writing
seven categories of research notes. Mock-only data layer with a contract-frozen
seam so the future real backend swap is zero-churn.

> 工程位置：`/home/winbeau/wenbiao_zhao/Aurash/frontend/`
> 设计稿仓：同仓库 `../components` `../pages` `../stylesheets`
> 5 轮 spec：同仓库 `../docs/round{1..5}.md`

---

## Quick start

```bash
nvm use            # uses .nvmrc → lts/iron (Node 20)
pnpm install --prefer-offline
pnpm dev           # http://localhost:5173
```

> 资源提示：`pnpm install` 在小型 VPS 上约 5–10 分钟，首次安装请在本地或专用机器执行。

## Scripts

| script             | what                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| `pnpm dev`         | Vite dev server at `http://localhost:5173`                             |
| `pnpm build`       | `tsc -b` (project references) then Vite production build               |
| `pnpm preview`     | preview the production build                                           |
| `pnpm typecheck`   | `tsc -b --noEmit` over `app + node + mock` projects                    |
| `pnpm lint`        | ESLint flat config across the repo                                     |
| `pnpm format`      | Prettier write across the repo                                         |
| `pnpm test`        | Vitest (jsdom) — unit & component tests                                |
| `pnpm e2e`         | Playwright (chromium) — auto-starts dev server via `webServer.command` |
| `pnpm bundle-viz`  | open `vite-bundle-visualizer`                                          |

## Conventions

```
src/
  api/                数据层（单向依赖：components → endpoints/ → client.ts → mock|fetch）
    client.ts         fetch + mock dispatcher（R3 实化）
    endpoints/        每个资源的函数式 API，进出过 zod schema
    schemas/          zod schemas + inferred types
    mock/             固定 fixtures + handlers（dev 专用，组件不允许直读）
    index.ts          TanStack Query hooks 与 endpoints 出口
  assets/             图片 / 字体（lucide icons 走 lucide-react，不进 assets）
  components/
    ui/               shadcn 生成位（R2 起）
    layout/           Header / Footer / MegaMenu / AppShell（R3）
    common/           CategoryBadge / Markdown / EmptyState 等（R2）
  features/
    auth/ editor/ browse/ home/   每个业务页的 sections / hooks（R3-R4）
  hooks/              全局复用 hooks
  lib/                cn / utils / categories（R2 起）
  pages/              路由对应的 page-level 容器
  stores/             zustand：authStore / draftStore / uiStore（仅 3 个）
  styles/             tokens.css / globals.css / prose-claude.css
  types/shims/        三方依赖类型补丁（每个文件顶部注明来源）
  router.tsx          React Router v6 配置（R3 实化）
  App.tsx main.tsx
playwright/
  e2e/                端到端 spec
  screenshots/        每轮验收截图（round-N-*.png）
```

### Strict 三件套

`tsconfig.app.json` 全开 `strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + noImplicitOverride`。
`src/api/mock/**` 由 `tsconfig.mock.json` 单独覆盖、关 `noUncheckedIndexedAccess`，让 fixture 数组访问 `notes[0]` 不再无谓报红。
项目以 project references 串起，`tsc -b` 一次跑完三个工程。

### 数据层架构

```mermaid
flowchart LR
  C[Component]
  H[hooks (TanStack Query)]
  E[endpoints/*.ts]
  CL[client.ts]
  M[mock/handlers.ts]
  F[fetch (real backend)]
  S[zod schemas/*.ts]

  C -- useNotes() --> H
  H --> E
  E -- input.parse / output.parse --> S
  E --> CL
  CL -- import.meta.env.DEV --> M
  CL -- prod --> F
```

切真后端：把 `client.ts` 中的 `dev → mock` 分支注释掉、改 `baseURL` 即可，业务代码 0 改动。

---

## Round 进度

- [x] **Round 1** — 工程基建 (vite + ts strict + tailwind v3 + shadcn config + eslint/prettier/husky/commitlint + playwright config)
- [ ] **Round 2** — 设计系统迁移 (tokens / shadcn 组件 / prose-claude 容器)
- [ ] **Round 3** — 布局与路由 (Header / MegaMenu / Footer / authStore / 守卫 / 占位页 + 冻结 R4 contracts)
- [ ] **Round 4** — 业务页面 (home / browse / editor / login，4 subagent 并行)
- [ ] **Round 5** — 集成验证 (跨页一致性 / 性能 / a11y / 视觉回归 / 文档 + INTEGRATION_REPORT)

详细 spec 见 `../docs/round{1..5}.md` 与 `~/.claude/plans/5-docs-5-review-agent-approval-commit-humming-bachman.md`。
