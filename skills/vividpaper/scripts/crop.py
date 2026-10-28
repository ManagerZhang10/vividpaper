#!/usr/bin/env python3
"""Cut one figure out of the PDF as a sharp PNG, and help you read coordinates.

    crop.py <paper.pdf> <page> --fig N           -o figures/<name>.png   # 自动：找 "Figure N" 标题上方紧挨着的图
    crop.py <paper.pdf> <page> --box x0 y0 x1 y1 -o figures/<name>.png   # 手动：0~1 的页面比例坐标
    crop.py <paper.pdf> <page> --page-grid                               # 整页叠 0.05 网格，用来估 --box

Every crop also writes <figures 的上一级>/_grid/<name>.png: the crop with a 0.1 grid,
for reading the 0..1 figure coordinates that F.box() / F.at() take.
Resolution is picked automatically (output ≥ 1400 px wide, at most 600 dpi); --dpi overrides.
Always open the result and check it: auto mode is a heuristic.
"""
import argparse, re, sys
from pathlib import Path

try:
    import pymupdf
except ImportError:
    sys.exit("需要 PyMuPDF：pip install pymupdf")


def column_of(page, cap):
    """x-range of the column the caption sits in (whole page when the caption spans both columns)."""
    W = page.rect.width
    mid = W / 2
    if cap.width > 0.55 * W or (cap.x0 < mid - 10 and cap.x1 > mid + 10):   # wide, or a short caption centred on the page
        return 0, W
    return (0, mid + 4) if cap.x0 + cap.width / 2 < mid else (mid - 4, W)


def auto_rect(page, n):
    cap = None
    for b in page.get_text("blocks"):
        if re.match(rf"^\s*(Figure|Fig\.)\s*{n}\s*[:.]", b[4]):
            cap = pymupdf.Rect(b[:4])
            break
    if cap is None:
        sys.exit(f"第 {page.number + 1} 页找不到 Figure {n} 的标题，改用 --box（先 --page-grid 看坐标）")
    cx0, cx1 = column_of(page, cap)
    # drop only what lies entirely in the other column; a figure may still spill across the gutter
    inside = lambda r: min(r.x1, cx1) - max(r.x0, cx0) >= 0.5 * max(r.width, 1)
    blocks = [(pymupdf.Rect(b[:4]), b[4]) for b in page.get_text("blocks")]
    # ceiling: the page header, and the nearest caption or body paragraph above this caption in the same column
    ceil = 0.072 * page.rect.height
    for r, t in blocks:
        if r.y1 <= cap.y0 - 1 and inside(r) and (re.match(r"^\s*(Figure|Fig\.|Table|Algorithm)\s*\d", t) or (len(t) > 250 and r.width > 0.8 * (cx1 - cx0))):
            ceil = max(ceil, r.y1)
    ok = lambda r: inside(r) and r.y0 >= ceil - 1 and r.y1 <= cap.y0 + 1
    graphics = [pymupdf.Rect(d["rect"]) for d in page.get_drawings()] + [pymupdf.Rect(i["bbox"]) for i in page.get_image_info()]
    graphics = [r for r in graphics if r.width > 1 and r.height > 1 and ok(r)]
    texts = [r for r, t in blocks if r.y1 <= cap.y0 - 1 and ok(r)]
    # grow upward from the caption: only graphics that touch the current figure band, so a second figure above is not swallowed
    near = [r for r in graphics if cap.y0 - r.y1 < 30]
    if not near:
        sys.exit("标题正上方没有图形元素（可能是位图贴在别处或图在标题下方），改用 --box（先 --page-grid 看坐标）")
    box = pymupdf.Rect(near[0])
    for r in near[1:]:
        box |= r
    grew = True
    while grew:
        grew = False
        for r in graphics:
            if r not in box and r.y1 >= box.y0 - 12 and r.y0 < box.y0:
                box |= r
                grew = True
    # labels inside or just around the figure band (axis labels, sub-figure titles), never the caption
    for _ in range(2):
        for r in texts:
            if r.y1 >= box.y0 - 14 and r.y0 <= box.y1 and r.height < 40:
                box |= r
    box.y1 = min(box.y1, cap.y0 - 2)
    return box + (-5, -5, 5, 3)


def grid(png_path, out, step, label=True):
    """Draw a labelled grid over an image (Pillow if present, else PyMuPDF)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None
    im = Image.open(png_path).convert("RGB")
    d = ImageDraw.Draw(im)
    W, H = im.size
    k = 0.0
    while k <= 1.0001:
        x, y = round(k * (W - 1)), round(k * (H - 1))
        major = abs(k * 10 - round(k * 10)) < 1e-6
        col = (255, 60, 0) if major else (255, 170, 120)
        d.line([(x, 0), (x, H)], fill=col, width=2 if major else 1)
        d.line([(0, y), (W, y)], fill=col, width=2 if major else 1)
        if label and major:
            d.text((x + 3, 3), f"{k:.1f}", fill=(220, 0, 0))
            d.text((3, y + 3), f"{k:.1f}", fill=(220, 0, 0))
        k += step
    im.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("page", type=int, help="页码，从 1 开始")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--fig", type=int)
    g.add_argument("--box", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"))
    g.add_argument("--page-grid", action="store_true")
    ap.add_argument("-o", "--out")
    ap.add_argument("--dpi", type=int)
    a = ap.parse_args()

    doc = pymupdf.open(a.pdf)
    page = doc[a.page - 1]
    W, H = page.rect.width, page.rect.height

    if a.page_grid:
        out = Path(a.pdf).parent / "pages" / f"p{a.page:02d}_grid.png"
        tmp = out.with_suffix(".tmp.png")
        page.get_pixmap(dpi=130).save(tmp)
        grid(tmp, out, 0.05)
        tmp.unlink()
        print(f"✓ {out.resolve()}  （粗线每 0.1，细线每 0.05，读数直接填 --box）")
        return
    if not a.out:
        sys.exit("要用 -o 指定输出文件")

    rect = auto_rect(page, a.fig) if a.fig else pymupdf.Rect(a.box[0] * W, a.box[1] * H, a.box[2] * W, a.box[3] * H)
    rect &= page.rect
    dpi = a.dpi or max(150, min(600, round(1400 / (rect.width / 72))))
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    pix = page.get_pixmap(dpi=dpi, clip=rect)
    pix.save(out)
    gp = grid(out, out.parent.parent / "_grid" / out.name, 0.1)
    print(f"✓ {out}  {pix.width}×{pix.height} @ {dpi}dpi  box=({rect.x0/W:.3f} {rect.y0/H:.3f} {rect.x1/W:.3f} {rect.y1/H:.3f})")
    if gp:
        print(f"  网格预览（读 F.box 坐标用）：{gp.resolve()}")


if __name__ == "__main__":
    main()
