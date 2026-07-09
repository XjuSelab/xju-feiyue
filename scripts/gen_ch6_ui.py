"""Chapter 6 §4 界面设计 — 6 UI wireframes (图6-2 ~ 图6-7)."""
from __future__ import annotations

from pathlib import Path

import figlib as F
from figlib import Fig

FIGS = Path(__file__).resolve().parents[1] / "docs" / "coursework" / "figures"

MUTE = "#8a94a6"
PLAN = F.RED_S


def _n(g, i):
    return f"u{i}"


# ==========================================================================
# 图6-2  写作页 /write
# ==========================================================================
def fig6_2() -> Fig:
    g = Fig("图6-2 写作页界面", 1000, 660)
    g.ui_window("win", 30, 30, 940, 600, "飞跃 · 写作页  /write")
    g.ui_input("title", 55, 92, 470, 38, "标题：飞跃·保研经验与时间线")
    g.ui_input("cat", 540, 92, 170, 38, "分类：research  ▼")
    g.ui_input("tags", 725, 92, 220, 38, "标签：#保研 #经验 +")
    g.ui_text("save", 55, 140, 300, 18, "● 已自动保存 12:04（草稿）", font=11,
              color="#3a9a5a", align="left")

    g.ui_panel("editor", 55, 168, 545, 400, "", fill="#fcfdff", stroke="#d7dee8")
    g.ui_text("edlbl", 66, 176, 200, 16, "正文（Markdown 编辑器）", font=11,
              align="left", color=MUTE)
    for i, t in enumerate(["## 一、初试与择校", "复习节奏与资料清单如下：",
                            "- 数学：强化 + 真题…", "> 选段将被 AI 改写"]):
        g.ui_text(f"line{i}", 74, 214 + i * 30, 480, 16, t, font=12, align="left")
    # floating AI toolbar over a selection
    g.ui_panel("bar", 150, 330, 400, 40, "", fill="#eef4ff", stroke=F.BLUE_S)
    for i, b in enumerate(["润色", "缩写", "扩写", "改语气", "翻译", "自定义"]):
        g.ui_btn(f"bb{i}", 160 + i * 64, 338, 58, 24, b, primary=(i == 0), font=10)
    g.ui_panel("diff", 150, 384, 400, 150, "", fill="#fbfbfb", stroke="#d7dee8",
               dashed=True)
    g.ui_text("difflbl", 162, 392, 380, 16, "AI 改写差异对照", font=11, align="left",
              color=MUTE)
    g.ui_text("diffa", 162, 418, 380, 16, "＋ 新增文本…", font=11, align="left",
              color="#3a9a5a")
    g.ui_text("diffd", 162, 442, 380, 16, "－ 删除文本…", font=11, align="left",
              color=PLAN)
    g.ui_text("diffk", 162, 466, 380, 16, "  不变文本…", font=11, align="left")
    g.ui_btn("acc", 300, 498, 110, 28, "全部采纳", primary=True, font=10)
    g.ui_btn("rej", 420, 498, 110, 28, "全部拒绝", primary=False, font=10)

    g.ui_panel("sum", 620, 168, 325, 250, "", fill="#fcfdff", stroke="#d7dee8")
    g.ui_text("sumlbl", 632, 176, 220, 16, "AI 一句话摘要（SSE 流式）", font=11,
              align="left", color=MUTE)
    g.ui_panel("sumbox", 632, 202, 300, 120, "", fill=F.WHITE, stroke="#e3e8f0")
    g.ui_text("sumtx", 644, 214, 280, 60,
              "正在生成：面向保研的复习节奏与择校…▍", font=11, align="left")
    g.ui_btn("gen", 632, 336, 160, 34, "AI 生成摘要", primary=True, font=11)
    g.ui_text("genhint", 632, 380, 300, 16, "失败自动回退首段截断，发布不阻塞",
              font=10, align="left", color=MUTE)

    g.ui_panel("footer", 620, 470, 325, 96, "", fill="#f6f8fb", stroke="#d7dee8")
    g.ui_text("fhint", 632, 484, 300, 30, "发布前校验：标题 / 正文 / 分类必填",
              font=11, align="left", color=MUTE)
    g.ui_btn("pub", 790, 512, 140, 42, "发布笔记", primary=True, font=13)
    return g


# ==========================================================================
# 图6-3  信息流浏览页 /browse
# ==========================================================================
def fig6_3() -> Fig:
    g = Fig("图6-3 信息流浏览页界面", 1000, 680)
    g.ui_window("win", 30, 30, 940, 620, "飞跃 · 信息流  /browse")
    # left filter sidebar
    g.ui_panel("side", 55, 92, 190, 520, "", fill="#f6f8fb", stroke="#d7dee8")
    g.ui_text("sl", 66, 100, 160, 16, "分类", font=11, align="left", color=MUTE)
    cats = ["全部", "research 科研", "course 课程", "competition 竞赛",
            "kaggle", "tools 工具", "life 生活"]
    for i, c in enumerate(cats):
        g.ui_btn(f"c{i}", 66, 126 + i * 34, 168, 28, c, primary=(i == 0), font=10)
    g.ui_text("tl", 66, 380, 160, 16, "热门标签", font=11, align="left", color=MUTE)
    for i, t in enumerate(["#保研", "#夏令营", "#kaggle", "#简历"]):
        g.ui_btn(f"t{i}", 66 + (i % 2) * 84, 406 + (i // 2) * 34, 78, 26, t,
                 primary=False, font=10)
    # top search + sort
    g.ui_input("search", 265, 92, 470, 38, "搜索标题 / 标签 / 作者")
    for i, s in enumerate(["最新", "热门", "我赞过"]):
        g.ui_btn(f"s{i}", 750 + i * 66, 93, 60, 36, s, primary=(i == 0), font=10)
    # card grid 2 columns
    def card(idx, x, y):
        g.ui_panel(f"card{idx}", x, y, 220, 190, "", fill=F.WHITE, stroke="#dfe4ec")
        g.ui_img(f"cov{idx}", x + 12, y + 12, 196, 84, "封面")
        g.ui_text(f"ct{idx}", x + 12, y + 104, 196, 16, "保研经验：从择校到复试",
                  font=11, align="left", bold=True)
        g.ui_text(f"cs{idx}", x + 12, y + 126, 196, 16, "一句话摘要文本……", font=10,
                  align="left", color=MUTE)
        g.ui_text(f"cm{idx}", x + 12, y + 158, 196, 16, "@作者 · ♥ 128 · 评 20 · ★ 15",
                  font=10, align="left", color=MUTE)
    positions = [(265, 145), (505, 145), (265, 350), (505, 350)]
    for i, (x, y) in enumerate(positions):
        card(i, x, y)
    g.ui_btn("more", 460, 566, 160, 34, "加载更多（游标分页）", primary=False, font=11)
    return g


# ==========================================================================
# 图6-4  笔记详情页 /note/:id
# ==========================================================================
def fig6_4() -> Fig:
    g = Fig("图6-4 笔记详情页界面", 1020, 700)
    g.ui_window("win", 30, 30, 960, 640, "飞跃 · 笔记详情  /note/:id")
    # article body
    g.ui_panel("body", 55, 92, 560, 550, "", fill="#fcfdff", stroke="#d7dee8")
    g.ui_text("h", 72, 108, 500, 20, "保研经验：从择校到复试全流程", font=14,
              align="left", bold=True)
    g.ui_text("meta", 72, 138, 500, 16, "@作者 · research · 阅读约 8 分钟", font=10,
              align="left", color=MUTE)
    for i, t in enumerate(["## 一、择校与定位", "正文 Markdown 渲染，支持代码高亮：",
                            "```python  def plan(): ...  ```",
                            "划选正文即可发起「锚点引用评论」。"]):
        g.ui_text(f"p{i}", 72, 176 + i * 40, 520, 16, t, font=12, align="left")
    g.ui_panel("mark", 72, 336, 400, 30, "被引用的原文片段（高亮 mark）", fill="#fff6d6",
               stroke=F.YELLOW_S, font=10, align="left")
    # action bar
    g.ui_btn("like", 72, 590, 96, 32, "♥ 点赞 128", primary=True, font=11)
    g.ui_btn("mode", 178, 590, 150, 32, "评论显示：inline ▼", primary=False, font=10)
    g.ui_text("cc", 340, 598, 160, 16, "评论 20", font=11, align="left", color=MUTE)
    # comment panel
    g.ui_panel("cmt", 635, 92, 355, 430, "", fill="#f6f8fb", stroke="#d7dee8")
    g.ui_text("cl", 648, 100, 200, 16, "评论区（锚点引用 · 平铺分页）", font=11,
              align="left", color=MUTE)
    for i in range(3):
        y = 128 + i * 96
        g.ui_panel(f"ci{i}", 648, y, 328, 84, "", fill=F.WHITE, stroke="#e3e8f0")
        g.ui_text(f"ca{i}", 660, y + 8, 300, 14, "@某同学 · 12:30", font=10,
                  align="left", color=MUTE)
        if i == 0:
            g.ui_panel(f"cq{i}", 660, y + 28, 300, 22, "「引用原文片段…」", fill="#fff6d6",
                       stroke=F.YELLOW_S, font=10, align="left")
            g.ui_text(f"cb{i}", 660, y + 56, 300, 14, "评论正文……回跳高亮原文", font=10,
                      align="left")
        else:
            g.ui_text(f"cb{i}", 660, y + 30, 300, 14, "评论正文……（可删除）", font=10,
                      align="left")
    g.ui_input("cinput", 648, 470, 250, 34, "写评论 / 划选正文引用…")
    g.ui_btn("csend", 906, 470, 68, 34, "发送", primary=True, font=11)
    # planned annotations
    g.ui_panel("plan", 635, 536, 355, 100, "", fill="#fdf2f2", stroke=PLAN, dashed=True)
    g.ui_text("pl", 648, 544, 330, 16, "尚未接入前端（规划项）：", font=11, bold=True,
              align="left", color=PLAN)
    g.ui_text("pl2", 648, 568, 340, 60,
              "点踩 · 收藏 · 合集侧栏 · 评论九宫格图片 · 评论赞踩 · 举报/拉黑菜单",
              font=11, align="left", color=PLAN)
    return g


# ==========================================================================
# 图6-5  个人中心·合集管理 /me（规划）
# ==========================================================================
def fig6_5() -> Fig:
    g = Fig("图6-5 合集管理界面(规划)", 1000, 620)
    g.ui_window("win", 30, 30, 940, 560, "飞跃 · 个人中心  /me")
    tabs = ["已发布", "草稿", "我的收藏", "笔记合集", "签到·经验"]
    for i, t in enumerate(tabs):
        planned = i >= 2
        g.ui_btn(f"tab{i}", 55 + i * 150, 92, 140, 34, t + ("" if not planned else " ·规划"),
                 primary=(i == 3), font=10)
    g.ui_text("hint", 55, 138, 700, 16,
              "后端已提供合集 CRUD 与条目管理接口；/me 合集 Tab 为前端后续接入（规划项）",
              font=11, align="left", color=PLAN)
    # collection list (left)
    g.ui_panel("clist", 55, 168, 300, 400, "", fill="#f6f8fb", stroke="#d7dee8")
    g.ui_text("cll", 66, 176, 200, 16, "我的合集", font=11, align="left", color=MUTE)
    for i, t in enumerate(["● 保研全流程 · 6 篇", "竞赛打怪之路 · 4 篇", "Kaggle 入门 · 3 篇"]):
        g.ui_panel(f"col{i}", 66, 204 + i * 60, 278, 48, "", fill=F.WHITE,
                   stroke="#e3e8f0" if i else F.BLUE_S)
        g.ui_text(f"colt{i}", 78, 218 + i * 60, 250, 16, t, font=11, align="left",
                  bold=(i == 0))
    g.ui_btn("newc", 66, 512, 160, 34, "＋ 新建合集", primary=True, font=11)
    # entries (right)
    g.ui_panel("entries", 375, 168, 540, 400, "", fill="#fcfdff", stroke="#d7dee8")
    g.ui_text("enl", 388, 176, 400, 16, "合集「保研全流程」内笔记（拖拽排序 · 单归属校验）",
              font=11, align="left", color=MUTE)
    for i in range(4):
        y = 206 + i * 78
        g.ui_panel(f"e{i}", 388, y, 514, 66, "", fill=F.WHITE, stroke="#e3e8f0")
        g.ui_text(f"en{i}", 402, y + 10, 60, 16, f"# {i + 1}", font=11, align="left",
                  color=MUTE)
        g.ui_img(f"ei{i}", 452, y + 8, 70, 48, "封面")
        g.ui_text(f"et{i}", 536, y + 12, 260, 16, "择校定位与信息搜集", font=11,
                  align="left", bold=True)
        g.ui_text(f"em{i}", 536, y + 36, 260, 14, "visible · 本人笔记", font=10,
                  align="left", color=MUTE)
        g.ui_btn(f"erm{i}", 812, y + 18, 76, 30, "移出", primary=False, font=10)
    return g


# ==========================================================================
# 图6-6  举报工单管理（规划）
# ==========================================================================
def fig6_6() -> Fig:
    g = Fig("图6-6 举报工单管理界面(规划)", 1020, 620)
    g.ui_window("win", 30, 30, 960, 560, "飞跃 · 管理后台 · 举报工单  /admin")
    g.ui_text("hint", 55, 92, 900, 16,
              "规划项：当前管理后台未接入举报工单队列；下图为后续治理界面设计",
              font=11, align="left", color=PLAN)
    # queue list (left)
    g.ui_panel("q", 55, 122, 330, 448, "", fill="#f6f8fb", stroke="#d7dee8")
    g.ui_text("ql", 66, 130, 200, 16, "工单队列", font=11, align="left", color=MUTE)
    rows = [("#1024 note", "pending", MUTE), ("#1025 comment", "ai_flagged", PLAN),
            ("#1026 note", "ai_flagged", PLAN), ("#1027 comment", "resolved", "#3a9a5a")]
    for i, (t, st, col) in enumerate(rows):
        g.ui_panel(f"r{i}", 66, 158 + i * 62, 308, 50, "", fill=F.WHITE,
                   stroke=F.BLUE_S if i == 1 else "#e3e8f0")
        g.ui_text(f"rt{i}", 78, 168 + i * 62, 200, 16, t, font=11, align="left")
        g.ui_text(f"rs{i}", 78, 188 + i * 62, 200, 14, "状态：" + st, font=10,
                  align="left", color=col)
    # detail (right)
    g.ui_panel("d", 405, 122, 510, 448, "", fill="#fcfdff", stroke="#d7dee8")
    g.ui_text("dl", 418, 130, 300, 16, "工单 #1025 · comment", font=12, align="left",
              bold=True)
    g.ui_panel("snap", 418, 160, 484, 96, "", fill="#fff6d6", stroke=F.YELLOW_S)
    g.ui_text("snl", 430, 168, 300, 14, "目标内容快照：", font=10, align="left", color=MUTE)
    g.ui_text("snt", 430, 190, 460, 40, "“被举报的评论正文文本内容……”", font=11,
              align="left")
    g.ui_panel("ai", 418, 272, 484, 96, "", fill="#eef4ff", stroke=F.BLUE_S)
    g.ui_text("ail", 430, 280, 300, 14, "AI 审查结论：", font=10, align="left", color=MUTE)
    g.ui_text("ait", 430, 302, 460, 16, "label = spam · confidence = 0.92", font=12,
              align="left", bold=True)
    g.ui_text("air", 430, 328, 460, 16, "reason：疑似广告导流……", font=11, align="left",
              color=MUTE)
    g.ui_text("reason", 418, 384, 300, 16, "举报类型：广告营销 · 举报人 @xxx", font=11,
              align="left", color=MUTE)
    g.ui_btn("del", 418, 416, 140, 40, "删除 / 隐藏", primary=True, font=12)
    g.ui_btn("dis", 574, 416, 140, 40, "驳回恢复", primary=False, font=12)
    g.ui_text("note", 418, 476, 460, 40,
              "高置信自动隐藏 → 人工复核；最终裁决权保留在管理员。", font=11,
              align="left", color=MUTE)
    return g


# ==========================================================================
# 图6-7  签到弹窗
# ==========================================================================
def fig6_7() -> Fig:
    g = Fig("图6-7 签到弹窗界面", 900, 620)
    g.ui_window("win", 20, 20, 860, 560, "飞跃 · 首页  /（每日首次上线）")
    # dimmed backdrop hint
    g.ui_panel("dim", 40, 70, 820, 490, "", fill="#eef1f5", stroke="#e3e8f0")
    g.ui_text("bg", 60, 90, 400, 16, "首页信息流（弹窗遮罩下）", font=11, align="left",
              color=MUTE)
    # modal
    g.ui_panel("modal", 270, 150, 360, 340, "", fill=F.WHITE, stroke="#c4ccd6")
    g.ui_text("mt", 290, 172, 320, 22, "每日签到", font=16, align="center", bold=True)
    g.ui_panel("badge", 385, 206, 130, 98, "", fill="#eef4ff", stroke=F.BLUE_S)
    g.ui_text("badget", 385, 236, 130, 40, "＋5 EXP", font=20, align="center", bold=True, color=F.BLUE_S)
    g.ui_text("exp", 290, 326, 320, 22, "经验 +5", font=15, align="center", bold=True,
              color="#3a9a5a")
    g.ui_text("streak", 290, 356, 320, 18, "已连续签到 7 天 · 当前 Lv2（exp 155）",
              font=11, align="center", color=MUTE)
    g.ui_btn("go", 330, 392, 240, 46, "一键签到", primary=True, font=14)
    g.ui_text("idem", 290, 452, 320, 16, "当日已签到则不再弹出（幂等，不重复加经验）",
              font=10, align="center", color=MUTE)
    return g


BUILDERS = {
    "ch6-fig2-ui-write": fig6_2,
    "ch6-fig3-ui-browse": fig6_3,
    "ch6-fig4-ui-detail": fig6_4,
    "ch6-fig5-ui-collection": fig6_5,
    "ch6-fig6-ui-report": fig6_6,
    "ch6-fig7-ui-checkin": fig6_7,
}


def main():
    for stem, builder in BUILDERS.items():
        F.render(builder(), FIGS, stem)
        print("wrote", stem)


if __name__ == "__main__":
    main()
