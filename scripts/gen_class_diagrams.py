"""Generate 图5-2 (领域模型类图) and 图6-1 (程序结构类图).

Both use the standard 3-compartment UML class box:
  ① «stereotype» + 类名   ② 成员变量   ③ 成员函数
"""
from __future__ import annotations

from pathlib import Path

import figlib as F
from figlib import Fig

FIGS = Path(__file__).resolve().parents[1] / "docs" / "coursework" / "figures"


# ==========================================================================
# 图5-2  领域模型 UML 类图（15 实体）
# ==========================================================================
def fig5_2() -> Fig:
    g = Fig("图5-2 领域模型类图", 1540, 1400)
    PLAN_H, PLAN_S = F.GRAY_F, F.GRAY_S
    CORE_H = "#c7dbf5"
    ENT = "entity"

    # top band ---------------------------------------------------------------
    g.uml("Draft", 70, 55, 250, "Draft 草稿", stereotype=ENT,
          attrs=["+ id: str {PK}", "+ owner_sid: str {FK}", "+ title / content / category"],
          methods=["+ autosave()", "+ publish(): Note"])
    g.uml("Collection", 500, 55, 235, "Collection 合集", stereotype=ENT,
          header_fill=F.YELLOW_F, header_stroke=F.YELLOW_S,
          attrs=["+ id: str {PK}", "+ owner_sid: str {FK}", "+ title / description"],
          methods=["+ addEntry(note)", "+ removeEntry(note)", "+ reorder()"])
    g.uml("CollectionEntry", 835, 55, 255, "CollectionEntry 合集条目", stereotype=ENT,
          header_fill=F.YELLOW_F, header_stroke=F.YELLOW_S,
          attrs=["+ collection_id: str {PK,FK}", "+ note_id: str {PK,FK,U}",
                 "+ sort_order: int"],
          methods=["+ moveTo(order)"])
    g.uml("Report", 1205, 45, 265, "Report 举报工单", stereotype="规划·entity",
          header_fill=PLAN_H, header_stroke=PLAN_S,
          attrs=["+ id: str {PK}", "+ reporter_sid: str {FK}", "+ target_type: str",
                 "+ reason / status: str", "+ ai_label / ai_confidence"],
          methods=["+ submit()", "+ aiClassify()", "+ resolve(action)"])
    g.uml("Block", 1205, 305, 235, "Block 拉黑", stereotype="规划·entity",
          header_fill=PLAN_H, header_stroke=PLAN_S,
          attrs=["+ blocker_sid: str {PK,FK}", "+ blocked_sid: str {PK,FK}"],
          methods=["+ block()", "+ unblock()"])

    # middle band ------------------------------------------------------------
    g.uml("User", 70, 560, 250, "User 用户", stereotype=ENT,
          header_fill=CORE_H, header_stroke=F.BLUE_S,
          attrs=["+ sid: str {PK}", "+ nickname / preferred_name", "+ role / exp / level"],
          methods=["+ checkIn()", "+ gainExp(delta)", "+ promote(role)"])
    g.uml("Note", 500, 540, 255, "Note 笔记", stereotype=ENT,
          header_fill=CORE_H, header_stroke=F.BLUE_S,
          attrs=["+ id: str {PK}", "+ author_sid: str {FK}", "+ title / summary / content",
                 "+ category / tags", "+ status: str"],
          methods=["+ publishFrom(draft)", "+ edit()", "+ softDelete()"])
    g.uml("Comment", 885, 510, 270, "Comment 评论", stereotype=ENT,
          attrs=["+ id: str {PK}", "+ note_id: str {FK}", "+ parent_id: str {FK}",
                 "+ reply_to_sid: str {FK}", "+ content / images", "+ anchor_text: str"],
          methods=["+ reply(parent)", "+ react(kind)", "+ delete()"])

    # growth / audit ---------------------------------------------------------
    g.uml("CheckIn", 1210, 560, 235, "CheckIn 签到", stereotype=ENT,
          header_fill=F.PURPLE_F, header_stroke=F.PURPLE_S,
          attrs=["+ user_sid: str {PK,FK}", "+ checkin_date: date {PK}"],
          methods=["+ create()"])
    g.uml("XpEvent", 1210, 765, 255, "XpEvent 经验流水", stereotype=ENT,
          header_fill=F.PURPLE_F, header_stroke=F.PURPLE_S,
          attrs=["+ id: int {PK}", "+ user_sid: str {FK}", "+ source_type / delta"],
          methods=["+ record()"])
    g.uml("LoginEvent", 1210, 1010, 235, "LoginEvent 登录事件", stereotype=ENT,
          header_fill=F.GRAY_F, header_stroke=F.GRAY_S,
          attrs=["+ id: int {PK}", "+ user_sid: str {FK}", "+ ip / user_agent"],
          methods=["+ record()"])

    # bottom band (interaction link entities) --------------------------------
    for nid, x, name in (("Like", 70, "Like 点赞"), ("NoteDislike", 330, "NoteDislike 点踩"),
                         ("Favorite", 610, "Favorite 收藏")):
        g.uml(nid, x, 995, 235 if nid == "NoteDislike" else 220, name, stereotype=ENT,
              header_fill=F.GREEN_F, header_stroke=F.GREEN_S,
              attrs=["+ note_id: str {PK,FK}", "+ user_sid: str {PK,FK}"],
              methods=["+ toggle()"])
    g.uml("CommentReaction", 885, 995, 265, "CommentReaction 评论表态", stereotype=ENT,
          header_fill=F.GREEN_F, header_stroke=F.GREEN_S,
          attrs=["+ comment_id: str {PK,FK}", "+ user_sid: str {PK,FK}", "+ kind: str"],
          methods=["+ toggle(kind)"])

    # relationships ----------------------------------------------------------
    L = F.LINE

    def rel(s, d, label, sl="1", dl="0..*", **kw):
        g.link(s, d, label=label, src_label=sl, dst_label=dl, kind="assoc", color=L, **kw)

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

    g.link("User", "Comment", label="发表", kind="assoc", color=L, src_label="1",
           dst_label="0..*", waypoints=[(205, 484), (1010, 484)])
    g.link("Comment", "Comment", label="父 / 回复(楼中楼)", kind="assoc", color=L,
           src_label="0..1", dst_label="0..*",
           points=[(995, 510), (995, 466), (1125, 466), (1125, 510)])
    g.link("User", "CommentReaction", label="评论表态", kind="assoc", color=L,
           src_label="", dst_label="0..*", waypoints=[(300, 900), (1000, 900)])
    g.link("User", "CheckIn", label="签到", kind="assoc", color=L, src_label="",
           dst_label="0..*", waypoints=[(322, 806), (1178, 806), (1178, 606)])
    g.link("User", "XpEvent", label="经验", kind="assoc", color=L, src_label="",
           dst_label="0..*", waypoints=[(322, 824), (1186, 824)])
    g.link("User", "LoginEvent", label="登录", kind="assoc", color=L, src_label="",
           dst_label="0..*", waypoints=[(322, 842), (1194, 842), (1194, 1052)])
    g.link("User", "Report", label="举报(规划)", kind="assoc", dashed=True, color=PLAN_S,
           src_label="1", dst_label="0..*", waypoints=[(255, 458), (1350, 458)])
    g.link("User", "Block", label="拉黑(规划)", kind="assoc", dashed=True, color=PLAN_S,
           src_label="1", dst_label="0..*", waypoints=[(235, 440), (1170, 440), (1170, 372)])
    return g


# ==========================================================================
# 图6-1  程序结构 UML 类图（分层设计类图）
# ==========================================================================
def _band(g: Fig, x, y, w, h, label, fill):
    g.box(f"band_{label}", x, y, w, h, "", fill=fill, stroke="#d7dee8", rounded=True)
    g.ui_text(f"bandlbl_{label}", x + 14, y + 8, w - 20, 20, label, font=13, bold=True,
              align="left", color=F.SUBINK)


def fig6_1() -> Fig:
    g = Fig("图6-1 程序结构类图", 1560, 1470)
    CTRL_H, CTRL_S = "#c7dbf5", F.BLUE_S
    SVC_H, SVC_S = F.GREEN_F, F.GREEN_S
    VIEW_H, VIEW_S = F.YELLOW_F, F.YELLOW_S

    _band(g, 30, 45, 1500, 285, "① 前端表现层  React 组件（boundary）", "#fbfcfe")
    _band(g, 30, 355, 1500, 205, "② 前端接口层  API 封装 / 数据契约", "#fbfdfb")
    _band(g, 30, 585, 1500, 335, "③ 后端路由层  routes（control · FastAPI）", "#fafbff")
    _band(g, 30, 945, 1150, 250, "④ 后端服务层  services（control）", "#fbfdfb")
    _band(g, 30, 1220, 1500, 215, "⑤ 数据层  models（entity · SQLAlchemy ORM）", "#fcfbfd")

    v = dict(header_fill=VIEW_H, header_stroke=VIEW_S, stereotype="boundary")
    g.uml("WritePage", 55, 100, 220, "WritePage", attrs=["- draftStore", "- aiState"],
          methods=["+ autoSave()", "+ aiPolish()", "+ publish()"], **v)
    g.uml("BrowsePage", 300, 100, 215, "BrowsePage", attrs=["- filters", "- cursor"],
          methods=["+ filterSort()", "+ loadMore()"], **v)
    g.uml("NoteDetailPage", 540, 100, 225, "NoteDetailPage",
          attrs=["- noteId", "- cmtMode"], methods=["+ like()", "+ toggleCmtMode()"], **v)
    g.uml("CommentSection", 790, 100, 235, "CommentSection", attrs=["- comments", "- anchor"],
          methods=["+ createComment()", "+ deleteComment()", "+ anchorJump()"], **v)
    g.uml("ProfilePage", 1050, 100, 215, "ProfilePage", attrs=["- activeTab"],
          methods=["+ notesTab()", "+ draftsTab()"], **v)
    g.uml("AdminPage", 1290, 100, 215, "AdminPage", attrs=["- role"],
          methods=["+ manageUsers()", "+ loginAudit()"], **v)

    g.uml("ApiClient", 55, 400, 320, "ApiClient", stereotype="boundary",
          header_fill="#c7dbf5", header_stroke=CTRL_S,
          attrs=["- baseURL: str", "- token: JWT"],
          methods=["+ get() / post() / put() / del()", "+ authBearer()", "+ zodParse(schema)"])
    g.uml("Schemas", 430, 400, 480, "DTO / Schemas", stereotype="pydantic · Zod",
          header_fill=F.GRAY_F, header_stroke=F.GRAY_S,
          attrs=["NoteOut · DraftOut · NoteCard",
                 "CommentIn · CommentOut · PaginatedComments",
                 "CollectionOut · CollectionDetailOut",
                 "AIComposeIn/Out · CheckinOut · XpEventOut"],
          methods=[])

    c = dict(header_fill=CTRL_H, header_stroke=CTRL_S, stereotype="control")
    g.uml("NotesRoutes", 50, 650, 225, "NotesRoutes", attrs=["- svc: NotesService", "- db"],
          methods=["+ list()", "+ detail()", "+ edit()", "+ delete()"], **c)
    g.uml("DraftsRoutes", 300, 650, 230, "DraftsRoutes",
          attrs=["- ai: AiComposeService", "- db"],
          methods=["+ create()", "+ update()", "+ publish()"], **c)
    g.uml("InteractionsRoutes", 555, 650, 255, "InteractionsRoutes",
          attrs=["- cmt: CommentsService", "- db"],
          methods=["+ like() / dislike()", "+ favorite()", "+ createComment()",
                   "+ reactComment()"], **c)
    g.uml("CollectionsRoutes", 835, 650, 235, "CollectionsRoutes", attrs=["- db"],
          methods=["+ crud()", "+ addEntry()", "+ noteContext()"], **c)
    g.uml("AiRoutes", 1095, 650, 200, "AiRoutes", attrs=["- ai: AiComposeService"],
          methods=["+ compose()", "+ composeStream()"], **c)
    g.uml("AuthRoutes", 1315, 650, 200, "AuthRoutes", attrs=["- db"],
          methods=["+ login() / register()", "+ dailyCheckin()", "+ xpEvents()"], **c)

    s = dict(header_fill=SVC_H, header_stroke=SVC_S, stereotype="control")
    g.uml("NotesService", 70, 1000, 250, "NotesService", attrs=["- db: AsyncSession"],
          methods=["+ listNotes()", "+ detail()", "+ edit() / delete()"], **s)
    g.uml("CommentsService", 400, 1000, 245, "CommentsService", attrs=["- db: AsyncSession"],
          methods=["+ listComments()  «keyset»"], **s)
    g.uml("AiComposeService", 720, 1000, 270, "AiComposeService",
          attrs=["- client: OpenAI", "- model: str"],
          methods=["+ polish()", "+ summarizeStream()", "+ fallbackTruncate()"], **s)
    g.uml("AiExternal", 1230, 1000, 270, "AI 服务", stereotype="external",
          header_fill=F.ORANGE_F, header_stroke=F.ORANGE_S,
          attrs=["+ endpoint: /v1/chat/completions", "+ model"],
          methods=["+ chatCompletions()  «一次性/SSE»"])

    g.uml("ORM", 130, 1265, 1280, "ORM 模型（SQLAlchemy · 详见图5-2）", stereotype="entity",
          header_fill="#c7dbf5", header_stroke=CTRL_S,
          attrs=["User · Note · Draft · Comment",
                 "Like · NoteDislike · Favorite · CommentReaction",
                 "Collection · CollectionEntry · CheckIn · XpEvent · LoginEvent",
                 "Report · Block（规划·预留）"],
          methods=[])

    dep = dict(kind="open", color=F.LINE, font=11)
    g.link("NoteDetailPage", "ApiClient", label="调用", **dep, waypoints=[(650, 372)])
    g.link("WritePage", "ApiClient", **dep, waypoints=[(165, 360), (200, 400)])
    g.link("ApiClient", "InteractionsRoutes", label="REST JSON + JWT", **dep,
           waypoints=[(215, 610)])
    g.link("InteractionsRoutes", "CommentsService", label="复用查询", **dep)
    g.link("NotesRoutes", "NotesService", label="复用查询", **dep)
    g.link("AiRoutes", "AiComposeService", label="AI 编排", **dep,
           waypoints=[(1030, 930), (855, 945)])
    g.link("AuthRoutes", "ORM", label="签到/经验写入", **dep,
           waypoints=[(1415, 900), (1528, 900), (1528, 1256), (1360, 1256)])
    g.link("InteractionsRoutes", "ORM", label="轻量写入", **dep,
           waypoints=[(660, 935), (660, 1250)])
    g.link("NotesService", "ORM", label="SQLAlchemy 查询", **dep)
    g.link("AiComposeService", "AiExternal", label="AI 润色/摘要", kind="open",
           color=F.ORANGE_S, dashed=True, font=11)
    g.ui_text("note61", 950, 410, 540, 90,
              "分层单向依赖：routes → services → db；\n"
              "发布 POST /drafts/{id}/publish 为唯一建笔记路径；\n"
              "AI 永不硬失败：故障降级不阻断主流程。",
              font=11, align="left", color=F.SUBINK)
    return g


def main():
    for stem, builder in (("ch5-fig2-class-domain", fig5_2),
                          ("ch6-fig1-class-program", fig6_1)):
        paths = F.render(builder(), FIGS, stem)
        print("wrote", paths["drawio"].name)


if __name__ == "__main__":
    main()
