=== Round 2：设计系统迁移（subagent: design-system-agent）===

依赖 Round 1 完成。任务：把 design/ 中的视觉规范固化成可复用的 tokens、组件、prose-claude 容器。

【步骤】
1. 读取 design/pages/design-system.html、design/stylesheets/styles.css、design/components/icons.jsx，提取：
   - 7 个类别色 hex
   - 三套字体栈
   - 灰阶（#37352F / #787774 / #9B9A97 / #EDECE9 / #F7F6F3 / #FFFFFF）
   - 圆角（按钮 6 / 卡片 8 / mega menu 12）
   - 间距尺度
   - 过渡 150ms

2. src/styles/tokens.css —— 用 CSS 变量定义所有 token：
```css
   :root {
     --color-bg: #FFFFFF;
     --color-bg-subtle: #F7F6F3;
     --color-text: #37352F;
     --color-text-muted: #787774;
     --color-text-faint: #9B9A97;
     --color-border: #EDECE9;
     --color-link: #2383E2;
     --cat-research: #E03E3E;
     --cat-course: #D9730D;
     --cat-recommend: #9065B0;
     --cat-competition: #B8405E;
     --cat-kaggle: #0B6E99;
     --cat-tools: #0F7B6C;
     --cat-life: #B5926A;
     --font-serif: 'Source Serif 4', 'Noto Serif SC', Georgia, serif;
     --font-sans: 'Inter Tight', 'PingFang SC', -apple-system, sans-serif;
     --font-mono: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
     --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px;
     --transition: 150ms ease;
   }
```

3. tailwind.config.ts 把上述 CSS 变量映射进 theme.extend：
   - colors: { bg, 'bg-subtle', text, 'text-muted', 'text-faint', border, link, 'cat-research'...'cat-life' }
   - fontFamily: { serif, sans, mono }
   - borderRadius: { sm, md, lg }
   - transitionDuration: { DEFAULT: '150ms' }

4. src/styles/globals.css：引入 tokens.css、引入 Tailwind 三件套指令、引入 Google Fonts（Source Serif 4 / Inter Tight / JetBrains Mono）、设置 body 默认字体与背景

5. src/styles/prose-claude.css —— 严格复刻 Claude 导出 PDF 排版：
   - 容器 max-width: 720px
   - H1/H2 用 serif，H2 下 1px 分割线
   - p line-height 1.75
   - blockquote 左 3px 实线 + 斜体
   - table 头部 bg-subtle + 圆角
   - 行内 code 浅灰底 + 红字
   - 块级 pre 浅灰底 + 圆角，预留语言标签和复制按钮位置（top-right）
   - 图片圆角 6px
   - 下方有 .prose-claude--dark 暗色变体占位

6. src/lib/categories.ts —— 7 个类别单一数据源：
```ts
   import { Microscope, BookOpen, GraduationCap, Trophy, BarChart3, Wrench, Coffee } from 'lucide-react';
   export const CATEGORIES = [
     { id: 'research',    label: '科研',   icon: Microscope,    colorVar: '--cat-research',    desc: '论文阅读 · 实验设计 · 组会汇报' },
     { id: 'course',      label: '课程',   icon: BookOpen,      colorVar: '--cat-course',      desc: '课堂笔记 · 作业整理 · 考试复习' },
     { id: 'recommend',   label: '推免',   icon: GraduationCap, colorVar: '--cat-recommend',   desc: '夏令营 · 预推免 · 套磁经验' },
     { id: 'competition', label: '竞赛',   icon: Trophy,        colorVar: '--cat-competition', desc: '数模 · ACM · 创新创业赛' },
     { id: 'kaggle',      label: 'Kaggle', icon: BarChart3,     colorVar: '--cat-kaggle',      desc: '比赛复盘 · 特征工程 · 模型 trick' },
     { id: 'tools',       label: '工具',   icon: Wrench,        colorVar: '--cat-tools',       desc: 'Linux · Git · LaTeX · 服务器' },
     { id: 'life',        label: '生活',   icon: Coffee,        colorVar: '--cat-life',        desc: '实验室日常 · 心情碎片 · 城市记录' },
   ] as const;
   export type CategoryId = typeof CATEGORIES[number]['id'];
   export const getCategory = (id: CategoryId) => CATEGORIES.find(c => c.id === id)!;
```

7. 通过 shadcn CLI 安装本期需要的组件：
   pnpm dlx shadcn@latest add button input textarea label badge card dialog dropdown-menu popover tooltip tabs select separator scroll-area sheet sonner skeleton

8. src/components/common/ 通用业务组件：
   - CategoryBadge.tsx —— props { categoryId, variant: 'dot' | 'chip' | 'icon-chip' | 'full' }
   - CodeBlock.tsx —— hover 显示复制按钮，点击 navigator.clipboard.writeText，显示 "Copied ✓" 1.5s
   - Markdown.tsx —— 封装 react-markdown + 全部 plugins，套 .prose-claude，code 走 CodeBlock
   - EmptyState.tsx / ErrorState.tsx / LoadingSkeleton.tsx —— 三态组件

9. src/pages/_dev/DesignSystemPage.tsx —— 仅 dev 挂载到 /_dev/design-system，
   展示：色板 / 字体 / 圆角 / 阴影 / 所有 ui/ 组件 / CategoryBadge 4 种变体 / CodeBlock / Markdown 渲染样例

10. src/lib/cn.ts：
```ts
    import { clsx, type ClassValue } from 'clsx';
    import { twMerge } from 'tailwind-merge';
    export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

【验证】
- pnpm typecheck && pnpm lint && pnpm build 0 错误
- pnpm dev 启动后访问 /_dev/design-system，Playwright MCP 截图：
  · round-2-tokens.png（色板 + 字体）
  · round-2-components.png（所有 ui 组件 + CategoryBadge）
  · round-2-prose-claude.png（Markdown 渲染样例，含代码块 hover 状态）
- 对照 design/pages/design-system.html，列出超过 2px 或 hex 不一致的差异点

【报告】
- 变更文件清单
- 三张截图
- 视觉差异表（设计稿值 / 实现值 / 偏差原因 / 是否需要回退修改）
