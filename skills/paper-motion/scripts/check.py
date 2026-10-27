#!/usr/bin/env python3
"""Self-check a built film in headless Chrome: one pass, no screen recording.

    check.py <film.html> [--at 12.5,40] [--cols 6]

Writes next to the html:
  <name>_sheet.png     contact sheet: one cell per caption line, at the moment the line finishes
  _frames/<name>_t<sec>.png  full-size frames for --at (scratch, not part of the film)
  <name>_audit.json    timeline + warnings
Prints the warnings. Exit code 1 when there are any, so you fix them before handing over.
Kinds: 报错 / 出界 / 字太小 / 压字幕 / 文字重叠 / 字幕太长 / 这句画面不动 / 画面静止 / 总长.
"""
import argparse, base64, html, json, os, re, shutil, subprocess, sys
from pathlib import Path

CANDIDATES = [
    os.environ.get("CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which("google-chrome") or "", shutil.which("chromium") or "", shutil.which("chromium-browser") or "",
]


def chrome():
    for c in CANDIDATES:
        if c and Path(c).exists():
            return c
    sys.exit("找不到 Chrome：装 Google Chrome，或设环境变量 CHROME=<可执行文件路径>")


def save_png(data_url, path):
    path.write_bytes(base64.b64decode(data_url.split(",", 1)[1]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--at", default="", help="逗号分隔的秒数，额外导出这些时刻的整帧")
    ap.add_argument("--cols", type=int, default=6)
    a = ap.parse_args()

    f = Path(a.html).resolve()
    url = f.as_uri() + f"?audit=1&cols={a.cols}&at={a.at}"
    r = subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                        "--virtual-time-budget=60000", "--run-all-compositor-stages-before-draw", "--dump-dom", url],
                       capture_output=True, text=True, timeout=600)
    m = re.search(r'<pre id="pm-audit">(.*?)</pre>', r.stdout, re.S)
    if not m:
        err = re.search(r'<pre style="color:#FF4B4B[^>]*>(.*?)</pre>', r.stdout, re.S)
        sys.exit("自查没跑出结果：" + (html.unescape(err.group(1)) if err else r.stderr[-800:]))
    out = json.loads(html.unescape(m.group(1)))

    stem = f.with_suffix("")
    save_png(out.pop("sheet"), Path(f"{stem}_sheet.png"))
    frames = out.pop("frames")
    if frames:
        fd = f.parent / "_frames"
        fd.mkdir(exist_ok=True)
        for t, durl in frames.items():
            save_png(durl, fd / f"{f.stem}_t{t}.png")
        print(f"整帧：{fd.resolve()}/")
    Path(f"{stem}_audit.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    tot = out["total"]
    print(f"总长 {int(tot // 60)}:{int(tot % 60):02d}（{tot:.0f} 秒）· {len(out['scenes']) - 2} 幕")
    for s in out["scenes"]:
        print(f"  {s['t0']:6.1f}s  {s['dur']:5.1f}s  {s['id']:<10} {s['name']}")
    print(f"关键帧总览：{stem}_sheet.png")
    w = out["warnings"]
    if not w:
        print("✓ 没有问题")
        return
    print(f"✗ {len(w)} 个问题：")
    for x in w:
        print(f"  {x['t']:6.1f}s  [{x['kind']}] {x['scene']}: {x['msg']}")
    sys.exit(1)


if __name__ == "__main__":
    main()
