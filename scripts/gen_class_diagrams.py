"""Generate 图5-2 (领域模型类图) and 图6-1 (程序结构类图)."""
from __future__ import annotations

from pathlib import Path

import figlib as F
from figlib import Fig

FIGS = Path(__file__).resolve().parents[1] / "docs" / "coursework" / "figures"


# ==========================================================================
# 图5-2  领域模型 UML 类图（15 实体）
# ==========================================================================
def fig5_2() -> Fig:
    g = Fig("图5-2 领域模型类图", 1500, 1280)
    PLAN_H, PLAN_S = F.GRAY_F, F.GRAY_S  # governance / planned classes
    CORE_H = "#c7dbf5"

    # top band ---------------------------------------------------------------
    g.uml("Draft", 70, 60, 250, "Draft 草稿", [
        "+ id: str {PK}",
        "+ owner_sid: str {FK}",
        "+ title / summary: str",
        "+ content: text",
        "+ category / tags",
        "+ updated_at: datetime",
    ])
    g.uml("Collection", 500, 60, 230, "Collection 合集", [
        "+ id: str {PK}",
        "+ owner_sid: str {FK}",
        "+ title: str",
        "+ description: text",
        "+ created_at / updated_at",
    ], header_fill=F.YELLOW_F, header_stroke=F.YELLOW_S)
    g.uml("CollectionEntry", 830, 60, 250, "CollectionEntry 合集条目", [
        "+ collection_id: str {PK,FK}",
        "+ note_id: str {PK,FK,U}",
        "+ sort_order: int",
        "+ created_at",
    ], header_fill=F.YELLOW_F, header_stroke=F.YELLOW_S)
    g.uml("Report", 1190, 60, 270, "Report 举报工单", [
        "+ id: str {PK}",
        "+ reporter_sid: str {FK}",
        "+ target_type: str",
        "+ reason / status: str",
        "+ ai_label / ai_confidence",
    ], stereotype="规划·预留", header_fill=PLAN_H, header_stroke=PLAN_S)
    g.uml("Block", 1190, 320, 230, "Block 拉黑", [
        "+ blocker_sid: str {PK,FK}",
        "+ blocked_sid: str {PK,FK}",
        "+ created_at",
    ], stereotype="规划·预留", header_fill=PLAN_H, header_stroke=PLAN_S)

    # middle band ------------------------------------------------------------
    g.uml("User", 70, 500, 250, "User 用户", [
        "+ sid: str {PK}",
        "+ name / nickname: str",
        "+ preferred_name: str",
        "+ role: str  {user/admin}",
        "+ exp / level: int",
        "+ created_at: datetime",
    ], header_fill=CORE_H, header_stroke=F.BLUE_S)
    g.uml("Note", 500, 490, 250, "Note 笔记", [
        "+ id: str {PK}",
        "+ author_sid: str {FK}",
        "+ title / summary: str",
        "+ content: text",
        "+ category: str",
        "+ tags: list[str]",
        "+ status: str",
        "+ created_at: datetime",
    ], header_fill=CORE_H, header_stroke=F.BLUE_S)
    g.uml("Comment", 880, 460, 270, "Comment 评论", [
        "+ id: str {PK}",
        "+ note_id: str {FK}",
        "+ author_sid: str {FK}",
        "+ parent_id: str {FK}",
        "+ reply_to_sid: str {FK}",
        "+ content: text",
        "+ images: list[str]",
        "+ anchor_text: str",
        "+ status: str",
    ])

    # growth / audit (right column) -----------------------------------------
    g.uml("CheckIn", 1210, 500, 230, "CheckIn 签到", [
        "+ user_sid: str {PK,FK}",
        "+ checkin_date: date {PK}",
        "+ created_at",
    ], header_fill=F.PURPLE_F, header_stroke=F.PURPLE_S)
    g.uml("XpEvent", 1210, 700, 250, "XpEvent 经验流水", [
        "+ id: int {PK}",
        "+ user_sid: str {FK}",
        "+ source_type: str",
        "+ delta: int",
        "+ ref_type / ref_id",
        "+ created_at",
    ], header_fill=F.PURPLE_F, header_stroke=F.PURPLE_S)
    g.uml("LoginEvent", 1210, 950, 230, "LoginEvent 登录事件", [
        "+ id: int {PK}",
        "+ user_sid: str {FK}",
        "+ ip / user_agent",
        "+ created_at",
    ], header_fill=F.GRAY_F, header_stroke=F.GRAY_S)

    # bottom band (interaction link entities) --------------------------------
    g.uml("Like", 70, 910, 220, "Like 点赞", [
        "+ note_id: str {PK,FK}",
        "+ user_sid: str {PK,FK}",
        "+ created_at",
    ], header_fill=F.GREEN_F, header_stroke=F.GREEN_S)
    g.uml("NoteDislike", 330, 910, 230, "NoteDislike 点踩", [
        "+ note_id: str {PK,FK}",
        "+ user_sid: str {PK,FK}",
        "+ created_at",
    ], header_fill=F.GREEN_F, header_stroke=F.GREEN_S)
    g.uml("Favorite", 600, 910, 220, "Favorite 收藏", [
        "+ note_id: str {PK,FK}",
        "+ user_sid: str {PK,FK}",
        "+ created_at",
    ], header_fill=F.GREEN_F, header_stroke=F.GREEN_S)
    g.uml("CommentReaction", 880, 910, 260, "CommentReaction 评论表态", [
        "+ comment_id: str {PK,FK}",
        "+ user_sid: str {PK,FK}",
        "+ kind: str  {like/dislike}",
        "+ created_at",
    ], header_fill=F.GREEN_F, header_stroke=F.GREEN_S)

    # relationships ---------------------------------------------------------
    L = F.LINE

    def rel(s, d, label, sl="1", dl="0..*", **kw):
        g.link(s, d, label=label, src_label=sl, dst_label=dl, kind="assoc", color=L, **kw)

    # local / straight
    rel("User", "Draft", "拥有")
    rel("User", "Note", "发布")
    rel("Note", "Comment", "包含")
    rel("User", "Collection", "创建")
    rel("User", "Like", "", sl="")
    rel("Like", "Note", "点赞", sl="0..*", dl="1")
    rel("User", "NoteDislike", "", sl="")
    rel("NoteDislike", "Note", "点踩", sl="0..*", dl="1")
    rel("User", "Favorite", "", sl="")
    rel("Favorite", "Note", "收藏", sl="0..*", dl="1")
    rel("Collection", "CollectionEntry", "包含")
    g.link("CollectionEntry", "Note", label="收录", kind="assoc", color=L,
           src_label="0..1", dst_label="1")
    rel("CommentReaction", "Comment", "表态", sl="0..*", dl="1")

    # top corridor: User -> Comment (发表)
    g.link("User", "Comment", label="发表", kind="assoc", color=L, src_label="1",
           dst_label="0..*", waypoints=[(205, 448), (1010, 448)])
    # Comment self loop on top edge (楼中楼 父/回复)
    g.link("Comment", "Comment", label="父 / 回复(楼中楼)", kind="assoc", color=L,
           src_label="0..1", dst_label="0..*",
           points=[(990, 460), (990, 424), (1120, 424), (1120, 460)])
    # bottom corridor: User -> CommentReaction (评论表态)
    g.link("User", "CommentReaction", label="评论表态", kind="assoc", color=L,
           src_label="", dst_label="0..*", waypoints=[(300, 838), (995, 838)])
    # right bus: User -> growth/audit
    g.link("User", "CheckIn", label="签到", kind="assoc", color=L, src_label="",
           dst_label="0..*", waypoints=[(322, 742), (1178, 742), (1178, 545)])
    g.link("User", "XpEvent", label="经验", kind="assoc", color=L, src_label="",
           dst_label="0..*", waypoints=[(322, 760), (1186, 760)])
    g.link("User", "LoginEvent", label="登录", kind="assoc", color=L, src_label="",
           dst_label="0..*", waypoints=[(322, 778), (1194, 778), (1194, 988)])
    # top corridor (planned, dashed): User -> Report / Block
    g.link("User", "Report", label="举报(规划)", kind="assoc", dashed=True, color=PLAN_S,
           src_label="1", dst_label="0..*", waypoints=[(255, 430), (1330, 430)])
    g.link("User", "Block", label="拉黑(规划)", kind="assoc", dashed=True, color=PLAN_S,
           src_label="1", dst_label="0..*", waypoints=[(235, 412), (1165, 412), (1165, 360)])
    return g


# ==========================================================================
# 图6-1  程序结构 UML 类图（分层设计类图）
# ==========================================================================
def _band(g: Fig, x, y, w, h, label, fill):
    g.box(f"band_{label}", x, y, w, h, "", fill=fill, stroke="#d7dee8", rounded=True)
    g.ui_text(f"bandlbl_{label}", x + 14, y + 8, w - 20, 20, label, font=13, bold=True,
              align="left", color=F.SUBINK)


def fig6_1() -> Fig:
    g = Fig("图6-1 程序结构类图", 1540, 1230)
    CTRL_H, CTRL_S = "#c7dbf5", F.BLUE_S
    SVC_H, SVC_S = F.GREEN_F, F.GREEN_S
    VIEW_H, VIEW_S = F.YELLOW_F, F.YELLOW_S

    _band(g, 30, 50, 1480, 190, "① 前端表现层  React 组件（boundary）", "#fbfcfe")
    _band(g, 30, 270, 1480, 150, "② 前端接口层  API 封装 / 数据契约", "#fbfdfb")
    _band(g, 30, 450, 1480, 290, "③ 后端路由层  routes（control · FastAPI）", "#fafbff")
    _band(g, 30, 770, 1130, 190, "④ 后端服务层  services（control）", "#fbfdfb")
    _band(g, 30, 990, 1480, 200, "⑤ 数据层  models（entity · SQLAlchemy ORM）", "#fcfbfd")

    v = dict(header_fill=VIEW_H, header_stroke=VIEW_S)
    g.uml("WritePage", 55, 108, 215, "WritePage «page»", methods=[
        "+ autoSave()", "+ aiPolish()", "+ publish()"], **v)
    g.uml("BrowsePage", 295, 108, 210, "BrowsePage «page»", methods=[
        "+ filterSort()", "+ loadMore()"], **v)
    g.uml("NoteDetailPage", 525, 108, 220, "NoteDetailPage «page»", methods=[
        "+ like()", "+ toggleCmtMode()"], **v)
    g.uml("CommentSection", 765, 108, 225, "CommentSection «组件»", methods=[
        "+ createComment()", "+ deleteComment()", "+ anchorJump()"], **v)
    g.uml("ProfilePage", 1010, 108, 215, "ProfilePage «page»", methods=[
        "+ notesTab()", "+ draftsTab()"], **v)
    g.uml("AdminPage", 1245, 108, 215, "AdminPage «page»", methods=[
        "+ manageUsers()", "+ loginAudit()"], **v)

    g.uml("ApiClient", 55, 312, 320, "ApiClient «fetch 封装»", methods=[
        "+ get() / post() / put() / del()", "+ authBearer(JWT)", "+ zodParse(schema)"],
        header_fill="#c7dbf5", header_stroke=CTRL_S)
    g.uml("Schemas", 430, 312, 470, "DTO / Schemas «pydantic · Zod»", attrs=[
        "NoteOut · DraftOut · NoteCard",
        "CommentIn · CommentOut · PaginatedComments",
        "CollectionOut · CollectionDetailOut",
        "AIComposeIn/Out · CheckinOut · XpEventOut"],
        header_fill=F.GRAY_F, header_stroke=F.GRAY_S)

    c = dict(header_fill=CTRL_H, header_stroke=CTRL_S)
    g.uml("NotesRoutes", 45, 512, 225, "NotesRoutes", methods=[
        "+ list()", "+ detail()", "+ edit()", "+ delete()"], **c)
    g.uml("DraftsRoutes", 290, 512, 225, "DraftsRoutes", methods=[
        "+ create()", "+ update()", "+ publish()"], **c)
    g.uml("InteractionsRoutes", 535, 512, 245, "InteractionsRoutes", methods=[
        "+ like() / dislike()", "+ favorite()", "+ createComment()",
        "+ reactComment()"], **c)
    g.uml("CollectionsRoutes", 800, 512, 235, "CollectionsRoutes", methods=[
        "+ crud()", "+ addEntry()", "+ noteContext()"], **c)
    g.uml("AiRoutes", 1055, 512, 200, "AiRoutes", methods=[
        "+ compose()", "+ composeStream()"], **c)
    g.uml("AuthRoutes", 1275, 512, 210, "AuthRoutes", methods=[
        "+ login() / register()", "+ dailyCheckin()", "+ xpEvents()"], **c)

    s = dict(header_fill=SVC_H, header_stroke=SVC_S)
    g.uml("NotesService", 70, 812, 250, "NotesService", methods=[
        "+ listNotes()", "+ detail()", "+ edit() / delete()"], **s)
    g.uml("CommentsService", 400, 812, 240, "CommentsService", methods=[
        "+ listComments()  «keyset 分页»"], **s)
    g.uml("AiComposeService", 720, 812, 270, "AiComposeService", methods=[
        "+ polish()", "+ summarizeStream()", "+ fallbackTruncate()"], **s)
    g.uml("AiExternal", 1220, 812, 270, "AI 服务 «external»", methods=[
        "+ /v1/chat/completions", "+ 一次性 / SSE 流式"],
        header_fill=F.ORANGE_F, header_stroke=F.ORANGE_S)

    g.uml("ORM", 130, 1030, 1280, "ORM 模型（SQLAlchemy · 详见图5-2）", attrs=[
        "User · Note · Draft · Comment",
        "Like · NoteDislike · Favorite · CommentReaction",
        "Collection · CollectionEntry · CheckIn · XpEvent · LoginEvent",
        "Report · Block（规划·预留）"],
        header_fill="#c7dbf5", header_stroke=CTRL_S)

    # dependencies (dashed «use») -------------------------------------------
    dep = dict(kind="open", color=F.LINE, font=11)
    g.link("NoteDetailPage", "ApiClient", label="调用", **dep,
           waypoints=[(635, 275)])
    g.link("WritePage", "ApiClient", **dep, waypoints=[(162, 280), (200, 300)])
    g.link("ApiClient", "InteractionsRoutes", label="REST JSON + JWT", **dep,
           waypoints=[(215, 452)])
    g.link("InteractionsRoutes", "CommentsService", label="复用查询", **dep)
    g.link("NotesRoutes", "NotesService", label="复用查询", **dep)
    g.link("AiRoutes", "AiComposeService", label="AI 编排", **dep,
           waypoints=[(1000, 745), (855, 770)])
    g.link("AuthRoutes", "ORM", label="签到/经验写入", **dep,
           waypoints=[(1388, 700), (1388, 1005)])
    g.link("InteractionsRoutes", "ORM", label="轻量写入", **dep,
           waypoints=[(658, 760), (658, 978)])
    g.link("NotesService", "ORM", label="SQLAlchemy 查询", **dep)
    g.link("AiComposeService", "AiExternal", label="AI 润色/摘要", kind="open",
           color=F.ORANGE_S, dashed=True, font=11)
    g.ui_text("note61", 950, 322, 520, 90,
              "分层单向依赖：routes → services → db；\n"
              "发布 POST /drafts/{id}/publish 为唯一建笔记路径；\n"
              "AI 永不硬失败：故障降级不阻断主流程。",
              font=11, align="left", color=F.SUBINK)
    return g


def main():
    builders = (
        ("ch5-fig2-class-domain", fig5_2),
        ("ch6-fig1-class-program", fig6_1),
    )
    for stem, builder in builders:
        g = builder()
        paths = F.render(g, FIGS, stem)
        print("wrote", paths["drawio"].name, paths["svg"].name, paths["png"].name)


if __name__ == "__main__":
    main()
