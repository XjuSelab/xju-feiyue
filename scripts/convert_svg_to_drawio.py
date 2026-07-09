from __future__ import annotations

import re
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


NS = {"svg": "http://www.w3.org/2000/svg"}


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def num(value: str | None, default: float = 0.0) -> float:
    if value is None:
        return default
    match = re.search(r"[-+]?\d*\.?\d+", str(value))
    return float(match.group(0)) if match else default


def parse_style_attr(style: str | None) -> dict[str, str]:
    result: dict[str, str] = {}
    if not style:
        return result
    for part in style.split(";"):
        if ":" in part:
            key, value = part.split(":", 1)
            result[key.strip()] = value.strip()
    return result


def merged_attrs(parent: dict[str, str], elem: ET.Element) -> dict[str, str]:
    attrs = dict(parent)
    attrs.update(parse_style_attr(elem.attrib.get("style")))
    for key, value in elem.attrib.items():
        if key != "style":
            attrs[key] = value
    return attrs


def extract_svg_size(root: ET.Element) -> tuple[float, float]:
    width = num(root.attrib.get("width"), 0)
    height = num(root.attrib.get("height"), 0)
    if not width or not height:
        view_box = root.attrib.get("viewBox", "")
        parts = [float(x) for x in re.split(r"[\s,]+", view_box.strip()) if x]
        if len(parts) == 4:
            width = width or parts[2]
            height = height or parts[3]
    return max(width or 800, 1), max(height or 600, 1)


def drawio_color(value: str | None, default: str = "none") -> str:
    if not value:
        return default
    value = value.strip()
    if value == "none":
        return "none"
    return value


def stroke_width(attrs: dict[str, str], default: str = "1") -> str:
    return str(num(attrs.get("stroke-width"), num(default)))


def base_shape_style(attrs: dict[str, str]) -> str:
    fill = drawio_color(attrs.get("fill"), "none")
    stroke = drawio_color(attrs.get("stroke"), "none")
    style = [
        "whiteSpace=wrap",
        "html=1",
        f"fillColor={fill}",
        f"strokeColor={stroke}",
        f"strokeWidth={stroke_width(attrs)}",
    ]
    if attrs.get("stroke-dasharray"):
        style.append("dashed=1")
    return ";".join(style) + ";"


def text_content(elem: ET.Element) -> str:
    parts: list[str] = []
    if elem.text and elem.text.strip():
        parts.append(elem.text.strip())
    for child in elem:
        if local_name(child.tag) == "tspan":
            if parts:
                parts.append("<br>")
            if child.text:
                parts.append(child.text.strip())
        if child.tail and child.tail.strip():
            parts.append(child.tail.strip())
    return "".join(parts)


def add_mx_cell(root: ET.Element, *, value: str = "", style: str, vertex: bool = True, edge: bool = False) -> ET.Element:
    cell = ET.SubElement(root, "mxCell")
    cell.set("id", "cell-" + uuid.uuid4().hex[:12])
    cell.set("value", value)
    cell.set("style", style)
    cell.set("parent", "1")
    if vertex:
        cell.set("vertex", "1")
    if edge:
        cell.set("edge", "1")
    return cell


def add_geometry(cell: ET.Element, x: float, y: float, width: float, height: float) -> None:
    geo = ET.SubElement(cell, "mxGeometry")
    geo.set("x", f"{x:.2f}")
    geo.set("y", f"{y:.2f}")
    geo.set("width", f"{width:.2f}")
    geo.set("height", f"{height:.2f}")
    geo.set("as", "geometry")


def add_edge_geometry(cell: ET.Element, points: list[tuple[float, float]]) -> None:
    geo = ET.SubElement(cell, "mxGeometry")
    geo.set("relative", "1")
    geo.set("as", "geometry")

    source = ET.SubElement(geo, "mxPoint")
    source.set("x", f"{points[0][0]:.2f}")
    source.set("y", f"{points[0][1]:.2f}")
    source.set("as", "sourcePoint")

    target = ET.SubElement(geo, "mxPoint")
    target.set("x", f"{points[-1][0]:.2f}")
    target.set("y", f"{points[-1][1]:.2f}")
    target.set("as", "targetPoint")

    if len(points) > 2:
        arr = ET.SubElement(geo, "Array")
        arr.set("as", "points")
        for x, y in points[1:-1]:
            p = ET.SubElement(arr, "mxPoint")
            p.set("x", f"{x:.2f}")
            p.set("y", f"{y:.2f}")


def edge_style(attrs: dict[str, str]) -> str:
    stroke = drawio_color(attrs.get("stroke"), "#1a1a1a")
    style = [
        "endArrow=none",
        "html=1",
        "rounded=0",
        f"strokeColor={stroke}",
        f"strokeWidth={stroke_width(attrs)}",
    ]
    if attrs.get("marker-end"):
        style[0] = "endArrow=block"
    if attrs.get("marker-start"):
        style.append("startArrow=block")
    if attrs.get("stroke-dasharray"):
        style.append("dashed=1")
    return ";".join(style) + ";"


def parse_path_points(d: str) -> list[tuple[float, float]]:
    tokens = re.findall(r"[MmLlHhVvAaZz]|[-+]?\d*\.?\d+(?:e[-+]?\d+)?", d)
    points: list[tuple[float, float]] = []
    cmd = ""
    i = 0
    x = y = 0.0

    def is_cmd(token: str) -> bool:
        return bool(re.fullmatch(r"[A-Za-z]", token))

    while i < len(tokens):
        if is_cmd(tokens[i]):
            cmd = tokens[i]
            i += 1
        if not cmd or i >= len(tokens):
            break

        absolute = cmd.isupper()
        c = cmd.upper()

        try:
            if c in {"M", "L"}:
                x2 = float(tokens[i])
                y2 = float(tokens[i + 1])
                i += 2
                if not absolute:
                    x2 += x
                    y2 += y
                x, y = x2, y2
                points.append((x, y))
                if c == "M":
                    cmd = "L" if absolute else "l"
            elif c == "H":
                x2 = float(tokens[i])
                i += 1
                if not absolute:
                    x2 += x
                x = x2
                points.append((x, y))
            elif c == "V":
                y2 = float(tokens[i])
                i += 1
                if not absolute:
                    y2 += y
                y = y2
                points.append((x, y))
            elif c == "A":
                # SVG arc: rx ry rotation large-arc sweep x y. draw.io native edge cannot
                # represent it exactly here, so keep the editable endpoint as a connector.
                x2 = float(tokens[i + 5])
                y2 = float(tokens[i + 6])
                i += 7
                if not absolute:
                    x2 += x
                    y2 += y
                x, y = x2, y2
                points.append((x, y))
            elif c == "Z":
                i += 1
            else:
                i += 1
        except (IndexError, ValueError):
            break

    # De-duplicate consecutive points.
    cleaned: list[tuple[float, float]] = []
    for point in points:
        if not cleaned or point != cleaned[-1]:
            cleaned.append(point)
    return cleaned


def convert_rect(mx_root: ET.Element, attrs: dict[str, str]) -> None:
    raw_width = attrs.get("width")
    raw_height = attrs.get("height")
    if raw_width == "100%" and raw_height == "100%":
        return

    x = num(attrs.get("x"))
    y = num(attrs.get("y"))
    width = num(raw_width)
    height = num(raw_height)
    if width <= 0 or height <= 0:
        return

    style = base_shape_style(attrs)
    if num(attrs.get("rx")) or num(attrs.get("ry")):
        style += "rounded=1;arcSize=10;"
    cell = add_mx_cell(mx_root, style=style)
    add_geometry(cell, x, y, width, height)


def convert_ellipse(mx_root: ET.Element, attrs: dict[str, str], is_circle: bool = False) -> None:
    cx = num(attrs.get("cx"))
    cy = num(attrs.get("cy"))
    rx = num(attrs.get("r")) if is_circle else num(attrs.get("rx"))
    ry = num(attrs.get("r")) if is_circle else num(attrs.get("ry"))
    if rx <= 0 or ry <= 0:
        return

    style = "ellipse;" + base_shape_style(attrs)
    cell = add_mx_cell(mx_root, style=style)
    add_geometry(cell, cx - rx, cy - ry, rx * 2, ry * 2)


def convert_line(mx_root: ET.Element, attrs: dict[str, str]) -> None:
    points = [
        (num(attrs.get("x1")), num(attrs.get("y1"))),
        (num(attrs.get("x2")), num(attrs.get("y2"))),
    ]
    cell = add_mx_cell(mx_root, style=edge_style(attrs), vertex=False, edge=True)
    add_edge_geometry(cell, points)


def convert_path(mx_root: ET.Element, attrs: dict[str, str]) -> None:
    d = attrs.get("d", "")
    points = parse_path_points(d)
    if len(points) < 2:
        return

    cell = add_mx_cell(mx_root, style=edge_style(attrs), vertex=False, edge=True)
    add_edge_geometry(cell, points)


def convert_text(mx_root: ET.Element, elem: ET.Element, attrs: dict[str, str]) -> None:
    value = text_content(elem)
    if not value:
        return

    x = num(attrs.get("x"))
    y = num(attrs.get("y"))
    font_size = num(attrs.get("font-size"), 14)
    anchor = attrs.get("text-anchor", "start")
    lines = value.replace("<br>", "\n").splitlines() or [value]
    visual_len = max(sum(2 if ord(ch) > 127 else 1 for ch in line) for line in lines)
    width = max(40, visual_len * font_size * 0.55 + 12)
    height = max(font_size + 8, len(lines) * (font_size + 4) + 4)

    if anchor == "middle":
        draw_x = x - width / 2
        align = "center"
    elif anchor == "end":
        draw_x = x - width
        align = "right"
    else:
        draw_x = x
        align = "left"
    draw_y = y - font_size

    color = drawio_color(attrs.get("fill"), "#1a1a1a")
    weight = "1" if attrs.get("font-weight") == "bold" else "0"
    style = (
        "text;html=1;strokeColor=none;fillColor=none;"
        f"fontSize={font_size:.0f};fontColor={color};fontStyle={weight};"
        f"align={align};verticalAlign=middle;whiteSpace=wrap;rounded=0;"
    )
    cell = add_mx_cell(mx_root, value=value, style=style)
    add_geometry(cell, draw_x, draw_y, width, height)


def traverse(elem: ET.Element, inherited: dict[str, str], mx_root: ET.Element) -> None:
    tag = local_name(elem.tag)
    attrs = merged_attrs(inherited, elem)

    if tag in {"defs", "marker"}:
        return

    if tag == "rect":
        convert_rect(mx_root, attrs)
    elif tag == "ellipse":
        convert_ellipse(mx_root, attrs)
    elif tag == "circle":
        convert_ellipse(mx_root, attrs, is_circle=True)
    elif tag == "line":
        convert_line(mx_root, attrs)
    elif tag == "path":
        # Ignore marker arrowhead definition paths by skipping defs above.
        convert_path(mx_root, attrs)
    elif tag == "text":
        convert_text(mx_root, elem, attrs)

    for child in elem:
        if tag == "text":
            continue
        traverse(child, attrs, mx_root)


def svg_to_drawio(svg_path: Path) -> Path:
    svg_root = ET.parse(svg_path).getroot()
    width, height = extract_svg_size(svg_root)

    mxfile = ET.Element("mxfile")
    mxfile.set("host", "app.diagrams.net")
    mxfile.set("modified", datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"))
    mxfile.set("agent", "Cline editable SVG converter")
    mxfile.set("version", "24.7.17")
    mxfile.set("type", "device")

    diagram = ET.SubElement(mxfile, "diagram")
    diagram.set("id", uuid.uuid4().hex[:12])
    diagram.set("name", "Page-1")

    model = ET.SubElement(diagram, "mxGraphModel")
    model.set("dx", "1422")
    model.set("dy", "794")
    model.set("grid", "1")
    model.set("gridSize", "10")
    model.set("guides", "1")
    model.set("tooltips", "1")
    model.set("connect", "1")
    model.set("arrows", "1")
    model.set("fold", "1")
    model.set("page", "1")
    model.set("pageScale", "1")
    model.set("pageWidth", str(int(max(width + 40, 850))))
    model.set("pageHeight", str(int(max(height + 40, 1100))))
    model.set("math", "0")
    model.set("shadow", "0")

    mx_root = ET.SubElement(model, "root")
    ET.SubElement(mx_root, "mxCell", {"id": "0"})
    ET.SubElement(mx_root, "mxCell", {"id": "1", "parent": "0"})

    traverse(svg_root, {}, mx_root)

    ET.indent(mxfile, space="  ")
    out_path = svg_path.with_suffix(".drawio")
    ET.ElementTree(mxfile).write(out_path, encoding="utf-8", xml_declaration=True)
    return out_path


def count_editable_cells(drawio_path: Path) -> int:
    root = ET.parse(drawio_path).getroot()
    return sum(1 for cell in root.iter("mxCell") if cell.get("vertex") == "1" or cell.get("edge") == "1")


def main() -> None:
    figures_dir = Path("docs/coursework/figures")
    svg_files = sorted(figures_dir.glob("*.svg"))
    if not svg_files:
        raise SystemExit(f"No SVG files found in {figures_dir}")

    print(f"Found {len(svg_files)} SVG files in {figures_dir}")
    for svg_path in svg_files:
        out_path = svg_to_drawio(svg_path)
        print(f"Generated {out_path} ({count_editable_cells(out_path)} editable cells)")


if __name__ == "__main__":
    main()