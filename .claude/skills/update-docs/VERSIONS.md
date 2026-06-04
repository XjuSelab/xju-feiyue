# 飞跃文档版本记忆

> 由 `update-docs` skill 维护。**最新在最上**。
> 每次跑:读顶部条目的 `since` → `git log <since>..HEAD` + 当前对话 → 归纳本版 → 在此**置顶**追加新条目。
> `since` = 该版本覆盖到的 commit(下一版从此往后 diff)。

---

## v0.1.0 · 2026-06-04 · since: fedbb86

**基线**:首次建立 README 全量重写 + GitHub Pages 发展历程页 + 本 skill。

- **README.md**:全量重写——简介 / 功能特性 / 技术栈 / 架构 / 开发历程(Claude 5 轮设计 → Phase 1-10)/ 贡献者(winbeau 182 commit + Claude co-author)/ 规模 / 部署 / 本地开发 / 贡献 / 致谢。修正 prod 为 SQLite(非 Postgres)。
- **site/index.html**:飞跃 Notion 风自包含单页——数据卡片、版本里程碑时间轴(倒序,最新在上)、起源叙事、bug 攻关、架构图 FIG1。CSS 字号 ×1.7、正文列宽 1040px、右上角固定 GitHub 角标(XjuSelab/xju-feiyue)。
- **部署**:`.github/workflows/deploy-pages.yml`(GitHub Actions,仅团队库)→ https://xjuselab.github.io/xju-feiyue/。
- **前端**:顶栏右上角 `GitHubStars` 角标(实时 ★star + 👁watch,缓存 1h)。
- **规模(prod DB 2026-06-04)**:用户 108 / 笔记 85 / 资料 8(55 文件)/ 点赞 41 / 评论 2 / 去重活跃登录 25。
- **当前 Phase 数:10**(最新 = Phase 10 学分统计 /credits + 教务一键导入)。**下一个里程碑为 Phase 11。**
