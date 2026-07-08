"""「部署+运维」PPT 小图（淡蓝色风格），输出 SVG + PNG 到 docs/ppt-figures/。

风格：统一淡蓝（fill 极浅蓝 / stroke 中蓝 / 字深蓝），小尺寸、留白足，供直接插入 PPT。
基于仓库真实事实（feiyue-backend.service / :8001 / deploy.sh /
Makefile sync-push,data-pull / HF winbeau/xju-feiyue-data / nosniff+DENY_EXTS / 144KB）。
"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs" / "ppt-figures"
OUT.mkdir(parents=True, exist_ok=True)

# 淡蓝色系
L0 = "#f3f9ff"   # 画布/最浅
L1 = "#eaf3fd"   # 盒子填充
L2 = "#dcecfb"   # 强调填充
BLUE = "#5b9bd5"  # 描边
DBLUE = "#2e6da4"  # 标题字
INK = "#33475b"   # 正文字
GRAY = "#8aa0b4"  # 次要
WHITE = "#ffffff"
FONT = "WenQuanYi Zen Hei, Microsoft YaHei, SimSun, sans-serif"


class SVG:
    def __init__(self, w, h):
        self.w, self.h, self.p = w, h, []

    def rect(self, x, y, w, h, fill=L1, stroke=BLUE, rx=9, sw=1.6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
                      f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=13, fill=INK, anchor="middle", bold=False, lh=None):
        lh = lh or size + 5
        wt = 700 if bold else 400
        lines = s.split("\n")
        y0 = y - (len(lines) - 1) * lh / 2
        for i, ln in enumerate(lines):
            self.p.append(
                f'<text x="{x}" y="{y0 + i*lh + size*0.35:.1f}" font-size="{size}" '
                f'fill="{fill}" text-anchor="{anchor}" font-weight="{wt}" '
                f'font-family="{FONT}">{ln}</text>')

    def box(self, x, y, w, h, title, sub="", fill=L1, stroke=BLUE, tcol=DBLUE):
        self.rect(x, y, w, h, fill, stroke)
        if sub:
            sl = sub.count("\n") + 1
            th, gap, slh = 14, 7, 15
            top = y + (h - (th + gap + sl * slh)) / 2
            self.text(x + w / 2, top + th / 2, title, 14, tcol, bold=True)
            self.text(x + w / 2, top + th + gap + sl * slh / 2, sub, 11, GRAY, lh=slh)
        else:
            self.text(x + w / 2, y + h / 2, title, 13.5, tcol, bold=True)

    def arrow(self, x1, y1, x2, y2, label="", dash=None, sw=1.8):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.p.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{BLUE}" '
                      f'stroke-width="{sw}" marker-end="url(#ah)"{d}/>')
        if label:
            self.text((x1 + x2) / 2, (y1 + y2) / 2 - 7, label, 11, DBLUE, bold=True)

    def pill(self, cx, cy, w, h, s, fill=L1):
        self.rect(cx - w / 2, cy - h / 2, w, h, fill, BLUE, rx=h / 2)
        self.text(cx, cy, s, 12.5, DBLUE, bold=True)

    def band(self, x, y, w, h, label):
        self.rect(x, y, w, h, "none", BLUE, rx=12, sw=1.4, dash="6 5")
        self.text(x + 12, y + 16, label, 12, DBLUE, anchor="start", bold=True)

    def save(self, stem):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}"><defs>'
                f'<marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="3" '
                f'orient="auto" markerUnits="strokeWidth">'
                f'<path d="M0,0 L7,3 L0,6 z" fill="{BLUE}"/></marker></defs>'
                f'<rect width="{self.w}" height="{self.h}" rx="10" fill="{L0}"/>')
        (OUT / f"{stem}.svg").write_text(head + "".join(self.p) + "</svg>", encoding="utf-8")
        return OUT / f"{stem}.svg"


# ---- S13a 生产拓扑（紧凑） -------------------------------------------------
def s13_topology():
    g = SVG(660, 340)
    g.band(150, 40, 470, 250, "华为云 VPS")
    g.box(24, 150, 110, 70, "用户浏览器", fill=WHITE)
    g.box(180, 150, 110, 70, "nginx", "静态服 + 反代")
    g.box(340, 62, 130, 58, "前端 dist", "Vite 构建", fill=L2)
    g.box(340, 210, 130, 66, "uvicorn :8001", "feiyue-backend")
    g.box(510, 210, 90, 66, "SQLite", "主库")
    g.box(510, 62, 90, 58, "DeepSeek", "外部 AI", fill=WHITE)
    g.arrow(134, 185, 178, 185, "HTTPS")
    g.arrow(290, 170, 338, 105, "静态")
    g.arrow(290, 200, 338, 240, "/api")
    g.arrow(470, 243, 508, 243, "读写")
    g.arrow(405, 210, 470, 120, "AI", dash="5 4")
    return g.save("s13-topology")


# ---- S13b 一键发布 6 步流水（横向） --------------------------------------
def s13_deploy_flow():
    g = SVG(820, 110)
    steps = ["git pull", "uv sync", "alembic\n迁移", "systemctl\nrestart", "/health\n探活", "pnpm build"]
    n = len(steps)
    w, gap = 108, 130
    x0 = 40
    for i, s in enumerate(steps):
        cx = x0 + i * gap + w / 2
        fill = L2 if i in (3, 4) else L1
        g.rect(cx - w / 2, 34, w, 46, fill, BLUE, rx=10)
        g.text(cx, 57, s, 12, DBLUE, bold=True, lh=14)
        if i < n - 1:
            g.arrow(cx + w / 2, 57, cx + gap - w / 2, 57, sw=1.6)
    g.text(410, 98, "deploy.sh 一条命令跑完 · 高亮两步是「零停机」关键", 11, GRAY)
    return g.save("s13-deploy-flow")


# ---- S14 双库 + 发布流水（流程版） ---------------------------------------
def s14_pipeline():
    g = SVG(780, 300)
    g.box(24, 120, 120, 64, "开发提交", "规范化 commit", fill=WHITE)
    g.box(210, 40, 190, 60, "团队规范库", "XjuSelab/xju-feiyue", fill=L2)
    g.box(210, 196, 190, 60, "部署源", "winbeau/Aurash", fill=L2)
    g.box(470, 40, 200, 60, "GitHub Pages", "发展历程 · 自动部署")
    g.box(470, 196, 130, 60, "deploy.sh", "拉取 → 发布")
    g.box(650, 196, 100, 60, "生产上线", "华为云")
    g.arrow(144, 140, 208, 82, "推送")
    g.arrow(144, 164, 208, 224, "推送")
    g.arrow(400, 70, 468, 70, "构建")
    g.arrow(400, 226, 468, 226)
    g.arrow(600, 226, 648, 226, "重启")
    return g.save("s14-pipeline")


# ---- S15 备份/恢复 环路 ---------------------------------------------------
def s15_backup():
    g = SVG(700, 320)
    g.box(24, 110, 130, 92, "生产 VPS", "DB · 附件\n密钥", fill=WHITE)
    g.rect(250, 60, 210, 190, WHITE, BLUE, rx=10)
    g.text(355, 82, "私有 HF 数据集", 13, DBLUE, bold=True)
    g.text(355, 99, "winbeau/xju-feiyue-data", 10.5, GRAY)
    g.box(268, 115, 174, 52, "state/", "DB+附件+密钥", fill=L2)
    g.box(268, 180, 174, 52, "schools/ · conf/", "高校 / 会议库", fill=L1)
    g.box(556, 110, 120, 92, "换机 / 灾备", "一键复现", fill=L2)
    g.arrow(154, 150, 248, 140, "sync-push（cron）")
    g.arrow(460, 165, 554, 160, "data-pull")
    g.text(355, 292, "62 篇 seed(content/notes) 灌库 + 站内发布 = 内容真源", 11, GRAY)
    return g.save("s15-backup")


# ---- S16a 安全四道防线（竖向层叠） ---------------------------------------
def s16_security():
    g = SVG(400, 320)
    layers = [
        ("① 鉴权", "HS256 JWT(7天) + bcrypt"),
        ("② 上传拦截", "DENY .svg/.html/.htm/.xml"),
        ("③ 响应加固", "nosniff 头 · 防存储型 XSS"),
        ("④ 体积校验", "≤50MB + magic-byte 嗅探"),
    ]
    y = 30
    fills = [L2, "#e4f0fb", L1, "#f0f7fe"]
    for i, (t, s) in enumerate(layers):
        g.rect(40, y, 320, 58, fills[i], BLUE, rx=10)
        g.text(58, y + 24, t, 14, DBLUE, anchor="start", bold=True)
        g.text(58, y + 43, s, 11, GRAY, anchor="start")
        y += 70
    return g.save("s16-security")


# ---- S16b 首屏体积柱状 ----------------------------------------------------
def s16_perf():
    g = SVG(440, 320)
    bx, by, top = 60, 260, 40
    g.p.append(f'<line x1="{bx}" y1="{by}" x2="410" y2="{by}" stroke="{GRAY}" stroke-width="1.4"/>')
    scale = (by - top) / 500.0
    budget = by - 200 * scale
    g.p.append(f'<line x1="{bx}" y1="{budget:.0f}" x2="410" y2="{budget:.0f}" '
               f'stroke="{BLUE}" stroke-width="1.6" stroke-dasharray="7 5"/>')
    g.text(406, budget - 6, "预算 200KB", 11, BLUE, anchor="end", bold=True)
    bars = [("首屏 main", 144, L2, "达标"), ("典型页", 90, L1, ""), ("WritePage", 464, "#cddff0", "已知偏差")]
    slot = 350 / len(bars)
    for i, (name, kb, col, tag) in enumerate(bars):
        h = kb * scale
        x = bx + 20 + slot * i
        g.rect(x, by - h, 74, h, col, BLUE, rx=5, sw=1.4)
        g.text(x + 37, by - h - 10, f"{kb}KB", 12, DBLUE, bold=True)
        g.text(x + 37, by + 18, name, 11.5, INK, bold=True)
        if tag:
            g.text(x + 37, by + 34, tag, 10.5, GRAY)
    return g.save("s16-perf")


def main():
    import cairosvg
    figs = [s13_topology, s13_deploy_flow, s14_pipeline, s15_backup, s16_security, s16_perf]
    for fn in figs:
        svg = fn()
        cairosvg.svg2png(url=str(svg), write_to=str(svg.with_suffix(".png")), scale=2.0)
        print("wrote", svg.name)


if __name__ == "__main__":
    main()
