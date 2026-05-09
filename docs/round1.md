=== Round 1：工程基建（subagent: infra-agent）===

任务：在 frontend/ 目录从 0 搭建工程骨架，不写任何业务代码。

【步骤】
1. 在 frontend/ 执行 pnpm create vite . --template react-ts，整理生成物
2. 安装核心依赖：
   pnpm add react-router-dom@6 zustand @tanstack/react-query zod
   pnpm add react-hook-form @hookform/resolvers
   pnpm add clsx tailwind-merge class-variance-authority
   pnpm add lucide-react
3. 安装开发依赖：
   pnpm add -D tailwindcss postcss autoprefixer
   pnpm add -D @types/node
   pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
   pnpm add -D @playwright/test
   pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
   pnpm add -D prettier eslint-config-prettier
   pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional
4. tsconfig.json 配 strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + paths "@/*": ["./src/*"]
5. vite.config.ts 配 alias、@vitejs/plugin-react、test 配置（环境 jsdom）
6. tailwind.config.ts —— 本轮先建空架子，CSS 变量与 token 留给 Round 2
7. 初始化 shadcn/ui：
   pnpm dlx shadcn@latest init
   选择：new-york 风格、base color stone、CSS variables
   （只 init，不安装具体组件，那是 Round 2 的事）
8. ESLint flat config（eslint.config.js），Prettier，Husky pre-commit 跑 lint-staged，commit-msg 跑 commitlint
9. Playwright 初始化：pnpm dlx playwright install --with-deps chromium，
   playwright.config.ts 设 baseURL http://localhost:5173，配 webServer 自动起 dev
10. 建好下面所有目录与占位 index.ts（避免空目录被 git 忽略）：

    src/
      api/
        endpoints/
        schemas/
        mock/
        client.ts
        index.ts
      assets/
      components/
        ui/                  # shadcn 生成位置
        layout/
        common/
      features/
        auth/
        editor/
        browse/
        home/
      hooks/
      lib/
        cn.ts                # tailwind-merge 封装
        utils.ts
      pages/
      stores/
      styles/
        tokens.css           # 占位
        prose-claude.css     # 占位
        globals.css
      types/
      router.tsx             # 占位，挂一个根路由
      App.tsx
      main.tsx

11. src/main.tsx 渲染 App，App 渲染一个最小占位 "LabNotes — Round 1 ready"
12. 编写 README.md：
    - 项目简介
    - 启动命令（pnpm dev / build / typecheck / lint / test / e2e）
    - 目录约定
    - 数据层架构图（Mermaid）
    - Round 进度勾选表
13. 在根目录加 .gitignore、.editorconfig、.nvmrc（写 lts/iron 即 Node 20）

【验证】
- pnpm install 成功
- pnpm dev 起来，访问 / 看到占位文字
- pnpm typecheck 0 错误
- pnpm lint 0 错误
- pnpm build 成功
- 调用 Playwright MCP 截图：访问 http://localhost:5173 → round-1-empty.png

【报告】
输出：
- 目录树（tree -L 3 -I 'node_modules|dist'）
- package.json scripts 段落
- 启动截图
- 与本提示词的任何偏差及原因
