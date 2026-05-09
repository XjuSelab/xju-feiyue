# Contributing to LabNotes

谢谢愿意参与。本仓库是 LabNotes 的 design + frontend 同仓项目，规则如下。

---

## 仓库结构

```
Aurash/
├── components/  pages/  stylesheets/      design 稿（HTML / CSS / JSX 参照）
├── docs/                                  spec + architecture + design-decisions
├── frontend/                              生产级 React 应用（本说明大部分针对它）
└── .github/PULL_REQUEST_TEMPLATE.md
```

进 frontend 干活：

```bash
cd frontend
pnpm install --prefer-offline
pnpm dev          # http://localhost:5173
```

> 资源提示：在 < 2 GB 内存的小机器上 pnpm install 约 5–10 分钟；如失败用 `pnpm install --network-concurrency=1`。

## 分支与 Commit

- 主开发分支：`main`（小团队 / solo project，直推 main）
- 大改动（接真后端、暗色模式、i18n）开 feature 分支：`feat/<area>` / `fix/<area>` / `chore/<area>`
- Commit 走 [Conventional Commits](https://www.conventionalcommits.org/)：
  - `feat(frontend/<area>): <subject>`
  - `fix(frontend/<area>): <subject>`
  - `docs(frontend): <subject>`
  - `chore(frontend): <subject>`
  - 大轮次用 `feat(frontend/round-<N>): …`
- header 长度上限 100 字符（commitlint 强制）；body 解释「为什么」而不是「做了什么」

## Hooks

`pre-commit` 跑 lint-staged（eslint --fix + prettier --write 改动文件）；
`commit-msg` 跑 commitlint。
通过 `git config core.hooksPath frontend/.husky` 接到本仓 `.git/hooks/`。
新克隆后 `cd frontend && pnpm install` 会触发 husky 的 prepare 脚本自动激活。

如需绕过（不推荐）：`git commit --no-verify`。

## 代码门槛

每个 PR / 直推 main 之前 **必须**：

```bash
cd frontend
pnpm typecheck   # 0 错误
pnpm lint        # 0 错误
pnpm test        # 全绿
pnpm build       # 成功 + 主 bundle gzip < 200 KB
```

如果 build 警告 chunk > 500 KB，看是 lazy 路由（可接受）还是首屏（必须修）。

## 数据层铁律

- 组件 / hook 不允许直接 `import` `mock/notes.json` 或调用 `fetch`
- 任何后端调用都通过 `src/api/endpoints/*.ts` 中的函数；进出过 zod schema
- 切真后端：改 `.env` 设 `VITE_API_BASE`，删 `api/index.ts` 中的 dev mock import；业务代码 0 改动
- Zustand stores 限定在 `src/stores/`，目前 2 个（auth / draft），uiStore 按需

## 设计 token 铁律

- 颜色 / 圆角 / 阴影 / 间距 / 过渡 → CSS 变量。**禁止硬编码 hex** 在 `tokens.css` 之外
- 类别色用 `var(--cat-<id>)`，tag 12% tint 用 `var(--tag-<id>-bg)`
- AI diff add/del 颜色已在 `--ai-add-*` / `--ai-del-*` 暴露，新组件不要再造一套

## A11y 检查清单（提交前）

- 交互元素 `aria-label`
- 表单 `aria-invalid` + `aria-describedby` 串错误信息
- 数据组件三态完整：`<LoadingSkeleton>` / `<EmptyState>` / `<ErrorState onRetry>`
- 路由 fallback 走 `<Suspense>`，errorElement 走 `<ErrorState>`
- 键盘可达：Tab 走完所有按钮 + Enter 触发 / Esc 关闭浮层

## 文件规模

- 单文件超 250 行就拆。`features/editor/WritePage.tsx` 是当前最大单文件，再加东西必拆。
- 测试覆盖底线：`lib/*` 100% / `api/schemas/*` 边界 / 关键 utility (`diffEngine`) 中英混合 case

## 写设计稿 / 文档

- design 稿改在 `components/` `pages/` `stylesheets/`，提交时打 `docs(design): …` tag 不打 frontend
- spec round 文档不再修改（已冻结）；新规范进 `docs/design-decisions.md`

---

## PR 模板

`.github/PULL_REQUEST_TEMPLATE.md` 已存。提交前过一遍：

- [ ] typecheck / lint / test / build 全绿
- [ ] commit message 符合 conventional commits
- [ ] 改动了 token / schema / endpoint 签名？同步更新 `docs/architecture.md` 或 `design-decisions.md`
- [ ] 添加 / 修改了组件？是否需要补单测？
- [ ] 截图或交互说明（如果是视觉改动）
