---
name: update-docs
description: 更新飞跃项目对外文档——README.md 与 GitHub Pages「发展历程」页 site/index.html。读取上一版本记忆(本目录 VERSIONS.md),依据最近 git 提交与当前对话归纳本次更新,在 VERSIONS.md 置顶追加新版本记录,刷新 Pages 时间轴(最新在最上)与 README/页面的真实规模数据,推两库自动部署。当用户说"更新 README / 更新 Pages / 更新发展历程 / 写版本记录 / 发个版 / 记一下这次更新 / changelog / 同步文档"等时触发。
---

# update-docs — 更新 README + GitHub Pages 发展历程页(带版本记忆)

维护飞跃项目两份对外文档并保留版本记忆。每次调用按下面步骤走;改完**推两库**,Pages 经
GitHub Actions 自动重部署。

## 产物与位置
- `README.md`(仓库根)——项目说明。
- `site/index.html`(自包含单文件 Pages 页)——发展历程/里程碑/规模/架构;经
  `.github/workflows/deploy-pages.yml` 部署到 **https://xjuselab.github.io/xju-feiyue/**
  (Pages 源已是 GitHub Actions,改 `site/**` push 团队库即自动重部署)。
- `skills/update-docs/VERSIONS.md`(本目录)——**版本记忆,最新在上,git 追踪**。

## 步骤

### 1) 读上一版本记忆
读本目录 `VERSIONS.md` **顶部**条目,取:上次版本号、`since:`(上次覆盖到的 commit SHA)、上次日期、当时的 Phase 数。

### 2) 收集本次变更
- `git log <上次 since>..HEAD --oneline`(本次涉及的提交)。
- 结合**当前对话**里用户诉求与已落地改动,归纳"这一版做了什么"(功能 / 修复 / 优化)。
- 里程碑级新功能 → 准备一条新的 timeline 条目(Phase N+1);仅小修补 → 只更 VERSIONS + 规模数字。

### 3) 刷新规模数据(prod DB 真实值,**绝不编造**)
prod 数据库是 huawei2 上的 **SQLite**(`~/Aurash/backend/labnotes.db`,不是 Postgres)。经 tmux 远程查:
```bash
~/.claude/skills/tmux-ssh-remote/tmux-inject.sh -t 60 --auto-recover "Aurash" \
  'python3 - ~/Aurash/backend/labnotes.db <<PYEOF
import sqlite3,sys; c=sqlite3.connect(sys.argv[1]).cursor()
f=lambda q:c.execute(q).fetchone()[0]
for t in ["users","notes","material_resources","material_files","likes","comments"]:
    print(t, f(f"select count(*) from {t}"))
print("distinct_login", f("select count(distinct user_sid) from login_events"))
PYEOF'
```
(若没有 tmux 会话,先用 tmux-ssh-remote skill 拉起名为 `Aurash` 的双跳会话:`ssh -t wsl "ssh -t huawei2"`。)

### 4) 更新 `site/index.html`
- **时间轴倒序约定:最新在最上**。有新里程碑就在 `<div class="timeline">` 内**最前面**插入一个新
  `<div class="tl-item done">`,照搬现有结构(`tl-dot` / `tl-date` / `tl-tag` "Phase N+1" / `tl-title` / `tl-body`)。
- 更新 Section 04 引导句的日期与提交数:"从 2026-05-09 到 <今天>、历经 N 天、M 次提交"。
  M = `git rev-list --count HEAD`;N = 距 2026-05-09 的天数。
- 更新数据卡片(`.stats-grid`)为步骤 3 的真实值。
- **样式基线勿改**(飞跃 Notion 风):浅底 `#f7f6f3` / 正文 `#37352f` / 次要 `#787774` /
  强调绿 `#0f7b6c` / 细边 `#edece9` / 衬线标题;CSS 字号已统一 ×1.7、正文列宽 `1040px`、
  右上角固定 `.gh-badge` GitHub 角标(在 `.doc` 之外,不随正文放大)——这些保持不动。

### 5) 更新 `README.md`
- 「规模数据」表 + 简介段数字 → 步骤 3 真实值。
- 有新 Phase → 「开发历程亮点」表补一行(该表按时间正序叙事,往后加即可)。
- 新功能 → 补进「功能特性」对应小节。
- 贡献者 co-author 数刷新:`git log --format='%(trailers:key=Co-authored-by,valueonly)' | sed '/^$/d' | sort | uniq -c | sort -rn`。

### 6) 写新版本记忆
在 `VERSIONS.md` **顶部**追加新条目:版本号(自增,如 v0.2.0)、日期、`since: <本次 git rev-parse HEAD 提交前的 SHA>`、变更摘要、README/Pages 各更新了什么、当前 Phase 数。

### 7) 验证(UI 改动必做)
本地起 http 服 `site/`(`python3 -m http.server <port>`),playwright **1440 视口**截图:确认
①无横向溢出 ②时间轴最新在最上 ③数据卡片正确 ④右上角角标在位。参见全局「改完 UI 必 playwright 验」习惯。

### 8) 提交并部署
- `git add README.md site/index.html skills/update-docs/VERSIONS.md`(+ frontend 改动若有)。
- commit(conventional:`docs:` 或 `feat:` 前缀,正文写本版要点)。
- **推两库**:`git push origin main && git push xju main`(团队库 `XjuSelab/xju-feiyue` + 部署源 `winbeau/Aurash`)。
- 推 xju 后 `site/**` 改动触发 Actions 重部署 Pages;`gh run list --repo XjuSelab/xju-feiyue --workflow deploy-pages.yml -L1` 看 success。
- 只动 `README.md`/`site/` → 无需 FE 部署;若动了 `frontend/` → 还要 FE 部署(huawei2 `git pull` + `pnpm build`)。
- `curl https://xjuselab.github.io/xju-feiyue/` 复验上线内容(注意 base 域名;Pages CDN 可能延迟几十秒)。

## 红线
- 规模数字一律来自 prod DB,不编造、不臆测。
- 时间轴**最新在最上**;新里程碑放顶部。
- 配色 / 字号 / 角标基线已定,别擅改。
- README/Pages 对外可见,推送即公开——推前确认内容无误。
