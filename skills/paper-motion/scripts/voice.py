#!/usr/bin/env python3
"""Read every caption line aloud with a text-to-speech voice, so the film plays with sound.

    voice.py <film dir> [--voice zh-CN-YunxiNeural] [--rate +30%] [--force]
    voice.py <film dir> --cmd 'my_tts --text {text} --out {out}'

Writes <film dir>/voice/: one audio file per spoken line + voice.json (text → file, clip length,
where the speech ends). build.py embeds them; each caption then lasts as long as its line takes
to say, and everything hung on g.L(i) moves with it. Also read aloud: the opening question and
the recap. Only new or changed lines are synthesized; files no longer used are removed.

Default engine: edge-tts (`pip install edge-tts`), Microsoft Edge's read-aloud voices — free,
no key, needs network. Male zh-CN voices: YunxiNeural (default), YunjianNeural, YunyangNeural.
--cmd runs any other engine (e.g. a local CosyVoice); it gets {text} and {out} (a .wav path).
"""
import argparse, array, asyncio, hashlib, html, json, re, shlex, subprocess, sys, tempfile, wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import pack     # noqa: E402
from check import chrome   # noqa: E402


def script(d):
    """Everything the film will read aloud, in order, as the engine sees it: [{scene, say}]."""
    page, _, _ = pack(d, voice=False)
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "script.html"
        f.write_text(page, encoding="utf-8")
        r = subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
                            "--virtual-time-budget=20000", "--dump-dom", f.as_uri() + "?script=1"],
                           capture_output=True, text=True, timeout=300)
    m = re.search(r'<pre id="pm-script">(.*?)</pre>', r.stdout, re.S)
    if not m:
        err = re.search(r'<pre style="color:#FF4B4B[^>]*>(.*?)</pre>', r.stdout, re.S)
        sys.exit("读不出字幕：" + (html.unescape(err.group(1)) if err else r.stderr[-800:]))
    return [x for x in json.loads(html.unescape(m.group(1))) if x["say"]]


def mp3_seconds(b):
    """Length of an MP3 by walking its frame headers (stdlib only)."""
    BR = {1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
          2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]}
    SR = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}
    i, sec = 0, 0.0
    if b[:3] == b"ID3":
        i = 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | (b[9] & 127))
    while i + 4 <= len(b):
        if b[i] != 0xFF or b[i + 1] & 0xE0 != 0xE0:
            i += 1
            continue
        ver, layer = (b[i + 1] >> 3) & 3, (b[i + 1] >> 1) & 3
        bri, sri, pad = b[i + 2] >> 4, (b[i + 2] >> 2) & 3, (b[i + 2] >> 1) & 1
        if ver == 1 or layer != 1 or bri in (0, 15) or sri == 3:   # Layer III only
            i += 1
            continue
        sr, br = SR[ver][sri], BR[1 if ver == 3 else 2][bri] * 1000
        n = 1152 if ver == 3 else 576
        sec += n / sr
        i += (144 if ver == 3 else 72) * br // sr + pad
    return sec


def wav_seconds(path):
    """(clip length, where the sound ends) of a 16-bit WAV."""
    with wave.open(str(path)) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        a = array.array("h", w.readframes(n))
    end = len(a) - 1
    while end > 0 and abs(a[end]) < 600:
        end -= 1
    return n / sr, end / ch / sr


def plausible(s):
    """Seconds a line takes to read, same estimate as the engine's lineDur."""
    cjk, words = len(re.findall(r"[㐀-鿿]", s)), len(re.findall(r"[A-Za-z0-9.√_]+", s))
    return max(2.4, 0.6 + 0.17 * cjk + 0.3 * words)


async def edge(text, voice, rate):
    import edge_tts
    audio, end = bytearray(), 0.0
    async for ch in edge_tts.Communicate(text, voice, rate=rate).stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] in ("SentenceBoundary", "WordBoundary"):
            end = max(end, (ch["offset"] + ch["duration"]) / 1e7)
    if not audio:
        raise RuntimeError("没有返回音频")
    return bytes(audio), end


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--voice", default="zh-CN-YunxiNeural", help="edge-tts 声音，默认云希（男声）")
    ap.add_argument("--rate", default="+30%", help="语速，edge-tts 写法，如 +0%%、+15%%、-10%%")
    ap.add_argument("--cmd", help="改用别的 TTS：命令模板，{text} 是要念的话，{out} 是要写出的 .wav")
    ap.add_argument("--force", action="store_true", help="全部重新合成")
    a = ap.parse_args()

    d = Path(a.dir)
    vd = d / "voice"
    vd.mkdir(exist_ok=True)
    engine = f"cmd:{a.cmd}" if a.cmd else f"edge:{a.voice}:{a.rate}"
    lines = script(d)
    says = list(dict.fromkeys(x["say"] for x in lines))
    mf = vd / "voice.json"
    old = {c["file"]: c for c in json.loads(mf.read_text(encoding="utf-8"))["clips"].values()} if mf.exists() and not a.force else {}

    clips, todo = {}, []
    for s in says:
        name = hashlib.sha1(f"{engine}|{s}".encode()).hexdigest()[:12] + (".wav" if a.cmd else ".mp3")
        if name in old and (vd / name).exists() and old[name]["dur"] >= .3 * plausible(s):   # a truncated clip is redone
            clips[s] = old[name]
        else:
            todo.append((s, name))
    print(f"要念的 {len(says)} 句，新合成 {len(todo)} 句（{'自定义命令' if a.cmd else a.voice + ' ' + a.rate}）")

    def done(s, name, dur, end):
        clips[s] = {"file": name, "dur": round(dur, 3), "end": round(min(end or dur, dur), 3)}
        print(f"  {len(clips):3d}/{len(says)}  {end:5.1f}s  {s[:28]}")

    if a.cmd:
        for s, name in todo:
            out = vd / name
            r = subprocess.run(a.cmd.format(text=shlex.quote(s), out=shlex.quote(str(out))), shell=True)
            if r.returncode or not out.exists():
                sys.exit(f"TTS 命令失败（退出码 {r.returncode}）：{s}")
            done(s, name, *wav_seconds(out))
    else:
        async def one(sem, s, name):
            async with sem:
                for k in range(4):
                    try:
                        audio, end = await edge(s, a.voice, a.rate)
                        if mp3_seconds(audio) < .3 * plausible(s):   # the service now and then sends only the first syllables
                            raise RuntimeError(f"音频只有 {mp3_seconds(audio):.1f} 秒，被截断了")
                        break
                    except Exception as e:
                        if k == 3:
                            sys.exit(f"edge-tts 失败：{e}\n  先 pip install -U edge-tts（微软改接口后旧版会 403），再检查网络")
                        await asyncio.sleep(2 * (k + 1))
                (vd / name).write_bytes(audio)
                done(s, name, mp3_seconds(audio), end)

        async def run():
            sem = asyncio.Semaphore(4)
            await asyncio.gather(*(one(sem, s, n) for s, n in todo))
        try:
            import edge_tts  # noqa: F401
        except ImportError:
            sys.exit("没装 edge-tts：pip install edge-tts")
        asyncio.run(run())

    clips = {s: clips[s] for s in says}
    keep = {c["file"] for c in clips.values()}
    for f in vd.iterdir():
        if f.suffix in (".mp3", ".wav") and f.name not in keep:
            f.unlink()
    mf.write_text(json.dumps({"engine": engine, "voice": a.voice if not a.cmd else "cmd", "clips": clips},
                             ensure_ascii=False, indent=1), encoding="utf-8")
    speech = sum(c["end"] for c in clips.values())
    print(f"✓ {vd.resolve()}/  {len(clips)} 句 · 念完约 {speech / 60:.1f} 分钟（不含句间停顿）")
    # TTS reads formula syntax literally: "(6 − 2)" came out as 「左圆括号 6 减 2 右圆括号」, "10000^(−2i/d)" as 「100、00」
    odd = [s for s in says if re.search(r"[()（）\[\]{}^_/\\|]", s)]
    if odd:
        print(f"⚠ {len(odd)} 句带公式符号，听一下；念得不对就给那句写 say（口语念法），或在 pronounce 里统一替换：")
        for s in odd:
            print(f"    {s}")
    print(f"  下一步：build.py {d} 打包，check.py 自查")


if __name__ == "__main__":
    main()
