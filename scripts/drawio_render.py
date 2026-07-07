"""Render a (figlib-vocabulary) .drawio to SVG/PNG faithfully.

Purpose: the user hand-edits the .drawio in draw.io; this VPS has no drawio
CLI, so we parse the mxGraphModel and reproduce the shapes we emit — UML class
swimlanes (name / attributes / operations compartments), umlLifeline
sequence lifelines (+ umlActor), rounded/plain rects, ellipses, datastores,
edges (arrow/open/none, dashed, waypoints) and edge labels.

Only the shape subset figlib produces is supported; anything else falls back
to a plain rounded rectangle so nothing silently disappears.
"""
from __future__ import annotations

import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

FONT = "WenQuanYi Zen Hei, Microsoft YaHei, SimSun, sans-serif"
INK = "#1f2328"
SUBINK = "#57606a"
WHITE = "#ffffff"


# --------------------------------------------------------------------------
def parse_style(s: str) -> dict:
    d = {}
    for part in (s or "").split(";"):
        if not part:
            continue
        if "=" in part:
            k, v = part.split("=", 1)
            d[k] = v
        else:
            d[part] = ""
    return d


def _f(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


class Cell:
    def __init__(self, el):
        self.id = el.get("id")
        self.parent = el.get("parent")
        self.value = el.get("value") or ""
        self.style = parse_style(el.get("style") or "")
        self.is_vertex = el.get("vertex") == "1"
        self.is_edge = el.get("edge") == "1"
        self.source = el.get("source")
        self.target = el.get("target")
        self.x = self.y = self.w = self.h = 0.0
        self.src_pt = self.tgt_pt = None
        self.waypoints = []
        self.rel_x = None   # edge label relative position
        self.offset = (0.0, 0.0)
        geo = el.find("mxGeometry")
        if geo is not None:
            self.x = _f(geo.get("x")); self.y = _f(geo.get("y"))
            self.w = _f(geo.get("width")); self.h = _f(geo.get("height"))
            self.rel_x = geo.get("x")  # for edge labels, x is the along-fraction
            for pt in geo.findall("mxPoint"):
                role = pt.get("as")
                p = (_f(pt.get("x")), _f(pt.get("y")))
                if role == "sourcePoint":
                    self.src_pt = p
                elif role == "targetPoint":
                    self.tgt_pt = p
                elif role == "offset":
                    self.offset = p
            arr = geo.find("Array")
            if arr is not None:
                self.waypoints = [(_f(p.get("x")), _f(p.get("y")))
                                  for p in arr.findall("mxPoint")]


def load(path: Path):
    root = ET.parse(path).getroot()
    model = root.find(".//mxGraphModel")
    w = int(_f(model.get("pageWidth"), 1000))
    h = int(_f(model.get("pageHeight"), 800))
    cells = {}
    order = []
    for el in model.find("root").findall("mxCell"):
        c = Cell(el)
        cells[c.id] = c
        order.append(c)
    return w, h, cells, order


def abs_pos(c: Cell, cells: dict):
    """Absolute (x,y) walking up the vertex parent chain."""
    x, y = c.x, c.y
    p = cells.get(c.parent)
    while p is not None and p.is_vertex:
        x += p.x; y += p.y
        p = cells.get(p.parent)
    return x, y


# --------------------------------------------------------------------------
def txt(x, y, s, size=12, anchor="middle", fill=INK, bold=False, italic=False):
    if s == "" or s is None:
        return ""
    b = ' font-weight="bold"' if bold else ""
    it = ' font-style="italic"' if italic else ""
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" '
            f'text-anchor="{anchor}"{b}{it} fill="{fill}">{escape(str(s))}</text>')


def arrowhead(p0, p1, kind, color, fill):
    x0, y0 = p0; x1, y1 = p1
    ang = math.atan2(y1 - y0, x1 - x0)
    L = 12
    if kind == "none":
        return ""
    a = (x1 - L * math.cos(ang - math.radians(18)), y1 - L * math.sin(ang - math.radians(18)))
    b = (x1 - L * math.cos(ang + math.radians(18)), y1 - L * math.sin(ang + math.radians(18)))
    if kind == "open":
        return (f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="1.3"/>'
                f'<line x1="{b[0]:.1f}" y1="{b[1]:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="1.3"/>')
    f = color if fill else WHITE
    return f'<polygon points="{x1:.1f},{y1:.1f} {a[0]:.1f},{a[1]:.1f} {b[0]:.1f},{b[1]:.1f}" fill="{f}" stroke="{color}" stroke-width="1"/>'


def diamond(p0, p1, filled, color):
    x0, y0 = p0; x1, y1 = p1
    ang = math.atan2(y1 - y0, x1 - x0)
    L, W = 14, 6
    back = (x0 + L * math.cos(ang), y0 + L * math.sin(ang))
    mid = (x0 + L / 2 * math.cos(ang), y0 + L / 2 * math.sin(ang))
    l = (mid[0] + W * math.cos(ang + math.pi / 2), mid[1] + W * math.sin(ang + math.pi / 2))
    r = (mid[0] + W * math.cos(ang - math.pi / 2), mid[1] + W * math.sin(ang - math.pi / 2))
    return (f'<polygon points="{x0:.1f},{y0:.1f} {l[0]:.1f},{l[1]:.1f} {back[0]:.1f},{back[1]:.1f} '
            f'{r[0]:.1f},{r[1]:.1f}" fill="{color if filled else WHITE}" stroke="{color}" stroke-width="1"/>')


def rect_clip(bx, by, bw, bh, tx, ty):
    cx, cy = bx + bw / 2, by + bh / 2
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sc = min(bw / 2 / abs(dx) if dx else math.inf, bh / 2 / abs(dy) if dy else math.inf)
    return cx + dx * sc, cy + dy * sc


def poly_point(pts, frac):
    if len(pts) < 2:
        return pts[0] if pts else (0, 0)
    segs = [(a, b, math.hypot(b[0] - a[0], b[1] - a[1])) for a, b in zip(pts, pts[1:])]
    total = sum(s[2] for s in segs) or 1
    target = frac * total
    acc = 0
    for a, b, d in segs:
        if acc + d >= target:
            t = (target - acc) / d if d else 0
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        acc += d
    return pts[-1]


# --------------------------------------------------------------------------
def render_vertex(c: Cell, cells: dict) -> str:
    st = c.style
    x, y = abs_pos(c, cells)
    w, h = c.w, c.h
    stroke = st.get("strokeColor", INK)
    if stroke in ("none", "inherit", ""):
        stroke = INK
    fill = st.get("fillColor", WHITE)
    fsize = int(_f(st.get("fontSize"), 12))
    parts = []

    # ---- UML class swimlane ----
    if "swimlane" in st:
        head = _f(st.get("startSize"), 26)
        hfill = fill if fill not in ("none", "") else "#dae8fc"
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{WHITE}" stroke="{stroke}" stroke-width="1.3"/>')
        parts.append(f'<path d="M{x} {y+head} L{x} {y+3} Q{x} {y} {x+3} {y} L{x+w-3} {y} '
                     f'Q{x+w} {y} {x+w} {y+3} L{x+w} {y+head} Z" fill="{hfill}" stroke="{stroke}" stroke-width="1.3"/>')
        val = c.value.replace("\n", " ").strip()
        if val.startswith("«") and "»" in val:
            ster, name = val.split("»", 1)
            parts.append(txt(x + w / 2, y + head * 0.40, ster + "»", size=int(fsize * 0.72), italic=True))
            parts.append(txt(x + w / 2, y + head * 0.80, name.strip(), size=fsize, bold=True))
        else:
            parts.append(txt(x + w / 2, y + head / 2 + fsize * 0.35, val, size=fsize, bold=True))
        return "".join(parts)

    # ---- UML lifeline ----
    if st.get("shape") == "umlLifeline":
        size = _f(st.get("size"), 34)
        cx = x + w / 2
        parts.append(f'<line x1="{cx}" y1="{y+size}" x2="{cx}" y2="{y+h}" stroke="{SUBINK}" stroke-width="1" stroke-dasharray="5 4"/>')
        if st.get("participant") == "umlActor":
            top = y + 2; r = 11
            parts += [
                f'<circle cx="{cx}" cy="{top+r}" r="{r}" fill="{WHITE}" stroke="{stroke}" stroke-width="1.4"/>',
                f'<line x1="{cx}" y1="{top+2*r}" x2="{cx}" y2="{top+2*r+22}" stroke="{stroke}" stroke-width="1.4"/>',
                f'<line x1="{cx-15}" y1="{top+2*r+8}" x2="{cx+15}" y2="{top+2*r+8}" stroke="{stroke}" stroke-width="1.4"/>',
                f'<line x1="{cx}" y1="{top+2*r+22}" x2="{cx-13}" y2="{top+2*r+40}" stroke="{stroke}" stroke-width="1.4"/>',
                f'<line x1="{cx}" y1="{top+2*r+22}" x2="{cx+13}" y2="{top+2*r+40}" stroke="{stroke}" stroke-width="1.4"/>',
            ]
            for i, ln in enumerate(c.value.split("\n")):
                parts.append(txt(cx, y + size + 2 + i * 14, ln, size=fsize, bold=True))
        else:
            parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{size}" rx="3" fill="{fill if fill!="none" else "#dae8fc"}" stroke="{stroke}" stroke-width="1.2"/>')
            for i, ln in enumerate(_wrap(c.value, int(w / (fsize * 0.6)) or 6)):
                parts.append(txt(x + w / 2, y + size / 2 + 5 + i * (fsize + 2) - 6, ln, size=fsize, bold=False))
        return "".join(parts)

    # ---- compartment separator line ----
    if "line" in st and not c.value:
        yy = y + h / 2
        return f'<line x1="{x}" y1="{yy}" x2="{x+w}" y2="{yy}" stroke="{stroke}" stroke-width="1"/>'

    # ---- text (class member / free label) ----
    if "text" in st:
        align = st.get("align", "left")
        col = st.get("fontColor", INK)
        if align == "left":
            sl = _f(st.get("spacingLeft"), 4)
            return txt(x + sl, y + h / 2 + fsize / 2 - 1, c.value, size=fsize, anchor="start",
                       fill=col, bold="fontStyle" in st)
        return txt(x + w / 2, y + h / 2 + fsize / 2 - 1, c.value, size=fsize, fill=col,
                   bold="fontStyle" in st)

    # ---- datastore (open rectangle) ----
    if st.get("shape") == "partialRectangle":
        parts.append(f'<path d="M{x+10} {y} L{x+w} {y} M{x+10} {y+h} L{x+w} {y+h} M{x+10} {y} L{x+10} {y+h}" '
                     f'fill="none" stroke="{stroke}" stroke-width="1.2"{" stroke-dasharray=\"6 4\"" if "dashed" in st else ""}/>')
        parts.append(txt(x + (w + 12) / 2 + 4, y + h / 2 + fsize / 2 - 1, c.value.replace("\n", " "), size=fsize))
        return "".join(parts)

    # ---- ellipse / process ----
    if "ellipse" in st or st.get("shape") in ("mxgraph.flowchart.terminator",):
        parts.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>')
        for i, ln in enumerate(c.value.split("\n")):
            parts.append(txt(x + w / 2, y + h / 2 - (len(c.value.split(chr(10)))-1)*8 + i * 16, ln, size=fsize))
        return "".join(parts)

    # ---- decision / choice diamond (判断 -> 菱形) ----
    if "rhombus" in st:
        cx, cy = x + w / 2, y + h / 2
        pts = f"{cx},{y} {x+w},{cy} {cx},{y+h} {x},{cy}"
        parts.append(f'<polygon points="{pts}" fill="{fill if fill != "none" else WHITE}" '
                     f'stroke="{stroke}" stroke-width="1.2"/>')
        lines = c.value.split("\n")
        for i, ln in enumerate(lines):
            parts.append(txt(cx, cy - (len(lines) - 1) * (fsize * 0.62) + i * (fsize + 4)
                             + fsize * 0.35, ln, size=fsize))
        return "".join(parts)

    # ---- actor standalone ----
    if st.get("shape") == "umlActor":
        cx = x + w / 2; top = y; r = 11
        parts += [
            f'<circle cx="{cx}" cy="{top+r}" r="{r}" fill="{WHITE}" stroke="{stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx}" y1="{top+2*r}" x2="{cx}" y2="{top+2*r+24}" stroke="{stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx-15}" y1="{top+2*r+9}" x2="{cx+15}" y2="{top+2*r+9}" stroke="{stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx}" y1="{top+2*r+24}" x2="{cx-13}" y2="{top+2*r+44}" stroke="{stroke}" stroke-width="1.4"/>',
            f'<line x1="{cx}" y1="{top+2*r+24}" x2="{cx+13}" y2="{top+2*r+44}" stroke="{stroke}" stroke-width="1.4"/>',
        ]
        parts.append(txt(cx, y + h + 2, c.value, size=fsize, bold=True))
        return "".join(parts)

    # ---- generic box / rounded / process(bar) ----
    dash = ' stroke-dasharray="6 4"' if "dashed" in st else ""
    rx = 12 if ("rounded" in st or st.get("shape") == "process") else 2
    if fill in ("none", ""):
        fillv = "none"
    else:
        fillv = fill
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fillv}" stroke="{stroke}" stroke-width="1.2"{dash}/>')
    if c.value:
        col = st.get("fontColor", INK)
        align = st.get("align", "center")
        lines = _wrap(c.value.replace("\n", "\n"), max(int(w / (fsize * 0.6)), 4))
        if st.get("verticalAlign") == "top":
            # container title (e.g. use-case boundary, layer group) sits at top
            y0 = y + fsize + 6
        else:
            y0 = y + h / 2 - (len(lines) - 1) * (fsize + 2) / 2 + fsize / 2 - 1
        for i, ln in enumerate(lines):
            if align == "left":
                parts.append(txt(x + 6, y0 + i * (fsize + 2), ln, size=fsize, anchor="start", fill=col, bold="fontStyle" in st))
            else:
                parts.append(txt(x + w / 2, y0 + i * (fsize + 2), ln, size=fsize, fill=col, bold="fontStyle" in st))
    return "".join(parts)


def _wrap(text, width_chars):
    if not text:
        return [""]
    out = []
    for part in text.split("\n"):
        line, cur = [], 0
        for ch in part:
            wc = 2 if ord(ch) > 0x2E7F else 1
            if cur + wc > width_chars and line:
                out.append("".join(line)); line, cur = [ch], wc
            else:
                line.append(ch); cur += wc
        out.append("".join(line))
    return out or [""]


def render_edge(c: Cell, cells: dict) -> str:
    st = c.style
    color = st.get("strokeColor", SUBINK)
    if color in ("none", "inherit", ""):
        color = SUBINK
    # endpoints — an explicit fixed sourcePoint/targetPoint (draw.io keeps these
    # even when an end is also connected to a cell) wins; else clip to the cell.
    src = cells.get(c.source); tgt = cells.get(c.target)
    mids = c.waypoints
    if c.src_pt is not None:
        p0 = c.src_pt
    elif src:
        sx, sy = abs_pos(src, cells)
        toward = mids[0] if mids else ((abs_pos(tgt, cells)[0] + tgt.w / 2, abs_pos(tgt, cells)[1] + tgt.h / 2) if tgt else (sx, sy))
        p0 = rect_clip(sx, sy, src.w, src.h, *toward)
    else:
        p0 = (0, 0)
    if c.tgt_pt is not None:
        pN = c.tgt_pt
    elif tgt:
        tx, ty = abs_pos(tgt, cells)
        toward = mids[-1] if mids else ((abs_pos(src, cells)[0] + src.w / 2, abs_pos(src, cells)[1] + src.h / 2) if src else p0)
        pN = rect_clip(tx, ty, tgt.w, tgt.h, *toward)
    else:
        pN = (100, 100)
    pts = [p0, *mids, pN]
    dashed = "dashed" in st
    d = ' stroke-dasharray="6 4"' if dashed else ""
    path = " ".join(f"{'M' if i==0 else 'L'}{px:.1f} {py:.1f}" for i, (px, py) in enumerate(pts))
    out = [f'<path d="{path}" fill="none" stroke="{color}" stroke-width="1.3"{d}/>']
    end = st.get("endArrow", "classic")
    endfill = st.get("endFill", "1") != "0"
    if end == "block":
        out.append(arrowhead(pts[-2], pts[-1], "block", color, endfill))
    elif end in ("open", "openThin"):
        out.append(arrowhead(pts[-2], pts[-1], "open", color, False))
    elif end in ("none", ""):
        pass
    else:
        out.append(arrowhead(pts[-2], pts[-1], "block", color, endfill))
    start = st.get("startArrow", "none")
    if start.startswith("diamond"):
        out.append(diamond(pts[0], pts[1], st.get("startFill", "0") != "0", color))
    # main label
    if c.value:
        mx, my = poly_point(pts, 0.5)
        lines = c.value.split("\n")
        bw = max(len(_disp(l)) for l in lines) * 11 * 0.62 + 8
        bh = len(lines) * 15 + 2
        out.append(f'<rect x="{mx-bw/2:.1f}" y="{my-bh/2:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{WHITE}" opacity="0.85" rx="3"/>')
        for i, ln in enumerate(lines):
            out.append(txt(mx, my - bh / 2 + 12 + i * 15, ln, size=11, fill=st.get("fontColor", SUBINK)))
    return "".join(out), pts


def _disp(s):
    return "".join("xx" if ord(c) > 0x2E7F else "x" for c in s)


def to_svg(path: Path) -> str:
    w, h, cells, order = load(path)
    body = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" font-family="{FONT}">',
            f'<rect width="{w}" height="{h}" fill="{WHITE}"/>']
    edge_pts = {}
    # vertices (non edge-label) in document order
    for c in order:
        if c.is_vertex and "edgeLabel" not in c.style and c.id not in ("0", "1"):
            body.append(render_vertex(c, cells))
    # edges
    for c in order:
        if c.is_edge:
            svg, pts = render_edge(c, cells)
            body.append(svg); edge_pts[c.id] = pts
    # edge labels (children of edges)
    for c in order:
        if c.is_vertex and "edgeLabel" in c.style and c.value:
            pts = edge_pts.get(c.parent)
            if not pts:
                continue
            rel = _f(c.rel_x, 0)
            frac = min(max((rel + 1) / 2, 0), 1)
            lx, ly = poly_point(pts, frac)
            lx += c.offset[0]; ly += c.offset[1]
            bw = len(c.value) * 9 + 6
            body.append(f'<rect x="{lx-bw/2:.1f}" y="{ly-9:.1f}" width="{bw:.1f}" height="16" fill="{WHITE}" opacity="0.9" rx="2"/>')
            body.append(txt(lx, ly + 3, c.value, size=11, fill=c.style.get("fontColor", SUBINK)))
    body.append("</svg>")
    return "\n".join(body)


def render(drawio_path, png_path=None, scale=2.0):
    drawio_path = Path(drawio_path)
    svg = to_svg(drawio_path)
    svg_path = drawio_path.with_suffix(".svg")
    svg_path.write_text(svg, encoding="utf-8")
    png_path = Path(png_path) if png_path else drawio_path.with_suffix(".png")
    import cairosvg
    cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), scale=scale)
    return png_path


if __name__ == "__main__":
    for p in sys.argv[1:]:
        out = render(p)
        print("rendered", out)
