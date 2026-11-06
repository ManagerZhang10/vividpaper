// Node side of the HyperFrames prototype; vp_hf.py calls it. Uses only what the hyperframes package already ships.
//   node vp_hf_node.mjs bundle <project dir> <out.html>     HyperFrames' own single-file bundler (same one check/snapshot/render load)
//   node vp_hf_node.mjs subset <font file> <text file> <out> keep only the glyphs the film uses (fontkit, a hyperframes dependency)
// The hyperframes package is found from VP_HF_PKG (its directory) or from node_modules next to the current directory.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const pkgDir = process.env.VP_HF_PKG || path.dirname(createRequire(path.join(process.cwd(), 'x.js')).resolve('hyperframes/package.json'));
const req = createRequire(path.join(pkgDir, 'package.json'));
const [cmd, a, b, c] = process.argv.slice(2);

// fontkit 2.0.4 subsets for PDF embedding: glyf/head/hhea/hmtx/loca/maxp/prep only (no cmap, OS/2, name, post), under
// the 'true' sfnt tag, tables not 4-byte aligned. Chrome's font sanitiser (OTS) rejects that. Add a cmap built from the
// subset's own glyph mapping, copy OS/2 and name (copyright, OFL licence) from the source, a version-3 post, and lay
// the tables out the standard way.
function readTables(src) {
  const n = src.readUInt16BE(4), tabs = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + 16 * i, off = src.readUInt32BE(o + 8), len = src.readUInt32BE(o + 12);
    tabs.push({ tag: src.toString('latin1', o, o + 4), data: Buffer.from(src.subarray(off, off + len)) });
  }
  return tabs;
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
function repack(sub, source, map) {
  const tabs = readTables(sub).filter(t => !['cmap', 'OS/2', 'name', 'post'].includes(t.tag)), srcT = readTables(source);
  const from = tag => srcT.find(t => t.tag === tag);
  tabs.push({ tag: 'cmap', data: cmap4(map) }, { tag: 'OS/2', data: from('OS/2').data }, { tag: 'name', data: from('name').data });
  const post = Buffer.from(from('post').data.subarray(0, 32)); post.writeUInt32BE(0x00030000, 0); tabs.push({ tag: 'post', data: post });
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

if (cmd === 'bundle') {
  // bundleToSingleHtml is not in the package's public exports (only ./api is); it lives in dist/compiler-<hash>.js.
  // Pinned to hyperframes@0.9.19; a version bump can rename the chunk, so look it up instead of hard-coding the hash.
  const dist = path.join(pkgDir, 'dist');
  const f = fs.readdirSync(dist).find(n => /^compiler-[A-Z0-9]+\.js$/.test(n));
  if (!f) throw new Error(`no dist/compiler-*.js in ${pkgDir}`);
  const { bundleToSingleHtml } = await import(pathToFileURL(path.join(dist, f)).href);
  if (typeof bundleToSingleHtml !== 'function') throw new Error(`${f} has no bundleToSingleHtml`);
  const html = await bundleToSingleHtml(path.resolve(a));
  fs.writeFileSync(b, html);
  console.log(JSON.stringify({ bytes: Buffer.byteLength(html), compiler: f }));
} else if (cmd === 'subset') {
  const fontkit = await import(pathToFileURL(req.resolve('fontkit')).href);
  const font = (fontkit.default || fontkit).openSync(a);
  const s = font.createSubset(), map = new Map();
  const chars = new Set(Array.from(fs.readFileSync(b, 'utf8')));
  let missing = [];
  for (const ch of chars) {
    const cp = ch.codePointAt(0); if (cp < 32) continue;
    const g = font.glyphForCodePoint(cp);
    if (!g || g.id === 0) missing.push(ch); else map.set(cp, s.includeGlyph(g));
  }
  const buf = repack(Buffer.from(s.encode()), fs.readFileSync(a), map);
  fs.writeFileSync(c, buf);
  console.log(JSON.stringify({ bytes: buf.length, glyphs: chars.size - missing.length, missing: missing.join('') }));
} else {
  console.error('usage: vp_hf_node.mjs bundle <project> <out.html> | subset <font> <text> <out>');
  process.exit(2);
}
