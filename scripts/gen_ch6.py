"""Chapter 6 detailed-design flows: sequence / state / activity diagrams.

Figure numbers (document order within ch6):
  6-8  seq  草稿发布与 AI 摘要降级
  6-9  seq  举报—AI 审查—人工裁决（规划）
  6-10 seq  合集上下文查询
  6-11 state 笔记生命周期
  6-12 state 评论
  6-13 state 举报工单（规划）
  6-14 activity 信息流筛选/排序/分页
  6-15 activity AI 流式摘要三层降级
"""
from __future__ import annotations

from pathlib import Path

import figlib as F
from figlib import Fig

FIGS = Path(__file__).resolve().parents[1] / "docs" / "coursework" / "figures"


# ---- sequence helpers -----------------------------------------------------
class Seq:
    def __init__(self, name, w, h, top=44, bottom=None):
        self.g = Fig(name, w, h)
        self.top = top
        self.bottom = bottom or (h - 30)
        self.x = {}
        self._n = 0

    def lifelines(self, specs):
        for lid, x, label, *rest in specs:
            actor = bool(rest and rest[0] == "actor")
            fill = F.ORANGE_F if actor else F.BLUE_F
            stroke = F.ORANGE_S if actor else F.BLUE_S
            self.g.lifeline(lid, x - 95, self.top, 190, self.bottom, label,
                            fill=fill, stroke=stroke, actor=actor)
            self.x[lid] = x
        return self.x

    def _uid(self, p):
        self._n += 1
        return f"{p}{self._n}"

    def activation(self, who, y1, y2, off=0):
        x = self.x[who] + off
        self.g.box(self._uid("act"), x - 6, y1, 12, y2 - y1, "", fill="#eef2f8",
                   stroke=F.BLUE_S)

    def msg(self, y, src, dst, label, ret=False):
        x1, x2 = self.x[src], self.x[dst]
        kind = "ret" if ret else "msg"
        self.g.link(points=[(x1, y), (x2, y)], kind=kind, color=F.LINE)
        mx = (x1 + x2) / 2
        self.g.ui_text(self._uid("t"), mx - 150, y - 19, 300, 16, label, font=11,
                       align="center", color=F.INK)

    def selfmsg(self, y, who, label):
        x = self.x[who]
        self.g.link(points=[(x, y), (x + 74, y), (x + 74, y + 26), (x + 6, y + 26)],
                    kind="msg", color=F.LINE)
        self.g.ui_text(self._uid("t"), x + 82, y + 2, 260, 30, label, font=11,
                       align="left", color=F.INK)

    def frame(self, x1, y1, x2, y2, label):
        self.g.box(self._uid("fr"), x1, y1, x2 - x1, y2 - y1, "", fill="none",
                   stroke=F.SUBINK, dashed=True)
        self.g.box(self._uid("frtab"), x1, y1, 120, 22, "", fill="#eef2f7",
                   stroke=F.SUBINK)
        self.g.ui_text(self._uid("t"), x1 + 8, y1 + 3, 112, 16, label, font=11,
                       bold=True, align="left", color=F.SUBINK)

    def build(self):
        return self.g


# ==========================================================================
# 图6-8  顺序图：草稿发布与 AI 摘要降级
# ==========================================================================
def fig6_8() -> Fig:
    s = Seq("图6-8 顺序图·草稿发布与AI摘要降级", 1380, 860, bottom=790)
    s.lifelines([
        ("U", 95, "注册用户", "actor"),
        ("W", 330, "WritePage 前端"),
        ("API", 585, "DraftsRoutes·发布"),
        ("AIS", 840, "AiComposeService"),
        ("AI", 1080, "外部 AI 服务"),
        ("DB", 1290, "DB · SQLite"),
    ])
    s.msg(130, "U", "W", "点击「发布」")
    s.selfmsg(160, "W", "校验标题 / 正文 / 分类非空")
    s.msg(232, "W", "API", "POST /notes/drafts/{id}/publish")
    s.msg(272, "API", "DB", "读取草稿")
    s.msg(310, "DB", "API", "草稿数据", ret=True)
    s.frame(540, 336, 1140, 590, "opt [摘要为空]")
    s.msg(372, "API", "AIS", "请求生成一句话摘要")
    s.msg(410, "AIS", "AI", "chat.completions")
    s.frame(800, 432, 1120, 560, "alt [超时/失败]")
    s.msg(468, "AI", "AIS", "摘要文本 / 超时", ret=True)
    s.selfmsg(500, "AIS", "首段截断兜底（永不失败）")
    s.msg(575, "AIS", "API", "最终摘要文本", ret=True)
    s.msg(628, "API", "DB", "单事务：建笔记 + 删草稿")
    s.msg(668, "DB", "API", "新笔记", ret=True)
    s.msg(708, "API", "W", "201 新笔记", ret=True)
    s.msg(748, "W", "U", "跳转笔记详情页", ret=True)
    return s.build()


# ==========================================================================
# 图6-9  顺序图：举报—AI 审查—人工裁决（规划）
# ==========================================================================
def fig6_9() -> Fig:
    s = Seq("图6-9 顺序图·举报审查裁决(规划)", 1380, 820, bottom=750)
    s.lifelines([
        ("U", 95, "注册用户", "actor"),
        ("W", 300, "前端"),
        ("API", 540, "ReportsRoutes（规划）"),
        ("DB", 760, "DB · reports"),
        ("MOD", 980, "AI 审查任务（规划）"),
        ("ADM", 1230, "管理员", "actor"),
    ])
    s.g.ui_text("plan", 300, 96, 720, 18,
                "★ 本链路为后续治理能力设计，当前代码尚未实现（虚线=规划）",
                font=11, bold=True, align="left", color=F.RED_S)
    s.msg(150, "U", "W", "点击「举报」，选择类型")
    s.msg(190, "W", "API", "POST /reports")
    s.msg(228, "API", "DB", "创建工单 pending")
    s.msg(266, "API", "W", "已受理", ret=True)
    s.msg(322, "API", "MOD", "异步送审（不阻塞受理）")
    s.msg(360, "MOD", "MOD", "")
    s.selfmsg(352, "MOD", "AI 分类 {label, confidence, reason}")
    s.msg(430, "MOD", "DB", "写回结论；高置信→自动隐藏目标")
    s.msg(500, "ADM", "API", "打开举报队列")
    s.msg(540, "API", "DB", "查工单 + AI 结论")
    s.msg(578, "DB", "ADM", "工单列表 + 快照 + 置信度", ret=True)
    s.msg(636, "ADM", "API", "裁决：删除 / 恢复")
    s.msg(674, "API", "DB", "更新工单 resolved / dismissed")
    for e in s.g.edges:
        e.dashed = True
        if e.color == F.LINE:
            e.color = F.SUBINK
    return s.build()


# ==========================================================================
# 图6-10  顺序图：合集上下文查询
# ==========================================================================
def fig6_10() -> Fig:
    s = Seq("图6-10 顺序图·合集上下文查询", 1200, 620, bottom=560)
    s.lifelines([
        ("C", 160, "前端 / 调试客户端", "actor"),
        ("API", 480, "CollectionsRoutes"),
        ("DB", 820, "DB · entries 表"),
        ("N", 1090, "DB · notes/users"),
    ])
    s.msg(150, "C", "API", "GET /notes/{id}/collection")
    s.msg(196, "API", "DB", "查 collection_entries[note_id]")
    s.frame(430, 224, 900, 300, "alt [无归属]")
    s.msg(262, "DB", "API", "无记录", ret=True)
    s.msg(300, "API", "C", "200 / null", ret=True)
    s.frame(430, 330, 1140, 500, "[已归属合集]")
    s.msg(368, "DB", "API", "collection_id", ret=True)
    s.msg(408, "API", "N", "JOIN 同合集 visible 条目（排序）")
    s.msg(448, "N", "API", "entries + author", ret=True)
    s.selfmsg(478, "API", "组装 currentIndex")
    s.msg(534, "API", "C", "collection + entries + currentIndex", ret=True)
    return s.build()


# ---- state helpers --------------------------------------------------------
def state_fig(name, w, h):
    return Fig(name, w, h)


# ==========================================================================
# 图6-11  状态图：笔记生命周期
# ==========================================================================
def fig6_11() -> Fig:
    g = Fig("图6-11 状态图·笔记生命周期", 1120, 460)
    g.initial("i", 60, 200)
    g.state("draft", 170, 178, 170, 66, "草稿 Draft")
    g.state("visible", 470, 178, 180, 66, "可见 visible")
    g.final("f", 830, 198)
    g.state("pending", 470, 330, 190, 62, "隐藏 pending", dashed=True,
            fill=F.GRAY_F, stroke=F.GRAY_S)

    L = F.LINE
    g.link("i", "draft", kind="arrow", color=L)
    g.link("draft", "visible", label="发布（唯一路径）", kind="arrow", color=L)
    g.link("visible", "f", label="作者删除\n（级联清赞/评论）", kind="arrow", color=L)
    g.link("visible", "pending", label="AI 高置信 / 管理员裁决（规划）", kind="arrow",
           color=F.SUBINK, dashed=True)
    g.link("pending", "visible", label="恢复（规划）", kind="arrow", color=F.SUBINK,
           dashed=True, waypoints=[(430, 361), (430, 244)])
    g.link("pending", "f", label="删除（规划）", kind="arrow", color=F.SUBINK,
           dashed=True, waypoints=[(760, 361), (843, 244)])
    g.ui_text("note", 60, 410, 900, 20,
              "已实现：草稿 → 发布(visible) → 作者删除；pending 隐藏态与治理裁决为后续规划（虚线）。",
              font=11, align="left", color=F.SUBINK)
    return g


# ==========================================================================
# 图6-12  状态图：评论
# ==========================================================================
def fig6_12() -> Fig:
    g = Fig("图6-12 状态图·评论", 1080, 440)
    g.initial("i", 70, 190)
    g.state("visible", 200, 168, 200, 66, "可见 visible")
    g.final("f", 620, 188)
    g.state("pending", 200, 320, 200, 62, "隐藏 pending", dashed=True,
            fill=F.GRAY_F, stroke=F.GRAY_S)
    L = F.LINE
    g.link("i", "visible", label="创建（含锚点/楼中楼/图片）", kind="arrow", color=L)
    g.link("visible", "f", label="评论作者 / 笔记作者删除\n（顶层删除级联楼内）", kind="arrow",
           color=L)
    g.link("visible", "pending", label="AI 高置信 / 管理员裁决（规划）", kind="arrow",
           color=F.SUBINK, dashed=True)
    g.link("pending", "visible", label="恢复（规划）", kind="arrow", color=F.SUBINK,
           dashed=True, waypoints=[(160, 351), (160, 234)])
    g.ui_text("note", 60, 398, 900, 20,
              "已实现：创建(visible) → 删除；pending 隐藏态与治理裁决为后续规划（虚线）。",
              font=11, align="left", color=F.SUBINK)
    return g


# ==========================================================================
# 图6-13  状态图：举报工单（规划）
# ==========================================================================
def fig6_13() -> Fig:
    g = Fig("图6-13 状态图·举报工单(规划)", 1240, 400)
    P = dict(dashed=True, fill=F.GRAY_F, stroke=F.GRAY_S)
    g.initial("i", 50, 176)
    g.state("pending", 150, 152, 170, 64, "pending 待处理", **P)
    g.state("flag", 430, 152, 190, 64, "ai_flagged 已标记", **P)
    g.state("resolved", 740, 70, 190, 64, "resolved 已处置", **P)
    g.state("dismissed", 740, 236, 190, 64, "dismissed 驳回", **P)
    g.final("f", 1040, 176)
    c = F.SUBINK
    g.link("i", "pending", kind="arrow", color=c, dashed=True)
    g.link("pending", "flag", label="AI 审查标记", kind="arrow", color=c, dashed=True)
    g.link("flag", "resolved", label="管理员裁决：删除/隐藏", kind="arrow", color=c,
           dashed=True, waypoints=[(680, 184), (680, 102)])
    g.link("flag", "dismissed", label="管理员裁决：驳回恢复", kind="arrow", color=c,
           dashed=True, waypoints=[(680, 184), (680, 268)])
    g.link("resolved", "f", kind="arrow", color=c, dashed=True,
           waypoints=[(1049, 102), (1049, 176)])
    g.link("dismissed", "f", kind="arrow", color=c, dashed=True,
           waypoints=[(1049, 268), (1049, 194)])
    g.ui_text("note", 50, 350, 1000, 20,
              "整条链路为后续治理能力规划（虚线）：pending → ai_flagged → resolved / dismissed。",
              font=11, align="left", color=F.SUBINK)
    return g


# ==========================================================================
# 图6-14  活动图：信息流筛选/排序/分页
# ==========================================================================
def fig6_14() -> Fig:
    g = Fig("图6-14 活动图·信息流筛选排序分页", 900, 1180)
    cx = 360
    g.initial("i", cx - 12, 30)
    ys = 90
    steps = [
        ("a1", "选择分类（7 类）"),
        ("a2", "输入关键词"),
        ("a3", "选择标签"),
        ("a4", "切换排序（最新/热门/我赞过）"),
        ("a5", "GET /notes（游标 + 过滤参数）"),
        ("a6", "后端应用层过滤 + 排序"),
        ("a7", "keyset 游标分页（每页 6~8）"),
        ("a8", "返回列表 + nextCursor"),
        ("a9", "前端渲染笔记卡片"),
    ]
    prev = "i"
    y = ys
    for aid, label in steps:
        g.action(aid, cx - 170, y, 340, 50, label)
        g.link(prev, aid, kind="arrow", color=F.LINE)
        prev = aid
        y += 86
    g.decision("d1", cx - 90, y, 180, 90, "有下一页\n且滚动到底？")
    g.link(prev, "d1", kind="arrow", color=F.LINE)
    g.final("f", cx - 13, y + 150)
    g.link("d1", "f", label="否", kind="arrow", color=F.LINE)
    # loop: yes -> load more -> back to render
    g.action("more", cx + 210, y + 10, 200, 50, "加载更多\n更新游标")
    g.link("d1", "more", label="是", kind="arrow", color=F.LINE, sside="e")
    a9_y = 778 + 25  # vertical centre of the 前端渲染 action
    g.link("more", "a9", label="追加列表", kind="arrow", color=F.LINE,
           points=[(cx + 310, y + 10), (cx + 470, y + 10), (cx + 470, a9_y),
                   (cx + 170, a9_y)])
    return g


# ==========================================================================
# 图6-15  活动图：AI 流式摘要三层降级
# ==========================================================================
def fig6_15() -> Fig:
    g = Fig("图6-15 活动图·AI摘要三层降级", 1200, 900)
    g.initial("i", 120, 60)
    g.action("a1", 60, 130, 200, 50, "触发生成摘要")
    g.action("a2", 60, 220, 200, 50, "SSE 流式接收")
    g.decision("d1", 70, 310, 180, 100, "首个 chunk\n到达？")
    g.action("s_ok", 60, 460, 200, 50, "逐字写入展示")
    g.action("done", 470, 720, 220, 56, "完成：回填摘要")
    g.final("f", 560, 820)

    g.action("b1", 380, 320, 220, 50, "回退 one-shot 生成")
    g.decision("d2", 400, 420, 180, 100, "one-shot\n成功？")
    g.action("b_ok", 380, 560, 220, 50, "回填结果")

    g.action("c1", 720, 420, 220, 50, "mock 伪流式")
    g.action("c2", 720, 510, 220, 50, "生成静态兜底文本")

    L = F.LINE
    g.link("i", "a1", kind="arrow", color=L)
    g.link("a1", "a2", kind="arrow", color=L)
    g.link("a2", "d1", kind="arrow", color=L)
    g.link("d1", "s_ok", label="是", kind="arrow", color=L)
    g.link("s_ok", "done", label="", kind="arrow", color=L,
           waypoints=[(160, 510), (160, 748), (470, 748)])
    g.link("d1", "b1", label="否 / Stream 失败", kind="arrow", color=F.RED_S, sside="e")
    g.link("b1", "d2", kind="arrow", color=L)
    g.link("d2", "b_ok", label="是", kind="arrow", color=L)
    g.link("b_ok", "done", label="", kind="arrow", color=L,
           waypoints=[(490, 610), (490, 720)])
    g.link("d2", "c1", label="否", kind="arrow", color=F.RED_S, sside="e")
    g.link("c1", "c2", kind="arrow", color=L)
    g.link("c2", "done", label="兜底摘要", kind="arrow", color=L,
           waypoints=[(830, 570), (830, 748), (690, 748)])
    g.link("done", "f", kind="arrow", color=L)
    g.ui_text("note", 60, 850, 1000, 20,
              "三层降级：SSE 流式 → one-shot → mock 伪流式；「AI 永不硬失败」，任一层成功即回填。",
              font=11, align="left", color=F.SUBINK)
    return g


BUILDERS = {
    "ch6-fig8-seq-publish": fig6_8,
    "ch6-fig9-seq-report": fig6_9,
    "ch6-fig10-seq-collection": fig6_10,
    "ch6-fig11-state-note": fig6_11,
    "ch6-fig12-state-comment": fig6_12,
    "ch6-fig13-state-report": fig6_13,
    "ch6-fig14-activity-browse": fig6_14,
    "ch6-fig15-activity-ai": fig6_15,
}


def main():
    for stem, builder in BUILDERS.items():
        F.render(builder(), FIGS, stem)
        print("wrote", stem)


if __name__ == "__main__":
    main()
