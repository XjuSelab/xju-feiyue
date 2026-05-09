=== Round 4：业务页面（请同时启动 4 个 subagent 并行执行 A/B/C/D）===

依赖 Round 3 完成。4 个 agent 互不依赖，并行工作。所有 agent 共同遵守：
- 所有数据通过 src/api/endpoints/* 走 TanStack Query
- 不允许在组件直接写假数据，假数据放 src/api/mock/
- props 用 type 不用 interface
- 文件超 250 行主动拆分
- 三态完整：loading（Skeleton）/ empty（EmptyState）/ error（ErrorState）

──────────────────────────────────
【subagent A：home-agent】

迁移 design/pages/home.html → src/features/home/ + src/pages/HomePage.tsx

文件：
- src/api/schemas/note.ts —— Zod schema：Note { id, title, summary, cover?, category, tags[], author, createdAt, likes, comments, readMinutes }
- src/api/endpoints/notes.ts —— listNotes / getHotThisWeek / getLatest / getMostLiked
- src/api/mock/notes.json —— 14 条贴近实验室真实场景的笔记（每类 2 条）
- src/api/mock/handlers.ts —— 200ms 延迟的 mock dispatcher
- src/api/index.ts —— 暴露 hooks: useNotes / useHotNotes / useLatestNotes...
- src/features/home/sections/WelcomeSection.tsx
- src/features/home/sections/CategoryGrid.tsx —— 七大板块 4×2 网格，桌面 4 列两行，移动单列
- src/features/home/sections/LatestFeed.tsx
- src/features/home/sections/HotCarousel.tsx
- src/pages/HomePage.tsx —— 组装 + Suspense 边界

──────────────────────────────────
【subagent B：browse-agent】

迁移 design/pages/browse.html → src/features/browse/ + src/pages/BrowsePage.tsx

文件：
- src/features/browse/FilterSidebar.tsx —— 8 行类别（含全部）+ 排序 + 筛选 chips
- src/features/browse/SearchBar.tsx
- src/features/browse/NoteCard.tsx —— 通用卡片（被 home 也复用）
- src/features/browse/NoteGrid.tsx —— useInfiniteQuery 分页
- src/features/browse/RightRail.tsx —— 热门标签 / 活跃作者 / 时间线
- src/features/browse/useBrowseParams.ts —— useSearchParams 双向同步 cat/sort/q/tags
- src/pages/BrowsePage.tsx
- 搜索结果命中关键词高亮（lib/highlight.ts，避免 dangerouslySetInnerHTML，用 React 节点）

──────────────────────────────────
【subagent C：editor-agent】★最复杂

迁移 design/pages/write.html + design/components/ai-drawer.jsx → src/features/editor/

依赖：
pnpm add @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/theme-one-dark @uiw/react-codemirror
pnpm add react-markdown remark-gfm rehype-highlight rehype-katex rehype-raw remark-math
pnpm add diff-match-patch
pnpm add -D @types/diff-match-patch
pnpm add highlight.js katex

文件：
- src/features/editor/WritePage.tsx —— 三栏容器（编辑 35 / 预览 35 / AI 30），抽屉收起时回 50/50
- src/features/editor/MarkdownEditor.tsx —— CodeMirror 6 包装，markdown 语法高亮，监听 selection
- src/features/editor/MarkdownPreview.tsx —— 复用 Round 2 的 <Markdown />，套 .prose-claude
- src/features/editor/toolbar/MainToolbar.tsx —— 标题 / 类别选择（7 项下拉）/ 保存草稿 / 发布
- src/features/editor/toolbar/SubToolbar.tsx —— Markdown 快捷按钮 + 标签输入 + 字数统计 + AI 入口 + 模式切换
- src/features/editor/ai/AIDrawer.tsx —— 抽屉头 + 操作选择区 + 结果区 + 操作栏 + 历史记录
- src/features/editor/ai/FloatingToolbar.tsx —— 选区 ≥4 字时浮出，5 个图标按钮
- src/features/editor/ai/DiffView.tsx —— 并排 + 行内两种模式，分块采纳/拒绝按钮
- src/features/editor/ai/diffEngine.ts —— diff-match-patch 中文字级粒度，输出 [{type, text}] 数组
- src/features/editor/ai/useAICompose.ts —— 流式 hook，调用 src/api/endpoints/ai.ts
- src/features/editor/hooks/useAutoSave.ts —— 草稿存 localStorage，draftStore 管理
- src/features/editor/hooks/useScrollSync.ts —— 编辑/预览滚动比例同步，debounce 50ms
- src/stores/draftStore.ts —— zustand 持久化
- src/api/endpoints/ai.ts —— mock 实现：返回预设 diff 数据（润色/精简/扩写/语气/翻译/自定义六个 mode），模拟 600-1200ms 延迟，伪流式按字符切片输出
- src/api/schemas/ai.ts

样式细节（严格遵守）：
- 删除：rgba(224,62,62,0.12) bg + #B91C1C 字 + line-through
- 新增：rgba(15,123,108,0.12) bg + #0F5E54 字 + underline
- diff 颗粒度：中文字级 / 英文词级
- 分块按钮：✓Check 绿 / ✗X 灰，hover 修改块时淡入

──────────────────────────────────
【subagent D：login-agent】

迁移 design/pages/login.html → src/features/auth/ + src/pages/LoginPage.tsx

文件：
- src/features/auth/LoginForm.tsx —— React Hook Form + zod，校验学号纯数字 8-12 位，密码非空
- src/features/auth/BrandPanel.tsx —— 左栏品牌区，7 张类别预览小卡片（4+3 自动排布）
- src/pages/LoginPage.tsx —— 两栏布局，登录页不套 AppShell
- 登录成功后读 location.state.from，无则回 /
- 错误用 sonner toast + 表单字段下方红字双重提示

──────────────────────────────────
【串联 Playwright E2E】

playwright/e2e/full-flow.spec.ts：

1. /login → 输入 20210001/123456 → 跳 /，截图 round-4-home.png
2. 滚动主页验证七大板块 4×2 渲染 → 截图 round-4-categories.png
3. hover 浏览 → 点 Kaggle → /browse?cat=kaggle，截图 round-4-browse-kaggle.png
4. 搜索"复盘" → 列表过滤 + 高亮，截图 round-4-search.png
5. 切换排序为"最热" → 列表重排
6. 点 mega menu 写作 → /write，截图 round-4-write-empty.png
7. 输入预设 markdown（含 H1/H2/列表/表格/代码块/数学公式）→ 预览实时渲染 → 截图 round-4-write-preview.png
8. hover 代码块 → Copy 按钮出现 → 点击 → 验证剪贴板内容 + "Copied ✓"
9. 选中预览中一段 → 浮动工具条出现 → 点"润色" → AI 抽屉展开 → diff 出现，截图 round-4-ai-sidebyside.png
10. 切换"行内对比"模式 → 截图 round-4-ai-inline.png
11. 点"全部采纳" → 编辑器内容更新 + toast，截图 round-4-ai-applied.png
12. 历史记录区点撤销 → 编辑器回滚

──────────────────────────────────
【每个 subagent 完成后报告】
- 新增/修改文件清单
- pnpm typecheck / lint 结果
- 自己负责页面的 Playwright 截图
- 与 design 稿的视觉差异（如有）
