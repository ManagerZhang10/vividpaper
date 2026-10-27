#!/usr/bin/env python3
"""Pack film.js + figures/ + the engine into one self-contained HTML file.

    build.py <film dir> [-o out.html] [--open]

<film dir> must contain film.js; every image in <film dir>/figures/ is embedded and
available in draw() as g.img('<file name without extension>', ...).
"""
import argparse, base64, json, mimetypes, re, subprocess, sys
from pathlib import Path

ENGINE = Path(__file__).resolve().parent.parent / "engine"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("-o", "--out")
    ap.add_argument("--open", action="store_true")
    a = ap.parse_args()

    d = Path(a.dir)
    film = (d / "film.js").read_text(encoding="utf-8")
    assets = {}
    for f in sorted((d / "figures").glob("*")) if (d / "figures").is_dir() else []:
        mt = mimetypes.guess_type(f.name)[0]
        if mt and mt.startswith("image/") and not f.name.startswith("_"):
            assets[f.stem] = f"data:{mt};base64," + base64.b64encode(f.read_bytes()).decode()
    m = re.search(r"title:\s*['\"]([^'\"]+)['\"]", film)
    title = (m.group(1) if m else d.name) + " · 3 分钟动效解读 · 张指导出品"

    html = (ENGINE / "player.html").read_text(encoding="utf-8")
    for key, val in {
        "/*__ENGINE__*/": (ENGINE / "pm.js").read_text(encoding="utf-8"),
        "/*__ASSETS__*/": "window.PM_ASSETS = " + json.dumps(assets) + ";",
        "/*__FILM__*/": film,
    }.items():
        html = html.replace(key, val.replace("</script", "<\\/script"))
    html = html.replace("__TITLE__", title)

    out = Path(a.out or d / f"{d.name}.html")
    out.write_text(html, encoding="utf-8")
    print(f"✓ {out.resolve()}  {out.stat().st_size / 1e6:.1f} MB · {len(assets)} 张图")
    if a.open:
        subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", str(out)])


if __name__ == "__main__":
    main()
