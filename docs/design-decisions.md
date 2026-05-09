# Design Decisions — LabNotes Frontend

> 5 轮交付中真正影响走向的决策记录。每条记录格式：**决策 → 理由 → 拒绝的备选**。
> 只记录现在还在影响代码的决策；纯实现细节不记录。

---

## R1 · Stack 锁版本

**决策**：React 18.3 / Vite 5.4 / TypeScript 5.6 / ESLint 9.39 / `@vitejs/plugin-react` 4.7。
**理由**：spec 明确「Vite + React 18」，但 `pnpm create vite` 默认会拉 React 19 / Vite 8 / TS 6。锁版本可避免无意识跨大版本升级带来的兼容问题。
**拒绝**：跟随 create-vite 默认（被 spec 否决）。

## R1 · Tailwind 锁 v3.4

**决策**：`pnpm add -D tailwindcss@^3.4 postcss autoprefixer`，**禁止** v4。
**理由**：spec 用 `tailwind.config.ts` JS 配置；Tailwind v4 改用 `@theme` in CSS，不兼容现有 shadcn 模板与本项目的 token 桥接策略。
**拒绝**：v4（虽然更新但破坏链路）。

## R1 · TS strict 三件套全开

**决策**：`strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + noImplicitOverride`。
**理由**：尽早捕获 fixture 数组访问、可选属性赋值、类继承漏写 override 等典型 bug。
**逃生口**（受控）：仅允许 `// @ts-expect-error <reason>` 与 `src/types/shims/*.d.ts` 显式补丁。
**实际遭遇**：
- `RequestInit.body` 不接 `undefined` → 改用条件赋值（`client.ts`）
- `createBrowserRouter` 推断回到 `@remix-run/router` 内部类型 → 显式 `ReturnType<typeof createBrowserRouter>` 注解（`router.tsx`）

## R1 · TS project references（保留）

**决策**：保留 `tsconfig.app.json` + `tsconfig.node.json` + `tsconfig.mock.json` 三段。R3 后从 references 中移除 mock，因 mock 目录此时为空（避免 TS18003）；R4 fixtures 进入后 mock 内容已经能在 app 配置下编译，未重新引入 mock 引用。
**理由**：mock fixture 数组访问下的 `noUncheckedIndexedAccess` 影响小，使用 `.find` / `.filter` 即可避免，不需要单独 override。

## R2 · 双轨命名 token（spec + design）

**决策**：tokens.css 同时定义 spec 命名（`--color-bg / --color-text / --color-border`）与 design 短名（`--bg / --fg / --line`）作 alias 指向同一 hex。
**理由**：spec 命名更语义化（用于业务组件），design 短名兼容 design 稿原始 markup（无需手翻每个 `var(--bg)`）。
**拒绝**：只保留 spec → 移植 prose-claude.css / design 稿样式工作量爆炸；只保留 design → 不符合 spec 偏差表 #1。

## R2 · 圆角 spec 6/8/12 + design 4/6/8 并存

**决策**：`--radius-{sm,md,lg} = 6/8/12`（spec），`--r-{sm,md,lg} = 4/6/8`（design legacy）。值有重叠（6=radius-sm=r-md，8=radius-md=r-lg）但语义不同。新组件用 spec，design 稿样式继续用 r-*。
**理由**：spec 明确「按钮 6 / 卡片 8 / mega menu 12」；design 稿大量使用 `var(--r-md)=6`，硬切回到 spec 数值会让 prose-claude 的 inline code 圆角从 4 变 6，视觉劣化。

## R2 · shadcn HSL 桥接策略

**决策**：tokens.css 用 hex；shadcn 的 `--background / --foreground / --primary / ...` 在 globals.css 中显式定义为 HSL 字符串（如 `0 0% 100%`），手算从 hex 推导。Tailwind config 用 `hsl(var(--xx) / <alpha-value>)`。
**理由**：shadcn 默认要 HSL 才能跟 Tailwind alpha modifier 配合；自建 token 用 hex 更直观、便于和 design 稿对齐。
**结果**：所有色值最终来自 tokens.css（单一色源），shadcn 的 HSL 是 tokens 的等价表达，不构成「双轨」。

## R2 · 类别 id `tools` 复数

**决策**：业务层使用 `tools`（spec），CSS 选择器层 `[data-cat="tools"]`。
**理由**：spec 偏差表 #3。
**遗留**：如未来视觉回归发现 design 稿仍有 `[data-cat="tool"]` 选择器依赖，给 CSS 双 selector `[data-cat="tool"], [data-cat="tools"]` 兼容。当前 CategoryBadge / MegaMenu 单元测试已 lock 在 `tools`。

## R3 · 单一 fetcher + dispatch 表（mock）

**决策**：`src/api/client.ts` 暴露 `request<T>({ method, path, schema, ... })`。dev 时用 `Map<string, MockHandler>` 按 `method+path` 精确匹配 + 200ms 模拟延迟；prod 时直接 `fetch`。
**理由**：实现「切真后端 0 改动」的关键就是这一层。endpoints 只调 `request()`，不知道是 mock 还是真后端。
**对路径模板的处理**：用 query 参数代替路径参数（如 `getNote(id)` → `GET /notes/get?id=…`），避免 dispatcher 实现路径匹配解析。

## R3 · `await import('./mock/handlers')` in `api/index.ts`

**决策**：在 dev 模式下顶层 `await import` mock handlers。Vite 的 ESM 配合 `import.meta.env.DEV` 会让 prod build 把整个分支移除。
**拒绝**：
- 在 main.tsx 静态 import → 进入 prod bundle
- 不 await（fire-and-forget）→ 极早期请求可能 race condition

## R3 · 末尾 contracts commit（独立）

**决策**：R3 主体（layout / router / auth）一个 commit；contracts step（schemas + endpoint stubs + mock fixtures + hook signatures）单独 commit。
**理由**：让 R4 4 个并行 subagent 真正独立 —— 谁都不用先建 NoteSchema，schema 在 contracts 里冻结后任何 agent 都能直接 import。事后回滚时也能定向 revert contracts 而不影响 R3 主体。
**结果**：R4 home/browse/editor/login 4 个 subagent 并行通过零 schema 冲突；4 个 commit 各自独立。

## R3 · LoginPage 双轨

**决策**：R3 给 LoginPage 写「functional minimum-viable」版本（受控 form + sonner toast + enterAsGuest）；R4 subagent D 替换为「双栏 BrandPanel + RHF + zodResolver + 字段红字双重提示」完整版。
**理由**：R3 验收要求「输入 20210001/123456 → 跳 /」可工作；不能等到 R4 才有可用登录。R4 把它从「能用」升级到「正式」。

## R4a · NoteCard 共享位置

**决策**：放 `src/components/common/NoteCard.tsx`，home + browse 都 import 它。
**理由**：spec 原文「NoteCard.tsx —— 通用卡片（被 home 也复用）」放在 features/browse/ 会让 home 跨 feature import，违反「features 之间不互相依赖」原则。
**拒绝**：放 features/browse/（spec 原始位置）→ 跨 feature 耦合。

## R4b · `lib/highlight.tsx` 用 split + capture group

**决策**：`text.split(re)`（re 含 capture group）→ 偶数 index 是非匹配段，奇数 index 是匹配段，分别渲染为 `<Fragment>` / `<mark>`。
**理由**：避免 `dangerouslySetInnerHTML`（XSS 安全）；返回的 React 节点天然可继承样式。
**拒绝**：`text.replace(re, '<mark>$1</mark>')` + `dangerouslySetInnerHTML` —— 用户搜索词来自 URL 可能包含 HTML，被注入。

## R4c · diff char-level + cleanupSemantic

**决策**：`diff_match_patch.diff_main()`（默认 char-level）+ `diff_cleanupSemantic()`。
**理由**：spec 说「中文字级 / 英文词级」。`diff_main` 默认就是字级，对中文天然合理；`cleanupSemantic` 把英文字级合并成可读语义块，近似「词级」。
**拒绝**：写自己的 token 化器 → 工作量大但产出和 cleanupSemantic 差异不大。

## R4c · 整块 accept/reject vs per-segment

**决策**：本轮只实现「全部采纳 / 拒绝」整块按钮；per-segment 接受拒绝（spec：✓Check 绿 / ✗X 灰 hover 修改块时淡入）**未实现**。
**理由**：每个段独立按钮 + 状态管理工作量与 R4 时间预算不匹配；R5 报告中标注为遗留 issue。

## R4c · WritePage chunk 大小

**决策**：spec 包体积优化建议（`highlight.js` core + 按需注册语言；`katex` 在 preview 检测 `$$` 时 dynamic import）**未实施**。
**理由**：写作页是 lazy chunk，主 bundle gzip 仍 144 KB（< 200 KB R5 budget），首屏不受影响。WritePage 自身 gzip 464 KB 是已知偏差，文档化为后续优化项。

## R5 · 单测覆盖 lib/* + schemas/* + diffEngine + CategoryBadge

**决策**：72 个单测，覆盖 `lib/*`（cn / highlight / categories）+ `api/schemas/*`（zod 边界）+ `features/editor/ai/diffEngine`（中英混合）+ `components/common/CategoryBadge`（4 variant + a11y）。
**拒绝**：组件级集成测试（NoteCard / Header / WritePage）→ 工作量大，价值远低于 schema/util 测试。E2E 走 Playwright，但本机 OS deps 不可用，留给配好环境的机器跑。

## R5 · Husky 接 parent repo

**决策**：`git config core.hooksPath frontend/.husky`，hooks 改用 `pnpm -C frontend exec lint-staged` 让 cwd 不重要。
**理由**：frontend 是 Aurash 子目录，`.git` 在父级；husky 9 默认行为找不到。`-C frontend` 让 pnpm 自己 resolve package.json 路径。
