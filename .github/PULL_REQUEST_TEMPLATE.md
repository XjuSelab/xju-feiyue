# Pull Request

## Summary

<!-- 一两句话：改了什么 / 为什么 -->

## Changes

<!-- bullet list，按数据层 / state / UI / docs / tests 分组 -->

- [ ] 数据层：
- [ ] State / store：
- [ ] UI / 组件：
- [ ] 文档：
- [ ] 测试：

## Verification

```bash
cd frontend
pnpm typecheck     # ✓
pnpm lint          # ✓
pnpm test          # ✓
pnpm build         # ✓ (gzip JS: ___ KB)
```

<!-- 如果有视觉改动，贴前后截图（design 系统对比 / dev /_dev/design-system 截图） -->

## Spec / contracts impact

- [ ] 没动 `api/schemas/*`、`api/endpoints/*` 函数签名、TanStack Query hook 签名
- [ ] 或：动了，已同步更新 `docs/architecture.md` + 通知所有 feature owner

## A11y / 三态

- [ ] 新交互元素带 `aria-label`
- [ ] 新数据组件三态完整（loading / empty / error + retry）
- [ ] 键盘可达

## 偏差披露

<!-- 与 spec 任何不一致的地方？是否进入 docs/design-decisions.md？-->

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
