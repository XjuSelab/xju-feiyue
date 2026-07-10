# 飞跃文档版本记忆

> 由 `update-docs` skill 维护。**最新在最上**。
> 每次跑:读顶部条目的 `since` → `git log <since>..HEAD` + 当前对话 → 归纳本版 → 在此**置顶**追加新条目。
> `since` = 该版本覆盖到的 commit(下一版从此往后 diff)。

---

## v0.2.0 · 2026-07-09 · since: a983090

**主题**:README 全量重写为 GitHub 风格(对齐 XjuSelab 组织主页 README)+ 时间轴补 Phase 11/12 + 仓库根目录清理。

- **README.md**:全量重写——居中头部(标题/双语副标/箴言/5 枚 flat-square 徽章,配色对齐 org 主页 2383E2/0F7B6C/9065B0/37352F)、`中文 · English` 双语小节、`:--` 对齐表格、居中 footer。内容新增:社区互动与成长体系(楼中楼/点踩收藏/合集/举报工单+AI 预审/等级签到/限流)、班级空间 /class、管理后台四 Tab、Phase 11/12、贡献者表刷新(winbeau 236 / tyhlt114514-stack 44 / wyiting235-creator 1 / Wenbiao Zhao 1;co-author: Opus 4.7 ×132 / Opus 4.8 1M ×55 / **Fable 5 ×15** / Opus 4.7 1M ×9)、后端服务名改 feiyue-backend、测试规模(pytest 281 / vitest 448)。
- **site/index.html**:时间轴置顶插入 Phase 12(2026-07-09 社区互动与成长体系,首批同学 PR 合入)与 Phase 11(2026-07-04~07 班级空间);Section 04 引导句更新为 61 天/282 次提交/十二大里程碑;TL;DR 与 Section 01 简介补社区/班级;ftag 增 5 枚(楼中楼/收藏合集/举报工单/等级签到/班级空间)。样式基线未动。
- **仓库清理(同日 a983090/02deadc)**:删 feiyue.doc.bak(与 文档模板.doc md5 相同)与误提交的 ~$考勤.docx;根目录 5 个课程文档归位 docs/;uv.lock + 3 个 e2e spec + greeting 单测入库。
- **规模数据**:⚠️ 本次 prod DB 查询被权限分类器拦截(生产读需人工确认),平台数字沿用 2026-06-04 已核实值并明确标注日期;仓库数字(282 commits/61 天/测试数)为本地 git 事实。**下次跑本 skill 优先补一次 prod 统计刷新。**
- **当前 Phase 数:12**(最新 = Phase 12 社区互动与成长体系)。**下一个里程碑为 Phase 13。**
- 注:本仓库 clone 只配了 origin(XjuSelab/xju-feiyue),无 winbeau/Aurash remote;Pages 部署走 origin push 即触发。

---

## v0.1.0 · 2026-06-04 · since: fedbb86

**基线**:首次建立 README 全量重写 + GitHub Pages 发展历程页 + 本 skill。

- **README.md**:全量重写——简介 / 功能特性 / 技术栈 / 架构 / 开发历程(Claude 5 轮设计 → Phase 1-10)/ 贡献者(winbeau 182 commit + Claude co-author)/ 规模 / 部署 / 本地开发 / 贡献 / 致谢。修正 prod 为 SQLite(非 Postgres)。
- **site/index.html**:飞跃 Notion 风自包含单页——数据卡片、版本里程碑时间轴(倒序,最新在上)、起源叙事、bug 攻关、架构图 FIG1。CSS 字号 ×1.7、正文列宽 1040px、右上角固定 GitHub 角标(XjuSelab/xju-feiyue)。
- **部署**:`.github/workflows/deploy-pages.yml`(GitHub Actions,仅团队库)→ https://xjuselab.github.io/xju-feiyue/。
- **前端**:顶栏右上角 `GitHubStars` 角标(实时 ★star + 👁watch,缓存 1h)。
- **规模(prod DB 2026-06-04)**:用户 108 / 笔记 85 / 资料 8(55 文件)/ 点赞 41 / 评论 2 / 去重活跃登录 25。
- **当前 Phase 数:10**(最新 = Phase 10 学分统计 /credits + 教务一键导入)。**下一个里程碑为 Phase 11。**
