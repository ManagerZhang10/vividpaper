#!/usr/bin/env python3
"""Prototype self-check for a HyperFrames-based VividPaper film.

    vp_hf_check.py <film dir> [--html out/<name>.html] [--hf <hyperframes package dir>] [--cols 6] [--no-length]

Three passes, one report in VividPaper's words:
  1. the packaged page with ?audit (headless Chrome --dump-dom, like check.py): pm.js's checks measured on the DOM —
     这句画面不动 / 画面静止 / 出界 / 字太小 / 压字幕 / 文字重叠 / 字幕太长;
  2. `hyperframes check --json` on the project with the caption band as --caption-zone: lint, runtime errors and failed
     requests, layout (overflow, overlap, caption band), contrast, dead stretches; findings are mapped to the same kinds;
  3. `hyperframes snapshot --at <every caption end>` → <name>_sheet.png next to the page (one cell per caption line).
Plus the timeline checks done here: 总长, 配音 (a line with no clip in a voiced film).
"""
import argparse, html, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "skills/vividpaper/scripts"))
from check import chrome   # noqa: E402

KIND = {   # hyperframes check code → VividPaper kind (None: report as-is under 「HF」)
    "caption_zone_collision": "压字幕", "content_overlap": "文字重叠", "text_overflow": "出界", "canvas_overflow": "出界",
    "text_clipped": "出界", "panel_out_of_canvas": "出界", "dead_stretch": "画面静止", "sweep_static": "画面静止",
    "motion_frozen": "画面静止", "first_frame_empty": "开场不动",
}


def hf_env():
    return {**os.environ, "HYPERFRAMES_NO_TELEMETRY": "1", "DO_NOT_TRACK": "1", "HYPERFRAMES_NO_UPDATE_CHECK": "1",
            "HYPERFRAMES_SKIP_SKILLS": "1", "HYPERFRAMES_NO_AUTO_INSTALL": "1", "HYPERFRAMES_NO_OPTIONAL_INSTALL": "1",
            "CI": "1"}   # without a TTY, `check` otherwise leaves a detached warm Chrome running for 5 minutes


def dom_audit(page):
    r = subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                        "--virtual-time-budget=120000", "--dump-dom", page.resolve().as_uri() + "?audit=1"], capture_output=True, text=True, timeout=600)
    m = re.search(r'<pre id="vp-audit">(.*?)</pre>', r.stdout, re.S)
    if not m:
        err = [e for e in re.findall(r'<pre style="color:#FF4B4B[^>]*>(.*?)</pre>', r.stdout, re.S) if "e.message" not in e]
        sys.exit("自查没跑出结果：" + (html.unescape(err[-1]) if err else r.stderr[-800:]))
    return json.loads(html.unescape(m.group(1)))


def hf_check(d, hf):
    cli = Path(hf) / "bin/hyperframes.mjs"
    r = subprocess.run(["node", str(cli), "check", str(d), "--json", "--caption-zone", f"x0=0;y0={1190 / 1440:.4f};x1=1;y1=1;severity=error"],
                       capture_output=True, text=True, env=hf_env(), timeout=900)
    try:
        rep = json.loads(r.stdout)
    except json.JSONDecodeError:
        return [{"t": 0, "scene": "film", "kind": "报错", "msg": "hyperframes check 没有输出 JSON：" + r.stderr[-300:]}], None
    out = []
    for sec in ("lint", "runtime", "layout", "motion", "contrast", "craft", "audio"):
        for f in (rep.get(sec) or {}).get("findings", []):
            code, sev = f.get("code", ""), f.get("severity", "")
            if code == "text_below_floor":   # HyperFrames' floor is 28 px; VividPaper's is 22 (pass 1 checks that)
                continue
            if sev not in ("error", "warning"):
                continue
            kind = KIND.get(code) or ("报错" if sec in ("lint", "runtime") else f"HF {code}")
            out.append({"t": f.get("time") or 0, "scene": f.get("sourceFile", ""), "kind": kind, "msg": f.get("message", "")[:160]})
    return out, rep


def sheet(d, hf, shots, out_png, cols):
    tmp = Path(tempfile.mkdtemp(prefix="vp_sheet_"))
    try:
        cli = Path(hf) / "bin/hyperframes.mjs"
        r = subprocess.run(["node", str(cli), "snapshot", str(d), "--at", ",".join(str(t) for t, _ in shots), "--output", str(tmp), "--no-end"],
                           capture_output=True, text=True, env=hf_env(), timeout=900)
        pngs = sorted(tmp.glob("*.png"))
        if len(pngs) < len(shots):
            print(f"⚠ snapshot 只出了 {len(pngs)}/{len(shots)} 张：{r.stderr[-300:]}")
            return
        def sec(p):
            m = re.search(r"(\d+(?:\.\d+)?)s", p.stem)
            return float(m.group(1)) if m else 0.0
        pngs.sort(key=sec)
        cw, ch = 270, 360
        cells = "".join(f'<div class="c"><b>{lab}  {t:.1f}s</b><img src="{p.as_uri()}"></div>' for (t, lab), p in zip(shots, pngs))
        rows = (len(shots) + cols - 1) // cols
        grid = tmp / "grid.html"
        grid.write_text(f"""<!doctype html><meta charset="utf-8"><style>body{{margin:0;background:#000;width:{cols * cw}px}}
.c{{float:left;width:{cw}px;height:{ch + 34}px}}b{{display:block;height:34px;line-height:34px;color:#ddd;font:600 20px -apple-system,"PingFang SC",sans-serif;padding-left:8px}}
img{{width:{cw - 4}px;height:{ch - 4}px;display:block}}</style>{cells}""", encoding="utf-8")
        subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                        f"--window-size={cols * cw},{rows * (ch + 34)}", f"--screenshot={out_png}", grid.as_uri()], capture_output=True, timeout=120)
        print(f"关键帧总览：{out_png}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--html")
    ap.add_argument("--hf", default=os.environ.get("VP_HF_PKG"))
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--no-length", action="store_true", help="不查总长（原型只有两幕）")
    a = ap.parse_args()
    d = Path(a.dir).resolve()
    page = Path(a.html) if a.html else d.parent / "out" / f"{d.name}.html"
    T = json.loads(re.search(r"window\.VP_TIMING = (\{.*?\});\n", (d / "assets/vp/timing.js").read_text(encoding="utf-8")).group(1))

    res = dom_audit(page)
    warns = res["warnings"]
    if a.hf:
        hw, rep = hf_check(d, hf=a.hf)
        warns += hw
        if rep:
            print(f"hyperframes check：lint {rep['lint']['errorCount']} 错 · layout {rep['layout']['errorCount']} 错 {rep['layout']['warningCount']} 警告"
                  f" · 对比度 {rep['contrast'].get('passed', 0)}/{rep['contrast'].get('checked', 0)} · craft 警告 {rep['craft']['warningCount']}")
        sheet(d, a.hf, res["shots"], page.with_name(page.stem + "_sheet.png"), a.cols)
    if not a.no_length:
        if T["total"] < 140:
            warns.append({"t": 0, "scene": "film", "kind": "总长", "msg": f"只有 {T['total']:.0f} 秒，目标 150–210 秒"})
        if T["total"] > 240:
            warns.append({"t": 0, "scene": "film", "kind": "总长", "msg": f"有 {T['total']:.0f} 秒，超过 4 分钟"})
    if T.get("voice"):
        voiced = {v["say"] for v in T["voice"]}
        n_lines = sum(len(s["lines"]) for s in T["scenes"])
        if len(voiced) < n_lines:
            warns.append({"t": 0, "scene": "film", "kind": "配音", "msg": f"{n_lines - len(voiced)} 句没有配音：改过字幕就重跑 voice.py"})

    print(f"总长 {int(T['total'] // 60)}:{int(T['total'] % 60):02d}（{T['total']:.1f} 秒）· {len(T['scenes']) - 1} 幕" + (f" · 配音 {len(T['voice'])} 句" if T.get("voice") else ""))
    for s in T["scenes"]:
        print(f"  {s['t0']:6.1f}s  {s['dur']:5.1f}s  {s['id']:<8} {s['name']}")
    if not warns:
        print("✓ 没有问题")
        return
    print(f"✗ {len(warns)} 个问题：")
    for x in warns:
        print(f"  {x['t']:6.1f}s  [{x['kind']}] {x['scene']}: {x['msg']}")
    sys.exit(1)


if __name__ == "__main__":
    main()
