"""「部署+运维」PPT 小图（#004098 藏青 + 红点缀），SVG + PNG 到 docs/ppt-figures/。

要点：盒子按 id 登记，link() 自动求两盒边缘交点连线 → 箭头必接边、不悬空；
标签带白底避免压线。基于仓库真实事实（feiyue-backend.service / :8001 / deploy.sh /
sync-push,data-pull / HF winbeau/xju-feiyue-data / nosniff+DENY_EXTS / 144KB）。
"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs" / "ppt-figures"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = "#004098"      # 主色 藏青
RED = "#c8102e"       # 点缀 红
INK = "#1a2740"       # 正文
GRAY = "#6b7686"      # 次要
F0 = "#f4f7fc"        # 画布
F1 = "#e9eef7"        # 盒填充
F2 = "#d5e0f1"        # 强调填充
REDF = "#fbe9ec"      # 红填充
WHITE = "#ffffff"
FONT = "WenQuanYi Zen Hei, Microsoft YaHei, SimSun, sans-serif"


class SVG:
    def __init__(self, w, h):
        self.w, self.h, self.p, self.box_g = w, h, [], {}

    # -- primitives --
    def rect(self, x, y, w, h, fill=F1, stroke=NAVY, rx=8, sw=1.7, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.p.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" '
                      f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=13, fill=INK, anchor="middle", bold=False, lh=None):
        lh = lh or size + 5
        wt = 700 if bold else 400
        lines = s.split("\n")
        y0 = y - (len(lines) - 1) * lh / 2
        for i, ln in enumerate(lines):
            self.p.append(
                f'<text x="{x:.1f}" y="{y0 + i*lh + size*0.35:.1f}" font-size="{size}" '
                f'fill="{fill}" text-anchor="{anchor}" font-weight="{wt}" '
                f'font-family="{FONT}">{ln}</text>')

    def _tw(self, s, size):
        return sum((size if ord(c) > 0x2E7F else size * 0.56) for c in s)

    def label(self, x, y, s, color=NAVY, size=11):
        w, h = self._tw(s, size) + 10, size + 6
        self.p.append(f'<rect x="{x-w/2:.1f}" y="{y-h/2:.1f}" width="{w:.1f}" height="{h:.1f}" '
                      f'rx="3" fill="{WHITE}" opacity="0.9"/>')
        self.text(x, y, s, size, color, bold=True)

    # -- boxes & auto-connected links --
    def box(self, bid, x, y, w, h, title, sub="", fill=F1, stroke=NAVY, tcol=NAVY, num=None):
        self.box_g[bid] = (x, y, w, h)
        self.rect(x, y, w, h, fill, stroke)
        if num:
            self.p.append(f'<circle cx="{x+16:.1f}" cy="{y+16:.1f}" r="10" fill="{RED}"/>')
            self.text(x + 16, y + 16, str(num), 11.5, WHITE, bold=True)
        if sub:
            sl = sub.count("\n") + 1
            th, gap, slh = 14, 6, 15
            top = y + (h - (th + gap + sl * slh)) / 2
            self.text(x + w / 2, top + th / 2, title, 13.5, tcol, bold=True)
            self.text(x + w / 2, top + th + gap + sl * slh / 2, sub, 10.5, GRAY, lh=slh)
        else:
            self.text(x + w / 2, y + h / 2, title, 13.5, tcol, bold=True)

    def _edge(self, bid, tx, ty):
        x, y, w, h = self.box_g[bid]
        cx, cy = x + w / 2, y + h / 2
        dx, dy = tx - cx, ty - cy
        if dx == 0 and dy == 0:
            return cx, cy
        sx = (w / 2) / abs(dx) if dx else 1e9
        sy = (h / 2) / abs(dy) if dy else 1e9
        s = min(sx, sy)
        return cx + dx * s, cy + dy * s

    def link(self, a, b, text="", color=NAVY, dash=None, sw=1.8):
        ax, ay, aw, ah = self.box_g[a]
        bx, by, bw, bh = self.box_g[b]
        acx, acy, bcx, bcy = ax + aw / 2, ay + ah / 2, bx + bw / 2, by + bh / 2
        x1, y1 = self._edge(a, bcx, bcy)
        x2, y2 = self._edge(b, acx, acy)
        d = f' stroke-dasharray="{dash}"' if dash else ""
        mk = "ahr" if color == RED else "ah"
        self.p.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                      f'stroke="{color}" stroke-width="{sw}" marker-end="url(#{mk})"{d}/>')
        if text:
            self.label((x1 + x2) / 2, (y1 + y2) / 2, text, color)

    def band(self, x, y, w, h, label):
        self.rect(x, y, w, h, "none", NAVY, rx=12, sw=1.4, dash="6 5")
        self.label(x + 14 + self._tw(label, 12) / 2, y + 14, label, NAVY, 12)

    def save(self, stem):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}"><defs>'
                f'<marker id="ah" markerWidth="9" markerHeight="9" refX="7.5" refY="3" '
                f'orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7.5,3 L0,6 z" fill="{NAVY}"/></marker>'
                f'<marker id="ahr" markerWidth="9" markerHeight="9" refX="7.5" refY="3" '
                f'orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7.5,3 L0,6 z" fill="{RED}"/></marker>'
                f'</defs><rect width="{self.w}" height="{self.h}" rx="10" fill="{F0}"/>')
        (OUT / f"{stem}.svg").write_text(head + "".join(self.p) + "</svg>", encoding="utf-8")
        return OUT / f"{stem}.svg"


# ---- S13a 生产拓扑 --------------------------------------------------------
def s13_topology():
    g = SVG(680, 340)
    g.band(150, 34, 500, 268, "华为云 VPS")
    g.box("br", 26, 150, 112, 70, "用户浏览器", fill=WHITE)
    g.box("ng", 182, 150, 112, 70, "nginx", "静态服 + 反向代理")
    g.box("st", 350, 66, 132, 58, "前端 dist", "Vite 构建产物", fill=F2)
    g.box("uv", 350, 214, 132, 66, "uvicorn:8001", "feiyue-backend")
    g.box("db", 516, 214, 96, 66, "SQLite", "主库")
    g.box("ai", 516, 66, 96, 58, "DeepSeek", "外部 AI", fill=WHITE, stroke=RED, tcol=RED)
    g.link("br", "ng", "HTTPS")
    g.link("ng", "st", "静态资源")
    g.link("ng", "uv", "反代 /api")
    g.link("uv", "db", "读写")
    g.link("uv", "ai", "润色/摘要", color=RED, dash="5 4")
    return g.save("s13-topology")


# ---- S13b 一键发布流水 ----------------------------------------------------
def s13_deploy_flow():
    g = SVG(840, 112)
    steps = ["git pull", "uv sync", "alembic\n迁移", "systemctl\nrestart", "/health\n探活", "pnpm build"]
    w, gap, x0 = 110, 132, 34
    ids = []
    for i, s in enumerate(steps):
        x = x0 + i * gap
        emph = i in (3, 4)
        g.box(f"p{i}", x, 30, w, 48, s, fill=F2 if emph else F1,
              stroke=RED if emph else NAVY, tcol=RED if emph else NAVY)
        ids.append(f"p{i}")
    for i in range(len(steps) - 1):
        g.link(ids[i], ids[i + 1])
    g.text(420, 102, "deploy.sh 串行执行；重启 + 探活两步构成上线闸门", 10.5, GRAY)
    return g.save("s13-deploy-flow")


# ---- S14 双库 + 流水线 ----------------------------------------------------
def s14_pipeline():
    g = SVG(800, 300)
    g.box("cm", 24, 118, 126, 66, "开发提交", "规范化 commit", fill=WHITE)
    g.box("std", 214, 40, 196, 60, "团队规范库", "XjuSelab/xju-feiyue", fill=F2)
    g.box("dep", 214, 200, 196, 60, "部署源", "winbeau/Aurash", fill=F2)
    g.box("pg", 478, 40, 208, 60, "GitHub Pages", "发展历程 · 自动部署")
    g.box("dp", 478, 200, 130, 60, "deploy.sh", "拉取 → 发布")
    g.box("pr", 654, 200, 108, 60, "生产上线", "华为云", stroke=RED, tcol=RED)
    g.link("cm", "std", "推送")
    g.link("cm", "dep", "推送")
    g.link("std", "pg", "自动构建")
    g.link("dep", "dp", "触发")
    g.link("dp", "pr", "重启", color=RED)
    return g.save("s14-pipeline")


# ---- S15 备份/恢复环路 ----------------------------------------------------
def s15_backup():
    g = SVG(720, 320)
    g.box("vps", 24, 108, 134, 96, "生产 VPS", "DB · 附件 · 密钥", fill=WHITE)
    g.box("hf", 250, 56, 218, 200, "", fill=WHITE)
    g.text(359, 78, "私有 HF 数据集", 13, NAVY, bold=True)
    g.text(359, 95, "winbeau/xju-feiyue-data", 10, GRAY)
    g.box("ns1", 270, 112, 178, 54, "state/", "DB + 附件 + 密钥", fill=F2)
    g.box("ns2", 270, 176, 178, 54, "schools/ · conf/", "高校 / 会议库", fill=F1)
    g.box("dr", 560, 108, 130, 96, "换机 / 灾备", "一键复现整站", fill=REDF, stroke=RED, tcol=RED)
    g.box("seed", 250, 276, 218, 34, "content/notes 62 篇 seed", fill=F1, stroke=GRAY, tcol=GRAY)
    g.link("vps", "hf", "sync-push · cron")
    g.link("hf", "dr", "data-pull", color=RED)
    g.link("seed", "hf")
    return g.save("s15-backup")


# ---- S16a 安全四道防线 ----------------------------------------------------
def s16_security():
    g = SVG(410, 320)
    layers = [
        ("鉴权", "HS256 JWT(7 天) + bcrypt 口令哈希"),
        ("上传准入", "DENY .svg/.html/.htm/.xml"),
        ("响应加固", "nosniff 头 · 抑制存储型 XSS"),
        ("体量校验", "≤ 50 MB + magic-byte 类型核验"),
    ]
    fills = [F2, "#dfe7f3", F1, "#eef2f9"]
    y = 26
    for i, (t, s) in enumerate(layers):
        g.rect(30, y, 350, 60, fills[i], NAVY, rx=9)
        g.p.append(f'<circle cx="{54}" cy="{y+30}" r="13" fill="{RED}"/>')
        g.text(54, y + 30, str(i + 1), 13, WHITE, bold=True)
        g.text(78, y + 23, t, 14, NAVY, anchor="start", bold=True)
        g.text(78, y + 42, s, 10.5, GRAY, anchor="start")
        y += 72
    return g.save("s16-security")


# ---- S16b 首屏体积预算 ----------------------------------------------------
def s16_perf():
    g = SVG(450, 320)
    bx, by, top = 62, 258, 42
    g.p.append(f'<line x1="{bx}" y1="{by}" x2="418" y2="{by}" stroke="{GRAY}" stroke-width="1.4"/>')
    scale = (by - top) / 500.0
    budget = by - 200 * scale
    g.p.append(f'<line x1="{bx}" y1="{budget:.1f}" x2="418" y2="{budget:.1f}" '
               f'stroke="{RED}" stroke-width="1.6" stroke-dasharray="7 5"/>')
    g.text(414, budget - 6, "预算 200KB", 11, RED, anchor="end", bold=True)
    bars = [("首屏 main", 144, F2, NAVY, "达标"), ("典型页", 90, F1, NAVY, ""),
            ("WritePage", 464, REDF, RED, "已知偏差")]
    slot = 356 / len(bars)
    for i, (name, kb, fl, sc, tag) in enumerate(bars):
        h = kb * scale
        x = bx + 22 + slot * i
        g.rect(x, by - h, 76, h, fl, sc, rx=5, sw=1.5)
        g.text(x + 38, by - h - 9, f"{kb}KB", 12, sc, bold=True)
        g.text(x + 38, by + 18, name, 11.5, INK, bold=True)
        if tag:
            g.text(x + 38, by + 34, tag, 10.5, sc)
    return g.save("s16-perf")


def main():
    import cairosvg
    for fn in (s13_topology, s13_deploy_flow, s14_pipeline, s15_backup, s16_security, s16_perf):
        svg = fn()
        cairosvg.svg2png(url=str(svg), write_to=str(svg.with_suffix(".png")), scale=2.0)
        print("wrote", svg.name)


if __name__ == "__main__":
    main()
