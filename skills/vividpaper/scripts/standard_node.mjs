// Node side of the VividPaper standard engine; scripts/standard.py runs it. Only the Flash-free path uses Node.
// It uses nothing beyond what package.json pins (hyperframes and its own dependencies, the Noto Sans SC font package).
//   node standard_node.mjs bundle <project dir> <out.html>           HyperFrames' own single-file bundler
//   node standard_node.mjs fonts <text file> <out dir> <weights>     VP Sans: Noto Sans SC cut down to the film's characters
//   node standard_node.mjs page <url> <selector> <out file>          open a built page in headless Chrome (VP_CHROME), wait for
//                                                                    <selector> (the self-check's or the mixdown's <pre>), save its text
// The package directory is VP_SKILL_DIR (the skill folder holding node_modules), else the folder above this script.
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const skillDir = process.env.VP_SKILL_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(path.join(skillDir, 'package.json'));
const [cmd, a, b, c] = process.argv.slice(2);

// ---------- fonts ----------
// The source is @fontsource-variable/noto-sans-sc (OFL; ~5 MB of woff2 slices, one variable weight axis), so nothing is
// fetched from Google Fonts. For every weight asked for, the glyphs the film shows are taken from whichever slice holds
// them, set to that weight, and written into one small static TrueType font per weight:
// - fontkit applies the weight to advance widths (HVAR) but its WOFF2 glyphs skip the outline deltas (gvar), so the deltas
//   are applied here with fontkit's own GlyphVariationProcessor before the outline is read;
// - outlines (composites flattened) are written as plain TrueType glyphs without hinting; head, hhea and OS/2 start from the
//   source's and get this subset's numbers; cmap, name (keeping the copyright and the OFL notice) and post are written here,
//   because Chrome's font sanitiser (OTS) rejects a font without them; tables are 4-byte aligned with correct checksums.
function rawTable(font, tag) {
  const entry = font.directory.tables[tag];
  if (!entry) return null;
  const s = font._getTableStream(tag);
  return Buffer.from(s.buffer.subarray(s.pos, s.pos + (entry.origLength ?? entry.length)));
}
function cmap4(map) {   // format 4 (Windows BMP), one segment per character + the 0xFFFF end segment
  const cps = [...map.keys()].filter(c => c < 0xFFFF).sort((x, y) => x - y), n = cps.length + 1;
  const len = 16 + 8 * n, t = Buffer.alloc(len), es = Math.floor(Math.log2(n)), sr = 2 * 2 ** es;
  t.writeUInt16BE(4, 0); t.writeUInt16BE(len, 2); t.writeUInt16BE(0, 4); t.writeUInt16BE(n * 2, 6);
  t.writeUInt16BE(sr, 8); t.writeUInt16BE(es, 10); t.writeUInt16BE(n * 2 - sr, 12);
  const end = 14, start = 16 + 2 * n, delta = start + 2 * n, ro = delta + 2 * n;
  cps.forEach((c, i) => { t.writeUInt16BE(c, end + 2 * i); t.writeUInt16BE(c, start + 2 * i); t.writeUInt16BE((map.get(c) - c + 65536) % 65536, delta + 2 * i); t.writeUInt16BE(0, ro + 2 * i); });
  const k = n - 1; t.writeUInt16BE(0xFFFF, end + 2 * k); t.writeUInt16BE(0xFFFF, start + 2 * k); t.writeUInt16BE(1, delta + 2 * k); t.writeUInt16BE(0, ro + 2 * k);
  const head = Buffer.alloc(12); head.writeUInt16BE(0, 0); head.writeUInt16BE(1, 2); head.writeUInt16BE(3, 4); head.writeUInt16BE(1, 6); head.writeUInt32BE(12, 8);
  return Buffer.concat([head, t]);
}
function sfnt(tabs) {
  const n = tabs.length;
  tabs.sort((x, y) => (x.tag < y.tag ? -1 : 1));
  const sum = d => { let s = 0; const p = Buffer.concat([d, Buffer.alloc((4 - d.length % 4) % 4)]); for (let i = 0; i < p.length; i += 4) s = (s + p.readUInt32BE(i)) >>> 0; return s; };
  const head = tabs.find(t => t.tag === 'head'); if (head) head.data.writeUInt32BE(0, 8);
  const es = Math.floor(Math.log2(n)), sr = 16 * 2 ** es;
  const dir = Buffer.alloc(12 + 16 * n);
  dir.writeUInt32BE(0x00010000, 0); dir.writeUInt16BE(n, 4); dir.writeUInt16BE(sr, 6); dir.writeUInt16BE(es, 8); dir.writeUInt16BE(n * 16 - sr, 10);
  let off = dir.length; const body = [];
  tabs.forEach((t, i) => {
    const o = 12 + 16 * i; dir.write(t.tag, o, 'latin1'); dir.writeUInt32BE(sum(t.data), o + 4); dir.writeUInt32BE(off, o + 8); dir.writeUInt32BE(t.data.length, o + 12);
    const pad = Buffer.alloc((4 - t.data.length % 4) % 4); body.push(t.data, pad); off += t.data.length + pad.length;
  });
  const out = Buffer.concat([dir, ...body]);
  if (head) { const hoff = dir.readUInt32BE(12 + 16 * tabs.indexOf(head) + 8); out.writeUInt32BE((0xB1B0AFBA - sum(out)) >>> 0, hoff + 8); }
  return out;
}
function nameTable(records) {   // format 0, Windows Unicode English only
  const enc = records.map(([id, s]) => [id, Buffer.from(String(s), 'utf16le').swap16()]);
  const head = Buffer.alloc(6 + 12 * enc.length); head.writeUInt16BE(0, 0); head.writeUInt16BE(enc.length, 2); head.writeUInt16BE(head.length, 4);
  let off = 0;
  enc.forEach(([id, b], i) => { const o = 6 + 12 * i; head.writeUInt16BE(3, o); head.writeUInt16BE(1, o + 2); head.writeUInt16BE(0x409, o + 4); head.writeUInt16BE(id, o + 6); head.writeUInt16BE(b.length, o + 8); head.writeUInt16BE(off, o + 10); off += b.length; });
  return Buffer.concat([head, ...enc.map(e => e[1])]);
}
function weightFonts(fontkit, files, weight) {
  // one fontkit font per slice, at this weight; the slices' glyphs get their outline deltas applied on first use
  return files.map(f => {
    const font = fontkit.create(fs.readFileSync(f));
    font.variationCoords = [weight];
    const vp = font._variationProcessor, done = new Set();
    if (!font._transformedGlyphs) font._transformGlyfTable();   // WOFF2 glyphs are decoded once, up front
    const T = font._transformedGlyphs;
    const vary = gid => {
      if (done.has(gid)) return; done.add(gid);
      const d = T[gid]; if (!d || !vp) return;
      const P = d.points?.[0]?.constructor;
      if (d.numberOfContours > 0 && P) {
        const pts = d.points.map(p => p.copy()); for (let k = 0; k < 4; k++) pts.push(new P(false, true, 0, 0));   // phantom points: the advance comes from HVAR
        vp.transformPoints(gid, pts); d.points = pts.slice(0, -4);
      } else if (d.numberOfContours < 0 && d.components) {
        const PP = font.getGlyph(0)._decode?.()?.points?.[0]?.constructor;
        if (PP) {
          const pts = d.components.map(cp => new PP(true, true, cp.dx, cp.dy)); for (let k = 0; k < 4; k++) pts.push(new PP(false, true, 0, 0));
          vp.transformPoints(gid, pts); d.components.forEach((cp, k) => { cp.dx = pts[k].x; cp.dy = pts[k].y; });
        }
        d.components.forEach(cp => vary(cp.glyphID));
      }
    };
    return { font, vary };
  });
}
function encodeGlyph(contours) {   // a simple TrueType glyph from point contours; coordinates rounded to font units
  const pts = [], ends = [];
  contours.forEach(c => { if (!c.length) return; c.forEach(p => pts.push([Math.round(p.x), Math.round(p.y), p.onCurve ? 1 : 0])); ends.push(pts.length - 1); });
  if (!pts.length) return { buf: Buffer.alloc(0), xMin: 0, xMax: 0, yMin: 0, yMax: 0, n: 0, nc: 0 };
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const bb = { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
  const flags = [], xb = [], yb = [];
  let lx = 0, ly = 0;
  for (const [x, y, on] of pts) {
    let f = on, dx = x - lx, dy = y - ly; lx = x; ly = y;
    if (dx === 0) f |= 0x10; else if (Math.abs(dx) <= 255) { f |= 0x02 | (dx > 0 ? 0x10 : 0); xb.push(Math.abs(dx)); } else xb.push(dx >> 8 & 255, dx & 255);
    if (dy === 0) f |= 0x20; else if (Math.abs(dy) <= 255) { f |= 0x04 | (dy > 0 ? 0x20 : 0); yb.push(Math.abs(dy)); } else yb.push(dy >> 8 & 255, dy & 255);
    flags.push(f);
  }
  const fb = [];   // run-length the flags (REPEAT)
  for (let i = 0; i < flags.length;) { let r = 0; while (i + r + 1 < flags.length && flags[i + r + 1] === flags[i] && r < 255) r++; if (r > 0) { fb.push(flags[i] | 0x08, r); i += r + 1; } else { fb.push(flags[i]); i++; } }
  const head = Buffer.alloc(10 + 2 * ends.length + 2);
  head.writeInt16BE(ends.length, 0); head.writeInt16BE(bb.xMin, 2); head.writeInt16BE(bb.yMin, 4); head.writeInt16BE(bb.xMax, 6); head.writeInt16BE(bb.yMax, 8);
  ends.forEach((e, i) => head.writeUInt16BE(e, 10 + 2 * i)); head.writeUInt16BE(0, 10 + 2 * ends.length);   // no instructions
  let buf = Buffer.concat([head, Buffer.from(fb), Buffer.from(xb), Buffer.from(yb)]);
  buf = Buffer.concat([buf, Buffer.alloc((4 - buf.length % 4) % 4)]);
  return { buf, ...bb, n: pts.length, nc: ends.length };
}
function buildWeight(fontkit, files, chars, weight, family) {
  const fonts = weightFonts(fontkit, files, weight);
  const base = fonts.find(f => f.font.hasGlyphForCodePoint(0x41)) || fonts[0];
  const items = [{ f: base, gid: 0 }], map = new Map(), missing = [];
  for (const ch of chars) {
    const cp = ch.codePointAt(0); if (cp < 32 || cp >= 0xFFFF || map.has(cp)) continue;
    const f = fonts.find(x => x.font.hasGlyphForCodePoint(cp));
    if (!f) { missing.push(ch); continue; }
    map.set(cp, items.length); items.push({ f, gid: f.font.glyphForCodePoint(cp).id });
  }
  const glyf = [], loca = [0], hmtx = [], bb = { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  let off = 0, maxPts = 0, maxCnt = 0, advMax = 0, minL = 0, minR = 0, xExt = 0;
  items.forEach(({ f, gid }) => {
    f.vary(gid);
    const g = f.font.getGlyph(gid), e = encodeGlyph(g._getContours()), adv = Math.max(0, Math.round(g.advanceWidth));
    glyf.push(e.buf); off += e.buf.length; loca.push(off);
    hmtx.push([adv, e.xMin]); advMax = Math.max(advMax, adv);
    if (e.n) {
      bb.xMin = Math.min(bb.xMin, e.xMin); bb.yMin = Math.min(bb.yMin, e.yMin); bb.xMax = Math.max(bb.xMax, e.xMax); bb.yMax = Math.max(bb.yMax, e.yMax);
      minL = Math.min(minL, e.xMin); minR = Math.min(minR, adv - e.xMax); xExt = Math.max(xExt, e.xMax);
      maxPts = Math.max(maxPts, e.n); maxCnt = Math.max(maxCnt, e.nc);
    }
  });
  const n = items.length;
  const head = Buffer.from(rawTable(base.font, 'head').subarray(0, 54));
  head.writeInt16BE(bb.xMin, 36); head.writeInt16BE(bb.yMin, 38); head.writeInt16BE(bb.xMax, 40); head.writeInt16BE(bb.yMax, 42);
  head.writeUInt16BE(weight >= 600 ? 1 : 0, 44);                  // macStyle bold
  head.writeInt16BE(1, 50);                                      // long loca
  const hhea = Buffer.from(rawTable(base.font, 'hhea').subarray(0, 36));
  hhea.writeUInt16BE(advMax, 10); hhea.writeInt16BE(minL, 12); hhea.writeInt16BE(minR, 14); hhea.writeInt16BE(xExt, 16); hhea.writeUInt16BE(n, 34);
  const maxp = Buffer.alloc(32); maxp.writeUInt32BE(0x00010000, 0); maxp.writeUInt16BE(n, 4); maxp.writeUInt16BE(maxPts, 6); maxp.writeUInt16BE(maxCnt, 8);
  maxp.writeUInt16BE(2, 14);                                      // maxZones
  const hm = Buffer.alloc(4 * n); hmtx.forEach(([a, l], i) => { hm.writeUInt16BE(a, 4 * i); hm.writeInt16BE(l, 4 * i + 2); });
  const lo = Buffer.alloc(4 * (n + 1)); loca.forEach((v, i) => lo.writeUInt32BE(v, 4 * i));
  const os2 = Buffer.from(rawTable(base.font, 'OS/2'));
  os2.writeUInt16BE(weight, 4);                                   // usWeightClass
  os2.writeUInt16BE(weight >= 600 ? 0x20 : 0x40, 62);             // fsSelection: BOLD or REGULAR
  const post = Buffer.alloc(32); post.writeUInt32BE(0x00030000, 0);
  const src = base.font.name.records, en = r => (r && (r.en || Object.values(r)[0])) || '';
  const tabs = [{ tag: 'glyf', data: Buffer.concat(glyf) }, { tag: 'loca', data: lo }, { tag: 'hmtx', data: hm }, { tag: 'head', data: head },
    { tag: 'hhea', data: hhea }, { tag: 'maxp', data: maxp }, { tag: 'cmap', data: cmap4(map) }, { tag: 'OS/2', data: os2 }, { tag: 'post', data: post },
    { tag: 'name', data: nameTable([[0, en(src.copyright)], [1, family], [2, weight >= 600 ? 'Bold' : 'Regular'], [3, `${family}-${weight}`],
      [4, `${family} ${weight}`], [5, 'Version 1.0'], [6, `${family.replace(/\s+/g, '')}-${weight}`],
      [13, 'This Font Software is licensed under the SIL Open Font License, Version 1.1. A subset of Noto Sans SC.'], [14, en(src.licenseURL) || 'https://openfontlicense.org']]) }];
  return { buf: sfnt(tabs), glyphs: n - 1, missing: missing.join('') };
}

if (cmd === 'bundle') {
  // bundleToSingleHtml is not in the package's public exports (only ./api is); it lives in dist/compiler-<hash>.js of the
  // pinned hyperframes version. A version bump can rename the chunk, so look it up instead of hard-coding the hash.
  const pkgDir = path.dirname(req.resolve('hyperframes/package.json')), dist = path.join(pkgDir, 'dist');
  const f = fs.readdirSync(dist).find(n => /^compiler-[A-Z0-9]+\.js$/.test(n));
  if (!f) throw new Error(`hyperframes 的 dist 里没有 compiler-*.js（${pkgDir}）：版本不对，重跑 python3 scripts/standard.py install`);
  const { bundleToSingleHtml } = await import(pathToFileURL(path.join(dist, f)).href);
  if (typeof bundleToSingleHtml !== 'function') throw new Error(`${f} 里没有 bundleToSingleHtml：hyperframes 版本不对`);
  const html = await bundleToSingleHtml(path.resolve(a));
  fs.writeFileSync(b, html);
  console.log(JSON.stringify({ bytes: Buffer.byteLength(html), compiler: f, version: req('hyperframes/package.json').version }));
} else if (cmd === 'fonts') {
  const fontkit = req('fontkit');
  const dir = path.join(path.dirname(req.resolve('@fontsource-variable/noto-sans-sc/package.json')), 'files');
  // numbered CJK slices first, then the latin / cyrillic / vietnamese ones (a character found twice comes from the first)
  const files = fs.readdirSync(dir).filter(n => n.endsWith('.woff2')).sort((x, y) => (/-\d+-wght/.test(y) - /-\d+-wght/.test(x)) || x.localeCompare(y, 'en', { numeric: true })).map(n => path.join(dir, n));
  const chars = [...new Set(Array.from(fs.readFileSync(a, 'utf8')))];
  fs.mkdirSync(b, { recursive: true });
  const out = {};
  for (const w of String(c || '400,700').split(',').map(Number)) {
    const r = buildWeight(fontkit, files, chars, w, 'VP Sans');
    fs.writeFileSync(path.join(b, `vp-sans-${w}.ttf`), r.buf);
    out[w] = { bytes: r.buf.length, glyphs: r.glyphs, missing: r.missing };
  }
  console.log(JSON.stringify(out));
} else if (cmd === 'page') {
  const puppeteer = createRequire(req.resolve('hyperframes/package.json'))('puppeteer-core');
  const timeout = 1000 * +(process.env.VP_PAGE_TIMEOUT || 900);
  const browser = await puppeteer.launch({ executablePath: process.env.VP_CHROME, headless: true, protocolTimeout: timeout,
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--mute-audio'], defaultViewport: { width: 1280, height: 1000 } });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(a, { waitUntil: 'load', timeout: 120000 });
    // either the result appears, or the player's red error box (boot() failed)
    await page.waitForFunction(sel => document.querySelector(sel) || document.querySelector('body > pre[style]'), { timeout, polling: 250 }, b);
    const r = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? { ok: true, text: e.textContent } : { ok: false, text: document.querySelector('body > pre[style]').textContent }; }, b);
    fs.writeFileSync(c, r.text);
    console.log(JSON.stringify({ ok: r.ok, bytes: r.text.length, error: r.ok ? '' : r.text, pageErrors: errors.slice(0, 5) }));
  } finally { await browser.close(); }
} else {
  console.error('usage: standard_node.mjs bundle <project> <out.html> | fonts <text file> <out dir> [400,700] | page <url> <selector> <out>');
  process.exit(2);
}
