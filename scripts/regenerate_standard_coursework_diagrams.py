from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
FIGS = ROOT / "docs" / "coursework" / "figures"

FONT = "fontFamily=SimSun;fontSize=12;"
EDGE = (
    "endArrow=block;html=1;rounded=0;strokeColor=#000000;"
    "fontFamily=SimSun;fontSize=12;"
)
EDGE_DASHED = EDGE + "dashed=1;"
EXTERNAL = (
    "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;"
    + FONT
)
PROCESS = (
    "ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;"
    + FONT
)
DATASTORE = (
    "shape=partialRectangle;right=0;whiteSpace=wrap;html=1;"
    "fillColor=#ffffff;strokeColor=#000000;"
    + FONT
)
DATASTORE_DASHED = DATASTORE + "dashed=1;"
BOUNDARY = (
    "rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#000000;"
    "fontStyle=1;verticalAlign=top;spacingTop=8;"
    + FONT
)
USECASE = (
    "ellipse;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;"
    + FONT
)
ACTOR = (
    "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;"
    "outlineConnect=0;fillColor=#ffffff;strokeColor=#000000;"
    + FONT
)
CLASS = (
    "swimlane;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;"
    "startSize=28;"
    + FONT
)
NOTE = (
    "rounded=0;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#000000;"
    + FONT
)


def value(text: str) -> str:
    return escape(text).replace("\n", "&#xa;")


def cell(id_: str, text: str, x: int, y: int, w: int, h: int, style: str) -> str:
    return (
        f'<mxCell id="{id_}" value="{value(text)}" style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/>'
        "</mxCell>"
    )


def edge(id_: str, source: str, target: str, label: str = "", dashed: bool = False) -> str:
    style = EDGE_DASHED if dashed else EDGE
    return (
        f'<mxCell id="{id_}" value="{value(label)}" style="{style}" edge="1" '
        f'parent="1" source="{source}" target="{target}">'
        '<mxGeometry relative="1" as="geometry"/>'
        "</mxCell>"
    )


def diagram(path: str, title: str, body: str, width: int = 1280, height: int = 860) -> None:
    xml = f'''<mxfile host="app.diagrams.net" modified="2026-07-07T00:00:00.000Z" agent="Codex" version="24.7.17">
  <diagram id="{escape(path)}" name="{escape(title)}">
    <mxGraphModel dx="1280" dy="860" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{width}" pageHeight="{height}" math="0" shadow="0">
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


def dfd_top() -> None:
    parts = [
        cell("anon", "匿名访客", 40, 90, 110, 55, EXTERNAL),
        cell("user", "注册用户", 40, 300, 110, 55, EXTERNAL),
        cell("ai", "外部 AI 服务\n润色/摘要", 1040, 90, 130, 65, EXTERNAL),
        cell("p0", "P0\n笔记与社区互动子系统", 470, 210, 210, 110, PROCESS),
        cell("d1", "D1 草稿库\ndrafts", 250, 70, 170, 55, DATASTORE),
        cell("d2", "D2 笔记库\nnotes", 250, 170, 170, 55, DATASTORE),
        cell("d3", "D3 互动库\nlikes / dislikes / favorites", 250, 270, 190, 65, DATASTORE),
        cell("d4", "D4 评论库\ncomments / comment_reactions", 720, 170, 210, 65, DATASTORE),
        cell("d6", "D6 成长库\ncheck_ins / xp_events", 720, 280, 190, 65, DATASTORE),
        cell("d7", "D7 合集库\ncollections / entries", 720, 390, 190, 65, DATASTORE),
        cell("d5", "D5 治理预留\nreports / blocks\n无业务路由", 960, 390, 170, 75, DATASTORE_DASHED),
        cell("legend", "DFD 符号：矩形=外部实体；圆=加工；开口矩形=数据存储；虚线=仅模型预留", 310, 560, 640, 45, NOTE),
        edge("e1", "anon", "p0", "浏览/检索/详情请求"),
        edge("e2", "p0", "anon", "公开笔记、评论、计数"),
        edge("e3", "user", "p0", "草稿/发布/评论/表态/收藏/合集/签到请求"),
        edge("e4", "p0", "user", "处理结果、经验、合集上下文"),
        edge("e5", "p0", "ai", "润色/摘要请求"),
        edge("e6", "ai", "p0", "改写文本/摘要结果"),
        edge("e7", "p0", "d1", "保存/读取草稿"),
        edge("e8", "p0", "d2", "查询/写入笔记"),
        edge("e9", "p0", "d3", "写入/统计表态与收藏"),
        edge("e10", "p0", "d4", "查询/写入评论"),
        edge("e11", "p0", "d6", "签到与经验流水"),
        edge("e12", "p0", "d7", "维护合集与上下文"),
    ]
    diagram("ch4-fig2-dfd-top.drawio", "顶层数据流图", "".join(parts), 1220, 650)


def dfd_publish() -> None:
    parts = [
        cell("user", "注册用户", 40, 250, 110, 55, EXTERNAL),
        cell("ai", "外部 AI 服务", 880, 80, 130, 55, EXTERNAL),
        cell("p11", "P1.1\n编辑与自动保存", 210, 110, 140, 90, PROCESS),
        cell("p12", "P1.2\n发布前校验", 410, 240, 140, 90, PROCESS),
        cell("p13", "P1.3\nAI 摘要生成", 640, 120, 140, 90, PROCESS),
        cell("p14", "P1.4\n首段截断兜底", 640, 320, 140, 90, PROCESS),
        cell("p15", "P1.5\n创建笔记并删除草稿", 880, 240, 170, 95, PROCESS),
        cell("d1", "D1 草稿库\ndrafts", 220, 350, 170, 55, DATASTORE),
        cell("d2", "D2 笔记库\nnotes", 890, 430, 170, 55, DATASTORE),
        cell("note", "本图只画当前代码链路：发布后没有 AI 审核入库步骤。", 420, 520, 430, 45, NOTE),
        edge("e1", "user", "p11", "编辑内容"),
        edge("e2", "p11", "d1", "草稿内容"),
        edge("e3", "user", "p12", "发布请求 draft_id"),
        edge("e4", "d1", "p12", "草稿"),
        edge("e5", "p12", "user", "校验错误"),
        edge("e6", "p12", "p13", "摘要为空且校验通过"),
        edge("e7", "p13", "ai", "摘要请求"),
        edge("e8", "ai", "p13", "摘要文本"),
        edge("e9", "p13", "p15", "AI 摘要"),
        edge("e10", "p13", "p14", "异常/超时"),
        edge("e11", "p14", "p15", "兜底摘要"),
        edge("e12", "p12", "p15", "已有摘要"),
        edge("e13", "p15", "d2", "新笔记"),
        edge("e14", "p15", "d1", "删除草稿"),
        edge("e15", "p15", "user", "NoteOut"),
    ]
    diagram("ch4-fig3-dfd-publish.drawio", "功能级数据流图-草稿发布与摘要降级", "".join(parts), 1120, 610)


def dfd_interaction_collection() -> None:
    parts = [
        cell("anon", "匿名访客", 40, 110, 110, 55, EXTERNAL),
        cell("user", "注册用户", 40, 360, 110, 55, EXTERNAL),
        cell("p21", "P2.1\n列表/详情查询", 230, 90, 140, 85, PROCESS),
        cell("p22", "P2.2\n笔记赞踩收藏", 230, 270, 145, 85, PROCESS),
        cell("p23", "P2.3\n评论/回复/评论表态", 500, 250, 165, 90, PROCESS),
        cell("p24", "P2.4\n合集管理与上下文查询", 500, 430, 175, 90, PROCESS),
        cell("p25", "P2.5\n每日签到与经验查询", 790, 340, 165, 90, PROCESS),
        cell("d2", "D2 笔记库\nnotes", 480, 70, 170, 55, DATASTORE),
        cell("d3", "D3 互动库\nlikes / dislikes / favorites", 770, 120, 210, 65, DATASTORE),
        cell("d4", "D4 评论库\ncomments / comment_reactions", 770, 220, 220, 65, DATASTORE),
        cell("d7", "D7 合集库\ncollections / entries", 770, 460, 190, 65, DATASTORE),
        cell("d6", "D6 成长库\ncheck_ins / xp_events", 990, 340, 190, 65, DATASTORE),
        edge("e1", "anon", "p21", "浏览/检索请求"),
        edge("e2", "p21", "anon", "公开列表/详情"),
        edge("e3", "user", "p21", "带登录态查询"),
        edge("e4", "p21", "d2", "读取可见笔记"),
        edge("e5", "p21", "d3", "读取计数/我的状态"),
        edge("e6", "p21", "d4", "读取评论数/评论列表"),
        edge("e7", "user", "p22", "赞/踩/收藏/取消"),
        edge("e8", "p22", "d3", "幂等写入/删除"),
        edge("e9", "p22", "user", "204 No Content"),
        edge("e10", "user", "p23", "评论、回复、删除、表态"),
        edge("e11", "p23", "d4", "写入/删除/统计"),
        edge("e12", "p23", "user", "CommentOut/204"),
        edge("e13", "user", "p24", "合集 CRUD/加入移出/上下文"),
        edge("e14", "p24", "d7", "合集与条目"),
        edge("e15", "p24", "d2", "校验已发布笔记"),
        edge("e16", "p24", "user", "CollectionOut/Context/null"),
        edge("e17", "user", "p25", "签到/经验流水"),
        edge("e18", "p25", "d6", "签到记录与经验事件"),
        edge("e19", "p25", "user", "gainedExp/streak/events"),
    ]
    diagram(
        "ch4-fig4-dfd-interaction-collection-checkin.drawio",
        "功能级数据流图-互动评论合集签到",
        "".join(parts),
        1220,
        600,
    )


def usecase() -> None:
    parts = [
        cell("boundary", "笔记系统与社区互动模块", 210, 40, 780, 720, BOUNDARY),
        cell("anon", "匿名访客", 55, 120, 70, 110, ACTOR),
        cell("user", "注册用户", 55, 360, 70, 110, ACTOR),
        cell("author", "笔记作者", 1080, 250, 70, 110, ACTOR),
        cell("ai", "外部 AI 服务", 1080, 520, 80, 120, ACTOR),
        cell("uc1", "UC-01\n浏览/检索信息流", 260, 105, 150, 60, USECASE),
        cell("uc2", "UC-02\n查看笔记详情", 470, 105, 150, 60, USECASE),
        cell("uc3", "UC-03\n撰写/自动保存草稿", 260, 210, 160, 60, USECASE),
        cell("uc4", "UC-04\nAI 选段润色", 470, 210, 150, 60, USECASE),
        cell("uc5", "UC-05\n发布笔记\n摘要降级", 690, 210, 150, 70, USECASE),
        cell("uc6", "UC-06\n编辑/删除本人笔记", 795, 310, 155, 60, USECASE),
        cell("uc7", "UC-07\n笔记点赞/取消", 260, 330, 150, 60, USECASE),
        cell("uc8", "UC-08\n笔记点踩/取消\n后端接口", 470, 330, 150, 70, USECASE),
        cell("uc9", "UC-09\n收藏/取消收藏", 690, 330, 150, 60, USECASE),
        cell("uc10", "UC-10\n发表评论/二级回复", 260, 455, 160, 60, USECASE),
        cell("uc11", "UC-11\n删除评论", 470, 455, 145, 60, USECASE),
        cell("uc12", "UC-12\n评论赞踩\n后端接口", 690, 455, 145, 65, USECASE),
        cell("uc13", "UC-13\n创建/维护合集", 260, 585, 150, 60, USECASE),
        cell("uc14", "UC-14\n加入/移出合集", 470, 585, 150, 60, USECASE),
        cell("uc15", "UC-15\n查询合集上下文", 690, 585, 150, 60, USECASE),
        cell("uc16", "UC-16\n每日签到", 260, 690, 135, 55, USECASE),
        cell("uc17", "UC-17\n查看经验流水", 470, 690, 145, 55, USECASE),
        cell("uc18", "UC-18\n查看我的收藏", 690, 690, 145, 55, USECASE),
        edge("a1", "anon", "uc1"),
        edge("a2", "anon", "uc2"),
        edge("u1", "user", "uc1"),
        edge("u2", "user", "uc2"),
        edge("u3", "user", "uc3"),
        edge("u4", "user", "uc4"),
        edge("u5", "user", "uc5"),
        edge("u7", "user", "uc7"),
        edge("u8", "user", "uc8"),
        edge("u9", "user", "uc9"),
        edge("u10", "user", "uc10"),
        edge("u11", "user", "uc11"),
        edge("u12", "user", "uc12"),
        edge("u13", "user", "uc13"),
        edge("u14", "user", "uc14"),
        edge("u15", "user", "uc15"),
        edge("u16", "user", "uc16"),
        edge("u17", "user", "uc17"),
        edge("u18", "user", "uc18"),
        edge("au1", "author", "uc6"),
        edge("au2", "author", "uc11"),
        edge("ai1", "uc4", "ai", "请求/返回改写"),
        edge("ai2", "uc5", "ai", "摘要为空时调用"),
        edge("inc1", "uc5", "uc3", "«include»", dashed=True),
        edge("inc2", "uc5", "uc4", "«extend»", dashed=True),
    ]
    diagram("ch4-fig5-usecase.drawio", "笔记系统与社区互动模块用例图", "".join(parts), 1220, 800)


def class_diagram_data() -> None:
    parts = [
        cell("User", "User\nsid: str PK\nname/nickname: str\nrole: str\nexp: int\nlevel: int\ncreated_at", 40, 50, 190, 145, CLASS),
        cell("Note", "Note\nid: str PK\ntitle/summary/content\ncategory: str\ntags: list[str]\nauthor_sid: FK\nstatus: str", 310, 50, 210, 165, CLASS),
        cell("Draft", "Draft\nid: str PK\nowner_sid: FK\ntitle/summary/content\ncategory/tags\nupdated_at", 610, 50, 200, 145, CLASS),
        cell("Comment", "Comment\nid: str PK\nnote_id: FK\nauthor_sid: FK\nparent_id: FK?\nreply_to_sid: FK?\nimages: list[str]\nanchor_text/offset\nstatus", 310, 285, 230, 210, CLASS),
        cell("Like", "Like\nnote_id: FK PK\nuser_sid: FK PK\ncreated_at", 40, 275, 170, 95, CLASS),
        cell("NoteDislike", "NoteDislike\nnote_id: FK PK\nuser_sid: FK PK\ncreated_at", 40, 395, 170, 95, CLASS),
        cell("Favorite", "Favorite\nnote_id: FK PK\nuser_sid: FK PK\ncreated_at", 40, 515, 170, 95, CLASS),
        cell("CommentReaction", "CommentReaction\ncomment_id: FK PK\nuser_sid: FK PK\nkind: like/dislike\ncreated_at", 610, 285, 210, 120, CLASS),
        cell("Collection", "Collection\nid: str PK\nowner_sid: FK\ntitle: str\ndescription: text\ncreated_at/updated_at", 910, 50, 210, 135, CLASS),
        cell("CollectionEntry", "CollectionEntry\ncollection_id: FK PK\nnote_id: FK PK\nsort_order: int\nnote_id UNIQUE", 910, 260, 220, 120, CLASS),
        cell("CheckIn", "CheckIn\nuser_sid: FK PK\ncheckin_date: date PK\ncreated_at", 910, 450, 190, 95, CLASS),
        cell("XpEvent", "XpEvent\nid: int PK\nuser_sid: FK\nsource_type: str\ndelta: int\nref_type/ref_id\ncreated_at", 610, 520, 210, 155, CLASS),
        cell("LoginEvent", "LoginEvent\nid: int PK\nuser_sid: FK\nip/user_agent\ncreated_at", 910, 610, 190, 105, CLASS),
        cell("Report", "Report\n仅数据模型预留\n无 /reports 路由", 1150, 250, 170, 95, CLASS + "dashed=1;"),
        cell("Block", "Block\n仅数据模型预留\n无 /blocks 路由", 1150, 380, 170, 85, CLASS + "dashed=1;"),
        edge("e1", "User", "Note", "1 发布 0..*"),
        edge("e2", "User", "Draft", "1 拥有 0..*"),
        edge("e3", "Note", "Comment", "1 包含 0..*"),
        edge("e4", "Comment", "Comment", "0..1 父评论 / 0..* 回复"),
        edge("e5", "User", "Like", "1 产生 0..*"),
        edge("e6", "Like", "Note", "0..* 指向 1"),
        edge("e7", "User", "NoteDislike", "1 产生 0..*"),
        edge("e8", "NoteDislike", "Note", "0..* 指向 1"),
        edge("e9", "User", "Favorite", "1 产生 0..*"),
        edge("e10", "Favorite", "Note", "0..* 指向 1"),
        edge("e11", "User", "Comment", "1 发表 0..*"),
        edge("e12", "CommentReaction", "Comment", "0..* 指向 1"),
        edge("e13", "User", "CommentReaction", "1 产生 0..*"),
        edge("e14", "User", "Collection", "1 创建 0..*"),
        edge("e15", "Collection", "CollectionEntry", "1 包含 0..*"),
        edge("e16", "CollectionEntry", "Note", "0..1 收录 1"),
        edge("e17", "User", "CheckIn", "1 拥有 0..*"),
        edge("e18", "User", "XpEvent", "1 拥有 0..*"),
        edge("e19", "User", "LoginEvent", "1 产生 0..*"),
        edge("e20", "User", "Report", "预留", dashed=True),
        edge("e21", "User", "Block", "预留", dashed=True),
    ]
    diagram("ch5-fig2-class-core-and-extensions.drawio", "核心数据 UML 类图", "".join(parts), 1360, 760)


def class_diagram_program() -> None:
    parts = [
        cell("Frontend", "前端页面组件\nWritePage\nBrowsePage\nNoteDetailPage\nProfilePage\nAdminPage", 50, 90, 220, 150, CLASS),
        cell("Api", "前端 API 封装\nendpoints/notes.ts\nendpoints/interactions.ts\nendpoints/drafts.ts\nendpoints/auth.ts\n合集前端封装待接入", 50, 340, 240, 170, CLASS),
        cell("Routes", "FastAPI 路由层\nroutes/notes.py\nroutes/drafts.py\nroutes/interactions.py\nroutes/collections.py\nroutes/auth.py\nroutes/ai.py", 390, 80, 250, 175, CLASS),
        cell("Services", "服务/查询层\nservices/notes.py\nservices/comments.py\nservices/ai_compose.py\nservices/auth.py", 730, 80, 250, 145, CLASS),
        cell("Schemas", "Schema 边界\nNoteOut / DraftOut\nCommentIn / CommentOut\nCollectionOut / UserOut\nAIComposeIn / AIComposeOut", 390, 360, 250, 155, CLASS),
        cell("Models", "SQLAlchemy 模型\nUser / Note / Draft\nComment / Like / NoteDislike\nFavorite / CommentReaction\nCollection / CollectionEntry\nCheckIn / XpEvent", 730, 330, 270, 205, CLASS),
        cell("External", "外部服务\nOpenAI-compatible AI\nDeepSeek dry-run/testing", 1080, 130, 190, 110, CLASS),
        edge("p1", "Frontend", "Api", "调用"),
        edge("p2", "Api", "Routes", "REST JSON + JWT"),
        edge("p3", "Routes", "Schemas", "请求/响应校验"),
        edge("p4", "Routes", "Services", "复杂查询/AI/鉴权复用"),
        edge("p5", "Routes", "Models", "轻量写入"),
        edge("p6", "Services", "Models", "SQLAlchemy 查询"),
        edge("p7", "Services", "External", "AI 润色/摘要"),
    ]
    diagram("ch6-fig1-class-diagram-note-community.drawio", "程序结构 UML 类图", "".join(parts), 1320, 610)


def main() -> None:
    FIGS.mkdir(parents=True, exist_ok=True)
    dfd_top()
    dfd_publish()
    dfd_interaction_collection()
    usecase()
    class_diagram_data()
    class_diagram_program()


if __name__ == "__main__":
    main()
