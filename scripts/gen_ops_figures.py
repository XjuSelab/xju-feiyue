"""生成「部署+运维」模块 PPT 示意图（S13-S16），输出 SVG + PNG 到 docs/ppt-figures/。

图基于仓库真实事实：feiyue-backend.service / :8001 / deploy.sh /
Makefile(sync-push,data-pull,schools-pull,conf-pull) / HF winbeau/xju-feiyue-data /
HardenedStaticFiles+nosniff+DENY_EXTS / JWT7天 / 首屏≈144KB。
"""
from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs" / "ppt-figures"
OUT.mkdir(parents=True, exist_ok=True)

NAVY, ACCENT, INK, GRAY = "#1f3a5f", "#2e86c1", "#1b1f24", "#5b636b"
LIGHT, WHITE, GREEN, ORANGE, RED = "#eef3f8", "#ffffff", "#2e8b57", "#d98a00", "#b3402f"
# WenQuanYi Zen Hei 是本机（Linux VPS）实际安装、cairosvg 能取到的中文字体，
# 必须放首位；后面几个是用户在 Windows/WPS 打开时的回退。
FONT = "WenQuanYi Zen Hei, Microsoft YaHei, SimSun, sans-serif"


class SVG:
    def __init__(self, w, h):
        self.w, self.h, self.p = w, h, []

    def rect(self, x, y, w, h, fill=WHITE, stroke=NAVY, rx=10, sw=2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
                      f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=16, fill=INK, anchor="middle", bold=False, lh=None):
        lh = lh or size + 6
        w = 700 if bold else 400
        lines = s.split("\n")
        y0 = y - (len(lines) - 1) * lh / 2
        for i, ln in enumerate(lines):
            self.p.append(
                f'<text x="{x}" y="{y0 + i*lh + size*0.35:.0f}" font-size="{size}" '
                f'fill="{fill}" text-anchor="{anchor}" font-weight="{w}" '
                f'font-family="{FONT}">{ln}</text>')

    def box(self, x, y, w, h, title, sub="", fill=LIGHT, stroke=NAVY, tcol=NAVY, dash=None):
        self.rect(x, y, w, h, fill, stroke, dash=dash)
        if sub:
            sl = sub.count("\n") + 1
            th, gap, slh = 16, 10, 18
            sh = sl * slh
            top = y + (h - (th + gap + sh)) / 2
            self.text(x + w / 2, top + th / 2, title, 16, tcol, bold=True)
            self.text(x + w / 2, top + th + gap + sh / 2, sub, 12, GRAY, lh=slh)
        else:
            self.text(x + w / 2, y + h / 2, title, 16, tcol, bold=True)

    def arrow(self, x1, y1, x2, y2, label="", color=ACCENT, dash=None, lc=None, sw=2.4):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.p.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" '
                      f'stroke-width="{sw}" marker-end="url(#ah)"{d}/>')
        if label:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            self.text(mx, my - 8, label, 12, lc or color, bold=True)

    def band(self, x, y, w, h, label, color=NAVY):
        self.rect(x, y, w, h, "none", color, rx=14, sw=2, dash="7 5")
        self.text(x + 14, y + 20, label, 14, color, anchor="start", bold=True)

    def save(self, stem):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}">'
                f'<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="8" refY="3" '
                f'orient="auto" markerUnits="strokeWidth">'
                f'<path d="M0,0 L8,3 L0,6 z" fill="{ACCENT}"/></marker></defs>'
                f'<rect width="{self.w}" height="{self.h}" fill="white"/>')
        (OUT / f"{stem}.svg").write_text(head + "".join(self.p) + "</svg>", encoding="utf-8")
        return OUT / f"{stem}.svg"


# ---------------------------------------------------------------- S13 生产架构拓扑
def s13():
    g = SVG(1160, 600)
    g.text(580, 34, "图 S13  生产部署拓扑（DNS → nginx →〔静态 / 反代〕→ uvicorn → SQLite）", 18, NAVY, bold=True)
    g.band(300, 96, 800, 430, "华为云 VPS · huawei2")
    g.box(40, 250, 170, 100, "用户浏览器", "winbeau.top /\nfeiyue.selab.top", fill=WHITE)
    g.box(330, 250, 170, 100, "nginx", "反向代理 + TLS", tcol=NAVY)
    g.box(600, 120, 220, 90, "前端静态", "frontend/dist（Vite 构建）", fill="#f2f7f2", stroke=GREEN, tcol=GREEN)
    g.box(600, 300, 220, 100, "FastAPI · uvicorn", "systemd: feiyue-backend\n:8001 · 开机自启/崩溃拉起", tcol=NAVY)
    g.box(910, 300, 190, 100, "SQLite", "labnotes.db\n(+ 只读高校/会议库)", fill="#f5f2f7", stroke="#7a5aa0", tcol="#7a5aa0")
    g.box(910, 120, 190, 84, "DeepSeek", "外部 AI（润色/摘要）", fill=WHITE, stroke=ORANGE, tcol=ORANGE, dash="6 4")
    g.arrow(210, 300, 328, 300, "HTTPS")
    g.arrow(500, 285, 598, 190, "静态直出", color=GREEN, lc=GREEN)
    g.arrow(500, 315, 598, 350, "反代 /api")
    g.arrow(820, 350, 908, 350, "读写")
    g.arrow(710, 300, 710, 206, "AI 调用", color=ORANGE, lc=ORANGE, dash="6 4")
    g.text(580, 560, "一键发布：deploy.sh → git pull main · uv sync · alembic upgrade head · systemctl restart · /health 探活 · pnpm build",
           13, GRAY)
    return g.save("s13-deploy-topology")


# ---------------------------------------------------------------- S14 双库 + CI/CD
def s14():
    g = SVG(1160, 560)
    g.text(580, 34, "图 S14  双库并行 + CI/CD 发布流水线", 18, NAVY, bold=True)
    g.box(40, 230, 180, 110, "开发提交", "conventional commits\nHusky · lint-staged", fill=WHITE)
    g.box(330, 120, 260, 100, "XjuSelab/xju-feiyue", "团队规范库（文档/规范/源）", stroke=ACCENT, tcol=ACCENT)
    g.box(330, 350, 260, 100, "winbeau/Aurash", "部署源（生产运行代码）", stroke=NAVY, tcol=NAVY)
    g.box(690, 350, 200, 100, "deploy.sh", "uv sync · alembic\nsystemctl · /health", fill=LIGHT)
    g.box(960, 350, 160, 100, "生产 VPS", "华为云 · 上线", fill="#f2f7f2", stroke=GREEN, tcol=GREEN)
    g.box(690, 120, 430, 100, "GitHub Pages · 发展历程时间轴", "对外自动部署（团队规范库触发）", stroke=ACCENT, tcol=ACCENT)
    g.arrow(220, 260, 328, 180, "推送")
    g.arrow(220, 300, 328, 395, "推送")
    g.arrow(590, 400, 688, 400, "拉取发布")
    g.arrow(890, 400, 958, 400, "重启")
    g.arrow(590, 165, 688, 165, "自动构建", color=ACCENT, lc=ACCENT)
    g.text(580, 520, "构建产物：pnpm 前端（Vite → dist） + uv 后端（Python 依赖锁定）　·　规模：≈182 commits / 2 代码库",
           13, GRAY)
    return g.save("s14-cicd-dual-repo")


# ---------------------------------------------------------------- S15 备份/恢复 + 命名空间
def s15():
    g = SVG(1160, 560)
    g.text(580, 34, "图 S15  数据持久化与灾备恢复（私有 HuggingFace Dataset）", 18, NAVY, bold=True)
    g.box(40, 210, 210, 140, "生产 VPS 实时状态", "SQLite 主库\n/uploads 附件\nsecrets 密钥", fill=WHITE)
    # HF dataset with two namespaces
    g.rect(430, 150, 300, 260, WHITE, NAVY, rx=12)
    g.text(580, 178, "私有数据集 winbeau/xju-feiyue-data", 15, NAVY, bold=True)
    g.box(455, 205, 250, 80, "state/", "DB + uploads + secrets", fill="#f5f2f7", stroke="#7a5aa0", tcol="#7a5aa0")
    g.box(455, 300, 250, 80, "schools/ · conf/", "高校导师库 / CCF 会议库", fill="#f2f7f2", stroke=GREEN, tcol=GREEN)
    g.box(910, 210, 210, 140, "换机 / 灾备", "make data-pull\n一键复现整站数据", fill=LIGHT, stroke=GREEN, tcol=GREEN)
    g.arrow(250, 250, 428, 240, "make sync-push（cron 定时）")
    g.arrow(730, 300, 908, 300, "make data-pull（一键恢复）", color=GREEN, lc=GREEN)
    g.box(430, 445, 300, 70, "内容真源 content/notes/*.md", "62 篇 seed 灌库 + 站内直接发布", fill=WHITE, stroke=GRAY, tcol=GRAY)
    g.arrow(580, 445, 580, 412, "seed", color=GRAY, lc=GRAY, sw=2)
    return g.save("s15-backup-restore")


# ---------------------------------------------------------------- S16 bundle 体积达标
def s16():
    g = SVG(1160, 560)
    g.text(580, 34, "图 S16  首屏体积预算与达标（gzip 后 JS）", 18, NAVY, bold=True)
    # axes
    bx, by, bw, bh = 150, 440, 820, 320   # baseline y=by, bars go up
    g.p.append(f'<line x1="{bx}" y1="{by}" x2="{bx+bw}" y2="{by}" stroke="{GRAY}" stroke-width="2"/>')
    # budget line at 200KB
    scale = 260 / 500.0  # 500KB -> 260px
    budget_y = by - 200 * scale
    g.p.append(f'<line x1="{bx}" y1="{budget_y:.0f}" x2="{bx+bw}" y2="{budget_y:.0f}" '
               f'stroke="{RED}" stroke-width="2" stroke-dasharray="8 5"/>')
    g.text(bx + bw - 4, budget_y - 8, "预算上限 200KB", 13, RED, anchor="end", bold=True)
    bars = [("首屏 main", 144, GREEN, "达标 ✓"), ("典型页 chunk", 90, GREEN, ""),
            ("WritePage", 464, ORANGE, "已知偏差")]
    n = len(bars)
    slot = bw / (n + 0.5)
    for i, (name, kb, col, tag) in enumerate(bars):
        h = kb * scale
        x = bx + slot * (i + 0.5)
        w = 130
        g.rect(x, by - h, w, h, col, col, rx=4, sw=0)
        g.text(x + w / 2, by - h - 14, f"{kb}KB", 15, col, bold=True)
        g.text(x + w / 2, by + 22, name, 14, INK, bold=True)
        if tag:
            g.text(x + w / 2, by + 42, tag, 12, col, bold=True)
    g.text(580, 520, "全路由 React.lazy + Suspense 懒加载；WritePage 因 CodeMirror6 + 字级 diff + KaTeX 偏大，已文档化为已知偏差",
           13, GRAY)
    return g.save("s16-bundle-budget")


def main():
    import cairosvg
    for fn in (s13, s14, s15, s16):
        svg = fn()
        png = svg.with_suffix(".png")
        cairosvg.svg2png(url=str(svg), write_to=str(png), scale=2.0)
        print("wrote", svg.name, "+", png.name)


if __name__ == "__main__":
    main()
