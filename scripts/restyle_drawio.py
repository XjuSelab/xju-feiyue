"""restyle_drawio — enforce the coursework figure spec on a .drawio in place.

Rules (per 赵文彪 2026-07 规范):
* 纯黑白线稿: every fill -> white (except pure-black solid marks like initial/
  final states & activation bars, and transparent 'none'); every stroke/font
  -> black; drop gradients.
* 页宽统一 2000 + 字号统一 fontSize=34: scale ALL geometry so pageWidth==2000,
  then force every fontSize to 34 (so text lands ~7pt when the PNG is inserted
  at 14.66 cm in Word).

Usage:  python restyle_drawio.py TARGET_WIDTH file1.drawio [file2.drawio ...]
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

BLACK = "#000000"
WHITE = "#ffffff"
FONT = 34


def _bw_style(style: str) -> str:
    """Force a draw.io style string to pure black/white line art."""
    if not style:
        return style
    out = []
    for tok in style.split(";"):
        if not tok:
            continue
        if "=" not in tok:
            out.append(tok)  # bare flag e.g. 'swimlane' / 'ellipse' / 'rounded'
            continue
        k, v = tok.split("=", 1)
        if k == "fillColor":
            # keep transparency and solid-black marks; everything else -> white
            v = v if v.lower() in ("none", BLACK, "#000") else WHITE
        elif k in ("strokeColor", "fontColor"):
            v = v if v.lower() == "none" else BLACK
        elif k in ("gradientColor", "swimlaneFillColor"):
            continue  # drop
        elif k == "fontSize":
            v = str(FONT)
        out.append(f"{k}={v}")
    return ";".join(out) + ";"


def _scale_attrs(el: ET.Element, s: float) -> None:
    for a in ("x", "y", "width", "height"):
        if a in el.attrib:
            try:
                el.attrib[a] = str(int(round(float(el.attrib[a]) * s)))
            except ValueError:
                pass


def restyle(path: Path, target_w: int) -> None:
    # draw.io files are single-root <mxfile>; parse straight.
    tree = ET.parse(path)
    root = tree.getroot()
    model = root.find(".//mxGraphModel")
    if model is None:
        return
    pw = float(model.attrib.get("pageWidth", target_w))
    # Scale geometry by at least FONT/12 so boxes (sized for the ~12px design
    # font) grow in step with the forced 34px text — otherwise text overflows.
    # For sparse figures 2000/pw wins, landing them at the target 2000 width
    # (~7pt at 14.66cm); dense figures render wider with proportionally smaller
    # printed text, but never overflow their boxes.
    s = max(target_w / pw, FONT / 12.0) if pw else FONT / 12.0
    model.attrib["pageWidth"] = str(int(round(pw * s)))
    if "pageHeight" in model.attrib:
        model.attrib["pageHeight"] = str(int(round(float(model.attrib["pageHeight"]) * s)))

    for cell in model.iter("mxCell"):
        if "style" in cell.attrib:
            cell.attrib["style"] = _bw_style(cell.attrib["style"])
    for geo in model.iter("mxGeometry"):
        # Relative geometry (edges + edge labels): x/y are a fraction in [-1,1]
        # along the edge, NOT absolute pixels — scaling them flings multiplicity
        # labels off the line. Only the absolute mxPoints inside get scaled below.
        if geo.get("relative") == "1":
            continue
        _scale_attrs(geo, s)
    for pt in model.iter("mxPoint"):
        _scale_attrs(pt, s)

    tree.write(path, encoding="utf-8", xml_declaration=False)


def main() -> None:
    target_w = int(sys.argv[1])
    for f in sys.argv[2:]:
        restyle(Path(f), target_w)
        print("restyled", Path(f).name)


if __name__ == "__main__":
    main()
