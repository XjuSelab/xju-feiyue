=== Round 5：集成验证（subagent: qa-agent，单 agent 收口）===

任务：4 个 agent 并行可能产生集成冲突，本轮统一收口 + 健壮性 + 视觉回归。

【检查清单】

1. 跨页面一致性
   - grep 全项目，确认所有类别展示走 CategoryBadge，硬编码色值（#E03E3E 等）只能出现在 tokens.css
   - 所有 Markdown 渲染走 <Markdown /> 或 .prose-claude
   - 按钮 size/variant 收敛在 default / sm / ghost / outline 四种内
   - 删除任何重复实现（比如多个地方各写了一份代码块复制按钮）

2. 数据层审计
   - 全局搜 mock/notes.json 引用，确认只在 mock/handlers.ts 出现
   - 全局搜 fetch，确认只在 api/client.ts 出现
   - 所有 endpoints 输入输出都过 zod parse
   - 模拟切真后端：临时改 client.ts 的 baseURL，注释掉 mock handlers，确认业务代码 0 改动

3. 状态管理审计
   - 仅 authStore / draftStore / uiStore 三个 zustand
   - 业务数据全部走 TanStack Query
   - 列出所有 useState 中超过 3 个字段的对象，建议拆分或迁 zustand

4. 性能
   - vite-bundle-visualizer 跑一次，截图 bundle 组成
   - 主页首屏 JS < 200KB（gzip）
   - 路由 lazy 全部到位
   - 编辑器 / 预览组件 React.memo
   - mega menu 内容懒加载

5. 可访问性
   - axe-core 跑各页面，0 critical 违规
   - 全键盘流程：Tab 完成登录 + 写作页选区 + AI 操作

6. 错误处理
   - 删 mock 数据返回空数组 → empty state
   - 让 mock handlers 抛错 → ErrorState 渲染 + retry 按钮可恢复
   - 在某组件故意 throw → ErrorBoundary 兜住 + 不影响其他路由

7. 视觉回归
   playwright/visual.spec.ts —— 对每个页面截图，与 round-4-*.png 像素对比，差异 > 2% 报警

8. 测试覆盖
   单测要求覆盖：
   - src/lib/* 工具函数 100%
   - src/api/schemas/* zod 边界
   - src/features/editor/ai/diffEngine.ts 中英混合用例
   - src/components/common/CategoryBadge.tsx 四种 variant

9. 文档
   - README.md 更新到最终版（启动 / 部署 / 目录 / 数据层 / 测试）
   - docs/architecture.md —— Mermaid 数据流图 + 路由图 + 组件分层
   - docs/design-decisions.md —— 5 轮关键决策记录
   - CONTRIBUTING.md —— 分支命名 / conventional commits / PR 模板
   - .github/PULL_REQUEST_TEMPLATE.md

【最终交付】
INTEGRATION_REPORT.md，结构：
1. 总览（5 轮里程碑表格）
2. 与 design 稿的偏差及理由
3. 已知遗留 issue
4. 性能报告（bundle / Lighthouse）
5. 测试覆盖率
6. 下一阶段建议（接真后端 / 暗色模式 / i18n / 笔记详情页 / 评论系统）

最后用 Playwright 录一段 30 秒的 demo video（playwright.config.ts video: 'on'），
完整跑一遍：登录 → 浏览 → 搜索 → 写作 → AI 润色 → 采纳 → 发布弹窗。

【报告】
- INTEGRATION_REPORT.md 完整内容
- 视觉回归差异表
- 测试覆盖率截图
- demo 视频路径
