# LabNotes Frontend — Architecture

> 生产级 React 应用，全 mock 但保留「未来切真后端零改动」的能力。
> 本文档描述应用整体架构、数据流、路由与组件分层。

---

## 数据流（单向依赖）

```mermaid
flowchart LR
  subgraph UI["UI 层"]
    C[Component]
    H[hooks (TanStack Query)]
  end
  subgraph DATA["数据层"]
    E[endpoints/*.ts]
    CL[client.ts]
    M[mock/handlers.ts]
    F[fetch (real backend)]
    S[zod schemas/*.ts]
  end

  C --> H
  H -->|useNotes / useAICompose / ...| E
  E -- request.parse --> S
  E -- request --> CL
  CL -.dev.-> M
  CL -.prod.-> F
  M -.fixture.-> NJ[notes.json]
```

**铁律**:
- 组件 **不允许** 直接 `import` `mock/notes.json` 或 `mock/handlers.ts`
- `endpoints/*.ts` 进出 **必须** 过 `Zod schema.parse()`
- `client.ts` 是唯一调用 `fetch()` 的地方
- 切真后端 = 把 `VITE_API_BASE` 指向真服务 + 删掉 `api/index.ts` 中的 dev-only mock import，业务代码 **0 改动**

---

## 路由树

```
BrowserRouter
├── /login                 ⟶ LoginPage（无 AppShell，双栏 BrandPanel + LoginForm）
└── <AppShell>             ⟵ Header(56px) + <Outlet/> + Footer(60px)
    ├── /                  ⟶ HomePage  (RequireAccess: 拒 anon)
    ├── /browse            ⟶ BrowsePage (公开)
    ├── /browse?cat=…&q=…  ⟵ useBrowseParams 双向同步
    ├── /write             ⟶ WritePage  (RequireAccess requireAuth)
    ├── /write/:draftId    ⟶ WritePage  (RequireAccess requireAuth)
    ├── /note/:id          ⟶ NoteDetailPage (公开)
    ├── /me                ⟶ ProfilePage (RequireAccess requireAuth)
    └── /_dev/design-system ⟶ DesignSystemPage (DEV only)
```

每个路由都是 `React.lazy` + `<Suspense fallback={…}>` + `errorElement={…}`：lazy 切分让首屏只装 main bundle，其余路由按需拉取。

---

## 组件分层

```
src/
├── api/                       数据层（无 React 依赖）
│   ├── schemas/               Zod schemas — 单一类型源
│   ├── endpoints/             业务函数（auth / notes / ai）
│   ├── mock/                  dev 假数据 + dispatch 表
│   ├── client.ts              fetch wrapper + zod boundary
│   └── index.ts               TanStack Query hooks 总出口
│
├── stores/                    Zustand persist
│   ├── authStore.ts           authed / guest / anon
│   └── draftStore.ts          drafts: Record<id, Draft>
│
├── components/
│   ├── ui/                    shadcn 生成（17 个 primitive）
│   ├── layout/                Header / Footer / MegaMenu / RequireAccess /
│   │                          AppShell
│   └── common/                CategoryBadge / NoteCard / Markdown /
│                              CodeBlock / EmptyState / ErrorState /
│                              LoadingSkeleton
│
├── features/                  功能纵向切片（每个独立路由各一个）
│   ├── auth/                  LoginForm / BrandPanel
│   ├── home/sections/         WelcomeSection / CategoryGrid / LatestFeed /
│   │                          HotCarousel
│   ├── browse/                FilterSidebar / SearchBar / NoteGrid /
│   │                          RightRail / useBrowseParams
│   └── editor/                MarkdownEditor / MarkdownPreview / WritePage
│       ├── ai/                AIDrawer / DiffView / FloatingToolbar /
│       │                      diffEngine / useAICompose
│       ├── toolbar/           MainToolbar / SubToolbar
│       └── hooks/             useAutoSave / useScrollSync
│
├── lib/                       Pure utilities
│   ├── cn.ts                  clsx + tailwind-merge
│   ├── categories.ts          7 类元数据（spec id "tools"）
│   ├── highlight.tsx          安全的搜索高亮（无 dangerouslySetInnerHTML）
│   └── utils.ts               re-export shim
│
├── pages/                     thin shell：组装 features 里的 sections
│   ├── HomePage / BrowsePage / WritePage / LoginPage /
│   │   NoteDetailPage / ProfilePage
│   └── _dev/DesignSystemPage  仅 DEV
│
├── styles/
│   ├── tokens.css             CSS variables 单一色源
│   ├── globals.css            tokens import + Tailwind + shadcn HSL bridge
│   └── prose-claude.css       Claude PDF 风 Markdown 排版容器
│
├── router.tsx                 createBrowserRouter + lazy + Suspense + ErrorElement
├── App.tsx                    QueryClientProvider + RouterProvider + Toaster
└── main.tsx                   createRoot + StrictMode + globals.css
```

**层级依赖规则**:
- `lib/` 不依赖任何东西（除三方）
- `api/` 依赖 `lib/`（categories 类型）
- `stores/` 依赖 `api/`
- `components/ui/` 不依赖 `api/`、`stores/`、`features/`
- `components/common/` 依赖 `lib/` + `components/ui/` + `api/schemas/` 类型
- `components/layout/` 依赖 `stores/` + `api/`
- `features/*/` 依赖 `api/`、`stores/`、`components/`
- `pages/` 是薄壳，**只组装 features**，不直接处理数据

---

## 状态管理

| 类别 | 工具 | 文件 | 使用 |
|---|---|---|---|
| 业务数据（笔记/AI） | TanStack Query v5 | hooks 在 `api/index.ts` | 所有列表/详情读取 |
| 鉴权 | Zustand + persist | `stores/authStore.ts` | login/logout/enterAsGuest/hydrate |
| 草稿 | Zustand + persist | `stores/draftStore.ts` | autosave 到 localStorage |
| URL 派生（cat/sort/q/tags） | `useSearchParams` | `features/browse/useBrowseParams.ts` | 双向同步 |

**不要做**：把笔记列表存进 zustand。所有业务数据走 TanStack Query 缓存即可。

---

## 设计 tokens

`tokens.css` 是唯一的色源。所有色值通过 CSS 变量传播：

- 业务 token：`--color-bg / --color-text / --cat-* / --tag-*-bg / --ai-*` 等
- design 稿别名：`--bg / --fg / --line / --r-* / --t-fast`
- shadcn HSL bridge：在 `globals.css` 中映射 `--background → --color-bg` 等

Tailwind 既暴露业务名（`bg-bg-subtle`、`text-cat-research`），也暴露 shadcn 槽位（`bg-background`、`text-muted-foreground`），两套都最终指向 tokens.css 里的同一个 hex。

---

## A11y 与键盘交互

- 所有路由的 sticky `Header` 是 `<header role="banner">`；`Footer` 是 `role="contentinfo"`
- `RequireAccess` 跳 `/login` 时把 `state.from` 一并带过去，登录成功后 fallback redirect
- `MegaMenu` 桌面态：hover 200ms 开 / 离开 150ms 关；Esc 关；外点击关；Tab 到「浏览」按 Enter 也能开
- `MegaMenu` 移动态：Shadcn `<Sheet>` 从右滑入
- 所有交互按钮 `aria-label`；表单 `aria-invalid` + `aria-describedby` 错误信息
- 三态组件：`EmptyState role="status"`、`ErrorState role="alert"`、`LoadingSkeleton role="status" aria-live="polite"`

---

## 性能预算

- 首屏 JS gzip < 200 KB（R5 budget）
- 路由 lazy + 共享 chunk（EmptyState 等）由 Vite 自动分块
- `MarkdownPreview` 使用 `React.memo` + `forwardRef`
- MegaMenu 底部三栏内容空数据，R4 home-agent 接通后由 useNotes 上游缓存兜
- ⚠️ `WritePage` 路由 chunk 因 CodeMirror + diff-match-patch + react-markdown + highlight.js + katex 全打入达 gzip 464 KB；优化方案见 INTEGRATION_REPORT.md
