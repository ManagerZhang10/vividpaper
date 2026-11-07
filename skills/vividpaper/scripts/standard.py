#!/usr/bin/env python3
"""VividPaper 标准版（standard engine）：画面用 HyperFrames（HTML/CSS/SVG + GSAP）来画，VividPaper 只管合同部分。

    standard.py doctor                 体检：Node、锁定版本的依赖、Chrome、ffmpeg 齐不齐；缺什么就打印怎么装、多大
    standard.py install [--browser]    在 skill 目录装锁定版本的依赖（npm ci，约 120 MB，只装在 node_modules/ 里）；
                                       --browser：本机没有 Chrome 时让 HyperFrames 下一个 chrome-headless-shell（约 190 MB）
    standard.py new <film dir> [--layout portrait|landscape]   起一个标准版片子目录（film.json + 片头/一幕/回顾三个模板）
    standard.py hf <command> [args…]   用锁定版本的 hyperframes 跑本地命令（关遥测、用本机 Chrome、不往 ~ 写东西）；
                                       publish、cloud、auth 这类上传或联网账号的命令一律拒绝

build.py / check.py / voice.py 看到片子目录里有 film.json 就走这里（Flash 版是 film.js，不经过这个文件，也不碰 Node）。

A standard film directory is a HyperFrames project whose root index.html is generated:
  film.json                paper, brand, layout, theme, pronounce, scenes[{id, name, lines, chapter?, lead?, tail?}]
  compositions/<id>.html   one HyperFrames sub-composition per scene; reads its caption times from VP.scene(id)
  assets/figures/          the paper's figures (crop.py), assets/film-lib.js and assets/film.css (optional, loaded by every scene)
  voice/                   voice.py output
build.py writes index.html and assets/vp/ (timing, kit, chrome layer, VP Sans subset, GSAP), bundles the project with
HyperFrames' own compiler into one HTML and wraps it in the VividPaper player: <film dir>/<name>.html.
"""
import argparse, base64, html as htmllib, json, mimetypes, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
ENGINE = SKILL / "engine" / "standard"
NODE_JS = HERE / "standard_node.mjs"
HF_CACHE = SKILL / "node_modules" / ".cache" / "hyperframes"   # only for a chrome-headless-shell download (install --browser)
GAP, OUTRO_DUR, NODE_MIN = 0.4, 3.6, 22
LAYOUTS = {   # card = the Flash engine's 3:4 page; portrait = 9:16 with the short-video safe area; landscape = 16:9
    "card": {"W": 1080, "H": 1440, "zone": {"top": 130, "bottom": 1190, "cap": 1300}, "safe": [20, 16, 1060, 1424], "capW": [940, 960], "head": [56, 72, 700]},
    "portrait": {"W": 1080, "H": 1920, "zone": {"top": 350, "bottom": 1310, "cap": 1392}, "safe": [80, 250, 1000, 1480], "capW": [860, 870], "head": [80, 300, 600]},
    "landscape": {"W": 1920, "H": 1080, "zone": {"top": 130, "bottom": 880, "cap": 975}, "safe": [20, 16, 1900, 1064], "capW": [1400, 1500], "head": [64, 72, 1100]},
}
BACKGROUND = {"dark": "#0B0B0E", "light": "#F5F2EC"}
WEIGHTS = "400,700"
RESERVED = {"outro", "vpchrome", "main", "root"}
# hyperframes commands that stay on this machine; everything else (publish, cloud, lambda, cloudrun, auth, billing, events,
# usage, telemetry, feedback, templates, skills, update, upgrade, open, catch-up, present, capture, reverse, …) is refused
HF_LOCAL = {"lint", "check", "validate", "inspect", "snapshot", "keyframes", "timeline", "compositions", "info", "docs",
            "preview", "render", "doctor", "browser", "audio", "beats", "compare", "measure", "history", "clean", "init",
            "add", "catalog", "media-treatment", "normalize-audio", "grade-compare", "diff"}


# ---------------------------------------------------------------- setup and doctor
def pinned():
    return json.loads((SKILL / "package.json").read_text(encoding="utf-8"))["dependencies"]


def node_version():
    node = shutil.which("node")
    if not node:
        return None, None
    try:
        v = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=20).stdout.strip()
        return node, int(re.match(r"v(\d+)", v).group(1)) if re.match(r"v(\d+)", v) else 0
    except Exception:
        return node, 0


def installed(pkg):
    f = SKILL / "node_modules" / pkg / "package.json"
    return json.loads(f.read_text(encoding="utf-8"))["version"] if f.exists() else None


def ffprobe():
    p = os.environ.get("HYPERFRAMES_FFPROBE_PATH")
    return p if p and Path(p).exists() else shutil.which("ffprobe")


def find_chrome():
    """The browser HyperFrames and the self-check drive: CHROME / the installed Google Chrome, else a downloaded headless shell."""
    sys.path.insert(0, str(HERE))
    from check import CANDIDATES
    for c in CANDIDATES:
        if c and Path(c).exists():
            return c
    for p in sorted(HF_CACHE.glob("chrome/chrome-headless-shell/*/*/chrome-headless-shell*")):
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return None


def doctor(verbose=True):
    """(ready, lines): is everything the standard engine needs here, and what to do about what is not."""
    out, ok = [], True
    node, major = node_version()
    if not node:
        ok = False
        out.append("✗ Node：没装。标准版要 Node ≥ 22（https://nodejs.org 下载安装包，或 brew install node）。")
    elif major < NODE_MIN:
        ok = False
        out.append(f"✗ Node：{node} 是 v{major}，标准版要 ≥ {NODE_MIN}。")
    else:
        out.append(f"✓ Node v{major}（{node}）")
    want, missing = pinned(), []
    for pkg, v in want.items():
        have = installed(pkg)
        if have != v:
            missing.append(f"{pkg}@{v}" + (f"（现在是 {have}）" if have else ""))
    if missing:
        ok = False
        out.append("✗ 依赖没装好：" + "、".join(missing) + f"\n    装：python3 {HERE / 'standard.py'} install"
                   "（npm ci，按 package-lock.json 装锁定版本，约 120 MB，只装在 skill 目录的 node_modules/ 里，不碰全局）")
    else:
        out.append("✓ hyperframes " + want["hyperframes"] + " · gsap " + want["gsap"] + " · Noto Sans SC（字体本地内嵌，不走 Google Fonts）")
    chrome = find_chrome()
    if chrome:
        out.append(f"✓ Chrome：{chrome}（HyperFrames 也用它，不另下载）")
    else:
        ok = False
        out.append("✗ 找不到 Chrome：装 Google Chrome，或设 CHROME=<可执行文件>；"
                   f"也可以 python3 {HERE / 'standard.py'} install --browser 让 HyperFrames 下载 chrome-headless-shell（约 190 MB）")
    ff, fp = shutil.which("ffmpeg"), ffprobe()
    out.append(f"✓ ffmpeg + ffprobe（只有 build.py --mp4 用）：{ff} · {fp}" if ff and fp else
               "· 出 mp4 还缺 " + "、".join(x for x, y in (("ffmpeg", ff), ("ffprobe", fp)) if not y)
               + "：build.py --mp4 要用（brew install ffmpeg 两个都有；ffprobe 也可以用环境变量 HYPERFRAMES_FFPROBE_PATH 指定）。做网页不需要")
    out.append("· 遥测：本 skill 的脚本调 HyperFrames 时一律关掉（HYPERFRAMES_NO_TELEMETRY=1、DO_NOT_TRACK=1），也不运行 publish 等上传命令")
    if verbose:
        print("VividPaper 标准版体检\n  " + "\n  ".join(out))
        print("  → 标准版可以用" if ok else
              "  → 标准版还不能用。不想装的话，Flash 版零安装（Python + Chrome 就够，写 film.js，见 SKILL.md）")
    return ok, out


def require_ready():
    ok, lines = doctor(verbose=False)
    if not ok:
        sys.exit("标准版还不能用：\n  " + "\n  ".join(l for l in lines if l.startswith("✗"))
                 + "\n不想装 Node 的话，用 Flash 版（film.js，零安装）。")


def install(browser=False):
    node, major = node_version()
    npm = shutil.which("npm")
    if not node or major < NODE_MIN or not npm:
        sys.exit(f"先装 Node ≥ {NODE_MIN}（自带 npm）：https://nodejs.org 或 brew install node；装好后重跑这条命令。")
    print(f"在 {SKILL} 装锁定版本的依赖（npm ci --ignore-scripts，约 120 MB）…")
    r = subprocess.run([npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"], cwd=SKILL)
    if r.returncode:
        sys.exit("npm ci 失败；看上面的报错（网络不通时可以换 npm 镜像：npm config set registry https://registry.npmmirror.com）")
    if browser or not find_chrome():
        print("下载 HyperFrames 用的 chrome-headless-shell（约 190 MB），放在 node_modules/.cache/ 里…")
        HF_CACHE.mkdir(parents=True, exist_ok=True)
        env = {**hf_base_env(), "HYPERFRAMES_CACHE_DIR": str(HF_CACHE), "HYPERFRAMES_CONFIG_DIR": str(HF_CACHE / "config")}
        subprocess.run(["node", str(hf_cli()), "browser", "ensure"], env=env, cwd=SKILL)
    doctor()


# ---------------------------------------------------------------- running hyperframes
def hf_cli():
    return SKILL / "node_modules" / "hyperframes" / "bin" / "hyperframes.mjs"


def hf_base_env():
    return {**os.environ, "HYPERFRAMES_NO_TELEMETRY": "1", "DO_NOT_TRACK": "1", "HYPERFRAMES_NO_UPDATE_CHECK": "1",
            "HYPERFRAMES_SKIP_SKILLS": "1", "CI": "1"}   # without a TTY, `check` would otherwise keep a warm Chrome alive for 5 minutes


class Run:
    """One run's scratch space. HyperFrames' cache, config, history and temp files (and so the Chrome profiles it creates)
    all live in it, nothing goes to ~; on exit every process still holding a path inside it is stopped and it is removed."""
    def __init__(self, project=None):
        self.dir = Path(tempfile.mkdtemp(prefix="vp-"))
        (self.dir / "tmp").mkdir()
        self.project = project
        self.had_state = bool(project and (project / ".hyperframes").exists())
        self.chrome = find_chrome()

    def env(self, **extra):
        e = {**hf_base_env(), "HYPERFRAMES_CACHE_DIR": str(self.dir / "cache"), "HYPERFRAMES_CONFIG_DIR": str(self.dir / "config"),
             "TMPDIR": str(self.dir / "tmp"), "VP_SKILL_DIR": str(SKILL), **extra}
        if self.chrome:
            e["HYPERFRAMES_BROWSER_PATH"] = e["VP_CHROME"] = self.chrome
        return e

    def hf(self, *args, timeout=1800, cwd=None):
        return subprocess.run(["node", str(hf_cli()), *map(str, args)], capture_output=True, text=True, env=self.env(), timeout=timeout, cwd=cwd)

    def node(self, *args, timeout=1800):
        r = subprocess.run(["node", str(NODE_JS), *map(str, args)], capture_output=True, text=True, env=self.env(), timeout=timeout)
        if r.returncode:
            sys.exit(f"node {args[0]} 失败：\n{r.stderr[-2000:]}")
        return json.loads(r.stdout.strip().splitlines()[-1])

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        subprocess.run(["pkill", "-f", str(self.dir)], capture_output=True)   # Chrome started by HyperFrames or puppeteer
        time.sleep(.3)
        subprocess.run(["pkill", "-9", "-f", str(self.dir)], capture_output=True)
        shutil.rmtree(self.dir, ignore_errors=True)
        if self.project and not self.had_state:   # HyperFrames' per-project state points into the cache just removed
            shutil.rmtree(self.project / ".hyperframes", ignore_errors=True)


def hf_passthrough(args):
    if not args:
        sys.exit("用法：standard.py hf <命令> [参数…]，例如 hf snapshot <片子目录> --at 3,8")
    cmd = args[0]
    if cmd not in HF_LOCAL:
        sys.exit(f"VividPaper 不跑 hyperframes {cmd}：只允许本机命令（{'、'.join(sorted(HF_LOCAL))}）；publish、cloud、auth 等上传或联网账号的命令一律不用")
    require_ready()
    extra = []
    if cmd == "init" and "--skip-skills" not in args:
        extra.append("--skip-skills")
    with Run() as run:
        env = run.env()
        if cmd == "init":   # never install skills into ~: a throwaway HOME and both opt-outs
            env["HOME"] = str(run.dir / "home")
        r = subprocess.run(["node", str(hf_cli()), *args, *extra], env=env)
        sys.exit(r.returncode)


# ---------------------------------------------------------------- film.json and the timeline
def engine_dir_check(d):
    if not (d / "film.json").exists():
        sys.exit(f"{d} 里没有 film.json")


def load_film(d, need_compositions=True):
    engine_dir_check(d)
    try:
        film = json.loads((d / "film.json").read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"film.json 不是合法的 JSON：{e}")
    if not isinstance(film.get("scenes"), list) or not film["scenes"]:
        sys.exit("film.json 要有 scenes：[{ id, name, lines }, …]")
    lay = film.get("layout")
    if lay is not None and lay not in ("portrait", "landscape"):
        sys.exit(f"layout 只能不写（3:4）、写 \"portrait\"（9:16）或 \"landscape\"（16:9），不认识「{lay}」")
    if film.get("theme", "dark") not in BACKGROUND:
        sys.exit("theme 只能是 \"dark\"（默认）或 \"light\"")
    b = film.get("brand")
    if "tool" in film:
        sys.exit("tool 选项已去掉：右上角要写自己的名字就写 brand")
    if b is not None and not (isinstance(b, str) and b.strip()):
        sys.exit("brand 要写成一段文字，例如 \"brand\": \"你的名字\"；不写就是「VividPaper」")
    seen = set()
    for s in film["scenes"]:
        sid = s.get("id")
        if not isinstance(sid, str) or not re.fullmatch(r"[a-z][a-z0-9_-]*", sid):
            sys.exit(f"每一幕要有 id（小写英文开头，只用字母数字 - _）：{sid!r}")
        if sid in RESERVED or sid in seen:
            sys.exit(f"幕的 id「{sid}」重复或是保留字（{'、'.join(sorted(RESERVED))}）")
        seen.add(sid)
        if not s.get("name"):
            sys.exit(f"「{sid}」没写 name（章节名）")
        if not isinstance(s.get("lines"), list):
            sys.exit(f"「{sid}」没写 lines（字幕）")
        for l in s["lines"]:
            if not (isinstance(l, str) or (isinstance(l, dict) and isinstance(l.get("text"), str))):
                sys.exit(f"「{sid}」的字幕要写成字符串或 {{\"text\": …, \"say\": …}}：{l!r}")
        if need_compositions and not (d / "compositions" / f"{sid}.html").exists():
            sys.exit(f"缺 compositions/{sid}.html（film.json 里每一幕对应一个合成文件；骨架见 engine/standard/templates/scene.html）")
    return film


def line_dur(s):
    """How long a caption stays up without a voice-over (pm.js lineDur)."""
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


def voice_script(d):
    """Everything the film reads aloud, in order: [{scene, say}] (voice.py)."""
    film = load_film(d, need_compositions=False)
    out = [{"scene": s["id"], "say": spoken(film, l if isinstance(l, dict) else {"text": l})} for s in film["scenes"] for l in s["lines"]]
    return [x for x in out if x["say"]]


def voice_clips(d):
    m = d / "voice" / "voice.json"
    if not m.exists():
        return {}, None
    v = json.loads(m.read_text(encoding="utf-8"))
    return {say: {**c, "path": d / "voice" / c["file"]} for say, c in v["clips"].items()}, v.get("voice", "")


def chunks(text, t0, dur):
    """A long spoken passage → captions of ≤ 28 characters cut at punctuation, each up for its share of the text (pm.js
    chunks(), used there for the opening and the recap; here for every scene with "chapter": false)."""
    ln = lambda s: len(s.replace("**", ""))
    out = []
    for p in re.findall(r"[^。！？；，、：]+[。！？；，、：]?", text) or [text]:
        if out and not re.search(r"[。！？]$", out[-1]) and ln(out[-1] + p) <= 28:
            out[-1] += p
        else:
            out.append(p)
    for i in range(len(out) - 1):   # a **highlight** cut in two stays highlighted on both sides
        if out[i].count("**") % 2:
            out[i] += "**"
            out[i + 1] = "**" + out[i + 1]
    n, u, res = sum(ln(x) for x in out) or 1, t0, []
    for x in out:
        d = dur * ln(x) / n
        res.append({"text": re.sub(r"[，、：；。]$", "", x), "t0": round(u, 3), "t1": round(u + d, 3)})
        u += d
    return res


def timeline(film, clips):
    """Every scene's start and length and every caption line's start and end (seconds). With a clip a line lasts as long as
    it takes to say + 0.4 s; without, the Flash engine's estimate by character count. The chrome layer, the scenes
    (VP.scene(id).L(i)) and the player all read this one table."""
    lay = {"name": film.get("layout") or "card", **LAYOUTS[film.get("layout") or "card"]}
    scenes, voice, t, num = [], [], 0.0, 0
    for s in film["scenes"]:
        u, lines = s.get("lead", 0.5), []
        for l in s["lines"]:
            o = {"text": l} if isinstance(l, str) else l
            say = spoken(film, o)
            c = clips.get(say)
            d = max(o.get("dur", 0), c["end"] + GAP + o.get("hold", 0)) if c else (o.get("dur") or line_dur(o["text"]) + o.get("hold", 0))
            lines.append({"text": o["text"], "t0": round(u, 3), "t1": round(u + d, 3)})
            voice.append({"scene": s["id"], "local": u, "say": say, "clip": bool(c)})
            u += d
        dur = u + s.get("tail", 0.8)
        chapter = s.get("chapter", True) is not False
        num += chapter
        extra = {k: v for k, v in s.items() if k not in ("lines", "lead", "tail", "chapter")}
        # captions on screen: one per line in a chapter (too long → 字幕太长), cut into ≤ 28-character pieces in the opening / recap
        caps = lines if chapter else [c for l in lines for c in chunks(l["text"], l["t0"], l["t1"] - l["t0"] - .1)]
        scenes.append({**extra, "num": num if chapter else None, "chapter": chapter, "t0": round(t, 3), "dur": round(dur, 3), "lines": lines, "caps": caps})
        t += dur
    scenes.append({"id": "outro", "name": "片尾", "builtin": "outro", "t0": round(t, 3), "dur": OUTRO_DUR, "lines": [], "caps": [], "endT": .4})
    t += OUTRO_DUR
    t0 = {s["id"]: s["t0"] for s in scenes}
    voice = [{"t": round(t0[v["scene"]] + v["local"], 3), "say": v["say"], "scene": v["scene"], "clip": v["clip"]} for v in voice]
    theme = film.get("theme", "dark")
    return {"paper": film.get("paper", {}), "brand": (film.get("brand") or "").strip() or None, "layout": lay, "theme": theme,
            "background": film.get("background") or BACKGROUND[theme], "scenes": scenes, "total": round(t, 3), "voice": voice}


# ---------------------------------------------------------------- the HyperFrames project
def film_text(d, film):
    """Every character the film can show: captions, chapter names, the chrome's fixed strings, the scenes' text, ASCII."""
    parts = [json.dumps(film, ensure_ascii=False), "本视频由开源工具 VividPaper 生成 ★ Star ManagerZhang10/vividpaper 最后回顾 片头 片尾 示意 图：论文",
             "".join(chr(c) for c in range(32, 127)), "，。、：；！？（）「」『』“”‘’…—·→←↑↓×÷√±≈≤≥∈∑−²³⁻ᵀ％"]
    for pat in ("compositions/*.html", "assets/*.js", "assets/*.css", "assets/*.html", "assets/**/*.json"):
        for f in d.glob(pat):
            if "assets/vp" not in f.as_posix():
                parts.append(f.read_text(encoding="utf-8", errors="ignore"))
    return "".join(sorted(set("".join(parts))))


def write_project(d, film, tl, run):
    vp = d / "assets" / "vp"
    if vp.exists():
        shutil.rmtree(vp)
    vp.mkdir(parents=True)
    (vp / ".gitignore").write_text("# written by build.py on every build\n*\n", encoding="utf-8")
    lay = tl["layout"]
    W, H = lay["W"], lay["H"]
    (vp / "chrome.html").write_text((ENGINE / "chrome.html").read_text(encoding="utf-8").replace("__W__", str(W)).replace("__H__", str(H)), encoding="utf-8")
    shutil.copy(ENGINE / "kit.js", vp / "kit.js")
    shutil.copy(SKILL / "node_modules" / "gsap" / "dist" / "gsap.min.js", vp / "gsap.min.js")
    (vp / "timing.js").write_text("// written by build.py from film.json and voice/: when every scene and caption line starts and ends (seconds)\n"
                                  f"window.VP_TIMING = {json.dumps(tl, ensure_ascii=False)};\n", encoding="utf-8")
    txt = run.dir / "chars.txt"
    txt.write_text(film_text(d, film), encoding="utf-8")
    fonts = run.node("fonts", txt, vp, WEIGHTS)
    miss = "".join(sorted(set("".join(v["missing"] for v in fonts.values()))))
    print(f"  字体 VP Sans：{fonts['400']['glyphs']} 个字符 · " + " + ".join(f"{w} {v['bytes'] / 1024:.0f} KB" for w, v in fonts.items())
          + (f" · Noto Sans SC 里没有：{miss}" if miss.strip() else ""))
    hosts = []
    for s in tl["scenes"]:
        if s.get("builtin"):
            continue
        hosts.append(f'    <div id="vp-scene-{s["id"]}" class="clip" data-composition-id="{s["id"]}" data-composition-src="compositions/{s["id"]}.html" '
                     f'data-start="{s["t0"]}" data-duration="{s["dur"]}" data-track-index="1" data-track-kind="graphics" data-width="{W}" data-height="{H}" style="z-index:1"></div>')
    lib = '\n  <script src="assets/film-lib.js"></script>' if (d / "assets" / "film-lib.js").exists() else ""
    css = '\n  <link rel="stylesheet" href="assets/film.css">' if (d / "assets" / "film.css").exists() else ""
    kit_css = (ENGINE / "kit.css").read_text(encoding="utf-8")
    (d / "index.html").write_text(f"""<!doctype html>
<!-- written by VividPaper build.py from film.json + compositions/ on every build: edit those, not this file -->
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width={W}, height={H}">
  <script src="assets/vp/gsap.min.js"></script>
  <script src="assets/vp/timing.js"></script>
  <script src="assets/vp/kit.js"></script>{lib}
  <style>
    @font-face {{ font-family: "VP Sans"; font-weight: 100 549; src: url("assets/vp/vp-sans-400.ttf") format("truetype"); }}
    @font-face {{ font-family: "VP Sans"; font-weight: 550 900; src: url("assets/vp/vp-sans-700.ttf") format("truetype"); }}
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: {tl['background']}; }}
    #root {{ position: relative; width: {W}px; height: {H}px; background: {tl['background']}; font-family: "VP Sans", sans-serif; }}
{kit_css}
  </style>{css}
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="{tl['total']}" data-width="{W}" data-height="{H}">
{chr(10).join(hosts)}
    <div id="vp-chrome" class="clip" data-composition-id="vpchrome" data-composition-src="assets/vp/chrome.html" data-start="0" data-duration="{tl['total']}" data-track-index="2" data-track-kind="captions" data-width="{W}" data-height="{H}" style="z-index:50"></div>
  </div>
  <script>
    window.__timelines = window.__timelines || {{}};
    window.__timelines["main"] = gsap.timeline({{ paused: true }});
  </script>
</body>
</html>
""", encoding="utf-8")


def js_string(s):
    """A JS string literal safe inside <script>. data-composition-id is written with an escaped hyphen so HyperFrames does
    not take the finished page, which sits in the project folder, for a second root composition."""
    return (json.dumps(s).replace("</", "<\\/").replace("<!--", "<\\u0021--")
            .replace("data-composition-id", "data-composition\\u002did"))


def data_uri(f):
    mt = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
    return f"data:{mt};base64," + base64.b64encode(Path(f).read_bytes()).decode()


def bgm_data(path, drop):
    sys.path.insert(0, str(HERE))
    from build import bgm_data as flash_bgm   # same checks and fields as the Flash engine
    return flash_bgm(path, drop)


# ---------------------------------------------------------------- build
def build(d, out=None, voice=True, bgm=None, bgm_drop="auto", mp4=False, open_page=False):
    require_ready()
    d = Path(d).resolve()
    film = load_film(d)
    clips, vname = voice_clips(d) if voice else ({}, None)
    tl = timeline(film, clips)
    out = Path(out).resolve() if out else d / f"{d.name}.html"
    t_start = time.time()
    with Run(d) as run:
        write_project(d, film, tl, run)
        inner = run.dir / "bundle.html"
        r = run.node("bundle", d, inner)
        comp = inner.read_text(encoding="utf-8")
    used = [v for v in tl["voice"] if v["clip"]]
    vo = None
    if used:
        vo = {"voice": vname or "", "clips": {}}
        for v in used:
            c = clips[v["say"]]
            vo["clips"][v["say"]] = {"src": data_uri(c["path"]), "dur": c["dur"], "end": c["end"]}
    data = (f"window.VP_TIMING = {json.dumps(tl, ensure_ascii=False)};\n"
            + (f"window.PM_VOICE = {json.dumps(vo, ensure_ascii=False)};\n" if vo else "")
            + (f"window.PM_BGM = {json.dumps(bgm_data(bgm, bgm_drop))};\n" if bgm else "")
            + f"window.VP_COMP = {js_string(comp)};")
    page = (ENGINE / "player.html").read_text(encoding="utf-8")
    title = ((film.get("paper") or {}).get("title") or d.name) + " · 3 分钟动效解读 · VividPaper"
    page = page.replace("/*__DATA__*/", data.replace("</script", "<\\/script")).replace("__TITLE__", htmllib.escape(title))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    nfig = len(list((d / "assets" / "figures").glob("*"))) if (d / "assets" / "figures").is_dir() else 0
    print(f"✓ {out}  {out.stat().st_size / 1e6:.1f} MB（标准版 · HyperFrames {r['version']} · 合成 {len(comp) / 1e6:.2f} MB · {time.time() - t_start:.0f} 秒）"
          + f" · {nfig} 张图 · 总长 {tl['total']:.1f} 秒" + (f" · 配音 {len(used)} 句" if used else "") + (f" · 配乐 {Path(bgm).name}" if bgm else ""))
    if mp4:
        render_mp4(d, out, out.with_suffix(".mp4"), has_sound=bool(used or bgm))
    if open_page:
        subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", str(out)])
    return out


def page_text(run, page, query, selector, timeout=900):
    """Open the built page with ?<query> in headless Chrome and return the text of <selector> (self-check, mixdown)."""
    f = run.dir / ("page_" + selector.strip("#") + ".txt")
    r = subprocess.run(["node", str(NODE_JS), "page", page.resolve().as_uri() + "?" + query, selector, f], capture_output=True, text=True,
                       env=run.env(VP_PAGE_TIMEOUT=str(timeout)), timeout=timeout + 120)
    if r.returncode:
        sys.exit(f"打开页面失败：{r.stderr[-1500:]}")
    res = json.loads(r.stdout.strip().splitlines()[-1])
    if not res["ok"]:
        sys.exit("页面报错：" + res["error"])
    return f.read_text(encoding="utf-8")


def render_mp4(d, page, out, has_sound=True):
    ff = shutil.which("ffmpeg")
    if not ff or not ffprobe():
        sys.exit("出 mp4 要 ffmpeg 和 ffprobe（HyperFrames 渲染用）：brew install ffmpeg；ffprobe 不在 PATH 上时设 HYPERFRAMES_FFPROBE_PATH=<路径>")
    t0 = time.time()
    with Run(d) as run:
        video = run.dir / "video.mp4"
        r = run.hf("render", d, "-o", video, "--quiet", timeout=7200)
        if r.returncode or not video.exists():
            sys.exit("hyperframes render 失败：\n" + (r.stderr or r.stdout)[-2000:])
        if has_sound:   # the page's own mix (voice + music, ducked), so the video sounds exactly like the page
            wav = run.dir / "mix.wav"
            wav.write_bytes(base64.b64decode(page_text(run, page, "mixdown=1&rate=48000", "#vp-mix")))
            r = subprocess.run([ff, "-y", "-loglevel", "error", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                                "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], capture_output=True, text=True)
            if r.returncode:
                sys.exit("ffmpeg 合成音轨失败：" + r.stderr[-800:])
        else:
            shutil.copy(video, out)
    print(f"✓ {out}  {out.stat().st_size / 1e6:.1f} MB · 渲染 {time.time() - t0:.0f} 秒")


# ---------------------------------------------------------------- check
KIND = {   # hyperframes check code → VividPaper kind (others are reported as 「HF <code>」)
    "caption_zone_collision": "压字幕", "content_overlap": "文字重叠", "text_overflow": "出界", "canvas_overflow": "出界",
    "text_clipped": "出界", "panel_out_of_canvas": "出界", "frame_out_of_frame": "出界", "dead_stretch": "画面静止",
    "sweep_static": "画面静止", "motion_frozen": "画面静止", "first_frame_empty": "开场不动",
}
NONDET = [(r"\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bperformance\.now\s*\(", "读了真实时间"), (r"\bMath\.random\s*\(", "用了无种子的随机数"),
          (r"\bsetTimeout\s*\(|\bsetInterval\s*\(|\brequestAnimationFrame\s*\(", "用了计时器（画面要由时间线决定）"),
          (r"\brepeat\s*:\s*-\s*1\b", "用了无限循环 repeat: -1（时间线要有确定的长度）")]


def lint(d, film):
    """What can be read off the source files: the contract items HyperFrames does not check in VividPaper's terms."""
    w = []
    add = lambda kind, scene, msg: w.append({"t": 0, "scene": scene, "kind": kind, "msg": msg})
    files = sorted(d.glob("compositions/*.html")) + [f for f in sorted(d.glob("assets/**/*")) if f.suffix in (".js", ".css", ".html") and "assets/vp" not in f.as_posix()]
    declared = {"vp sans"}
    srcs = {f: f.read_text(encoding="utf-8", errors="ignore") for f in files}
    for s in srcs.values():
        for m in re.finditer(r"@font-face\s*{[^}]*font-family\s*:\s*['\"]?([^;'\"]+)", s):
            declared.add(m.group(1).strip().lower())
    generic = {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-monospace", "ui-sans-serif", "ui-serif", "inherit", "initial", "unset", "emoji", "math"}
    for f, s in srcs.items():
        rel = f.relative_to(d).as_posix()
        code = re.sub(r"<!--.*?-->", "", s, flags=re.S)
        code = re.sub(r"(?<![:\"'])//[^\n]*", "", code)
        for pat, what in NONDET:
            if re.search(pat, code):
                add("报错", rel, f"{what}：拖进度、倍速、自查和 mp4 都会错（AGENTS.md 规则 3）")
        if re.search(r"""(?:src|href)\s*=\s*["']https?://|url\(\s*["']?https?://|@import\s+["']?https?://""", code):
            add("报错", rel, "引用了网上的文件：成片要能离线打开，图片、字体、脚本都放进 assets/")
        if "fonts.googleapis" in code or "fonts.gstatic" in code:
            add("报错", rel, "用了 Google Fonts：字体要本地内嵌（默认 VP Sans；别的字体放 assets/fonts/ 再写 @font-face）")
        for m in re.finditer(r"font-family\s*:\s*([^;}\n\"']*(?:[\"'][^\"']*[\"'][^;}\n\"']*)*)", code):
            for fam in m.group(1).split(","):
                fam = fam.strip().strip("\"'").strip().lower()
                if fam and fam not in generic and fam not in declared and not fam.startswith("var("):
                    add("字体", rel, f"字体「{fam}」没有内嵌：HyperFrames 渲染时会去 Google Fonts 下载（国内连不上）。用 VP Sans，或把字体文件放进 assets/fonts/ 写 @font-face")
        if f.parent.name == "compositions":
            sid = f.stem
            if "gsap.timeline(" in code and not re.search(r"paused\s*:\s*true", code):
                add("报错", rel, "GSAP 时间线要建成 paused：gsap.timeline({ paused: true })（AGENTS.md 规则 3）")
            if not re.search(r"__timelines\s*\[\s*['\"]" + re.escape(sid) + r"['\"]\s*\]\s*=", code):
                add("报错", rel, f"没有登记时间线：建完后写 window.__timelines['{sid}'] = tl")
    ids = {s["id"] for s in film["scenes"]}
    for f in d.glob("compositions/*.html"):
        if f.stem not in ids:
            add("报错", f"compositions/{f.name}", "film.json 里没有这一幕，它不会出现在片子里")
    return w


def hf_check(run, d, lay):
    cz = f"x0=0;y0={lay['zone']['bottom'] / lay['H']:.4f};x1=1;y1=1;severity=error"
    r = run.hf("check", d, "--json", "--caption-zone", cz, timeout=1800)
    try:
        rep = json.loads(r.stdout)
    except json.JSONDecodeError:
        return [{"t": 0, "scene": "film", "kind": "报错", "msg": "hyperframes check 没有输出 JSON：" + (r.stderr or r.stdout)[-300:]}], [], None
    out, advice = [], []
    for sec in ("lint", "runtime", "layout", "motion", "contrast", "craft", "audio"):
        for f in (rep.get(sec) or {}).get("findings", []):
            code, sev = f.get("code", ""), f.get("severity", "")
            if sev not in ("error", "warning"):
                continue
            item = {"t": f.get("time") or 0, "scene": f.get("sourceFile") or f.get("file") or "", "kind": KIND.get(code) or ("报错" if sec in ("lint", "runtime") else f"HF {code}"),
                    "msg": (f.get("message") or "")[:200]}
            # HyperFrames' craft pass is its house taste (a 3 s stillness limit, a 28 px type floor, music on every film): shown
            # as advice. VividPaper's own limits (6 s, 22 px) are checked on the page; the voice and music are mixed by the page.
            (advice if sec == "craft" else out).append(item)
    return out, advice, rep


def snapshot_sheet(run, d, lay, shots, out_png, cols, extra=(), frames_dir=None, stem=""):
    snap = run.dir / "snap"
    times = [t for t, _ in shots] + list(extra)
    r = run.hf("snapshot", d, "--at", ",".join(f"{t:g}" for t in times), "--output", snap, "--no-end", timeout=1800)
    pngs = sorted(snap.glob("*.png"))
    def sec(p):
        m = re.search(r"(\d+(?:\.\d+)?)s", p.stem)
        return float(m.group(1)) if m else 0.0
    by = {}
    for p in pngs:
        by.setdefault(round(sec(p), 2), p)
    if len(by) < len(set(round(t, 2) for t in times)):
        print(f"⚠ snapshot 只出了 {len(by)}/{len(times)} 张：{(r.stderr or r.stdout)[-300:]}")
    if frames_dir and extra:
        frames_dir.mkdir(exist_ok=True)
        for t in extra:
            p = by.get(round(t, 2))
            if p:
                shutil.copy(p, frames_dir / f"{stem}_t{t:g}.png")
        print(f"整帧：{frames_dir}/")
    cw = 270
    ch = round(cw * lay["H"] / lay["W"])
    cells = "".join(f'<div class="c"><b>{htmllib.escape(lab)}  {t:.1f}s</b><img src="{by[round(t, 2)].as_uri()}"></div>' for t, lab in shots if round(t, 2) in by)
    rows = (len(shots) + cols - 1) // cols
    grid = run.dir / "grid.html"
    grid.write_text(f"""<!doctype html><meta charset="utf-8"><style>body{{margin:0;background:#000;width:{cols * cw}px}}
.c{{float:left;width:{cw}px;height:{ch + 34}px}}b{{display:block;height:34px;line-height:34px;color:#ddd;font:600 20px -apple-system,"PingFang SC",sans-serif;padding-left:8px}}
img{{width:{cw - 4}px;height:{ch - 4}px;display:block}}</style>{cells}""", encoding="utf-8")
    subprocess.run([run.chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", f"--user-data-dir={run.dir / 'grid-profile'}",
                    f"--window-size={cols * cw},{rows * (ch + 34)}", f"--screenshot={out_png}", grid.as_uri()], capture_output=True, timeout=180)


def check(target, at="", cols=6):
    require_ready()
    target = Path(target).resolve()
    d = target if target.is_dir() else target.parent
    film = load_film(d)
    page = target if target.is_file() else d / f"{d.name}.html"
    if not page.exists():
        sys.exit(f"没找到成片 {page}：先 build.py {d}")
    T = json.loads(re.search(r"window\.VP_TIMING = (\{.*?\});\n", page.read_text(encoding="utf-8")).group(1))
    if json.loads((d / "assets" / "vp" / "timing.js").read_text(encoding="utf-8").split("window.VP_TIMING = ", 1)[1].rsplit(";", 1)[0]) != T:
        sys.exit("片子目录里的工程和这个成片不是同一次 build：先重跑 build.py（它会重写 index.html 和 assets/vp/）")
    lay = T["layout"]
    t0 = time.time()
    warns = lint(d, film)
    with Run(d) as run:
        res = json.loads(page_text(run, page, "audit=1", "#vp-audit"))
        warns += res["warnings"]
        hw, advice, rep = hf_check(run, d, lay)
        warns += hw
        if rep:
            print(f"hyperframes check：lint {rep['lint']['errorCount']} 错 · layout {rep['layout']['errorCount']} 错 {rep['layout']['warningCount']} 警告"
                  f" · 对比度 {rep['contrast'].get('passed', 0)}/{rep['contrast'].get('checked', 0)} · craft 警告 {rep['craft']['warningCount']}")
        extra = [float(x) for x in at.split(",") if x.strip()]
        snapshot_sheet(run, d, lay, res["shots"], page.with_name(page.stem + "_sheet.png"), cols, extra, page.parent / "_frames", page.stem)
    if film.get("checkLength", True) is not False:
        if T["total"] < 140:
            warns.append({"t": 0, "scene": "film", "kind": "总长", "msg": f"只有 {T['total']:.0f} 秒，目标 150–210 秒：加一幕或每幕加一两句"})
        if T["total"] > 240:
            warns.append({"t": 0, "scene": "film", "kind": "总长", "msg": f"有 {T['total']:.0f} 秒，超过 4 分钟：砍幕，不要压缩字幕"})
    if any(v["clip"] for v in T["voice"]):
        for v in T["voice"]:
            if not v["clip"]:
                warns.append({"t": v["t"], "scene": v["scene"], "kind": "配音", "msg": f"「{v['say'][:16]}…」没有配音：改过字幕就重跑 voice.py"})
    seen, uniq = set(), []
    for x in warns:
        k = (x["kind"], x["scene"], x["msg"])
        if k not in seen:
            seen.add(k)
            uniq.append(x)
    warns = uniq
    page.with_name(page.stem + "_audit.json").write_text(json.dumps({"total": T["total"], "layout": lay["name"], "scenes": [
        {k: s[k] for k in ("id", "name", "t0", "dur")} for s in T["scenes"]], "warnings": warns}, ensure_ascii=False, indent=1), encoding="utf-8")
    if advice:
        print(f"HyperFrames 的建议（它自己的口味，不算问题，看情况采纳）{len(advice)} 条：")
        for x in advice:
            print(f"  · {float(x['t']):6.1f}s  {x['kind'][3:] if x['kind'].startswith('HF ') else x['kind']}: {x['msg'][:140]}")
    tot = T["total"]
    nsc = sum(1 for s in T["scenes"] if not s.get("builtin"))
    print(f"总长 {int(tot // 60)}:{int(tot % 60):02d}（{tot:.0f} 秒）· {nsc} 幕 · {lay['name']} {lay['W']}×{lay['H']}"
          + (f" · 配音 {sum(1 for v in T['voice'] if v['clip'])} 句" if any(v["clip"] for v in T["voice"]) else "") + f" · 自查 {time.time() - t0:.0f} 秒")
    for s in T["scenes"]:
        print(f"  {s['t0']:6.1f}s  {s['dur']:5.1f}s  {s['id']:<10} {s['name']}")
    print(f"关键帧总览：{page.with_name(page.stem + '_sheet.png')}")
    if not warns:
        print("✓ 没有问题")
        return
    print(f"✗ {len(warns)} 个问题：")
    for x in warns:
        print(f"  {float(x['t']):6.1f}s  [{x['kind']}] {x['scene']}: {x['msg']}")
    sys.exit(1)


# ---------------------------------------------------------------- new
def new(d, layout=None):
    d = Path(d)
    if (d / "film.json").exists() or (d / "film.js").exists():
        sys.exit(f"{d} 里已经有 film.json / film.js")
    (d / "compositions").mkdir(parents=True, exist_ok=True)
    (d / "assets" / "figures").mkdir(parents=True, exist_ok=True)
    film = {"paper": {"title": "方法名", "full": "论文全称", "byline": "作者 · 机构 · 会议 年份", "arxiv": ""},
            **({"layout": layout} if layout else {}),
            "scenes": [
                {"id": "opening", "name": "片头", "chapter": False, "lead": 0, "badges": ["机构", "会议 年份"], "points": ["具体结果 1", "具体结果 2"],
                 "lines": ["这篇论文回答的问题（**强调**）？", "今天解读机构会议的论文 **方法名**", "为什么值得读：具体的结果、落地或开源"]},
                {"id": "problem", "name": "第一幕：老办法哪里不行", "lines": ["第一句字幕", "第二句字幕", "第三句字幕"]},
                {"id": "recap", "name": "回顾", "chapter": False, "lines": ["我们最后回顾一下", "第一条", "第二条", "第三条"]},
            ]}
    (d / "film.json").write_text(json.dumps(film, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copy(ENGINE / "templates" / "opening.html", d / "compositions" / "opening.html")
    shutil.copy(ENGINE / "templates" / "recap.html", d / "compositions" / "recap.html")
    (d / "compositions" / "problem.html").write_text((ENGINE / "templates" / "scene.html").read_text(encoding="utf-8").replace("__ID__", "problem"), encoding="utf-8")
    print(f"✓ {d.resolve()}：film.json + compositions/opening.html、problem.html、recap.html（片头和回顾是可选模板，可删可改）")


def main():
    ap = argparse.ArgumentParser(description="VividPaper 标准版：体检、安装、起新片、跑本地 hyperframes 命令")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor", help="体检")
    p = sub.add_parser("install", help="装锁定版本的依赖（npm ci）")
    p.add_argument("--browser", action="store_true", help="让 HyperFrames 下载 chrome-headless-shell（本机没有 Chrome 时）")
    p = sub.add_parser("new", help="起一个标准版片子目录")
    p.add_argument("dir")
    p.add_argument("--layout", choices=["portrait", "landscape"])
    p = sub.add_parser("hf", help="跑本地 hyperframes 命令", add_help=False)
    p.add_argument("args", nargs=argparse.REMAINDER)
    a = ap.parse_args()
    if a.cmd == "doctor":
        sys.exit(0 if doctor()[0] else 1)
    if a.cmd == "install":
        install(a.browser)
    elif a.cmd == "new":
        new(a.dir, a.layout)
    elif a.cmd == "hf":
        hf_passthrough(a.args)


if __name__ == "__main__":
    main()
