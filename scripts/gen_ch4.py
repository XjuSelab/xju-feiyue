"""Chapter 4 figures: system flow, top DFD, two functional DFDs, use-case."""
from __future__ import annotations

from pathlib import Path

import figlib as F
from figlib import Fig

FIGS = Path(__file__).resolve().parents[1] / "docs" / "coursework" / "figures"


# --------------------------------------------------------------------------
# 图4-1  系统流程图（请求处理链路）
# --------------------------------------------------------------------------
def fig4_1() -> Fig:
    g = Fig("图4-1 系统流程图", 1060, 940)
    g.external("U", 400, 40, 260, 64, "用户 / 管理员")
    g.box("SPA", 400, 150, 260, 60, "浏览器 · React 18 SPA", fill=F.BLUE_F, stroke=F.BLUE_S)
    g.box("NG", 380, 262, 300, 66, "nginx 反向代理\n静态资源直出 + API 反向代理",
          fill=F.GRAY_F, stroke=F.GRAY_S)
    # backend container
    g.box("BE", 350, 372, 360, 320, "", fill="#fafbff", stroke="#c4ccd6", rounded=True)
    g.ui_text("BElbl", 366, 382, 320, 20, "FastAPI 单体后端（routes → services → db）",
              font=11, bold=True, align="left", color=F.SUBINK)
    g.box("R", 420, 420, 220, 54, "路由层 routes", fill=F.BLUE_F, stroke=F.BLUE_S)
    g.box("S", 420, 500, 220, 54, "服务层 services", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.box("D", 420, 580, 220, 54, "数据层 db（SQLAlchemy）", fill=F.PURPLE_F, stroke=F.PURPLE_S)
    g.datastore("DB", 400, 740, 260, 60, "SQLite 主库 labnotes.db", fill=F.PURPLE_F,
                stroke=F.PURPLE_S)
    g.external("AI", 780, 470, 220, 74, "外部 AI 服务\nDeepSeek · OpenAI 兼容")
    g.box("MOD", 780, 590, 220, 54, "AI 审查分类（规划）", fill=F.RED_F, stroke=F.RED_S,
          dashed=True)
    g.datastore("HF", 760, 740, 240, 60, "HF 私有 Dataset · 灾备快照", fill=F.GRAY_F,
                stroke=F.GRAY_S, dashed=True)

    A = dict(kind="arrow", color=F.LINE)
    g.link("U", "SPA", label="操作", **A)
    g.link("SPA", "NG", label="HTTPS 请求", **A)
    g.link("NG", "R", label="REST · JWT", **A)
    g.link("R", "S", label="复杂查询/AI/鉴权", **A)
    g.link("R", "D", label="轻量写入", color=F.LINE, kind="arrow",
           waypoints=[(400, 447), (400, 607)])
    g.link("S", "D", label="ORM 查询", **A)
    g.link("D", "DB", label="读写", **A)
    g.link("S", "AI", label="润色 / 摘要", **A)
    g.link("S", "MOD", label="审查(规划)", kind="arrow", color=F.RED_S, dashed=True,
           waypoints=[(660, 527), (700, 617)])
    g.link("DB", "HF", label="cron 快照", kind="arrow", color=F.SUBINK, dashed=True)
    g.link("SPA", "U", label="页面响应", color=F.SUBINK,
           waypoints=[(690, 180), (690, 72)], kind="arrow")
    return g


# --------------------------------------------------------------------------
# 图4-2  顶层数据流图
# --------------------------------------------------------------------------
def fig4_2() -> Fig:
    g = Fig("图4-2 顶层数据流图", 1320, 860)
    g.external("guest", 60, 120, 165, 74, "匿名访客")
    g.external("user", 60, 360, 165, 74, "注册用户")
    g.external("ai", 1095, 210, 170, 74, "外部 AI 服务")
    g.external("admin", 1095, 470, 170, 74, "管理员（规划）")
    for n in ("admin",):
        g.by_id(n).dashed = True
    g.process("P0", 470, 210, 360, 190, "P0\n笔记与社区互动子系统",
              shape="ellipse", fill=F.GREEN_F, stroke=F.GREEN_S)

    ds = [("D1", "D1 草稿库"), ("D2", "D2 笔记库"), ("D3", "D3 互动库"),
          ("D4", "D4 评论库"), ("D5", "D5 治理预留库"), ("D6", "D6 成长库"),
          ("D7", "D7 合集库")]
    x = 60
    for did, label in ds:
        dashed = did == "D5"
        g.datastore(did, x, 660, 165, 56, label,
                    fill=F.GRAY_F if dashed else F.PURPLE_F,
                    stroke=F.GRAY_S if dashed else F.PURPLE_S, dashed=dashed)
        x += 180

    L = F.LINE
    g.link("user", "P0", label="草稿/发布/评论\n表态/收藏/签到/合集", kind="arrow", color=L,
           tside="w")
    g.link("P0", "user", label="列表/详情/结果", kind="arrow", color=L,
           points=[(500, 360), (300, 300), (225, 385)])
    g.link("guest", "P0", label="浏览/检索", kind="arrow", color=L, tside="w")
    g.link("P0", "guest", label="笔记/评论数据", kind="arrow", color=L,
           points=[(500, 250), (300, 175), (225, 160)])
    g.link("P0", "ai", label="润色/摘要请求", kind="arrow", color=L,
           points=[(830, 270), (1095, 250)])
    g.link("ai", "P0", label="改写/摘要文本", kind="arrow", color=L,
           points=[(1095, 285), (830, 320)])
    g.link("admin", "P0", label="裁决(规划)", kind="arrow", color=F.SUBINK, dashed=True)
    # process <-> stores
    for did in ("D1", "D2", "D3", "D4", "D5", "D6", "D7"):
        col = F.SUBINK if did == "D5" else L
        dn = g.by_id(did)
        g.link("P0", did, kind="arrow", color=col, dashed=(did == "D5"),
               waypoints=[(dn.cx, 500)])
    return g


# --------------------------------------------------------------------------
# 图4-3  功能级 DFD：草稿发布与自动摘要
# --------------------------------------------------------------------------
def fig4_3() -> Fig:
    g = Fig("图4-3 功能级DFD·草稿发布", 1260, 720)
    g.external("user", 40, 300, 150, 74, "注册用户")
    g.datastore("D1", 300, 60, 170, 54, "D1 草稿库", fill=F.PURPLE_F, stroke=F.PURPLE_S)
    g.datastore("D2", 980, 600, 190, 54, "D2 笔记库", fill=F.PURPLE_F, stroke=F.PURPLE_S)
    g.external("ai", 980, 90, 190, 70, "外部 AI 服务")

    g.process("P11", 290, 210, 190, 96, "P1.1\n编辑与自动保存", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.process("P12", 560, 300, 190, 96, "P1.2\n发布前校验", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.process("P13", 830, 300, 190, 96, "P1.3\nAI 摘要生成", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.process("P14", 830, 470, 190, 86, "P1.4\n首段截断兜底", fill=F.YELLOW_F, stroke=F.YELLOW_S)
    g.process("P15", 540, 560, 210, 96, "P1.5\n创建笔记并删草稿", fill=F.GREEN_F, stroke=F.GREEN_S)

    L = F.LINE
    g.link("user", "P11", label="编辑内容", kind="arrow", color=L)
    g.link("P11", "D1", label="保存草稿", kind="arrow", color=L)
    g.link("user", "P12", label="发布", kind="arrow", color=L,
           points=[(115, 340), (300, 420), (560, 360)])
    g.link("D1", "P12", label="读草稿", kind="arrow", color=L,
           points=[(400, 114), (600, 300)])
    g.link("P12", "user", label="错误提示", kind="arrow", color=F.RED_S,
           points=[(610, 396), (360, 470), (192, 366)])
    g.link("P12", "P13", label="摘要为空", kind="arrow", color=L)
    g.link("P13", "ai", label="生成请求", kind="arrow", color=L,
           points=[(905, 300), (1005, 160)])
    g.link("ai", "P13", label="摘要文本", kind="arrow", color=L,
           points=[(1085, 160), (985, 300)])
    g.link("P13", "P14", label="超时/失败", kind="arrow", color=F.RED_S, dashed=True)
    g.link("P13", "P15", label="摘要就绪", kind="arrow", color=L,
           points=[(830, 380), (700, 500)])
    g.link("P14", "P15", label="兜底摘要", kind="arrow", color=L,
           points=[(830, 520), (700, 560)])
    g.link("P15", "D2", label="新笔记", kind="arrow", color=L)
    g.link("P15", "D1", label="删草稿", kind="arrow", color=F.SUBINK, dashed=True,
           points=[(560, 560), (360, 300), (360, 114)])
    return g


# --------------------------------------------------------------------------
# 图4-4  功能级 DFD：互动、评论、合集与签到
# --------------------------------------------------------------------------
def fig4_4() -> Fig:
    g = Fig("图4-4 功能级DFD·互动评论合集签到", 1280, 860)
    g.external("guest", 40, 60, 150, 66, "匿名访客")
    g.external("user", 40, 380, 150, 74, "注册用户")

    g.process("Q1", 300, 60, 200, 90, "P3.1\n列表/详情查询", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.process("Q2", 300, 300, 200, 90, "P3.2\n笔记赞踩收藏", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.process("Q3", 300, 440, 200, 90, "P3.3\n评论/回复/表态", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.process("Q4", 300, 580, 200, 90, "P3.4\n合集管理与上下文", fill=F.GREEN_F, stroke=F.GREEN_S)
    g.process("Q5", 300, 720, 200, 90, "P3.5\n每日签到与经验", fill=F.GREEN_F, stroke=F.GREEN_S)

    g.datastore("D2", 640, 70, 170, 54, "D2 笔记库", fill=F.PURPLE_F, stroke=F.PURPLE_S)
    g.datastore("D3", 640, 310, 170, 54, "D3 互动库", fill=F.PURPLE_F, stroke=F.PURPLE_S)
    g.datastore("D4", 640, 450, 170, 54, "D4 评论库", fill=F.PURPLE_F, stroke=F.PURPLE_S)
    g.datastore("D7", 640, 590, 170, 54, "D7 合集库", fill=F.PURPLE_F, stroke=F.PURPLE_S)
    g.datastore("D6", 640, 730, 170, 54, "D6 成长库", fill=F.PURPLE_F, stroke=F.PURPLE_S)

    L = F.LINE
    g.link("guest", "Q1", label="浏览/检索", kind="arrow", color=L)
    g.link("user", "Q1", label="浏览/检索", kind="arrow", color=L,
           points=[(115, 400), (250, 200), (300, 120)])
    g.link("Q1", "D2", label="读笔记/计数", kind="arrow", color=L)
    g.link("Q1", "D3", label="读互动", kind="arrow", color=L,
           points=[(500, 120), (600, 330)])
    g.link("Q1", "D4", label="读评论", kind="arrow", color=L,
           points=[(500, 130), (590, 470)])
    g.link("user", "Q2", label="赞/踩/收藏", kind="arrow", color=L)
    g.link("Q2", "D3", label="幂等写入", kind="arrow", color=L)
    g.link("user", "Q3", label="评论/回复/表态", kind="arrow", color=L,
           points=[(115, 440), (250, 470), (300, 480)])
    g.link("Q3", "D4", label="写评论", kind="arrow", color=L)
    g.link("user", "Q4", label="合集维护", kind="arrow", color=L,
           points=[(115, 450), (240, 620), (300, 620)])
    g.link("Q4", "D7", label="读写合集", kind="arrow", color=L)
    g.link("Q4", "D2", label="校验已发布", kind="arrow", color=F.SUBINK, dashed=True,
           points=[(500, 600), (830, 300), (760, 124)])
    g.link("user", "Q5", label="签到", kind="arrow", color=L,
           points=[(115, 454), (240, 760), (300, 760)])
    g.link("Q5", "D6", label="签到/经验流水", kind="arrow", color=L)
    return g


# --------------------------------------------------------------------------
# 图4-5  模块用例图
# --------------------------------------------------------------------------
def fig4_5() -> Fig:
    g = Fig("图4-5 模块用例图", 1360, 1120)
    g.actor("guest", 40, 250, "匿名访客")
    g.actor("user", 40, 560, "注册用户")
    g.actor("author", 40, 860, "笔记作者")
    g.actor("ai", 1250, 300, "外部 AI 服务")

    g.boundary("sys", 260, 40, 940, 1050, "笔记系统与社区互动")

    uc = [
        ("UC01", 330, 90, "浏览/检索\n信息流"),
        ("UC02", 560, 90, "查看笔记详情"),
        ("UC03", 800, 90, "撰写/自动\n保存草稿"),
        ("UC04", 1020, 90, "AI 选段润色"),
        ("UC05", 800, 210, "发布笔记\n(AI 摘要兜底)"),
        ("UC06", 1020, 210, "编辑/删除\n本人笔记"),
        ("UC07", 330, 330, "笔记点赞"),
        ("UC08", 560, 330, "笔记点踩\n(后端)"),
        ("UC09", 800, 350, "收藏/取消\n收藏"),
        ("UC18", 1020, 350, "查看我的收藏"),
        ("UC10", 330, 500, "发表评论/\n二级回复"),
        ("UC11", 560, 500, "删除评论"),
        ("UC12", 800, 500, "评论赞踩\n(后端)"),
        ("UC13", 330, 660, "创建/维护\n合集"),
        ("UC14", 560, 660, "加入/移出\n合集笔记"),
        ("UC15", 800, 660, "查询合集\n上下文"),
        ("UC16", 330, 830, "每日签到"),
        ("UC17", 560, 830, "查看经验流水"),
    ]
    for uid, x, y, label in uc:
        g.usecase(uid, x, y, 190, 84, label)

    L = F.LINE
    def a(actor, ucid, **kw):
        g.link(actor, ucid, kind="assoc", color=L, **kw)

    for u in ("UC01", "UC02"):
        a("guest", u)
    a("guest", "UC15")
    for u in ("UC01", "UC02", "UC03", "UC04", "UC05", "UC07", "UC08", "UC09",
              "UC18", "UC10", "UC12", "UC13", "UC14", "UC15", "UC16", "UC17"):
        a("user", u)
    for u in ("UC06", "UC11"):
        a("author", u)
    # AI as secondary actor
    a("ai", "UC04", tside="e")
    a("ai", "UC05", tside="e")
    # include: publish includes AI summary; author generalizes user
    g.link("author", "user", kind="inherit", color=F.SUBINK,
           points=[(75, 860), (75, 650)])
    return g


BUILDERS = {
    "ch4-fig1-system-flow": fig4_1,
    "ch4-fig2-dfd-top": fig4_2,
    "ch4-fig3-dfd-publish": fig4_3,
    "ch4-fig4-dfd-interaction": fig4_4,
    "ch4-fig5-usecase": fig4_5,
}


def main():
    for stem, builder in BUILDERS.items():
        F.render(builder(), FIGS, stem)
        print("wrote", stem)


if __name__ == "__main__":
    main()
