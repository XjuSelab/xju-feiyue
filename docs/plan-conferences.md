# 计算机会议页（CCF 会议）—— 多轮实现计划

> 落盘计划，供 clear 上下文后继续。设计稿在 `archive/design-refs/tmp/`（待归位）。

## Context / 目标

新增「CCF 会议」页：展示《CCF 推荐国际学术会议和期刊目录》第七版 ~230 个会议，
按领域 / 级别 / 截稿状态筛选，表格 + 时间线两视图，重点是**截稿日期 (deadline)**。
最终形态：
1. **基础数据表**：230 个计算机会议 → **转成 sqlite**（与 schools 同套路：只读 sqlite +
   gitignore + HF 同步，**不进 `labnotes.db`**）。
2. **爬虫更新**：每个会议 3 种爬取状态，3 种频率，DeepSeek v4-flash (no thinking) + 联网搜索
   （类 openclaw）+ 必要时 playwright 查证 / 复核截稿时间；爬虫即该 sqlite 的**生产者**
   （角色同 supervisor-claw 之于 schools.sqlite）。
3. **时间基于本年**，每年 1 月 1 日全部重置、重新查证下一周期。
4. **先前端，再爬虫**；**分多轮（R0–R3）实现**，每轮可独立 commit / 部署。

设计稿已就绪（`tmp/conferences.html` + `tmp/conferences-data.jsx`，含完整页面逻辑与
230 条数据），据此落地，**镜像 schools 功能 + schools 数据同步那一整套**。

---

## 架构（与 schools 对齐）

```
conferences-data.jsx  ──(R0 转换脚本)──▶  backend/data/conferences/
                                            ├── conferences.sqlite   (gitignored, 只读服务)
                                            └── manifest.json        (sha256 + counts, 同 schools)
        │                                         ▲
        └──(同源 emit)──▶ 前端种子 JSON/TS         │ 爬虫(R3) 读旧 sqlite→查证→原子写新 sqlite + 推 HF
                                                   │
后端只读 glue (R2, 镜像 schools_engine)  ◀─────────┘
   GET /conferences  ──▶  前端 react-query 拉全量(230行)→客户端筛选/排序/分类
HF: winbeau/xju-feiyue-data 数据集新增 conferences/ 命名空间(同 schools/ 平行)
```

要点：
- 会议 sqlite **只读服务**（同 schools：`mode=ro&immutable=1` + mtime 热加载），**爬虫是唯一写者**，
  原子替换文件后端自动热载。
- **gitignore** `backend/data/conferences/`；数据走 **HF `xju-feiyue-data` 的 `conferences/` 命名空间**，
  不进 git（参照 [[schools-data-in-git]]）。
- 只有 230 行 → 前端**一次拉全量、客户端筛选**，无需服务端分页（比 schools 简单）。

---

## 状态语义（先统一）

前端「显示状态」由 `deadline` 对比今天**纯前端推导**的 4 档（设计稿 `classify()`）：

| UI 档 | 条件 | 中文 |
|---|---|---|
| `tbd`    | deadline = null  | 未公布 |
| `closed` | deadline < 今天  | 已截止 |
| `soon`   | 0 ≤ 距今 ≤ 30 天 | 即将截稿 |
| `open`   | 距今 > 30 天     | 征稿中 |

爬虫「爬取状态」是更粗的 3 态，决定查证频率（存进 sqlite 的 `crawl_state` 列）：

| 爬取状态 | = UI 档 | 频率 | 理由 |
|---|---|---|---|
| 未公布 | `tbd` | **1 天/次** | 等官宣，尽快抓本年 CFP |
| 已公布 | `open` ∪ `soon`（deadline 在未来） | **5 天/次** | 主要查是否延期 + 复核准确 |
| 已截止 | `closed` | **不再查证** | 等 1 月 1 日重置 |

外加「**本年周期**」语义：1 月 1 日把所有会议打回「未公布」、清本周期动态字段、重新查证。

---

## sqlite schema（R0 定，爬虫 + 后端共用）

`conferences` 表（单表即可）：
- **静态**（CCF 目录种子，基本不变）：`id PK, abbr, name_full, field, tier(A|B|C), publisher, dblp`
- **动态**（按当年周期，爬虫写）：`homepage, cycle, location, conf_date, deadline(ISO|null), note`
- **爬虫状态**：`crawl_state('unannounced'|'announced'|'closed'), confidence(real), source_url,
  last_checked_at, next_check_at, target_year`
- `id` 沿用设计稿：`${field}-${tier}-${abbr去非字母小写}-${index}`

`field` 维表可选（10 个领域），也可前端写死 `CCF_FIELDS` 常量（推荐后者，省一张表）。
`manifest.json` 同 schools：`{schema_version, generated_at, counts:{conferences,...}, sqlite_sha256, sqlite_bytes}`，
供 HF 同步做完整性校验。

---

## R0 · 数据基建（设计稿归位 + jsx→sqlite + gitignore）

**A. design-refs 归位**（`tmp/` 4 文件：conferences 为新增；home/schools 仅各多 1 行 CCF 会议 tab，已 diff 确认）：
```bash
cd archive/design-refs
git mv tmp/conferences.html      pages/conferences.html
git mv tmp/conferences-data.jsx  components/conferences-data.jsx
mv     tmp/home.html             pages/home.html       # 覆盖：+CCF 会议 tab
mv     tmp/schools.html          pages/schools.html    # 覆盖：+CCF 会议 tab
rmdir  tmp
```
- 修 `conferences.html` 里对 data 的相对引用为 `../components/conferences-data.jsx`（对照 schools.html）。
- 更新 `README.md` 映射表加一行：`pages/conferences.html + components/conferences-data.jsx → frontend/src/features/conferences/`。

**B. 转换脚本**（一次源、两处 emit）：`scripts/conf_crawler/seed.py`（或 `scripts/seed_conferences.py`）
解析 `conferences-data.jsx` 的 `CCF_CONFS` / `CCF_FIELDS`（正则/轻量解析；或先人工转成中间 `conferences.seed.json`），产出：
1. `backend/data/conferences/conferences.sqlite`（建表 + 灌 230 行；`crawl_state` 按 deadline 推导；`next_check_at=now`）+ `manifest.json`；
2. 前端种子 `frontend/src/features/conferences/data.ts`（typed `CCF_FIELDS` + `CCF_CONFS`），供 R1 页面 / mock 用。

**C. gitignore**：`.gitignore` 加 `backend/data/conferences/`（紧挨现有 `backend/data/schools/`）。

R0 验收：`sqlite3 conferences.sqlite "select count(*) from conferences"` = 230；`data.ts` tsc 通过。

---

## R1 · 前端页面（纯静态数据，先做）

镜像 `frontend/src/features/schools/` → `frontend/src/features/conferences/`：

```
features/conferences/
├── ConferencesPage.tsx     # 主页：field tab + filter bar + table/timeline 切换（来自 conferences.html App）
├── types.ts                # Conference / CcfField / FilterState / SortState / ConfStatus
├── data.ts                 # R0 产出的 CCF_FIELDS + CCF_CONFS(230)
├── classify.ts             # classify / daysUntil / fmtDeadlineWord / progressForBar（搬 helpers，TODAY=运行时当天）
├── filter.ts / sort.ts     # applyFilters / applySort + smartSort（搬设计稿）
└── components/
    ├── FieldTabs.tsx  FilterBar.tsx  ConfTable.tsx  TimelineView.tsx
    └── cells/ TierBadge  FieldChip  WhereCell  DeadlineCell  LinksCell
```
- 样式：把设计稿 `<style>` 翻成 Tailwind + 复用 `frontend/src/styles/tokens.css` 的 token
  （`--cat-course/tools/research`、`--font-serif/mono` 等），**不引** design-ref 的 `styles.css`。
- 路由 `frontend/src/router.tsx`（schools 在 L136-144）：加 `/conferences` → `ConferencesPage` + `RequireAccess requireAuth`。
- 页面壳 `frontend/src/pages/ConferencesPage.tsx`：re-export feature 页。
- 导航 `frontend/src/components/layout/Header.tsx`（L52 `高校信息`）：其后加 `<NavItem to="/conferences" label="CCF 会议" />`。
- 数据源：直接 `import { CCF_CONFS, CCF_FIELDS } from './data'`，`useMemo` 客户端 filter+classify+sort。

R1 验收：`npx tsc -b` + `pnpm test`；playwright 实测筛选/搜索/排序/双视图/链接，截图比对设计稿。

---

## R2 · 后端只读 glue + `/conferences` API + HF 同步 + 前端切源

**后端（镜像 schools，但更薄——单表全量）**：
- `backend/app/db/conferences_engine.py`：镜像 `schools_engine.py` 的 `SchoolsEngineHolder`
  （只读 AsyncEngine + mtime 热载 + manifest 缓存 + 缺文件 503）。**或**把 schools_engine 泛化成
  通用只读 holder（`data_dir + filename` 参数化）再共用——决策点，倾向先镜像、低风险。
- `backend/app/schemas/conference.py`（`SnakeModel`）：`CcfField, ConferenceRow, ConferencesOut`。
- `backend/app/services/conferences_query.py`：`list_conferences(session)` 查全表（230 行，无筛选/分页）。
- `backend/app/routes/conferences.py`：`GET /conferences`（全量 + count）、`POST /admin/conferences/reload`
  （复用 `require_admin`）。`main.py` `include_router` + lifespan 里 `init/boot/dispose` holder（仿 schools L61-68）。

**HF 同步 + gitignore**：
- `backend/data/conferences/` 已在 R0 gitignore。
- 在 `xju-feiyue-data` 数据集加 `conferences/` 命名空间（与 `schools/` 平行，scoped mirror 互不清空）。
- `scripts/sync/`：把 `schools.py` 的 push/pull/status 流程**泛化或复制**出 conferences 版（同样按
  claw-manifest 校验 sha256、原子替换）；`Makefile` 加 `conf-push/conf-pull/conf-pull-force/conf-status`，
  并入 `make data-push`/`make data-pull`（= sync + schools + conf）。
- `deploy.sh`：在 `schools-pull-force` 后加 `conf-pull-force`（best-effort、非致命，同 schools）。
- 更新 `scripts/sync/README.md` 的 What-gets-synced 表 + [[schools-data-in-git]] 记忆。

**前端切源**：`frontend/src/api/{endpoints,schemas,mock}/conferences.*` 三件套（镜像 schools）；
`ConferencesPage` 由 `import data` 改成 `useQuery(['conferences'], getConferences, {staleTime: 30min})`；
`data.ts` 退居 mock handler 数据源（dev 离线仍可用）。

R2 验收：`uv run pytest`（list 行数 230、缺文件 503）；`curl /conferences | jq '.count'`；
前端真接口模式渲染一致；deploy 后 `make conf-pull-force` 跑通。

---

## R3 · 爬虫（DeepSeek + 联网搜索，类 openclaw）

**定位**：`conferences.sqlite` 的生产者，独立 cron 工具 **`scripts/conf_crawler/`**（仿 `scripts/sync/`
的 uv 子项目 + `cron_install.sh`）。读旧 sqlite 的爬虫状态 → 查证 → **原子写新 sqlite** → `make conf-push` 推 HF。
（不在 API 进程内跑，隔离搜索/playwright 重活；CLAUDE.md：重活只在 huawei2/本地，不在 VPS。）

**调度与状态机**（频率：未公布 1d、已公布 5d、已截止停）：
1. 选 `crawl_state != 'closed' AND next_check_at <= now()` 的行。
2. 每个会议：构造 query（如 `"{abbr} {target_year} call for papers submission deadline"`）→ 联网搜索
   取 top 结果 → httpx 抓正文（需 JS 渲染的页面用 **playwright** 兜底）→ 喂 **DeepSeek
   `deepseek-v4-flash`（no thinking）** 要求严格 JSON：`{found, deadline(ISO|null), cycle, location,
   conf_date, homepage, confidence(0-1), source_url, note}`；复用 `settings.deepseek_*`
   （`backend/app/settings.py` L11-15，`AsyncOpenAI(base_url, api_key)`）。
3. 回写：更新动态字段；按 deadline 重算 `crawl_state`（null→未公布；<today→已截止；else→已公布）；
   `last_checked_at=now`；`next_check_at = now + (1d if 未公布 else 5d)`；已截止不再排期。
   更新 manifest sha256/counts。
4. 延期检测：已公布态 5 天复核，官网 deadline 变了即更新（5d 频率的目的）。

**1 月 1 日重置**（cron `0 0 1 1 *` 或 crawler 内判断）：所有行 `crawl_state='unannounced'`、
清/归档本周期动态字段、`target_year=新年`、`next_check_at=now`，重查全部新一年 CFP。

**用量**：230 会议，最坏全未公布 230 次 flash/天；多数进入 5d/停后骤降；flash 便宜，`deepseek_dry_run` 可空跑管线。

R3 验收：`deepseek_dry_run=true` 跑一轮，核对状态机 / `next_check_at` 排期；挑已截止(PPoPP)、
未公布(PACT) 等人工核对查证结果；`make conf-push` 后 huawei2 `conf-pull` 生效、页面更新。

---

## 决策点 / 不在本轮

- conferences_engine：镜像 schools vs 把 schools_engine 泛化共用——倾向先镜像。
- 联网搜索实现：复用 supervisor-claw 的 openclaw / 独立搜索 API / DeepSeek 自带检索——R3 落地时定。
- 爬虫运行机器：huawei2（有 backend+playwright）或本地，跑完 `conf-push`，huawei2 部署/cron `conf-pull`。
- 会议详情抽屉 / 多档 deadline 拆分 / 往届归档——先不做，note 字段承载。
- field 维表 vs 前端写死 CCF_FIELDS——倾向前端写死。

## 关键参照文件

- 设计稿：`archive/design-refs/pages/conferences.html`、`components/conferences-data.jsx`
- 前端模板：`frontend/src/features/schools/*`、`frontend/src/api/{endpoints,schemas,mock}/schools.*`
- 路由/导航：`frontend/src/router.tsx` L136-144、`frontend/src/components/layout/Header.tsx` L52
- 后端只读 glue 模板：`backend/app/db/schools_engine.py`、`routes/schools.py`、`schemas/school.py`、`services/schools_query.py`、`main.py` L61-94
- HF 同步模板：`scripts/sync/schools.py`、`config.py`(SCHOOLS_*/命名空间)、`Makefile`(schools-*/data-*)、`deploy.sh`(schools-pull-force)
- DeepSeek：`backend/app/settings.py` L11-15
- gitignore/记忆：`.gitignore`(backend/data/schools/)、记忆 [[schools-data-in-git]]
