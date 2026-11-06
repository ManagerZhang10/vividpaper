#!/usr/bin/env python3
"""Prototype: build a VividPaper film whose picture is a HyperFrames composition.

    vp_hf.py <film dir> [-o out.html] [--voice <voice dir>] [--mute] [--hf <hyperframes package dir>] [--fonts <dir>]

<film dir> is a HyperFrames project plus film.json:
  film.json             paper, brand, scenes[{id, name, lines}]: the captions, same fields as film.js
  compositions/<id>.html one HyperFrames scene per film.json scene, reading its line times from window.VP.scene(id)
  assets/film-lib.js    (optional) helpers shared by the scenes; assets/figures/ the paper's figures

It writes the generated part of the project, so `npx hyperframes render|check|snapshot <film dir>` work on it directly:
  index.html                   root: one host per scene at its start/length, the vp-chrome layer, one <audio> per voiced line
  assets/vp/timing.js          window.VP_TIMING (every scene's start/length and every caption's start/end) + window.VP helpers
  compositions/vp-chrome.html  captions, chapter header, brand, end card with the VividPaper credit (engine/vp-chrome.html)
  assets/vendor/gsap.min.js, assets/fonts/vp-sans.ttf (Noto Sans SC subset to the film's characters), assets/voice/*.mp3
Then it bundles the project with HyperFrames' own compiler (one HTML: runtime, GSAP, scenes, fonts, figures inlined) and
wraps that in the VividPaper player (engine/player-hf.html): one offline HTML file.

The timeline is computed here, not in the browser: line length = voice clip end + 0.4 s when the line has a clip
(voice.py output), else the pm.js estimate by character count. That table is the only thing the scenes read, so a
voiced build and a silent build of the same scenes differ only in timing.js and index.html.
"""
import argparse, base64, json, mimetypes, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = HERE / "engine"
GAP, OUTRO_DUR = 0.4, 4.4   # pm.js: gap after a voiced line; outro without recap = .6 + .6 + 3.2


def line_dur(s):
    t = s.replace("**", "")
    cjk = len(re.findall(r"[㐀-鿿]", t))
    words = len(re.findall(r"[A-Za-z0-9.√_]+", t))
    return max(2.4, 0.6 + 0.17 * cjk + 0.3 * words)


def spoken(film, q):
    """What voice.py reads for a line (pm.js spoken())."""
    if isinstance(q, dict) and q.get("say") is not None:
        return q["say"].strip()
    s = (q if isinstance(q, str) else q["text"]).replace("**", "")
    for a, b in (film.get("pronounce") or {}).items():
        s = s.replace(a, b)
    s = re.sub(r"[₀-₉]", lambda m: " " + str(ord(m.group()) - 0x2080), s)
    s = re.sub(r"([A-Za-z0-9Ͱ-Ͽ)²³ā])\s*−\s*", r"\1 减 ", s)
    s = s.replace("²", " 平方").replace("³", " 立方").replace("_", " ").replace("‖", "")
    s = re.sub(r"\s*→\s*", "，", s)
    return re.sub(r" {2,}", " ", s).strip()


def timeline(film, clips):
    scenes, voice, t = [], [], 0.0
    for i, s in enumerate(film["scenes"]):
        u, lines = s.get("lead", 0.5), []
        for l in s["lines"]:
            o = {"text": l} if isinstance(l, str) else l
            say = spoken(film, o)
            c = clips.get(say)
            d = max(o.get("dur", 0), c["end"] + GAP + o.get("hold", 0)) if c else (o.get("dur") or line_dur(o["text"]) + o.get("hold", 0))
            lines.append({"text": o["text"], "t0": round(u, 3), "t1": round(u + d, 3)})
            if c:
                voice.append({"scene": s["id"], "local": u, "say": say})
            u += d
        dur = u + s.get("tail", 0.8)
        scenes.append({"id": s["id"], "name": s["name"], "num": i + 1, "t0": round(t, 3), "dur": round(dur, 3), "lines": lines})
        t += dur
    scenes.append({"id": "outro", "name": "片尾", "builtin": "outro", "t0": round(t, 3), "dur": OUTRO_DUR, "lines": [], "endT": OUTRO_DUR - 3.0})
    t += OUTRO_DUR
    t0 = {s["id"]: s["t0"] for s in scenes}
    voice = [{"t": round(t0[v["scene"]] + v["local"], 3), "say": v["say"]} for v in voice]
    return {"paper": film.get("paper", {}), "brand": film.get("brand"), "scenes": scenes, "total": round(t, 3), "voice": voice}


def run_node(hf, *args):
    env = {**os.environ, "VP_HF_PKG": str(hf), "HYPERFRAMES_NO_TELEMETRY": "1", "DO_NOT_TRACK": "1", "HYPERFRAMES_NO_UPDATE_CHECK": "1"}
    r = subprocess.run(["node", str(HERE / "vp_hf_node.mjs"), *map(str, args)], capture_output=True, text=True, env=env)
    if r.returncode:
        sys.exit(f"node {args[0]} 失败：\n{r.stderr[-1500:]}")
    if r.stderr.strip():
        print(r.stderr.strip())
    return json.loads(r.stdout.strip().splitlines()[-1])


def film_text(d, film, tl):
    """Every character the film can show: captions, chapter names, the chrome's fixed strings, the scenes' own text, ASCII."""
    parts = [json.dumps(film, ensure_ascii=False), "本视频由开源工具 VividPaper 生成 ★ Star ManagerZhang10/vividpaper 0123456789",
             "".join(chr(c) for c in range(32, 127)), "，。、：；！？（）「」『』“”…—·→×÷√"]
    for f in list((d / "compositions").glob("*.html")) + list((d / "assets").glob("*.js")):
        parts.append(re.sub(r"<[^>]+>", " ", f.read_text(encoding="utf-8")))
    return "".join(sorted(set("".join(parts))))


def write_project(d, film, tl, clips, hf, fonts):
    (d / "assets/vp").mkdir(parents=True, exist_ok=True)
    (d / "assets/vendor").mkdir(parents=True, exist_ok=True)
    (d / "assets/fonts").mkdir(parents=True, exist_ok=True)
    shutil.copy(ENGINE / "vp-chrome.html", d / "compositions/vp-chrome.html")
    gsap = Path(hf).parent / "gsap/dist/gsap.min.js"
    if not gsap.exists():
        sys.exit(f"找不到 GSAP：{gsap}（npm install gsap@3.15.0 装在 hyperframes 旁边）")
    shutil.copy(gsap, d / "assets/vendor/gsap.min.js")
    (d / "assets/vp/timing.js").write_text(
        "// generated by vp_hf.py: when every scene and caption line starts and ends (seconds)\n"
        f"window.VP_TIMING = {json.dumps(tl, ensure_ascii=False)};\n"
        "window.VP = { scene(id) {\n"
        "  const s = window.VP_TIMING.scenes.find(x => x.id === id); if (!s) throw new Error(`VP_TIMING 里没有这一幕：${id}`);\n"
        "  const line = i => { if (!s.lines[i]) throw new Error(`L(${i}) 超出「${id}」的字幕条数 ${s.lines.length}`); return s.lines[i]; };\n"
        "  return { ...s, L: i => line(i).t0, Le: i => line(i).t1, at: (i, f) => line(i).t0 + (line(i).t1 - line(i).t0) * f };\n"
        "} };\n", encoding="utf-8")
    # fonts: subset a full Noto Sans SC (OFL) to the characters this film shows
    txt = d / "assets/vp/_chars.txt"
    txt.write_text(film_text(d, film, tl), encoding="utf-8")
    # fontkit only writes TrueType (glyf) subsets as whole fonts (a CFF/.otf source comes out as a bare CFF table that
    # Chrome rejects), so the source is a static TrueType Noto Sans SC; one weight, bold is synthesised by the browser
    r = run_node(hf, "subset", Path(fonts) / "NotoSansSC-Regular.ttf", txt, d / "assets/fonts/vp-sans.ttf")
    print(f"  字体：{r['glyphs']} 个字符 → {r['bytes'] / 1024:.0f} KB")
    txt.unlink()
    # voice clips used, copied in so `hyperframes render` mixes them
    vd = d / "assets/voice"
    if vd.exists():
        shutil.rmtree(vd)
    audio = []
    if tl["voice"]:
        vd.mkdir(parents=True)
        for k, v in enumerate(tl["voice"]):
            c = clips[v["say"]]
            shutil.copy(c["path"], vd / c["file"])
            audio.append(f'    <audio id="vo{k}" class="clip" src="assets/voice/{c["file"]}" data-start="{v["t"]}" data-track-index="{10 + k}" data-volume="1" data-vp-voice></audio>')
    hosts = []
    for s in tl["scenes"]:
        if s.get("builtin"):
            continue
        hosts.append(f'    <div id="{s["id"]}" class="clip" data-composition-id="{s["id"]}" data-composition-src="compositions/{s["id"]}.html" '
                     f'data-start="{s["t0"]}" data-duration="{s["dur"]}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1440" style="z-index:1"></div>')
    lib = '\n  <script src="assets/film-lib.js"></script>' if (d / "assets/film-lib.js").exists() else ""
    (d / "index.html").write_text(f"""<!doctype html>
<!-- generated by vp_hf.py from film.json + compositions/: edit those, not this file -->
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1080, height=1440">
  <script src="assets/vendor/gsap.min.js"></script>
  <script src="assets/vp/timing.js"></script>{lib}
  <style>
    @font-face {{ font-family: "VP Sans"; font-weight: 400; src: url("assets/fonts/vp-sans.ttf") format("truetype"); }}
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{ width: 1080px; height: 1440px; overflow: hidden; background: #0B0B0E; }}
    #root {{ position: relative; width: 1080px; height: 1440px; background: #0B0B0E; font-family: "VP Sans", sans-serif; }}
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="{tl['total']}" data-width="1080" data-height="1440">
{chr(10).join(hosts)}
    <div id="vpchrome" class="clip" data-composition-id="vpchrome" data-composition-src="compositions/vp-chrome.html" data-start="0" data-duration="{tl['total']}" data-track-index="2" data-track-kind="captions" data-width="1080" data-height="1440" style="z-index:50"></div>
{chr(10).join(audio)}
  </div>
  <script>
    window.__timelines = window.__timelines || {{}};
    window.__timelines["main"] = gsap.timeline({{ paused: true }});
  </script>
</body>
</html>
""", encoding="utf-8")


def js_string(s):
    """A JS string literal that is safe inside <script> (no </script>, no <!--)."""
    return json.dumps(s).replace("</", "<\\/").replace("<!--", "<\\u0021--")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("-o", "--out")
    ap.add_argument("--voice", help="voice.py 的输出目录（含 voice.json）；默认 <film dir>/voice")
    ap.add_argument("--mute", action="store_true", help="不用配音：按字数估时长")
    ap.add_argument("--hf", default=os.environ.get("VP_HF_PKG"), help="hyperframes 包目录（node_modules/hyperframes）")
    ap.add_argument("--fonts", default=os.environ.get("VP_FONTS"), help="放 NotoSansSC-Regular.ttf（静态 TrueType）的目录")
    a = ap.parse_args()
    if not a.hf or not Path(a.hf, "package.json").exists():
        sys.exit("要给 --hf <node_modules/hyperframes 目录>（或设 VP_HF_PKG）")
    if not a.fonts:
        sys.exit("要给 --fonts <放 Noto Sans SC 的目录>（或设 VP_FONTS）")

    d = Path(a.dir).resolve()
    film = json.loads((d / "film.json").read_text(encoding="utf-8"))
    clips = {}
    vdir = Path(a.voice) if a.voice else d / "voice"
    if not a.mute and (vdir / "voice.json").exists():
        for say, c in json.loads((vdir / "voice.json").read_text(encoding="utf-8"))["clips"].items():
            clips[say] = {**c, "path": vdir / c["file"]}
    tl = timeline(film, clips)
    write_project(d, film, tl, clips, a.hf, a.fonts)

    with tempfile.TemporaryDirectory() as tmp:
        inner = Path(tmp) / "bundle.html"
        r = run_node(a.hf, "bundle", d, inner)
        comp = inner.read_text(encoding="utf-8")
    # the page mixes the voice itself (and keeps it in step at 2×): leave the composition's <audio> to `hyperframes render`
    comp = re.sub(r"<audio\b[^>]*\bdata-vp-voice\b[^>]*>\s*</audio>", "", comp)
    voice = None
    if tl["voice"]:
        voice = {"clips": {}}
        for v in tl["voice"]:
            c = clips[v["say"]]
            mt = mimetypes.guess_type(c["file"])[0] or "audio/mpeg"
            voice["clips"][v["say"]] = {"src": f"data:{mt};base64," + base64.b64encode(Path(c["path"]).read_bytes()).decode(), "end": c["end"]}
    data = (f"window.VP_TIMING = {json.dumps(tl, ensure_ascii=False)};\n"
            + (f"window.PM_VOICE = {json.dumps(voice, ensure_ascii=False)};\n" if voice else "")
            + f"window.VP_COMP = {js_string(comp)};")
    page = (ENGINE / "player-hf.html").read_text(encoding="utf-8")
    title = (film.get("paper", {}).get("title") or d.name) + " · 3 分钟动效解读 · VividPaper"
    page = page.replace("/*__DATA__*/", data.replace("</script", "<\\/script")).replace("__TITLE__", title)
    out = Path(a.out or d.parent / "out" / f"{d.name}.html")   # not inside the project: HyperFrames lint refuses a second root HTML there
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"✓ {out.resolve()}  {out.stat().st_size / 1e6:.2f} MB（合成 {len(comp) / 1e6:.2f} MB，编译器 {r['compiler']}）"
          + f" · 总长 {tl['total']:.1f} 秒" + (f" · 配音 {len(tl['voice'])} 句" if tl["voice"] else " · 无配音"))
    for s in tl["scenes"]:
        print(f"  {s['t0']:6.2f}s  {s['dur']:5.2f}s  {s['id']:<8} " + "  ".join(f"L{i}={l['t0']:.2f}" for i, l in enumerate(s["lines"])))


if __name__ == "__main__":
    main()
