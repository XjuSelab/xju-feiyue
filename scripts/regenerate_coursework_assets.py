from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "coursework"
FIGS = DOCS / "figures"


def cell(id_: str, value: str, x: int, y: int, w: int, h: int, style: str) -> str:
    return (
        f'<mxCell id="{id_}" value="{escape(value)}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
        "</mxCell>"
    )


def edge(id_: str, source: str, target: str, label: str = "") -> str:
    style = (
        "endArrow=block;html=1;rounded=0;strokeColor=#59636e;"
        "fontSize=12;fontFamily=Microsoft YaHei;"
    )
    return (
        f'<mxCell id="{id_}" value="{escape(label)}" style="{style}" edge="1" '
        f'parent="1" source="{source}" target="{target}">'
        '<mxGeometry relative="1" as="geometry"/>'
        "</mxCell>"
    )


def diagram(path: str, title: str, body: str, width: int = 1200, height: int = 820) -> None:
    xml = f'''<mxfile host="app.diagrams.net" modified="2026-07-06T00:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="{escape(path)}" name="{escape(title)}">
    <mxGraphModel dx="1200" dy="820" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{width}" pageHeight="{height}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        {body}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
'''
    (FIGS / path).write_text(xml, encoding="utf-8")


BOX = "rounded=1;whiteSpace=wrap;html=1;arcSize=8;fontFamily=Microsoft YaHei;fontSize=13;fillColor=#f8fafc;strokeColor=#64748b;"
LAYER = "swimlane;whiteSpace=wrap;html=1;fontFamily=Microsoft YaHei;fontSize=14;fontStyle=1;fillColor=#eef2ff;strokeColor=#64748b;"
CLASS = "swimlane;whiteSpace=wrap;html=1;fontFamily=Microsoft YaHei;fontSize=12;fillColor=#ffffff;strokeColor=#475569;startSize=26;"
ACT = "rounded=1;whiteSpace=wrap;html=1;arcSize=12;fontFamily=Microsoft YaHei;fontSize=13;fillColor=#ecfeff;strokeColor=#0891b2;"
STATE = "rounded=1;whiteSpace=wrap;html=1;arcSize=50;fontFamily=Microsoft YaHei;fontSize=13;fillColor=#f0fdf4;strokeColor=#16a34a;"


def generate_figures() -> None:
    FIGS.mkdir(parents=True, exist_ok=True)

    diagram(
        "ch5-fig1-module-structure.drawio",
        "模块总体结构",
        "".join(
            [
                cell("fe", "前端 React SPA", 60, 80, 220, 420, LAYER),
                cell("be", "后端 FastAPI 单体", 380, 80, 260, 420, LAYER),
                cell("db", "SQLite 数据层", 760, 130, 180, 260, LAYER),
                cell("ai", "外部 AI 服务", 760, 430, 180, 90, BOX),
                cell("p1", "WritePage\\n草稿编辑 / AI 润色 / 发布", 90, 140, 160, 70, BOX),
                cell("p2", "BrowsePage\\n筛选 / 排序 / 分页", 90, 230, 160, 70, BOX),
                cell("p3", "NoteDetailPage\\n阅读 / 评论 / 合集侧栏", 90, 320, 160, 70, BOX),
                cell("p4", "ProfilePage / AdminPage\\n收藏 / 合集 / 签到 / 管理", 90, 410, 160, 70, BOX),
                cell("r1", "routes/drafts.py\\n草稿 CRUD、发布", 410, 125, 200, 55, BOX),
                cell("r2", "routes/notes.py\\n列表、详情、编辑、删除", 410, 195, 200, 55, BOX),
                cell("r3", "routes/interactions.py\\n赞踩、收藏、评论", 410, 265, 200, 55, BOX),
                cell("r4", "routes/collections.py\\n合集 CRUD、侧栏上下文", 410, 335, 200, 55, BOX),
                cell("r5", "routes/auth.py\\n签到、经验、我的收藏", 410, 405, 200, 55, BOX),
                cell("t1", "users / notes / drafts", 790, 185, 120, 50, BOX),
                cell("t2", "comments / likes / favorites", 790, 250, 120, 50, BOX),
                cell("t3", "collections / check_ins / xp_events", 790, 315, 120, 55, BOX),
                edge("e1", "fe", "be", "REST JSON + JWT"),
                edge("e2", "be", "db", "SQLAlchemy"),
                edge("e3", "r1", "ai", "摘要降级"),
            ]
        ),
    )

    diagram(
        "ch5-fig2-er-core-and-extensions.drawio",
        "核心数据类图",
        "".join(
            [
                cell("User", "User\\n- sid: str PK\\n- nickname: str\\n- role: str\\n- exp: int\\n- level: int", 40, 60, 190, 120, CLASS),
                cell("Note", "Note\\n- id: str PK\\n- title: str\\n- category: str\\n- status: str\\n- author_sid: FK", 310, 60, 190, 125, CLASS),
                cell("Draft", "Draft\\n- id: str PK\\n- owner_sid: FK\\n- title/content\\n- category/tags", 580, 60, 190, 110, CLASS),
                cell("Comment", "Comment\\n- id: str PK\\n- note_id: FK\\n- author_sid: FK\\n- parent_id: FK\\n- images / anchor_*", 310, 245, 210, 145, CLASS),
                cell("Like", "Like\\n(note_id, user_sid) PK", 60, 250, 150, 70, CLASS),
                cell("NoteDislike", "NoteDislike\\n(note_id, user_sid) PK", 60, 340, 150, 70, CLASS),
                cell("Favorite", "Favorite\\n(note_id, user_sid) PK", 60, 430, 150, 70, CLASS),
                cell("CommentReaction", "CommentReaction\\n(comment_id, user_sid) PK\\nkind: like/dislike", 580, 250, 190, 90, CLASS),
                cell("Collection", "Collection\\n- id: str PK\\n- owner_sid: FK\\n- title / description", 850, 60, 190, 100, CLASS),
                cell("CollectionEntry", "CollectionEntry\\n(collection_id, note_id) PK\\nsort_order\\nnote_id UNIQUE", 850, 220, 210, 105, CLASS),
                cell("CheckIn", "CheckIn\\n(user_sid, date) PK", 850, 390, 170, 70, CLASS),
                cell("XpEvent", "XpEvent\\n- id: int PK\\n- user_sid: FK\\n- source_type / delta", 620, 420, 190, 95, CLASS),
                edge("c1", "User", "Note", "1 发布 N"),
                edge("c2", "User", "Draft", "1 拥有 N"),
                edge("c3", "Note", "Comment", "1 包含 N"),
                edge("c4", "Comment", "Comment", "父评论 1..N 回复"),
                edge("c5", "User", "Like", "1..N"),
                edge("c6", "Like", "Note", "N..1"),
                edge("c7", "User", "Favorite", "1..N"),
                edge("c8", "Favorite", "Note", "N..1"),
                edge("c9", "CommentReaction", "Comment", "N..1"),
                edge("c10", "User", "Collection", "1 创建 N"),
                edge("c11", "Collection", "CollectionEntry", "1..N"),
                edge("c12", "CollectionEntry", "Note", "N..1 单归属"),
                edge("c13", "User", "CheckIn", "1..N"),
                edge("c14", "User", "XpEvent", "1..N"),
            ]
        ),
    )

    diagram(
        "ch6-fig1-class-diagram-note-community.drawio",
        "程序结构类图",
        "".join(
            [
                cell("Routes", "路由层\\nnotes.py\\ndrafts.py\\ninteractions.py\\ncollections.py\\nauth.py\\nai.py", 70, 70, 210, 170, CLASS),
                cell("Services", "服务/查询层\\nservices/notes.py\\nservices/comments.py\\nservices/ai_compose.py\\nservices/auth.py", 410, 70, 230, 150, CLASS),
                cell("Models", "模型层\\nUser / Note / Draft\\nComment / Like / Favorite\\nCollection / CheckIn / XpEvent", 760, 70, 260, 160, CLASS),
                cell("Frontend", "前端页面\\nWritePage\\nBrowsePage\\nNoteDetailPage\\nProfilePage\\nAdminPage", 70, 330, 210, 150, CLASS),
                cell("Api", "前端 API 封装\\nendpoints/notes.ts\\nendpoints/interactions.ts\\nendpoints/collections.ts\\nendpoints/auth.ts", 410, 330, 230, 150, CLASS),
                cell("Schema", "Pydantic/Zod Schema\\nNoteOut / CommentOut\\nCollectionOut / UserOut", 760, 330, 260, 120, CLASS),
                edge("p1", "Frontend", "Api", "调用"),
                edge("p2", "Api", "Routes", "REST"),
                edge("p3", "Routes", "Services", "复用查询/AI/鉴权"),
                edge("p4", "Routes", "Models", "直接写入轻量交互"),
                edge("p5", "Services", "Models", "SQLAlchemy"),
                edge("p6", "Routes", "Schema", "输入/输出校验"),
            ]
        ),
    )

    diagram(
        "ch6-fig2-seq-publish-with-summary-fallback.drawio",
        "草稿发布与摘要降级顺序图",
        "".join(
            [
                cell("u", "用户", 40, 60, 110, 50, BOX),
                cell("fe", "WritePage", 210, 60, 130, 50, BOX),
                cell("api", "drafts.py", 400, 60, 130, 50, BOX),
                cell("ai", "ai_compose", 590, 60, 130, 50, BOX),
                cell("db", "SQLite", 780, 60, 130, 50, BOX),
                edge("s1", "u", "fe", "点击发布"),
                edge("s2", "fe", "api", "POST /notes/drafts/{id}/publish"),
                edge("s3", "api", "db", "读取草稿并校验"),
                edge("s4", "api", "ai", "summary 为空时请求摘要"),
                edge("s5", "ai", "api", "成功摘要或首段兜底"),
                edge("s6", "api", "db", "创建 Note、删除 Draft"),
                edge("s7", "api", "fe", "返回 NoteOut"),
                edge("s8", "fe", "u", "跳转详情页"),
            ]
        ),
    )

    diagram(
        "ch6-fig6-seq-report-review.drawio",
        "举报审核规划顺序图",
        "".join(
            [
                cell("warn", "当前代码未实现 /reports、blocks 和 AI 审核工单路由；本图为待补功能设计，不作为已实现链路。", 60, 40, 900, 50, "rounded=1;whiteSpace=wrap;html=1;fontFamily=Microsoft YaHei;fontSize=13;fillColor=#fff7ed;strokeColor=#f97316;"),
                cell("user", "用户", 70, 140, 120, 50, BOX),
                cell("ui", "前端举报面板", 260, 140, 150, 50, BOX),
                cell("api", "规划：/reports", 500, 140, 150, 50, BOX),
                cell("ai", "规划：AI 审核", 730, 140, 150, 50, BOX),
                cell("admin", "规划：admin 裁决", 960, 140, 150, 50, BOX),
                edge("r1", "user", "ui", "选择原因"),
                edge("r2", "ui", "api", "提交工单"),
                edge("r3", "api", "ai", "异步分类"),
                edge("r4", "ai", "api", "label/confidence"),
                edge("r5", "admin", "api", "人工处理"),
            ]
        ),
    )

    diagram(
        "ch6-fig10-seq-collection-sidebar.drawio",
        "合集侧栏加载顺序图",
        "".join(
            [
                cell("u", "用户", 60, 70, 110, 50, BOX),
                cell("detail", "NoteDetailPage", 230, 70, 150, 50, BOX),
                cell("api", "collections.py", 460, 70, 150, 50, BOX),
                cell("db", "SQLite", 690, 70, 130, 50, BOX),
                edge("q1", "u", "detail", "打开笔记"),
                edge("q2", "detail", "api", "GET /notes/{id}/collection"),
                edge("q3", "api", "db", "查 CollectionEntry"),
                edge("q4", "db", "api", "合集 + entries + notes"),
                edge("q5", "api", "detail", "NoteCollectionContextOut 或 null"),
                edge("q6", "detail", "u", "展示侧栏入口/隐藏"),
            ]
        ),
    )

    diagram(
        "ch6-fig7-state-note-lifecycle.drawio",
        "笔记生命周期状态图",
        "".join(
            [
                cell("draft", "Draft\\n草稿", 100, 180, 130, 60, STATE),
                cell("visible", "visible\\n已发布可见", 350, 180, 150, 60, STATE),
                cell("pending", "pending\\n处理中隐藏", 610, 180, 150, 60, STATE),
                cell("deleted", "deleted\\n删除", 870, 180, 130, 60, STATE),
                edge("n1", "draft", "visible", "发布成功"),
                edge("n2", "visible", "pending", "规划：高置信审核标记"),
                edge("n3", "pending", "visible", "规划：驳回恢复"),
                edge("n4", "visible", "deleted", "作者删除"),
                edge("n5", "pending", "deleted", "规划：管理员删除"),
            ]
        ),
    )

    diagram(
        "ch6-fig-comment-state.drawio",
        "评论状态图",
        "".join(
            [
                cell("created", "visible\\n正常展示", 180, 170, 150, 60, STATE),
                cell("pending", "pending\\n处理中隐藏", 470, 170, 150, 60, STATE),
                cell("deleted", "deleted\\n删除", 760, 170, 130, 60, STATE),
                edge("m1", "created", "pending", "规划：AI 高置信标记"),
                edge("m2", "pending", "created", "规划：管理员恢复"),
                edge("m3", "created", "deleted", "作者/笔记作者删除"),
                edge("m4", "pending", "deleted", "规划：管理员删除"),
            ]
        ),
    )

    diagram(
        "ch6-fig-report-state.drawio",
        "举报工单状态图",
        "".join(
            [
                cell("pending", "pending\\n待处理", 150, 160, 150, 60, STATE),
                cell("flagged", "ai_flagged\\nAI 已标记", 430, 160, 160, 60, STATE),
                cell("resolved", "resolved\\n已处理", 720, 95, 150, 60, STATE),
                cell("dismissed", "dismissed\\n已驳回", 720, 230, 150, 60, STATE),
                edge("g1", "pending", "flagged", "规划：AI 返回结论"),
                edge("g2", "pending", "resolved", "规划：人工直接处理"),
                edge("g3", "flagged", "resolved", "规划：确认删除/隐藏"),
                edge("g4", "flagged", "dismissed", "规划：驳回举报"),
            ]
        ),
    )

    diagram(
        "ch6-fig8-activity-browse-filter-sort-pagination.drawio",
        "信息流筛选排序分页活动图",
        "".join(
            [
                cell("a1", "选择分类/搜索/标签", 100, 80, 180, 60, ACT),
                cell("a2", "切换排序 newest/hot/liked", 360, 80, 190, 60, ACT),
                cell("a3", "GET /notes", 630, 80, 150, 60, ACT),
                cell("a4", "服务端过滤并 cursor 分页", 860, 80, 210, 60, ACT),
                cell("a5", "渲染卡片列表", 630, 240, 160, 60, ACT),
                cell("a6", "滚动加载更多", 360, 240, 180, 60, ACT),
                edge("a12", "a1", "a2"),
                edge("a23", "a2", "a3"),
                edge("a34", "a3", "a4"),
                edge("a45", "a4", "a5"),
                edge("a56", "a5", "a6"),
                edge("a63", "a6", "a3", "携带 nextCursor"),
            ]
        ),
    )

    diagram(
        "ch6-fig9-activity-ai-streaming-fallback.drawio",
        "AI 摘要流式降级活动图",
        "".join(
            [
                cell("x1", "触发生成摘要", 110, 80, 160, 60, ACT),
                cell("x2", "优先 SSE 流式请求", 360, 80, 180, 60, ACT),
                cell("x3", "逐字展示结果", 610, 80, 160, 60, ACT),
                cell("x4", "流式失败", 360, 230, 150, 60, ACT),
                cell("x5", "回退 one-shot", 610, 230, 160, 60, ACT),
                cell("x6", "仍失败：首段截断兜底", 850, 230, 190, 60, ACT),
                edge("x12", "x1", "x2"),
                edge("x23", "x2", "x3", "成功"),
                edge("x24", "x2", "x4", "异常/超时"),
                edge("x45", "x4", "x5"),
                edge("x53", "x5", "x3", "成功"),
                edge("x56", "x5", "x6", "失败"),
                edge("x63", "x6", "x3"),
            ]
        ),
    )


def replace_text() -> None:
    replacements = {
        "ch5-概要设计-笔记系统与社区互动.md": [
            ("### 5.1 概念结构设计（E-R 图）", "### 5.1 概念结构设计（UML 类图）"),
            ("E-R 图", "UML 类图"),
            ("图 5-2 笔记系统与社区互动模块 E-R 图", "图 5-2 笔记系统与社区互动模块核心数据类图"),
            ("| `services/interactions.py` | 点赞/点踩互斥、收藏幂等、举报创建、拉黑管理 |", "| `routes/interactions.py` | 点赞/点踩互斥、收藏幂等、评论创建与评论表态；当前代码尚未实现举报与拉黑接口 |"),
            ("| `services/collections.py` | 合集 CRUD、笔记加入/移出合集校验、合集侧栏数据组装 |", "| `routes/collections.py` | 合集 CRUD、笔记加入/移出合集校验、合集侧栏数据组装 |"),
            ("| `services/growth.py` | 签到幂等校验、经验加减与等级升级（对称扣回） |", "| `routes/auth.py` | 签到幂等校验、经验发放、等级计算、经验流水和我的收藏查询 |"),
            ("| FR-15 | 内容举报 | interactions | interactions |", "| FR-15 | 内容举报 | 未实现 | 当前代码仅预留 Report 数据模型，尚无 `/reports` 路由 |"),
            ("| FR-16 | AI 审查分类 | interactions | interactions |", "| FR-16 | AI 审查分类 | 未实现 | 当前代码尚无内容审核异步任务 |"),
            ("| FR-17 | 管理员举报裁决 | interactions | interactions |", "| FR-17 | 管理员举报裁决 | 未实现 | 当前管理后台未接入举报工单队列 |"),
            ("| FR-18 | 拉黑用户 | interactions | interactions |", "| FR-18 | 拉黑用户 | 未实现 | 当前代码仅有 Block 数据模型，尚无接口与前端入口 |"),
            ("| FR-20 | 经验与等级 | auth, interactions | growth |", "| FR-20 | 经验与等级 | auth | routes/auth.py |"),
        ],
        "ch6-详细设计-笔记系统与社区互动.md": [
            ("`services/interactions.py` | 点赞/点踩互斥、收藏幂等、举报创建、拉黑管理", "`routes/interactions.py` | 点赞/点踩互斥、收藏幂等、评论创建与评论表态；举报和拉黑当前未实现"),
            ("`services/collections.py` | 合集 CRUD、笔记加入/移出校验", "`routes/collections.py` | 合集 CRUD、笔记加入/移出校验"),
            ("`services/growth.py` | 签到幂等校验、经验加减与等级升级（对称扣回）", "`routes/auth.py` | 签到幂等校验、经验发放、等级计算与经验流水查询"),
            ("#### 3.2 services/interactions 模块", "#### 3.2 routes/interactions 模块"),
            ("互动服务负责笔记表态（赞/踩）的互斥逻辑、收藏幂等、举报创建与拉黑管理。", "互动路由负责笔记表态（赞/踩）的互斥逻辑、收藏幂等、评论创建与评论表态。当前代码尚未实现举报创建与拉黑管理接口。"),
            ("#### 3.3 services/collections 模块", "#### 3.3 routes/collections 模块"),
            ("#### 3.4 services/growth 模块", "#### 3.4 routes/auth 签到与经验模块"),
            ("成长服务负责每日签到幂等校验与经验结算。", "认证路由中的签到与经验接口负责每日签到幂等校验、经验发放、等级计算和经验流水查询。"),
            ("异步触发 AI 审查分类", "当前代码未触发 AI 审查分类"),
            ("举报—AI 审查—人工裁决顺序图", "举报—AI 审查—人工裁决规划顺序图"),
        ],
        "ch7-系统测试-笔记系统与社区互动.md": [
            ("经测试证实，本模块的 21 条功能需求均已实现或可验证：", "经代码 review 与现有测试核对，本模块中草稿发布、浏览、评论、赞踩、收藏、合集、签到与经验等功能已实现或可验证；举报、AI 审核裁决、拉黑仍停留在数据模型/规划层，不能写作已完成："),
            ("幂等设计（点赞、点踩、收藏、签到、举报）均以数据库约束验证通过；", "幂等设计中，点赞、点踩、收藏、签到已以数据库约束或重复调用测试验证通过；举报幂等尚未实现接口验证；"),
            ("| D-06 | AI 审查异步任务未实现断点重试 | AI 服务间歇故障时工单可能长时间挂起 | 增加重试队列或定时扫描 |", "| D-06 | 举报、AI 审查、人工裁决、拉黑接口尚未实现 | FR-15 至 FR-18 无法作为已交付功能验收 | 补齐 `/reports`、`/blocks`、管理端工单接口及前端入口 |"),
            ("本模块的 21 条功能需求均已实现或可验证", "本模块的已实现功能已通过现有用例验证，FR-15 至 FR-18 需要作为后续补齐项"),
        ],
    }
    for name, pairs in replacements.items():
        path = DOCS / name
        text = path.read_text(encoding="utf-8")
        for old, new in pairs:
            text = text.replace(old, new)
        path.write_text(text, encoding="utf-8")

    ch4 = DOCS / "ch4-需求分析-笔记系统与社区互动.md"
    text = ch4.read_text(encoding="utf-8")
    ch4_pairs = [
        (
            '- **增量二（本轮新增）**：社区互动与治理的扩展——笔记/评论点踩、笔记收藏、两层楼中楼回复、评论图片（九宫格）、内容举报与"AI 审查 + 管理员裁决"双通道治理、用户拉黑、每日签到与用户等级，以及**笔记合集**（创作者创建合集、加入自己的已发布笔记、详情页侧栏浏览同合集笔记）。',
            '- **增量二（本轮新增）**：社区互动与成长的扩展——笔记/评论点踩、笔记收藏、两层楼中楼回复、评论图片（九宫格）、每日签到与用户等级，以及**笔记合集**（创作者创建合集、加入自己的已发布笔记、详情页侧栏浏览同合集笔记）。内容举报、"AI 审查 + 管理员裁决"双通道治理、用户拉黑当前仅完成数据模型预留，业务接口和前端入口仍为后续规划项。',
        ),
        (
            '5. 为社区提供内容治理能力：用户可举报违规内容并选择举报类型，系统先经 AI 审查分类、再由管理员裁决处置；用户可拉黑不愿看到的用户；',
            '5. 为社区后续治理能力预留数据模型：举报、AI 审查分类、管理员裁决与拉黑当前尚未完成业务接口；',
        ),
        (
            '6. 以每日签到与互动经验驱动的等级体系，提升用户粘性并正向激励优质内容创作。',
            '6. 以每日签到驱动的经验等级体系提升用户粘性；互动经验奖励（被赞、被收藏等）作为后续扩展项。',
        ),
        (
            '| 治理域 | 内容卡片/详情页操作菜单、`/admin` 举报队列 | 举报（8 类型）、AI 审查分类、管理员裁决、拉黑 |',
            '| 治理域 | 数据模型预留，接口待补 | 举报（8 类型）、AI 审查分类、管理员裁决、拉黑为后续规划项 |',
        ),
        (
            '| FR-09 | 收藏笔记与我的收藏 | 登录用户可收藏/取消收藏笔记；个人中心提供"我的收藏"列表页；收藏行为向作者发放经验（见 FR-20） | 二 |',
            '| FR-09 | 收藏笔记与我的收藏 | 登录用户可收藏/取消收藏笔记；个人中心提供"我的收藏"列表页；当前实现不因收藏向作者发放经验 | 二 |',
        ),
        (
            '| FR-13 | 评论表态（赞/踩） | 登录用户可对评论/回复点赞或点踩，规则同 FR-08（互斥、幂等、踩数不公开）；评论被赞向评论者发放经验（见 FR-20） | 二 |',
            '| FR-13 | 评论表态（赞/踩） | 登录用户可对评论/回复点赞或点踩，规则同 FR-08（互斥、幂等、踩数不公开）；当前实现不因评论被赞向评论者发放经验 | 二 |',
        ),
        (
            '| FR-15 | 内容举报 | 登录用户可举报笔记或评论，须选择举报类型之一：垃圾广告 / 色情低俗 / 辱骂攻击 / 违法违规 / 涉政敏感 / 虚假信息 / 侵权抄袭 / 其他（可附最多 200 字补充说明）；同一用户对同一内容重复举报不重复计数（幂等更新）；举报提交后进入待审队列并触发 AI 审查 | 二 |',
            '| FR-15 | 内容举报 | 规划项。当前代码仅预留 reports 表模型，尚无举报提交接口、举报菜单和工单队列 | 后续 |',
        ),
        (
            '| FR-16 | AI 审查分类 | 系统在两个时机对内容做 AI 审查：①笔记发布、评论提交后**异步**自动分类；②内容被举报时触发复审。AI 输出 `{分类标签, 置信度, 理由}`，标签体系与举报类型对齐（另含"正常"）。置信度 ≥ 0.9 的违规判定 → 内容自动转为"处理中"隐藏态待人工复核；< 0.9 → 仅标记优先级入队。**AI 服务不可用时举报直接进入人工队列，举报提交与内容发布均不受阻断** | 二 |',
            '| FR-16 | AI 审查分类 | 规划项。当前代码尚未实现内容审核异步任务；后续实现时需保证 AI 不阻断发布、评论和举报受理 | 后续 |',
        ),
        (
            '| FR-17 | 管理员举报裁决 | 管理员在举报队列中按优先级/时间查看工单（含目标内容快照与 AI 审查结论），执行裁决：维持违规判定并删除/隐藏内容，或驳回举报并恢复展示；处置记录（处置人、时间、动作）留档可查 | 二 |',
            '| FR-17 | 管理员举报裁决 | 规划项。当前管理后台未接入举报工单队列和人工裁决接口 | 后续 |',
        ),
        (
            '| FR-18 | 拉黑用户 | 登录用户可拉黑/取消拉黑其他用户，效果为**单向隐藏**：信息流中被拉黑者的笔记对我过滤不显示；评论区中被拉黑者的评论折叠为"已屏蔽该用户的评论"占位（可手动展开，避免楼中楼断层）；**被拉黑方无任何感知，仍可正常互动**；个人中心提供拉黑名单管理 | 二 |',
            '| FR-18 | 拉黑用户 | 规划项。当前代码仅预留 blocks 表模型，尚无拉黑/取消拉黑接口、信息流过滤和黑名单管理页面 | 后续 |',
        ),
        (
            '| FR-20 | 经验与等级 | 经验来源：每日签到 +5、评论被点赞 +2/次、笔记被点赞 +5/次、笔记被收藏 +8/次；取消赞/收藏时**对称扣回**（防刷分）。等级阈值 0/50/150/300/600/1000 对应 Lv0 新生 → Lv1 助跑 → Lv2 起跳 → Lv3 腾空 → Lv4 飞跃 → Lv5 登顶；等级徽章展示于评论区昵称旁与个人主页，个人中心可查看经验明细（最近变动记录） | 二 |',
            '| FR-20 | 经验与等级 | 当前实现的经验来源为每日签到 +5，并按阈值 0/50/150/300/600/1000 计算 Lv0～Lv5；个人中心可查看经验明细。评论被点赞、笔记被点赞、笔记被收藏产生经验及取消扣回为后续扩展项 | 二 |',
        ),
        (
            '| 注册用户 | 人类 | 匿名访客全部能力 + 写作发布、AI 辅助、表态、收藏、评论/回复、举报、拉黑、签到 |',
            '| 注册用户 | 人类 | 匿名访客全部能力 + 写作发布、AI 辅助、表态、收藏、评论/回复、签到；举报和拉黑为后续扩展 |',
        ),
        (
            '| 12 | 经验变动事件 | XpEvent | 各类行为触发的经验增减 | 加工"经验结算" | D6 | 中（随互动产生） | 用户标识 + 来源类型 + 变动值 + 时间 |',
            '| 12 | 经验变动事件 | XpEvent | 当前由每日签到触发的经验增加；互动触发经验为后续扩展 | 加工"经验结算" | D6 | 中 | 用户标识 + 来源类型 + 变动值 + 时间 |',
        ),
        (
            '| 9 | 经验结算与升级 | P7 | 签到/被赞/被收藏及其取消 | 中 | 经验变动事件 | 更新后经验、等级 | 按规则加减经验（取消对称扣回），跨阈值时更新等级 |',
            '| 9 | 经验结算与升级 | P7 | 每日签到 | 中 | 签到请求 | 更新后经验、等级 | 每日首次签到增加 5 点经验，跨阈值时更新等级；被赞/被收藏经验为后续扩展 |',
        ),
        (
            '1. 收藏做完整功能（按钮 + 我的收藏页 + 作者经验），而非仅计数；',
            '1. 收藏做完整功能（按钮 + 我的收藏页），作者经验奖励为后续扩展；',
        ),
        (
            '8. 经验规则与等级阈值见 FR-20，取消行为对称扣回；',
            '8. 当前经验规则与等级阈值见 FR-20，取消行为对称扣回为后续互动经验扩展；',
        ),
    ]
    for old, new in ch4_pairs:
        text = text.replace(old, new)
    ch4.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    generate_figures()
    replace_text()
