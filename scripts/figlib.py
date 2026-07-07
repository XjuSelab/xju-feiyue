"""figlib — single-source figure toolkit for the 飞跃 coursework.

Each figure is described ONCE as a set of nodes + edges, then emitted to
BOTH an editable ``.drawio`` (draw.io / diagrams.net native) and a clean
``.svg``. The SVG is rasterised to ``.png`` with cairosvg for Word embedding.

Design goals
------------
* UML classes render as PROPER compartments (name / attributes / methods) in
  both drawio and svg — never "everything crammed into the class name".
* One coordinate system (top-left origin, y down) shared by svg & drawio.
* A small, uniform visual language across every diagram type.

The module is intentionally dependency-light: stdlib only for generation;
cairosvg is used lazily inside :func:`rasterise` (skipped if unavailable).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from xml.sax.saxutils import escape

# --------------------------------------------------------------------------
# palette — a calm, print-friendly system (blue headers, warm accents)
# --------------------------------------------------------------------------
INK = "#1f2328"          # primary text / strokes
SUBINK = "#57606a"       # secondary text
LINE = "#5b6b7b"         # edges
WHITE = "#ffffff"

# fills / strokes per role
BLUE_F, BLUE_S = "#dae8fc", "#6c8ebf"     # entity / class
GREEN_F, GREEN_S = "#d5e8d4", "#82b366"   # process / action
ORANGE_F, ORANGE_S = "#ffe6cc", "#d79b00" # external / actor accent
GRAY_F, GRAY_S = "#f2f4f7", "#8a94a6"     # neutral panel
YELLOW_F, YELLOW_S = "#fff2cc", "#d6b656" # note / highlight
PURPLE_F, PURPLE_S = "#e1d5e7", "#9673a6" # store / control
RED_F, RED_S = "#f8cecc", "#b85450"       # error / planned

FONT = "WenQuanYi Zen Hei, Microsoft YaHei, SimSun, sans-serif"
DRAWIO_FONT = "SimSun"   # what draw.io / WPS will show on the user's box

H_HEADER = 26            # uml class name band height
LINE_H = 20              # uml class member line height
SEP_H = 8


def _sty(d: dict) -> str:
    return "".join(f"{k}={v};" for k, v in d.items())


# --------------------------------------------------------------------------
# node / edge data
# --------------------------------------------------------------------------
@dataclass
class Node:
    id: str
    kind: str                 # see renderers below
    x: float
    y: float
    w: float
    h: float
    label: str = ""
    attrs: list[str] = field(default_factory=list)
    methods: list[str] = field(default_factory=list)
    fill: str = WHITE
    stroke: str = INK
    header_fill: str = BLUE_F
    header_stroke: str = BLUE_S
    font: int = 12
    bold: bool = False
    dashed: bool = False
    align: str = "center"     # text align for simple boxes
    rounded: bool = False
    extra: dict = field(default_factory=dict)

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2


@dataclass
class Edge:
    src: str | None = None
    dst: str | None = None
    label: str = ""
    src_label: str = ""       # e.g. multiplicity near source
    dst_label: str = ""
    kind: str = "arrow"       # arrow|open|assoc|inherit|aggregate|compose|dashed|msg|ret
    dashed: bool = False
    points: list[tuple[float, float]] | None = None   # explicit polyline (overrides)
    waypoints: list[tuple[float, float]] | None = None
    sside: str = ""           # exit side hint: n/s/e/w
    tside: str = ""           # entry side hint
    color: str = LINE
    font: int = 11
    curve: bool = False


@dataclass
class Fig:
    name: str
    w: int
    h: int
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    _seq: int = 0
    bg: str = WHITE

    def _nid(self, prefix: str) -> str:
        self._seq += 1
        return f"{prefix}{self._seq}"

    # -- node constructors --------------------------------------------------
    def add(self, node: Node) -> Node:
        self.nodes.append(node)
        return node

    def by_id(self, nid: str) -> Node:
        for n in self.nodes:
            if n.id == nid:
                return n
        raise KeyError(nid)

    def uml(self, nid, x, y, w, name, attrs=None, methods=None, *, stereotype="",
            header_fill=BLUE_F, header_stroke=BLUE_S, line_h=LINE_H, h=None):
        attrs = attrs or []
        methods = methods or []
        title = name if not stereotype else f"«{stereotype}»\n{name}"
        title_lines = 1 + (1 if stereotype else 0)
        head = H_HEADER + (LINE_H - 6) * (title_lines - 1)
        sep = SEP_H if (attrs and methods) else 0
        body = len(attrs) * line_h + sep + len(methods) * line_h
        if not attrs and not methods:
            body = 8
        auto_h = head + body + 6
        n = Node(nid, "uml_class", x, y, w, h or auto_h, label=title,
                 attrs=attrs, methods=methods, header_fill=header_fill,
                 header_stroke=header_stroke, stroke=header_stroke)
        n.extra["head"] = head
        n.extra["line_h"] = line_h
        return self.add(n)

    def box(self, nid, x, y, w, h, label="", *, fill=WHITE, stroke=INK,
            font=12, bold=False, rounded=False, dashed=False, align="center"):
        return self.add(Node(nid, "box", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font, bold=bold, rounded=rounded,
                             dashed=dashed, align=align))

    def process(self, nid, x, y, w, h, label, *, fill=GREEN_F, stroke=GREEN_S,
                shape="round", font=12):
        n = Node(nid, "process", x, y, w, h, label=label, fill=fill, stroke=stroke,
                 font=font, rounded=True)
        n.extra["shape"] = shape       # round|ellipse
        return self.add(n)

    def datastore(self, nid, x, y, w, h, label, *, fill=PURPLE_F, stroke=PURPLE_S,
                  dashed=False, font=12):
        return self.add(Node(nid, "datastore", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, dashed=dashed, font=font))

    def external(self, nid, x, y, w, h, label, *, fill=ORANGE_F, stroke=ORANGE_S,
                 font=12):
        return self.add(Node(nid, "external", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font))

    def actor(self, nid, x, y, label, *, w=70, h=90, font=12):
        return self.add(Node(nid, "actor", x, y, w, h, label=label, font=font,
                             stroke=INK))

    def usecase(self, nid, x, y, w, h, label, *, fill=BLUE_F, stroke=BLUE_S, font=12):
        return self.add(Node(nid, "usecase", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font))

    def boundary(self, nid, x, y, w, h, label, *, stroke=SUBINK, font=13):
        return self.add(Node(nid, "boundary", x, y, w, h, label=label, fill="none",
                             stroke=stroke, font=font))

    def state(self, nid, x, y, w, h, label, *, fill=BLUE_F, stroke=BLUE_S, font=12,
              dashed=False):
        return self.add(Node(nid, "state", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font, rounded=True, dashed=dashed))

    def initial(self, nid, x, y, *, r=12):
        return self.add(Node(nid, "initial", x, y, 2 * r, 2 * r, fill=INK, stroke=INK))

    def final(self, nid, x, y, *, r=13):
        return self.add(Node(nid, "final", x, y, 2 * r, 2 * r, fill=INK, stroke=INK))

    def decision(self, nid, x, y, w, h, label="", *, fill=YELLOW_F, stroke=YELLOW_S,
                 font=11):
        return self.add(Node(nid, "decision", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font))

    def action(self, nid, x, y, w, h, label, *, fill=GREEN_F, stroke=GREEN_S, font=12):
        return self.add(Node(nid, "action", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font, rounded=True))

    def bar(self, nid, x, y, w, h=6):
        return self.add(Node(nid, "bar", x, y, w, h, fill=INK, stroke=INK))

    def lifeline(self, nid, x, y, w, bottom, label, *, fill=BLUE_F, stroke=BLUE_S,
                 head_h=34, font=12, actor=False):
        n = Node(nid, "lifeline", x, y, w, head_h, label=label, fill=fill,
                 stroke=stroke, font=font)
        n.extra["bottom"] = bottom
        n.extra["actor"] = actor
        return self.add(n)

    def note(self, nid, x, y, w, h, label, *, fill=YELLOW_F, stroke=YELLOW_S, font=11,
             align="left"):
        return self.add(Node(nid, "note", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font, align=align))

    # UI wireframe primitives ------------------------------------------------
    def ui_window(self, nid, x, y, w, h, title="", *, fill=WHITE, stroke="#c4ccd6"):
        return self.add(Node(nid, "ui_window", x, y, w, h, label=title, fill=fill,
                             stroke=stroke))

    def ui_panel(self, nid, x, y, w, h, label="", *, fill="#f6f8fb", stroke="#d7dee8",
                 font=11, align="center", dashed=False, rounded=True):
        return self.add(Node(nid, "ui_panel", x, y, w, h, label=label, fill=fill,
                             stroke=stroke, font=font, align=align, dashed=dashed,
                             rounded=rounded))

    def ui_btn(self, nid, x, y, w, h, label, *, primary=True, font=11):
        fill = "#2f6bd6" if primary else "#eef2f8"
        return self.add(Node(nid, "ui_btn", x, y, w, h, label=label, fill=fill,
                             stroke="#2f6bd6" if primary else "#c4ccd6", font=font,
                             extra={"primary": primary}))

    def ui_input(self, nid, x, y, w, h, label="", *, font=11):
        return self.add(Node(nid, "ui_input", x, y, w, h, label=label, fill=WHITE,
                             stroke="#c4ccd6", font=font, align="left"))

    def ui_text(self, nid, x, y, w, h, label, *, font=11, align="left", color=INK,
                bold=False):
        return self.add(Node(nid, "ui_text", x, y, w, h, label=label, fill="none",
                             stroke="none", font=font, align=align, bold=bold,
                             extra={"color": color}))

    def ui_img(self, nid, x, y, w, h, label="", *, font=10):
        return self.add(Node(nid, "ui_img", x, y, w, h, label=label, fill="#eef1f5",
                             stroke="#c4ccd6", font=font))

    # -- edge constructor ---------------------------------------------------
    def link(self, src=None, dst=None, label="", **kw) -> Edge:
        e = Edge(src=src, dst=dst, label=label, **kw)
        self.edges.append(e)
        return e


# ==========================================================================
# geometry helpers (for SVG edge routing)
# ==========================================================================
def _anchor(n: Node, side: str) -> tuple[float, float]:
    return {
        "n": (n.cx, n.y), "s": (n.cx, n.y + n.h),
        "e": (n.x + n.w, n.cy), "w": (n.x, n.cy),
        "c": (n.cx, n.cy),
        "ne": (n.x + n.w, n.y), "nw": (n.x, n.y),
        "se": (n.x + n.w, n.y + n.h), "sw": (n.x, n.y + n.h),
    }[side]


def _rect_clip(n: Node, tx: float, ty: float) -> tuple[float, float]:
    """Point on rect boundary of n along the ray toward (tx,ty)."""
    cx, cy = n.cx, n.cy
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    hw, hh = n.w / 2, n.h / 2
    scale = min(
        hw / abs(dx) if dx else math.inf,
        hh / abs(dy) if dy else math.inf,
    )
    return cx + dx * scale, cy + dy * scale


def _ellipse_clip(n: Node, tx: float, ty: float) -> tuple[float, float]:
    cx, cy = n.cx, n.cy
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    a, b = n.w / 2, n.h / 2
    t = 1.0 / math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b))
    return cx + dx * t, cy + dy * t


def _clip(n: Node, tx: float, ty: float, side: str = "") -> tuple[float, float]:
    if side:
        return _anchor(n, side)
    if n.kind in ("process", "usecase", "initial", "final") or \
            (n.kind == "process" and n.extra.get("shape") == "ellipse"):
        return _ellipse_clip(n, tx, ty)
    if n.kind == "decision":       # diamond ~ use rhombus clip
        cx, cy = n.cx, n.cy
        dx, dy = tx - cx, ty - cy
        if dx == 0 and dy == 0:
            return cx, cy
        hw, hh = n.w / 2, n.h / 2
        scale = 1.0 / (abs(dx) / hw + abs(dy) / hh)
        return cx + dx * scale, cy + dy * scale
    return _rect_clip(n, tx, ty)


def _edge_points(fig: Fig, e: Edge) -> list[tuple[float, float]]:
    if e.points:
        return e.points
    s = fig.by_id(e.src)
    t = fig.by_id(e.dst)
    mids = e.waypoints or []
    # reference target for clipping = first midpoint (or target center)
    sref = mids[0] if mids else (t.cx, t.cy)
    tref = mids[-1] if mids else (s.cx, s.cy)
    p0 = _clip(s, sref[0], sref[1], e.sside)
    p1 = _clip(t, tref[0], tref[1], e.tside)
    return [p0, *mids, p1]


# ==========================================================================
# SVG emitter
# ==========================================================================
def _svg_text(x, y, s, *, size=12, anchor="middle", fill=INK, bold=False,
              italic=False):
    if s is None or s == "":
        return ""
    weight = ' font-weight="bold"' if bold else ""
    style = ' font-style="italic"' if italic else ""
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" '
            f'font-size="{size}" text-anchor="{anchor}"{weight}{style} '
            f'fill="{fill}">{escape(str(s))}</text>')


def _svg_multiline(x, y, lines, *, size=12, anchor="middle", fill=INK, lh=None,
                   bold=False):
    lh = lh or size + 4
    out = []
    for i, ln in enumerate(lines):
        out.append(_svg_text(x, y + i * lh, ln, size=size, anchor=anchor, fill=fill,
                             bold=bold))
    return "".join(out)


def _wrap(text: str, width_chars: int) -> list[str]:
    """Rough CJK-aware wrap: count CJK as 2, latin as 1."""
    if "\n" in text:
        out = []
        for part in text.split("\n"):
            out.extend(_wrap(part, width_chars) or [""])
        return out
    line, cur = [], 0
    out = []
    for ch in text:
        wc = 2 if ord(ch) > 0x2E7F else 1
        if cur + wc > width_chars and line:
            out.append("".join(line))
            line, cur = [ch], wc
        else:
            line.append(ch)
            cur += wc
    if line:
        out.append("".join(line))
    return out or [""]


def _dash(n) -> str:
    return ' stroke-dasharray="6 4"' if getattr(n, "dashed", False) else ""


def _node_svg(n: Node) -> str:
    x, y, w, h = n.x, n.y, n.w, n.h
    k = n.kind
    if k == "uml_class":
        head = n.extra["head"]
        lh = n.extra["line_h"]
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" '
                 f'fill="{WHITE}" stroke="{n.stroke}" stroke-width="1.3"/>']
        # header band
        parts.append(f'<path d="M{x} {y+head} L{x} {y+3} Q{x} {y} {x+3} {y} '
                     f'L{x+w-3} {y} Q{x+w} {y} {x+w} {y+3} L{x+w} {y+head} Z" '
                     f'fill="{n.header_fill}" stroke="{n.header_stroke}" stroke-width="1.3"/>')
        title_lines = n.label.split("\n")
        ty = y + (head - (len(title_lines) - 1) * 14) / 2 + 10
        parts.append(_svg_multiline(x + w / 2, ty, title_lines, size=13, bold=True,
                                    lh=14))
        cy = y + head
        for a in n.attrs:
            cy += lh
            parts.append(_svg_text(x + 8, cy - 5, a, size=12, anchor="start"))
        if n.methods:
            if n.attrs:
                cy_sep = cy + 4
                parts.append(f'<line x1="{x}" y1="{cy_sep}" x2="{x+w}" y2="{cy_sep}" '
                             f'stroke="{n.header_stroke}" stroke-width="1"/>')
                cy = cy_sep
            for m in n.methods:
                cy += lh
                parts.append(_svg_text(x + 8, cy - 5, m, size=12, anchor="start", italic=True))
        return "".join(parts)

    if k in ("box", "state", "action"):
        rx = 12 if (n.rounded or k in ("state", "action")) else 2
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
                 f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.2"{_dash(n)}/>']
        parts.append(_center_label(n))
        return "".join(parts)

    if k == "process":
        if n.extra.get("shape") == "ellipse":
            parts = [f'<ellipse cx="{n.cx}" cy="{n.cy}" rx="{w/2}" ry="{h/2}" '
                     f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.2"/>']
        else:
            parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" '
                     f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.2"/>']
        parts.append(_center_label(n))
        return "".join(parts)

    if k == "datastore":
        # open-ended store: left vertical bar + top/bottom lines
        d = _dash(n)
        parts = [
            f'<path d="M{x+10} {y} L{x+w} {y} M{x+10} {y+h} L{x+w} {y+h} '
            f'M{x+10} {y} L{x+10} {y+h}" fill="none" stroke="{n.stroke}" '
            f'stroke-width="1.2"{d}/>',
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" '
            f'stroke="none"/>',
        ]
        parts.append(_center_label(n, x0=x + 12))
        return "".join(parts)

    if k == "external":
        # 3D-ish source/sink box
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" '
                 f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.2"/>',
                 f'<line x1="{x+6}" y1="{y}" x2="{x+6}" y2="{y+h}" '
                 f'stroke="{n.stroke}" stroke-width="1"/>']
        parts.append(_center_label(n, x0=x + 6))
        return "".join(parts)

    if k == "actor":
        cx = n.cx
        top = y + 6
        r = 11
        parts = [
            f'<circle cx="{cx}" cy="{top+r}" r="{r}" fill="{WHITE}" stroke="{n.stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx}" y1="{top+2*r}" x2="{cx}" y2="{top+2*r+26}" stroke="{n.stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx-16}" y1="{top+2*r+10}" x2="{cx+16}" y2="{top+2*r+10}" stroke="{n.stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx}" y1="{top+2*r+26}" x2="{cx-14}" y2="{top+2*r+48}" stroke="{n.stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx}" y1="{top+2*r+26}" x2="{cx+14}" y2="{top+2*r+48}" stroke="{n.stroke}" stroke-width="1.4"/>',
        ]
        for i, ln in enumerate(n.label.split("\n")):
            parts.append(_svg_text(cx, y + h + 2 + i * 15, ln, size=n.font, bold=True))
        return "".join(parts)

    if k == "usecase":
        parts = [f'<ellipse cx="{n.cx}" cy="{n.cy}" rx="{w/2}" ry="{h/2}" '
                 f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.2"/>']
        parts.append(_center_label(n))
        return "".join(parts)

    if k == "boundary":
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" '
                 f'fill="none" stroke="{n.stroke}" stroke-width="1.3" stroke-dasharray="2 3"/>']
        parts.append(_svg_text(n.cx, y + 20, n.label, size=n.font, bold=True,
                              fill=SUBINK))
        return "".join(parts)

    if k == "initial":
        return f'<circle cx="{n.cx}" cy="{n.cy}" r="{w/2}" fill="{INK}"/>'
    if k == "final":
        return (f'<circle cx="{n.cx}" cy="{n.cy}" r="{w/2}" fill="none" stroke="{INK}" stroke-width="1.4"/>'
                f'<circle cx="{n.cx}" cy="{n.cy}" r="{w/2-4}" fill="{INK}"/>')

    if k == "decision":
        pts = f"{n.cx},{y} {x+w},{n.cy} {n.cx},{y+h} {x},{n.cy}"
        parts = [f'<polygon points="{pts}" fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.2"/>']
        if n.label:
            parts.append(_center_label(n))
        return "".join(parts)

    if k == "bar":
        return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{INK}"/>'

    if k == "lifeline":
        bottom = n.extra["bottom"]
        parts = [f'<line x1="{n.cx}" y1="{y+h}" x2="{n.cx}" y2="{bottom}" '
                 f'stroke="{SUBINK}" stroke-width="1" stroke-dasharray="5 4"/>']
        if n.extra.get("actor"):
            parts.append(_node_svg(Node(n.id + "_a", "actor", n.cx - 22, y - 34, 44,
                                        h + 30, label=n.label, stroke=INK)))
        else:
            parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" '
                         f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.2"/>')
            parts.append(_center_label(n))
        return "".join(parts)

    if k == "note":
        f = 12
        parts = [f'<path d="M{x} {y} L{x+w-f} {y} L{x+w} {y+f} L{x+w} {y+h} L{x} {y+h} Z" '
                 f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.1"/>',
                 f'<path d="M{x+w-f} {y} L{x+w-f} {y+f} L{x+w} {y+f}" fill="none" stroke="{n.stroke}" stroke-width="1.1"/>']
        parts.append(_left_label(n, pad=8))
        return "".join(parts)

    # ---- UI primitives ----
    if k == "ui_window":
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" '
                 f'fill="{WHITE}" stroke="{n.stroke}" stroke-width="1.4"/>',
                 f'<path d="M{x} {y+30} L{x} {y+8} Q{x} {y} {x+8} {y} L{x+w-8} {y} '
                 f'Q{x+w} {y} {x+w} {y+8} L{x+w} {y+30} Z" fill="#eef2f7" stroke="{n.stroke}" stroke-width="1.4"/>']
        for i, cc in enumerate(("#ff6159", "#febc2e", "#28c840")):
            parts.append(f'<circle cx="{x+16+i*16}" cy="{y+15}" r="5" fill="{cc}"/>')
        if n.label:
            parts.append(_svg_text(x + w / 2, y + 20, n.label, size=12, bold=True,
                                  fill=SUBINK))
        return "".join(parts)

    if k in ("ui_panel", "ui_img", "ui_input"):
        rx = 8 if n.rounded else 4
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
                 f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.1"{_dash(n)}/>']
        if k == "ui_img":
            parts.append(f'<path d="M{x} {y} L{x+w} {y+h} M{x+w} {y} L{x} {y+h}" '
                         f'stroke="#c4ccd6" stroke-width="1" fill="none"/>')
        if n.label:
            if n.align == "left":
                parts.append(_left_label(n, pad=8))
            else:
                parts.append(_center_label(n))
        return "".join(parts)

    if k == "ui_btn":
        primary = n.extra.get("primary", True)
        tc = WHITE if primary else INK
        parts = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" '
                 f'fill="{n.fill}" stroke="{n.stroke}" stroke-width="1.1"/>']
        parts.append(_svg_text(n.cx, n.cy + n.font / 2 - 1, n.label, size=n.font,
                              fill=tc, bold=True))
        return "".join(parts)

    if k == "ui_text":
        color = n.extra.get("color", INK)
        lines = _wrap(n.label, int(n.w / (n.font * 0.62)) or 8) if n.w else [n.label]
        out = []
        yy = n.y + n.font
        ax = n.x if n.align == "left" else n.cx
        for ln in lines:
            out.append(_svg_text(ax, yy, ln, size=n.font, anchor="start" if n.align == "left" else "middle",
                                 fill=color, bold=n.bold))
            yy += n.font + 4
        return "".join(out)

    return ""


def _center_label(n: Node, x0=None):
    if not n.label:
        return ""
    x0 = n.x if x0 is None else x0
    cx = (x0 + n.x + n.w) / 2
    maxw = (n.x + n.w) - x0 - 10
    lines = _wrap(n.label, max(int(maxw / (n.font * 0.6)), 4))
    total = len(lines) * (n.font + 3)
    y0 = n.cy - total / 2 + n.font
    return _svg_multiline(cx, y0, lines, size=n.font, lh=n.font + 3,
                          bold=n.bold, fill=INK)


def _left_label(n: Node, pad=6):
    if not n.label:
        return ""
    lines = _wrap(n.label, max(int((n.w - pad * 2) / (n.font * 0.6)), 4))
    y0 = n.y + n.font + 4
    out = []
    for i, ln in enumerate(lines):
        out.append(_svg_text(n.x + pad, y0 + i * (n.font + 4), ln, size=n.font,
                             anchor="start"))
    return "".join(out)


def _arrowhead(p0, p1, kind, color):
    """Return svg for arrowhead at p1 pointing along p0->p1."""
    x0, y0 = p0
    x1, y1 = p1
    ang = math.atan2(y1 - y0, x1 - x0)
    L = 12
    W = 5
    if kind in ("arrow", "msg", "dashed"):
        ax = x1 - L * math.cos(ang - math.radians(W * 3))
        ay = y1 - L * math.sin(ang - math.radians(W * 3))
        bx = x1 - L * math.cos(ang + math.radians(W * 3))
        by = y1 - L * math.sin(ang + math.radians(W * 3))
        return f'<polygon points="{x1:.1f},{y1:.1f} {ax:.1f},{ay:.1f} {bx:.1f},{by:.1f}" fill="{color}"/>'
    if kind == "ret":       # open V (dashed return)
        ax = x1 - L * math.cos(ang - math.radians(18))
        ay = y1 - L * math.sin(ang - math.radians(18))
        bx = x1 - L * math.cos(ang + math.radians(18))
        by = y1 - L * math.sin(ang + math.radians(18))
        return (f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="1.3"/>'
                f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="1.3"/>')
    if kind == "open":
        ax = x1 - L * math.cos(ang - math.radians(20))
        ay = y1 - L * math.sin(ang - math.radians(20))
        bx = x1 - L * math.cos(ang + math.radians(20))
        by = y1 - L * math.sin(ang + math.radians(20))
        return (f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="1.3"/>'
                f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="1.3"/>')
    if kind == "inherit":   # hollow triangle
        ax = x1 - L * math.cos(ang - math.radians(20))
        ay = y1 - L * math.sin(ang - math.radians(20))
        bx = x1 - L * math.cos(ang + math.radians(20))
        by = y1 - L * math.sin(ang + math.radians(20))
        return f'<polygon points="{x1:.1f},{y1:.1f} {ax:.1f},{ay:.1f} {bx:.1f},{by:.1f}" fill="{WHITE}" stroke="{color}" stroke-width="1.2"/>'
    return ""


def _diamond(p0, p1, filled, color):
    """Diamond at p0 (source) for aggregate/compose, pointing along p0->p1."""
    x0, y0 = p0
    x1, y1 = p1
    ang = math.atan2(y1 - y0, x1 - x0)
    L = 14
    W = 6
    tipx, tipy = x0, y0
    backx = x0 + L * math.cos(ang)
    backy = y0 + L * math.sin(ang)
    midx = x0 + L / 2 * math.cos(ang)
    midy = y0 + L / 2 * math.sin(ang)
    lx = midx + W * math.cos(ang + math.pi / 2)
    ly = midy + W * math.sin(ang + math.pi / 2)
    rx = midx + W * math.cos(ang - math.pi / 2)
    ry = midy + W * math.sin(ang - math.pi / 2)
    fill = color if filled else WHITE
    return (f'<polygon points="{tipx:.1f},{tipy:.1f} {lx:.1f},{ly:.1f} {backx:.1f},{backy:.1f} {rx:.1f},{ry:.1f}" '
            f'fill="{fill}" stroke="{color}" stroke-width="1.2"/>')


def _edge_svg(fig: Fig, e: Edge) -> str:
    pts = _edge_points(fig, e)
    color = e.color
    dashed = e.dashed or e.kind in ("open", "ret") or (e.kind == "dashed")
    d = ' stroke-dasharray="6 4"' if dashed else ""
    path = " ".join(f"{'M' if i == 0 else 'L'}{px:.1f} {py:.1f}" for i, (px, py) in enumerate(pts))
    out = [f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.3"{d}/>']
    # arrowhead at target end
    head_kind = e.kind
    if e.kind not in ("assoc", "aggregate", "compose"):
        out.append(_arrowhead(pts[-2], pts[-1], head_kind, color))
    if e.kind in ("aggregate", "compose"):
        out.append(_diamond(pts[0], pts[1], e.kind == "compose", color))
    # labels
    if e.label:
        mid = pts[len(pts) // 2]
        # place near geometric middle of full polyline
        mx, my = _polyline_mid(pts)
        lines = e.label.split("\n")
        bw = max(len(_disp(l)) for l in lines) * e.font * 0.6 + 8
        bh = len(lines) * (e.font + 3) + 4
        out.append(f'<rect x="{mx-bw/2:.1f}" y="{my-bh/2:.1f}" width="{bw:.1f}" height="{bh:.1f}" '
                   f'fill="{WHITE}" opacity="0.9" rx="3"/>')
        out.append(_svg_multiline(mx, my - bh / 2 + e.font, lines, size=e.font,
                                  lh=e.font + 3, fill=SUBINK))
    if e.src_label:
        sx, sy = pts[0]
        tx, ty = pts[1]
        ang = math.atan2(ty - sy, tx - sx)
        out.append(_svg_text(sx + 16 * math.cos(ang) + 6, sy + 16 * math.sin(ang), e.src_label,
                             size=e.font, fill=SUBINK))
    if e.dst_label:
        sx, sy = pts[-1]
        tx, ty = pts[-2]
        ang = math.atan2(ty - sy, tx - sx)
        out.append(_svg_text(sx + 18 * math.cos(ang), sy + 18 * math.sin(ang) - 4, e.dst_label,
                             size=e.font, fill=SUBINK))
    return "".join(out)


def _disp(s: str) -> str:
    return "".join("xx" if ord(c) > 0x2E7F else "x" for c in s)


def _polyline_mid(pts):
    if len(pts) == 2:
        return (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2
    # total length midpoint
    segs = []
    total = 0
    for a, b in zip(pts, pts[1:]):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        segs.append((a, b, d))
        total += d
    half = total / 2
    acc = 0
    for a, b, d in segs:
        if acc + d >= half:
            t = (half - acc) / d if d else 0
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        acc += d
    return pts[len(pts) // 2]


def to_svg(fig: Fig) -> str:
    body = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{fig.w}" height="{fig.h}" '
            f'viewBox="0 0 {fig.w} {fig.h}" font-family="{FONT}">']
    body.append(f'<rect x="0" y="0" width="{fig.w}" height="{fig.h}" fill="{fig.bg}"/>')
    # edges under nodes for lifeline dashed, but arrows over: draw edges after nodes
    for n in fig.nodes:
        body.append(_node_svg(n))
    for e in fig.edges:
        body.append(_edge_svg(fig, e))
    body.append("</svg>")
    return "\n".join(body)


# ==========================================================================
# draw.io emitter
# ==========================================================================
def _dstyle_common(font=12, bold=False):
    s = {"fontFamily": DRAWIO_FONT, "fontSize": font, "html": 1}
    if bold:
        s["fontStyle"] = 1
    return s


def _drawio_node(fig: Fig, n: Node, out: list[str]):
    x, y, w, h = int(n.x), int(n.y), int(n.w), int(n.h)
    k = n.kind
    if k == "uml_class":
        head = int(n.extra["head"])
        lh = int(n.extra["line_h"])
        st = _sty({
            "swimlane": "", "fontStyle": 1, "align": "center", "verticalAlign": "top",
            "childLayout": "stackLayout", "horizontal": 1, "startSize": head,
            "horizontalStack": 0, "resizeParent": 1, "resizeParentMax": 0,
            "resizeLast": 0, "collapsible": 0, "marginBottom": 0, "html": 1,
            "fillColor": n.header_fill, "strokeColor": n.header_stroke,
            "fontFamily": DRAWIO_FONT, "fontSize": 13,
        })
        out.append(f'<mxCell id="{n.id}" value="{escape(n.label)}" style="{st}" vertex="1" parent="1">'
                   f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        line_st = _sty({
            "text": "", "strokeColor": "none", "fillColor": "none", "align": "left",
            "verticalAlign": "top", "spacingLeft": 6, "spacingRight": 6,
            "overflow": "hidden", "rotatable": 0,
            "points": "[[0,0.5],[1,0.5]]", "portConstraint": "eastwest",
            "fontFamily": DRAWIO_FONT, "fontSize": 12, "html": 1,
        })
        yy = head
        for i, a in enumerate(n.attrs):
            out.append(f'<mxCell id="{n.id}_a{i}" value="{escape(a)}" style="{line_st}" vertex="1" parent="{n.id}">'
                       f'<mxGeometry y="{yy}" width="{w}" height="{lh}" as="geometry"/></mxCell>')
            yy += lh
        if n.methods:
            if n.attrs:
                sep_st = _sty({
                    "line": "", "strokeWidth": 1, "fillColor": "none", "align": "left",
                    "verticalAlign": "middle", "spacingTop": -1, "spacingLeft": 3,
                    "spacingRight": 3, "rotatable": 0, "labelPosition": "right",
                    "points": "[]", "portConstraint": "eastwest",
                    "strokeColor": n.header_stroke, "html": 1,
                })
                out.append(f'<mxCell id="{n.id}_sep" value="" style="{sep_st}" vertex="1" parent="{n.id}">'
                           f'<mxGeometry y="{yy}" width="{w}" height="{SEP_H}" as="geometry"/></mxCell>')
                yy += SEP_H
            for i, m in enumerate(n.methods):
                out.append(f'<mxCell id="{n.id}_m{i}" value="{escape(m)}" style="{line_st}" vertex="1" parent="{n.id}">'
                           f'<mxGeometry y="{yy}" width="{w}" height="{lh}" as="geometry"/></mxCell>')
                yy += lh
        return

    style = _drawio_shape_style(n)
    out.append(f'<mxCell id="{n.id}" value="{escape(n.label)}" style="{style}" vertex="1" parent="1">'
               f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


def _drawio_shape_style(n: Node) -> str:
    base = {"whiteSpace": "wrap", "html": 1, "fontFamily": DRAWIO_FONT,
            "fontSize": n.font, "fillColor": n.fill, "strokeColor": n.stroke}
    if n.bold:
        base["fontStyle"] = 1
    if n.dashed:
        base["dashed"] = 1
    k = n.kind
    if k in ("box",):
        if n.rounded:
            base["rounded"] = 1
        if n.fill == "none":
            base["fillColor"] = "none"
        base["align"] = n.align
        return _sty(base)
    if k == "process":
        if n.extra.get("shape") == "ellipse":
            base["ellipse"] = ""
        else:
            base["rounded"] = 1
            base["arcSize"] = 50
        return _sty(base)
    if k == "datastore":
        base.update({"shape": "partialRectangle", "top": 1, "bottom": 1, "left": 1,
                     "right": 0, "fillColor": n.fill})
        return _sty(base)
    if k == "external":
        base["shape"] = "process"
        base["size"] = 0.06
        return _sty(base)
    if k == "actor":
        return _sty({"shape": "umlActor", "verticalLabelPosition": "bottom",
                     "labelPosition": "center", "verticalAlign": "top", "html": 1,
                     "outlineConnect": 0, "fontFamily": DRAWIO_FONT, "fontSize": n.font,
                     "fillColor": WHITE, "strokeColor": n.stroke, "fontStyle": 1})
    if k == "usecase":
        base["ellipse"] = ""
        return _sty(base)
    if k == "boundary":
        return _sty({"rounded": 1, "arcSize": 6, "html": 1, "dashed": 1, "dashPattern": "2 3",
                     "fillColor": "none", "strokeColor": n.stroke, "verticalAlign": "top",
                     "fontFamily": DRAWIO_FONT, "fontSize": n.font, "fontStyle": 1,
                     "fontColor": SUBINK})
    if k == "state":
        base["rounded"] = 1
        base["arcSize"] = 40
        return _sty(base)
    if k == "action":
        base["rounded"] = 1
        base["arcSize"] = 30
        return _sty(base)
    if k == "initial":
        return _sty({"ellipse": "", "html": 1, "fillColor": INK, "strokeColor": INK})
    if k == "final":
        return _sty({"ellipse": "", "shape": "endState", "html": 1, "fillColor": INK,
                     "strokeColor": INK})
    if k == "decision":
        base["rhombus"] = ""
        return _sty(base)
    if k == "bar":
        return _sty({"html": 1, "fillColor": INK, "strokeColor": INK})
    if k == "lifeline":
        return _sty({"shape": "umlLifeline", "perimeter": "lifelinePerimeter",
                     "whiteSpace": "wrap", "html": 1, "container": 0,
                     "collapsible": 0, "fontFamily": DRAWIO_FONT, "fontSize": n.font,
                     "fillColor": n.fill, "strokeColor": n.stroke,
                     "size": int(n.h)})
    if k == "note":
        base["shape"] = "note"
        base["size"] = 12
        base["align"] = n.align
        base["verticalAlign"] = "top"
        return _sty(base)
    # UI primitives -> approximate drawio shapes
    if k == "ui_window":
        return _sty({"rounded": 1, "arcSize": 4, "html": 1, "fillColor": WHITE,
                     "strokeColor": n.stroke, "verticalAlign": "top",
                     "fontFamily": DRAWIO_FONT, "fontSize": 12, "fontStyle": 1})
    if k in ("ui_panel", "ui_input", "ui_img"):
        base["rounded"] = 1 if n.rounded else 0
        base["align"] = n.align
        base["verticalAlign"] = "middle" if n.align == "center" else "top"
        if k == "ui_img":
            base["shape"] = "image"  # fallback; still a box
            base.pop("shape")
        return _sty(base)
    if k == "ui_btn":
        primary = n.extra.get("primary", True)
        return _sty({"rounded": 1, "arcSize": 40, "html": 1, "fillColor": n.fill,
                     "strokeColor": n.stroke, "fontColor": WHITE if primary else INK,
                     "fontFamily": DRAWIO_FONT, "fontSize": n.font, "fontStyle": 1})
    if k == "ui_text":
        return _sty({"text": "", "html": 1, "strokeColor": "none", "fillColor": "none",
                     "align": n.align, "verticalAlign": "top",
                     "fontFamily": DRAWIO_FONT, "fontSize": n.font,
                     "fontColor": n.extra.get("color", INK),
                     "fontStyle": 1 if n.bold else 0})
    base["align"] = n.align
    return _sty(base)


_ARROW_MAP = {
    "arrow": ("block", 1, "none"),
    "dashed": ("block", 1, "none"),
    "open": ("open", 0, "none"),
    "ret": ("open", 0, "none"),
    "msg": ("block", 1, "none"),
    "assoc": ("none", 0, "none"),
    "inherit": ("block", 0, "none"),      # will set endFill=0 -> hollow
    "aggregate": ("none", 0, "diamondThin"),
    "compose": ("none", 0, "diamondThin"),
}


def _drawio_edge(fig: Fig, e: Edge, out: list[str], idx: int):
    end, endfill, startarrow = _ARROW_MAP.get(e.kind, ("block", 1, "none"))
    st = {
        "html": 1, "rounded": 0, "endArrow": end, "endFill": endfill,
        "strokeColor": e.color, "fontFamily": DRAWIO_FONT, "fontSize": e.font,
        "fontColor": SUBINK,
    }
    if e.kind == "inherit":
        st["endArrow"] = "block"
        st["endFill"] = 0
    if e.kind in ("aggregate", "compose"):
        st["startArrow"] = "diamondThin"
        st["startFill"] = 1 if e.kind == "compose" else 0
        st["startSize"] = 14
        st["endArrow"] = "open" if e.kind else "none"
        st["endArrow"] = "none"
    if e.dashed or e.kind in ("dashed", "ret", "open"):
        st["dashed"] = 1
    eid = f"e{idx}"
    attrs = f'edge="1" parent="1"'
    if e.src:
        attrs += f' source="{e.src}"'
    if e.dst:
        attrs += f' target="{e.dst}"'
    geo = '<mxGeometry relative="1" as="geometry">'
    inner = ""
    if e.points:
        (sx, sy), (tx, ty) = e.points[0], e.points[-1]
        geo = (f'<mxGeometry relative="1" as="geometry">'
               f'<mxPoint x="{int(sx)}" y="{int(sy)}" as="sourcePoint"/>'
               f'<mxPoint x="{int(tx)}" y="{int(ty)}" as="targetPoint"/>')
        mids = e.points[1:-1]
        if mids:
            inner = '<Array as="points">' + "".join(
                f'<mxPoint x="{int(px)}" y="{int(py)}"/>' for px, py in mids) + '</Array>'
    elif e.waypoints:
        inner = '<Array as="points">' + "".join(
            f'<mxPoint x="{int(px)}" y="{int(py)}"/>' for px, py in e.waypoints) + '</Array>'
    geo += inner + '</mxGeometry>'
    out.append(f'<mxCell id="{eid}" value="{escape(e.label)}" style="{_sty(st)}" {attrs}>{geo}</mxCell>')
    # endpoint multiplicity labels as child cells
    for frac, txt in ((0.08, e.src_label), (0.92, e.dst_label)):
        if txt:
            lst = _sty({"edgeLabel": "", "resizable": 0, "html": 1, "align": "center",
                        "fontFamily": DRAWIO_FONT, "fontSize": e.font, "fontColor": SUBINK})
            out.append(f'<mxCell id="{eid}_l{int(frac*100)}" value="{escape(txt)}" style="{lst}" '
                       f'vertex="1" connectable="0" parent="{eid}">'
                       f'<mxGeometry x="{-0.84 + frac*1.84:.2f}" relative="1" as="geometry">'
                       f'<mxPoint as="offset"/></mxGeometry></mxCell>')


def to_drawio(fig: Fig) -> str:
    out = ['<mxfile host="app.diagrams.net" agent="figlib">',
           f'<diagram id="{escape(fig.name)}" name="{escape(fig.name)}">',
           f'<mxGraphModel dx="1280" dy="820" grid="0" gridSize="10" guides="1" '
           f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
           f'pageWidth="{fig.w}" pageHeight="{fig.h}" math="0" shadow="0"><root>',
           '<mxCell id="0"/><mxCell id="1" parent="0"/>']
    for n in fig.nodes:
        _drawio_node(fig, n, out)
    for i, e in enumerate(fig.edges):
        _drawio_edge(fig, e, out, i)
    out.append('</root></mxGraphModel></diagram></mxfile>')
    return "\n".join(out)


# ==========================================================================
# output
# ==========================================================================
def rasterise(svg_path: Path, png_path: Path, scale: float = 2.0):
    import cairosvg
    cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), scale=scale)


def render(fig: Fig, out_dir: Path, stem: str, *, scale: float = 2.0,
           make_png: bool = True) -> dict:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    drawio_p = out_dir / f"{stem}.drawio"
    svg_p = out_dir / f"{stem}.svg"
    png_p = out_dir / f"{stem}.png"
    drawio_p.write_text(to_drawio(fig), encoding="utf-8")
    svg_p.write_text(to_svg(fig), encoding="utf-8")
    if make_png:
        rasterise(svg_p, png_p, scale=scale)
    return {"drawio": drawio_p, "svg": svg_p, "png": png_p}
