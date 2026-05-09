=== Round 3：布局与路由骨架（subagent: layout-agent）===

依赖 Round 2 完成。任务：搭出全站可用的 Header / MegaMenu / Footer / 路由 / 守卫，页面内容用占位。

【步骤】
1. src/router.tsx —— React Router v6，所有路由 lazy + Suspense + ErrorBoundary：
   /login                     → LoginPage
   /                          → HomePage（包 RequireAccess，游客可看，未登录非游客跳 /login）
   /browse                    → BrowsePage
   /write                     → WritePage（必须登录）
   /write/:draftId            → WritePage
   /note/:id                  → NoteDetailPage（占位）
   /me                        → ProfilePage（占位）
   /_dev/*                    → 仅 import.meta.env.DEV 时挂载

2. src/stores/authStore.ts（zustand，持久化到 localStorage）：
```ts
   type Mode = 'authed' | 'guest' | 'anon';
   interface AuthState {
     user: User | null;
     mode: Mode;
     login: (sid: string, password: string) => Promise<void>;
     logout: () => void;
     enterAsGuest: () => void;
   }
```
   login 调 src/api/endpoints/auth.ts 的 mock 实现（学号 20210001 / 密码 123456 通过）

3. src/components/layout/RequireAccess.tsx —— 守卫
   - 配置 { requireAuth?: boolean, allowGuest?: boolean }
   - 不满足跳 /login 并保留 from

4. src/components/layout/Header.tsx —— sticky，56px 高，下方 1px border
   左：Logo "📓 LabNotes" → 点击回 /
   中：导航（主页 / 浏览 / 写作）
   右：搜索框（240px，仅 UI，点击进 /browse?q=xxx）+ 头像下拉
   游客模式：右侧显示游客 badge + [登录] 按钮，无头像下拉

5. src/components/layout/MegaMenu.tsx —— Radix Popover 实现
   - hover "浏览" 200ms 后展开，移开延迟 150ms 关闭
   - 点击"浏览"文字本身跳 /browse
   - 1080px 宽，4×2 网格 + 底部三栏（本周热门 / 高赞收藏 / 最新发布）
   - 底部数据通过 useQuery 拉 mock，本轮先用静态占位
   - 第 8 格"全部笔记"，黑底白字 LayoutGrid 图标
   - 移动端（< md 断点）改为 Sheet 抽屉，从右滑入
   - Esc 关闭、Tab 可达

6. src/components/layout/Footer.tsx —— 60px 高，居中文字

7. src/components/layout/AppShell.tsx —— Header + <Outlet /> + Footer，登录页不套 AppShell

8. src/api/endpoints/auth.ts 的 mock 实现（本轮提前做，因为登录守卫要用）：
   - login(sid, password) → 校验后返回 { user, token }
   - me() → 从 localStorage 读 token 返回 user
   - logout()

9. 占位页面：HomePage / BrowsePage / WritePage / LoginPage / NoteDetailPage / ProfilePage
   每个挂一段 "<PageName> placeholder" 文案，方便路由验证

【验证 — Playwright MCP 串流测试】
1. 访问 /login → 截图 round-3-login.png
2. 输入 20210001 / 123456 → 提交 → 跳 / → 头像区出现 → 截图 round-3-home-authed.png
3. 退出登录 → 跳 /login → 点"以游客身份浏览" → 跳 / → 出现游客 badge → 截图 round-3-guest.png
4. hover "浏览" 文字 250ms → 截图 round-3-megamenu.png
   验证：4×2 网格 + 底部三栏 + 阴影 + 圆角 12px
5. 鼠标移开 → 200ms 后面板消失
6. 点击 mega menu 中"科研"卡片 → 跳 /browse?cat=research → URL 正确
7. 游客状态访问 /write → 跳 /login，from 参数 = /write
8. 键盘测试：Tab 到"浏览"按 Enter → 面板展开 → Esc 关闭

【报告】
- 路由树 ASCII
- 6 张截图
- 守卫、megamenu、移动端 Sheet 是否符合预期
- pnpm typecheck / lint / build 结果
