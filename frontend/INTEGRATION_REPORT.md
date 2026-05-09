# LabNotes Frontend — Integration Report

> 交付报告。涵盖 5 轮的成果、与 spec 的偏差、性能 / 测试 / 一致性指标、遗留 issue
> 以及下一阶段建议。本文档与 `docs/architecture.md` 和 `docs/design-decisions.md`
> 配套阅读。

生成时间：2026-05-09

---

## 1 · 总览（5 轮里程碑）

| 轮次         | Commit     | 文件 | 主要交付                                                                                                                                                                 |
| ------------ | ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1           | `9881a96`  | 51   | Vite + React 18 + TS strict + Tailwind v3 + shadcn config + ESLint flat + Husky + Playwright config                                                                      |
| R2           | `8aebc6f`  | 46   | tokens.css + globals + prose-claude + 17 个 shadcn primitive + 6 common 组件 + DesignSystemPage 8 sections                                                               |
| R3 主        | `1a5951a`  | 20   | Layout (Header/MegaMenu/Footer/AppShell) + Router (lazy + Suspense + ErrorElement) + RequireAccess 守卫 + auth API + authStore + 6 占位页（含 minimum-viable LoginPage） |
| R3 contracts | `31bb162`  | 6    | NoteSchema / AIComposeSchema / endpoint stubs / 14 条 mock fixtures / TanStack Query hook 签名                                                                           |
| R4a (home)   | `62c9269`  | 8    | notes endpoints 实现 + 6 个 mock 路由 + NoteCard + 4 home sections                                                                                                       |
| R4d (login)  | `52a200c`  | 3    | LoginForm (RHF + zodResolver + 双重错误提示) + BrandPanel 双栏 + 完整 LoginPage                                                                                          |
| R4b (browse) | `d8eb8f5`  | 7    | useBrowseParams (URL 双向同步) + SearchBar / FilterSidebar / NoteGrid (useInfiniteQuery) / RightRail + highlight                                                         |
| R4c (editor) | `4660717`  | 18   | CodeMirror 编辑器 + 预览 + AI 抽屉 (6 mode + diff + 历史) + diffEngine + 双 toolbar + draftStore + autosave + scrollSync                                                 |
| R5           | （本提交） | ~15  | 单测 (72) + Husky 接通父级 repo + 一致性 grep 审计 + architecture / design-decisions / CONTRIBUTING / PR template / INTEGRATION_REPORT                                   |

**累计**：约 110 commits 内的代码增长，**69 个业务 TS/TSX 源文件 (5102 行) + 8 个测试文件 (548 行)**，加 17 个 shadcn 生成的 UI primitive。

---

## 2 · 与 spec 的偏差（按已知重要性排序）

### ⚠️ 性能：WritePage 路由 chunk 1.43 MB / gzip 464 KB

- **现状**：lazy 路由，**首屏不加载**；主 bundle gzip 144.82 KB ✅ < 200 KB R5 budget。
- **来源**：`@codemirror/*`（~150 KB）+ `react-markdown` + `rehype-highlight` 自动注册 ~190 个语言（~150 KB） + `katex` (~270 KB) + `diff-match-patch`（~30 KB）全打入。
- **未实施的优化**：
  - `highlight.js` 改用 `lib/core` + 按需注册 ~6 种常用语言（python/js/ts/bash/sql/markdown）→ 估计 -100 KB
  - `katex` 在 `MarkdownPreview` 检测到 `$$` / `$...$` 后再 `await import('katex')` + 动态注入 CSS → 估计 -200 KB
- **影响**：写作页首次访问额外加载 ~464 KB（gzip）；后续 Vite cache 命中。**对其他路由零影响**。
- **优先级**：P1，建议下个迭代立刻处理。

### ⚠️ AI diff per-segment 接受/拒绝按钮（未实现）

- **spec**：「分块按钮 ✓Check 绿 / ✗X 灰，hover 修改块时淡入」
- **现状**：只实现「全部采纳 / 全部拒绝」整块按钮 + 历史区。
- **影响**：用户体验降级 —— 不能选择性接受 AI 修改的局部段落。
- **优先级**：P2。

### ⚠️ AI 伪流式按字符切片输出（未实现）

- **spec**：mock 实现按字符切片伪流式输出。
- **现状**：mock 一次性返回完整结果（含 400-1000 ms 模拟延迟）。
- **影响**：UI 没有「逐字浮现」效果。但真后端接通时 streaming 是后端工作，前端的钩子已经在 `useAICompose` mutation 上预留。
- **优先级**：P3（mock-only nicety；接真后端不影响）。

### ⚠️ Playwright OS deps 不可用（贯穿 5 轮）

- **现状**：本机 VPS 缺 `libatk / libxkbcommon / libXcomposite / libXdamage / libXfixes / libXrandr / libgbm / libasound / libatspi`，无 sudo 装不了；spec 的截图 + 视觉回归 + axe-core 流程全部降级为 curl + 模块加载验证 + 类型/单测兜底。
- **未做**：R3 8 步 / R4 12 步 Playwright 串流，R5 视觉回归 + axe-core a11y 审计 + demo video。
- **缓解**：每轮 commit message 中详细记录降级证据（HTTP status / curl 输出）；架构 / 三态 / a11y 在代码层做到位（aria-\* / role / 键盘可达手写测试）。
- **优先级**：P1，需要在能装 deps 的机器上补一次完整跑测，结果回贴本文档。

### 设计 token 偏差（已在 docs/design-decisions.md 落地）

- **#1** Token 命名 spec vs design：双轨命名共存
- **#2** 圆角 spec 6/8/12 vs design 4/6/8：双轨值共存
- **#3** 类别 id `tools` vs `tool`：业务层强制 `tools`，CSS hook 同步
- **#4** Header 高度 56 (spec) vs 48 (design)：56 落地
- **#5** MegaMenu 1080 (spec) vs 1040 (design)：1080 with `min(1080, viewport-32)` 兜底
- **#6** Playwright `--with-deps` 跳过：见上
- **#7** 字体回退栈含 PingFang SC：✅
- **#8** Design 独有 token (`--bg-hover / --line-strong / --tag-*-bg / --code-inline-* / --shadow-card / --ai-add-* / --ai-del-*`)：全部追加进 tokens.css
- **#9** Tailwind 锁 v3.4：✅
- **#10** shadcn 与 tokens.css 桥接：✅ HSL 形式，单一色源
- **#11** `tailwindcss-animate`：✅
- **#12** AI diff 命名规范：✅ 使用 `--ai-add-bg/-fg/-border` 等

---

## 3 · 一致性审计

通过 grep 检测以下铁律：

| 规则                                      | 期望                          | 实际                                                                                        |
| ----------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| 硬编码 hex 仅在 tokens.css/globals.css    | 业务代码 0 命中               | ✅ 仅 `DiffView.tsx` 注释里出现（说明 spec 颜色），代码 0 命中                              |
| `fetch(` 仅在 client.ts                   | 1 命中                        | ✅ `client.ts:93` 唯一                                                                      |
| `notes.json` 引用 仅 mock/handlers.ts     | 1 命中                        | ✅ `handlers.ts:12` 唯一                                                                    |
| `react-markdown` import 仅 `<Markdown />` | 1 命中                        | ✅ `Markdown.tsx:1` 唯一                                                                    |
| Zustand store 数量 ≤ 3                    | ≤ 3                           | ✅ 2（authStore, draftStore；uiStore 按需未创建）                                           |
| Button variant 收敛                       | default/sm/ghost/outline 主用 | ✅ 业务代码仅用 `default + outline + sm`；DesignSystemPage 展示 6 variants 是 showcase 用途 |

---

## 4 · 数据层「切真后端零改动」验证

**步骤**（脑手联动验证）：

1. 在 `frontend/.env.production` 设置 `VITE_API_BASE=https://api.example.com`
2. 删除 / 注释 `src/api/index.ts:21-23` 的 dev mock import：
   ```ts
   // if (import.meta.env.DEV) {
   //   await import('./mock/handlers')
   // }
   ```
3. `pnpm build` 进入生产模式：
   - `client.ts` 的 `if (isDev)` 分支 dead-code 消除
   - `mockHandlers` Map 永远空，但永远不被读
   - 所有 endpoint 函数继续走 `request()` 然后落到 `fetch(url, init)` 上
   - 真后端只需要满足 `NoteSchema` / `AIComposeResponseSchema` 等 JSON 契约

**业务代码改动量**：0 行（components / pages / features / hooks / stores 全部不动）。
**新增改动量**：1 个 env 变量 + 注释 1 个 import。

---

## 5 · 性能 (Bundle Stats)

```
dist/index.html                    0.46 kB  gzip:   0.30 kB
dist/assets/index-*.css           41.62 kB  gzip:   8.04 kB
dist/assets/NoteDetailPage         0.42 kB  gzip:   0.32 kB
dist/assets/ProfilePage            0.43 kB  gzip:   0.32 kB
dist/assets/EmptyState             4.93 kB  gzip:   1.80 kB  ← 共享 chunk
dist/assets/HomePage               5.00 kB  gzip:   2.05 kB
dist/assets/BrowsePage            10.51 kB  gzip:   4.00 kB
dist/assets/index-* (entry)       16.46 kB  gzip:   5.74 kB
dist/assets/LoginPage             31.66 kB  gzip:  12.38 kB  ← RHF + zod
dist/assets/index-* (main)       467.78 kB  gzip: 144.82 kB  ← React + Router + TanStack + zustand
dist/assets/WritePage          1,438.53 kB  gzip: 464.13 kB  ⚠️ 见 §2
```

**首屏 (`/`)**：main + entry + HomePage + EmptyState + CSS = ~172 KB gzip + 8 KB CSS = **180 KB total**，在 R5 budget 200 KB 之内。

**Lighthouse 模拟**（基于 bundle 大小估算 4G 网络）：

- FCP（First Contentful Paint）：~1.5 s
- LCP（Largest Contentful Paint）：~1.8 s（home 列表数据 mock 200 ms 后到达）
- TBT（Total Blocking Time）：~150 ms
- 实际数字需在装好 Playwright OS deps 的机器上跑确认。

---

## 6 · 测试覆盖

```
Test Files  8 passed (8)
Tests      72 passed (72)
Duration   6.47 s
```

| 文件                                       | 用例数 | 覆盖目标                                                                            |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| `lib/cn.test.ts`                           | 7      | clsx + tailwind-merge 各路                                                          |
| `lib/highlight.test.tsx`                   | 7      | empty / single / case / multi / regex escape / 中文 / no match                      |
| `lib/categories.test.ts`                   | 6      | 7 cats / `tools` 复数 / colorVar 匹配 / `getCategory` 异常                          |
| `api/schemas/user.test.ts`                 | 10     | UserSchema / LoginRequest 8-12 数字边界 / token 非空                                |
| `api/schemas/note.test.ts`                 | 15     | NoteSchema 完整边界 / ListNotesQuery sort 枚举 / limit ≤ 50 / Paginated cursor null |
| `api/schemas/ai.test.ts`                   | 15     | 6 mode 全枚举 / DiffSegment 类型 / Response elapsedMs                               |
| `features/editor/ai/diffEngine.test.ts`    | 6      | 全等 / insertion / deletion / 中文 / CN+EN / partition 完整性                       |
| `components/common/CategoryBadge.test.tsx` | 6      | 4 variants / data-cat / `tools` 复数 / aria-label / desc                            |

**未覆盖**（已知）：

- 组件级集成测试（Header / NoteGrid / WritePage）
- 路由级 E2E（Playwright spec，OS deps 限制）
- Stores（authStore / draftStore）— `persist` middleware 复杂，价值不如 schema 测试

---

## 7 · 已知遗留 Issue（按优先级）

| P   | Issue                                                                                | Round 引入 | 解决方案                                                                                            |
| --- | ------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| P1  | WritePage chunk gzip 464 KB                                                          | R4c        | highlight.js core + lang 按需注册；katex 动态 import                                                |
| P1  | Playwright OS deps 不可用 → 视觉回归 + axe-core 缺失                                 | R1 起持续  | 在能装 deps 的机器上跑 R3 / R4 spec 列出的截图序列；视觉回归阈值 5%（spec 偏差从 2% 调）            |
| P2  | AI diff per-segment 接受/拒绝（✓ 绿 / ✗ 灰 hover 淡入）                              | R4c        | DiffView 给 add/del segment 加独立按钮组；状态管理用 Set\<segmentIndex\>                            |
| P2  | AI mock 伪流式按字符切片                                                             | R4c        | mock 改用 ReadableStream + chunk emit；前端 hook 改用 `experimental_streamText` 或自实现 chunk 累积 |
| P3  | uiStore 未创建                                                                       | R3 起      | 当出现「跨组件 UI 状态」（移动端 sidebar 开合 / 全局主题切换）时创建                                |
| P3  | `core.hooksPath` 是 repo-local 配置；新克隆者需手动 `git config` 或跑 `pnpm prepare` | R5         | 包含在 `pnpm install` 自动 prepare（已配） + CONTRIBUTING.md 提示                                   |
| P3  | DesignSystemPage 体积稍大 (16 KB gzip)，dev-only 但跟 main bundle 共享 import 链     | R2         | 已在 router 用 `import.meta.env.DEV` 条件 lazy；prod 已 tree-shake 掉，本身无影响                   |

---

## 8 · 下一阶段建议（按业务价值）

1. **接真后端**：spec 设计的 client.ts / endpoints 双层抽象天然支持。完整契约见 `../BACKEND_SPEC.md`（19 条路由 + 10 schema）；前端只需 `.env` 切 `VITE_API_BASE` + 注释 `src/api/index.ts` 的 dev mock import。
2. **暗色模式**：`next-themes` 已在 R2 装入；tokens.css 加 `[data-theme="dark"]` overrides；`prose-claude--dark` 占位类已存。
3. **i18n**：当前界面纯中文；引入 `react-i18next`，category labels / sidebar headers 等先上 zh + en。
4. **笔记详情页**：`NoteDetailPage` 当前是占位；接通 `useNote(id)` + `<Markdown />` 渲染，加评论模块。
5. **评论 + 收藏**：需要后端的 `POST /notes/:id/like` 等接口；前端可先 mock。
6. **WritePage 性能优化**（P1）：见 §7。
7. **per-segment diff 接受/拒绝**（P2）：见 §7。
8. **完整 a11y 审计 + 视觉回归**：在能装 OS deps 的机器跑一次，回贴报告到本文档 §5。

---

## 9 · 命令速查（验收）

```bash
cd frontend

# 类型 + 静态检查
pnpm typecheck         # ✅ 0 错误
pnpm lint              # ✅ 0 错误

# 测试
pnpm test              # ✅ 72 passed
pnpm test --coverage   # 生成覆盖率报告

# 构建
pnpm build             # ✅ 主 bundle gzip 144 KB

# 启动 dev（http://localhost:5173）
pnpm dev

# 访问 dev 路径
http://localhost:5173/                            HomePage
http://localhost:5173/login                       LoginPage（双栏）
http://localhost:5173/browse?cat=research         BrowsePage（cat 筛选）
http://localhost:5173/browse?q=Kaggle             BrowsePage（搜索 + 高亮）
http://localhost:5173/write                       WritePage（需登录）
http://localhost:5173/_dev/design-system          DEV-only 设计系统对照页

# 模拟 mock 登录
学号: 20211010001  密码: 123456
游客模式: 点击「以游客身份浏览」按钮
```

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
