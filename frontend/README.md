# LabNotes — Frontend

Notion-style minimal shell + Claude-style prose container for browsing & writing
seven categories of research notes. Mock-only data layer with a contract-frozen
seam so the future real backend swap is zero-churn.

> 工程位置：`/home/winbeau/wenbiao_zhao/Aurash/frontend/`
> 设计稿（已归档）：`../archive/design-refs/`
> 后端契约：`../BACKEND_SPEC.md`

---

## Quick start

```bash
nvm use            # uses .nvmrc → lts/iron (Node 20)
pnpm install --prefer-offline
pnpm dev           # http://localhost:5173
```

> 资源提示：`pnpm install` 在小型 VPS 上约 5–10 分钟，首次安装请在本地或专用机器执行。

## Scripts

| script            | what                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `pnpm dev`        | Vite dev server at `http://localhost:5173`                             |
| `pnpm build`      | `tsc -b` (project references) then Vite production build               |
| `pnpm preview`    | preview the production build                                           |
| `pnpm typecheck`  | `tsc -b --noEmit` over `app + node + mock` projects                    |
| `pnpm lint`       | ESLint flat config across the repo                                     |
| `pnpm format`     | Prettier write across the repo                                         |
| `pnpm test`       | Vitest (jsdom) — unit & component tests                                |
| `pnpm e2e`        | Playwright (chromium) — auto-starts dev server via `webServer.command` |
| `pnpm bundle-viz` | open `vite-bundle-visualizer`                                          |

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

### 接真后端（联调）

```bash
# 1. .env.local 指向后端
echo 'VITE_API_BASE=http://localhost:8000' > .env.local

# 2. （可选）注释 src/api/index.ts 的 dev mock import 让所有请求都走真后端：
# if (import.meta.env.DEV) {
#   await import('./mock/handlers')
# }
```

完整契约见 `../BACKEND_SPEC.md`。

### 演示账号

学号 `20211010001` / 密码 `123456`；游客模式点登录页「以游客身份浏览」。

---

## 文档地图

- `INTEGRATION_REPORT.md` — 5 轮交付报告 / 性能 / 单测 / 偏差 / 已知 issue
- `../docs/architecture.md` — 数据流 / 路由树 / 组件分层 / 状态管理
- `../docs/design-decisions.md` — 12 条关键决策与原因
- `../BACKEND_SPEC.md` — 后端 API 契约（19 路由 + 10 schema）

## 测试

```bash
pnpm test         # vitest（72 个单测覆盖 lib + api/schemas + diffEngine + CategoryBadge）
pnpm e2e          # Playwright（需 OS deps：libnss3/libatk-bridge 等，本机 VPS 不可用）
```
