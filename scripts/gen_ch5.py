"""Chapter 5 figure: 图5-1 模块总体架构（组件视图）."""
from __future__ import annotations

from pathlib import Path

import figlib as F
from figlib import Fig

FIGS = Path(__file__).resolve().parents[1] / "docs" / "coursework" / "figures"


def _comp(g, nid, x, y, w, h, label, fill, stroke, font=12):
    g.box(nid, x, y, w, h, label, fill=fill, stroke=stroke, rounded=True, font=font)


def fig5_1() -> Fig:
    g = Fig("图5-1 模块总体架构", 1280, 900)

    # ---- client tier ----
    g.box("client", 40, 46, 900, 190, "", fill="#fbfcfe", stroke="#c4ccd6", rounded=True)
    g.ui_text("clbl", 56, 56, 600, 20, "客户层 · 浏览器 React 18 SPA（前端 features 纵切）",
              font=12, bold=True, align="left", color=F.SUBINK)
    pages = [
        ("WritePage\n/write", 58), ("BrowsePage\n/browse", 240),
        ("NoteDetailPage\n/note/:id", 422), ("ProfilePage\n/me", 604),
        ("AdminPage\n/admin", 786),
    ]
    for i, (label, x) in enumerate(pages):
        _comp(g, f"pg{i}", x, 90, 168, 58, label, F.YELLOW_F, F.YELLOW_S, font=11)
    _comp(g, "apicli", 58, 166, 880, 52,
          "api/client.ts · 统一请求封装（TanStack Query 缓存 · Zod 边界校验 · Bearer JWT）",
          "#dfeafb", F.BLUE_S, font=11)

    # ---- nginx ----
    _comp(g, "nginx", 300, 276, 380, 52, "nginx 反向代理（静态资源直出 + API 反向代理）",
          F.GRAY_F, F.GRAY_S, font=12)

    # ---- backend tier ----
    g.box("be", 40, 368, 900, 470, "", fill="#fafbff", stroke="#c4ccd6", rounded=True)
    g.ui_text("belbl", 56, 378, 420, 20,
              "服务端 · FastAPI 单体后端（分层单向依赖）",
              font=12, bold=True, align="left", color=F.SUBINK)
    # routes row
    g.ui_text("rlbl", 58, 410, 90, 18, "路由层 routes", font=11, bold=True, align="left",
              color=F.BLUE_S)
    routes = ["notes", "drafts", "interactions", "collections", "ai", "auth"]
    x = 58
    for r in routes:
        w = 168 if r in ("interactions", "collections") else 120
        _comp(g, f"r_{r}", x, 434, w, 46, r, F.BLUE_F, F.BLUE_S, font=11)
        x += w + 14
    # services row
    g.ui_text("slbl", 58, 512, 150, 18, "服务层 services", font=11, bold=True, align="left",
              color=F.GREEN_S)
    _comp(g, "s_notes", 58, 536, 220, 46, "notes（列表/详情/编辑）", F.GREEN_F, F.GREEN_S, font=11)
    _comp(g, "s_comments", 300, 536, 240, 46, "comments（评论 keyset 分页）", F.GREEN_F, F.GREEN_S, font=11)
    _comp(g, "s_ai", 562, 536, 240, 46, "ai_compose（润色/摘要降级）", F.GREEN_F, F.GREEN_S, font=11)
    # data row
    g.ui_text("dlbl", 58, 616, 90, 18, "数据层 db", font=11, bold=True, align="left",
              color=F.PURPLE_S)
    _comp(g, "orm", 58, 640, 420, 52, "SQLAlchemy 2.x ORM 模型 + Alembic 迁移",
          F.PURPLE_F, F.PURPLE_S, font=11)
    g.datastore("sqlite", 520, 636, 280, 60, "SQLite 主库 labnotes.db", fill=F.PURPLE_F,
                stroke=F.PURPLE_S)
    g.ui_text("note", 58, 720, 760, 40,
              "发布为唯一建笔记路径（POST /notes/drafts/{id}/publish）；治理域 reports/blocks 仅数据模型预留。",
              font=11, align="left", color=F.SUBINK)

    # ---- external ----
    g.external("ai", 1010, 470, 230, 80, "外部 AI 服务\nDeepSeek · OpenAI 兼容")
    g.datastore("hf", 1010, 636, 230, 60, "HF 私有 Dataset · cron 灾备", fill=F.GRAY_F,
                stroke=F.GRAY_S, dashed=True)

    L = F.LINE
    A = dict(kind="arrow", color=L)
    g.link("apicli", "nginx", label="HTTPS", **A)
    g.link("nginx", "r_interactions", label="REST · JWT", **A)
    g.link("r_notes", "s_notes", label="", **A)
    g.link("r_interactions", "s_comments", label="复用查询", **A,
           waypoints=[(420, 500)])
    g.link("r_ai", "s_ai", label="AI 编排", **A, waypoints=[(760, 505), (680, 520)])
    g.link("s_notes", "orm", label="ORM 查询", **A)
    g.link("r_interactions", "orm", label="轻量写入", **A, waypoints=[(300, 505), (270, 630)])
    g.link("orm", "sqlite", label="读写", **A)
    g.link("s_ai", "ai", label="润色/摘要", **A, waypoints=[(920, 559), (1000, 510)])
    g.link("sqlite", "hf", label="快照", kind="arrow", color=F.SUBINK, dashed=True)
    return g


BUILDERS = {"ch5-fig1-module-structure": fig5_1}


def main():
    for stem, builder in BUILDERS.items():
        F.render(builder(), FIGS, stem)
        print("wrote", stem)


if __name__ == "__main__":
    main()
