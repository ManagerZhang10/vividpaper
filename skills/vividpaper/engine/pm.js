// VividPaper engine · 张指导出品
// Every frame is a pure function of time t: the same t always gives the same picture.
// No CSS animation and no real clock inside draw(); that is what makes seeking, 4× and the self-check work.
'use strict';
const PM = (() => {
  const W = 1080, H = 1440;
  const BRAND = '张指导出品', TOOL = 'VividPaper', SLOGAN = '3 分钟看懂一篇论文';
  const COL = {
    bg: '#0B0B0E', panel: '#15151A', fg: '#F4F3EF', sub: '#C9C9CF', dim: '#8A8A92', faint: '#3A3A42', line: '#26262C',
    acc: '#FF6A2C', acc2: '#FFB089', blue: '#5AA9FF', green: '#3DDC97', yellow: '#FFD23F', purple: '#B48CFF', red: '#FF4B4B', white: '#FFFFFF',
  };
  const CN = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  const FONT = {
    cn: (s, w) => `${w} ${s}px -apple-system,"SF Pro Text","Helvetica Neue",Arial,${CN}`,
    mono: (s, w) => `${w} ${s}px ui-monospace,"SF Mono",Menlo,Consolas,monospace`,
    disp: (s, w) => `${w} ${s}px -apple-system,"SF Pro Display","Helvetica Neue",Arial,${CN}`,
  };
  const ZONE = { top: 130, bottom: 1190, cap: 1300 };   // content lives between top and bottom; captions below

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    lin: k => k,
    out: k => 1 - Math.pow(1 - k, 3),
    in: k => k * k * k,
    io: k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: k => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  };
  const prog = (t, a, d, e = 'out') => E[e](clamp((t - a) / Math.max(d, 1e-6)));
  const win = (t, a, b, fi = .3, fo = .3) => (t < a || t > b) ? 0 : Math.min(E.out(clamp((t - a) / fi)), 1 - E.in(clamp((t - (b - fo)) / fo)));
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  let C, X, FILM = null, TL = null, LOG = null;
  const IMG = {}, CACHE = {};

  // ---------- timeline ----------
  // A caption line stays up long enough to be read: ~0.17 s per Chinese character, 0.3 s per English word.
  function lineDur(s) {
    const t = s.replace(/\*\*/g, '');
    const cjk = (t.match(/[㐀-鿿]/g) || []).length, words = (t.match(/[A-Za-z0-9.√_]+/g) || []).length;
    return Math.max(2.4, 0.6 + 0.17 * cjk + 0.3 * words);
  }
  // Voice-over (optional): build.py fills PM_VOICE.clips from voice/ — spoken text → { src, dur: clip length, end: where the speech ends }.
  // With a clip, a line lasts as long as it takes to say (+ GAP), so every action hung on g.L(i) moves with the voice.
  const GAP = 0.4;
  const txt = q => typeof q === 'string' ? q : q.text;
  // what gets read aloud: `say` verbatim, otherwise the caption without **, with the film's `pronounce` substitutions,
  // then formula notation made sayable — TTS reads x_t as 「x 下划线 t」, N²−N as 「N 平方负 N」 and drops the 1 of x₁
  function spoken(f, q) {
    if (typeof q !== 'string' && q.say != null) return q.say.trim();
    let s = txt(q).replace(/\*\*/g, '');
    Object.entries(f.pronounce || {}).forEach(([a, b]) => { s = s.split(a).join(b); });
    return s
      .replace(/[₀-₉]/g, c => ' ' + (c.charCodeAt(0) - 0x2080))
      .replace(/([A-Za-z0-9Ͱ-Ͽ)²³ā])\s*−\s*/g, '$1 减 ')   // − between two terms is minus; a leading −2 stays negative
      .replace(/²/g, ' 平方').replace(/³/g, ' 立方')
      .replace(/_/g, ' ').replace(/‖/g, '').replace(/\s*→\s*/g, '，')
      .replace(/ {2,}/g, ' ').trim();
  }
  const clipOf = s => (window.PM_VOICE && window.PM_VOICE.clips[s]) || null;
  function timeline(f) {
    const voice = [];   // every piece of narration in order: { sc, t (scene-local start), say, clip }
    const qSay = f.question ? '这篇论文回答一个问题：' + spoken(f, f.question) : '', qc = clipOf(qSay);
    const sc = [{ id: 'intro', name: '片头', builtin: 'intro', lines: [], dur: qc ? Math.max(3.6, 1.0 + qc.end + 0.8) : 3.6 }];
    if (qSay) voice.push({ sc: sc[0], t: 1.0, say: qSay, clip: qc });
    f.scenes.forEach((s, i) => {
      const lines = [], scene = { ...s, num: i + 1, lines }; let u = s.lead ?? 0.5;
      (s.lines || []).forEach(l => {
        const o = typeof l === 'string' ? { text: l } : l, say = spoken(f, o), c = clipOf(say);
        const d = c ? Math.max(o.dur ?? 0, c.end + GAP + (o.hold || 0)) : o.dur ?? lineDur(o.text) + (o.hold || 0);
        lines.push({ text: o.text, t0: u, t1: u + d }); voice.push({ sc: scene, t: u, say, clip: c }); u += d;
      });
      scene.dur = u + (s.tail ?? 0.8); sc.push(scene);
    });
    // recap items come up one by one: every 1.7 s, or once the previous one has been said
    const recapT = []; let u = .6;
    if ((f.recap || []).length) {   // spoken lead-in under the 「最后回顾」 heading; silent films don't wait for it
      const say = '我们最后回顾一下', c = clipOf(say);
      voice.push({ sc: null, t: u, say, clip: c }); if (c) u += c.end + GAP;
    }
    (f.recap || []).forEach(r => {
      const say = spoken(f, r), c = clipOf(say);
      recapT.push(u); voice.push({ sc: null, t: u, say, clip: c }); u += Math.max(1.7, c ? c.end + GAP : 0);
    });
    const outro = { id: 'outro', name: '回顾', builtin: 'outro', lines: [], recapT, dur: u + .6 + 3.2 }; sc.push(outro);
    voice.forEach(v => { v.sc = v.sc || outro; });
    let t = 0; sc.forEach(s => { s.t0 = t; t += s.dur; });
    voice.forEach(v => { v.t += v.sc.t0; });
    return { scenes: sc, total: t, voice };
  }
  function sceneAt(t) { const s = TL.scenes; for (let i = s.length - 1; i >= 0; i--) if (t >= s[i].t0) return s[i]; return s[0]; }

  // ---------- low-level drawing ----------
  function withA(a, fn) { if (a <= 0.001) return; X.save(); X.globalAlpha *= a; fn(); X.restore(); }
  function log(kind, x0, y0, x1, y1, extra) { if (LOG) LOG.items.push({ kind, x0, y0, x1, y1, ...extra }); }

  // "a **b** c" → [[a, base], [b, hl], [c, base]]
  function spans(s, base, hl) {
    const out = [];
    String(s).split(/(\*\*[^*]+\*\*)/).forEach(p => { if (!p) return; out.push(p.startsWith('**') ? [p.slice(2, -2), hl] : [p, base]); });
    return out;
  }
  function rich(parts, x, y, o = {}) {
    let size = o.size ?? 40; const w = o.weight ?? 600, f = FONT[o.font ?? 'cn'];
    X.font = f(size, w);
    let tw = parts.reduce((a, p) => a + X.measureText(p[0]).width, 0);
    if (o.maxW && tw > o.maxW) { size = Math.floor(size * o.maxW / tw); X.font = f(size, w); tw = parts.reduce((a, p) => a + X.measureText(p[0]).width, 0); }
    const align = o.align ?? 'center';
    let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
    const x0 = cx;
    withA(o.alpha ?? 1, () => {
      X.textAlign = 'left'; X.textBaseline = o.base ?? 'middle';
      for (const [s, c] of parts) { X.fillStyle = c; X.fillText(s, cx, y); cx += X.measureText(s).width; }
    });
    if ((o.alpha ?? 1) > 0.05) log(o.kind ?? 'text', x0, y - size / 2, x0 + tw, y + size / 2, { size, s: parts.map(p => p[0]).join(''), a: X.globalAlpha * (o.alpha ?? 1) });
    return { x: x0, y: y - size / 2, w: tw, h: size };
  }

  // ---------- drawing helpers (all coordinates are absolute on the 1080×1440 stage) ----------
  const D = {
    text(s, x, y, o = {}) { return rich(spans(s, o.color ?? COL.fg, o.hl ?? COL.acc), x, y, o); },
    rich,
    rect(x, y, w, h, o = {}) {
      withA(o.alpha ?? 1, () => {
        X.beginPath(); X.roundRect(x, y, w, h, o.r ?? 14);
        if (o.fill) { X.fillStyle = o.fill; X.fill(); }
        if (o.stroke) { X.strokeStyle = o.stroke; X.lineWidth = o.lw ?? 3; X.setLineDash(o.dash || []); X.stroke(); X.setLineDash([]); }
      });
      if ((o.alpha ?? 1) > 0.05) log('rect', x, y, x + w, y + h);
      return { x, y, w, h };
    },
    circle(x, y, r, o = {}) {
      withA(o.alpha ?? 1, () => {
        X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2);
        if (o.fill) { X.fillStyle = o.fill; X.fill(); }
        if (o.stroke) { X.strokeStyle = o.stroke; X.lineWidth = o.lw ?? 3; X.stroke(); }
      });
      if (o.fill && (o.alpha ?? 1) > 0.05) log('shape', x - r, y - r, x + r, y + r);   // outline-only rings may sweep past the edge
    },
    // straight line; k = how much of it is drawn (0..1); head = arrowhead at the end
    line(x1, y1, x2, y2, o = {}) { return D.path([[x1, y1], [x2, y2]], o); },
    arrow(x1, y1, x2, y2, o = {}) { return D.path([[x1, y1], [x2, y2]], { head: 18, ...o }); },
    // quadratic curve bent sideways by `bend` px
    curve(x1, y1, x2, y2, o = {}) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
      const b = o.bend ?? L * .25, cx = mx - dy / L * b, cy = my + dx / L * b, pts = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2]); }
      return D.path(pts, o);
    },
    path(pts, o = {}) {
      const k = clamp(o.k ?? 1); if (k <= 0) return;
      let total = 0; const seg = [];
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
      let left = total * k; const out = [pts[0]];
      for (let i = 1; i < pts.length && left > 0; i++) {
        const l = seg[i - 1], u = Math.min(1, left / (l || 1));
        out.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]); left -= l;
      }
      withA(o.alpha ?? 1, () => {
        X.strokeStyle = o.color ?? COL.sub; X.lineWidth = o.lw ?? 4; X.lineCap = 'round'; X.lineJoin = 'round'; X.setLineDash(o.dash || []);
        X.beginPath(); out.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.stroke(); X.setLineDash([]);
        if (o.head && out.length > 1) {
          const [a, b] = [out[out.length - 2], out[out.length - 1]], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hs = o.head;
          X.fillStyle = o.color ?? COL.sub; X.beginPath(); X.moveTo(b[0], b[1]);
          X.lineTo(b[0] - hs * Math.cos(ang - .45), b[1] - hs * Math.sin(ang - .45)); X.lineTo(b[0] - hs * Math.cos(ang + .45), b[1] - hs * Math.sin(ang + .45)); X.closePath(); X.fill();
        }
      });
    },
    // a figure from figures/; h omitted → keep aspect. card: true puts it on a white card (paper figures are drawn for white).
    img(name, x, y, w, h, o = {}) {
      const im = IMG[name]; if (!im) throw new Error(`没有图片 ${name}（放进 figures/ 再 build）`);
      const cr = o.crop || [0, 0, 1, 1], sw = im.width * (cr[2] - cr[0]), sh = im.height * (cr[3] - cr[1]);
      if (h == null) h = w * sh / sw;
      const pad = o.card ? (o.pad ?? 18) : 0;
      withA(o.alpha ?? 1, () => {
        if (o.card) { X.beginPath(); X.roundRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad, 16); X.fillStyle = o.cardColor ?? '#FFFFFF'; X.fill(); }
        X.save();
        if (o.radius) { X.beginPath(); X.roundRect(x, y, w, h, o.radius); X.clip(); }
        X.imageSmoothingEnabled = o.smooth !== false; X.imageSmoothingQuality = 'high';
        X.drawImage(im, im.width * cr[0], im.height * cr[1], sw, sh, x, y, w, h);
        if (o.tint) { X.globalCompositeOperation = 'multiply'; X.globalAlpha *= o.tint.alpha ?? 1; X.fillStyle = o.tint.color; X.fillRect(x, y, w, h); }
        X.restore();
      });
      if ((o.alpha ?? 1) > 0.05) log('img', x - pad, y - pad, x + w + pad, y + h + pad);
      // helpers to point at things inside the figure, in 0..1 figure coordinates
      return { x, y, w, h, at: (fx, fy) => [x + fx * w, y + fy * h], box: (fx0, fy0, fx1, fy1) => [x + fx0 * w, y + fy0 * h, (fx1 - fx0) * w, (fy1 - fy0) * h] };
    },
    // the loaded Image of figures/<name>, e.g. to read pixels once inside g.cache
    image(name) { const im = IMG[name]; if (!im) throw new Error(`没有图片 ${name}（放进 figures/ 再 build）`); return im; },
    // an offscreen canvas built once by fn(ctx, canvas) and reused; key must depend only on fixed parameters, never on t
    cache(key, w, h, fn) {
      if (!CACHE[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d', { willReadFrequently: true }), c); CACHE[key] = c; }
      return CACHE[key];
    },
    // filled / stroked polygon
    poly(pts, o = {}) {
      withA(o.alpha ?? 1, () => {
        X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); if (o.close !== false) X.closePath();
        if (o.fill) { X.fillStyle = o.fill; X.fill(); }
        if (o.stroke) { X.strokeStyle = o.stroke; X.lineWidth = o.lw ?? 3; X.stroke(); }
      });
      if ((o.alpha ?? 1) > 0.05) log('shape', Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1])));
    },
    // point at fraction u (0..1) of the way along a polyline — move a dot along a path
    along(pts, u) {
      let total = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
      let left = clamp(u) * total;
      for (let i = 1; i < pts.length; i++) { if (left <= seg[i - 1] || i === pts.length - 1) { const k = clamp(left / (seg[i - 1] || 1)); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; } left -= seg[i - 1]; }
      return pts[0];
    },
    // highlight frame that draws itself in (k: 0..1), with an optional label chip
    mark(x, y, w, h, o = {}) {
      if (Array.isArray(x)) { o = y || {}; [x, y, w, h] = x; }
      const k = clamp(o.k ?? 1), c = o.color ?? COL.acc, r = o.r ?? 10;
      if (k <= 0) return;
      const pts = [[x + r, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y], [x + r, y]];
      D.path(pts, { k, color: c, lw: o.lw ?? 5, alpha: o.alpha ?? 1 });
      if (o.fill) withA((o.alpha ?? 1) * k, () => { X.fillStyle = rgba(c, o.fill); X.fillRect(x, y, w, h); });
      if (o.label) {
        const side = o.side ?? 'right', s = o.labelSize ?? 30, a = clamp((k - .5) * 2) * (o.alpha ?? 1);
        if (o.leader) {   // label sits at leader=[x, y] (outside the figure), a dashed line runs back to the frame
          const [lx, ly] = o.leader, ex = clamp(lx, x, x + w), ey = clamp(ly, y, y + h);
          D.line(ex, ey, lx, ly, { color: c, lw: 3, dash: [6, 6], alpha: a });
          D.chip(o.label, lx, ly, { size: s, color: c, solid: true, align: lx >= x + w ? 'left' : lx <= x ? 'right' : 'center', alpha: a });
        } else {
          const pos = { right: [x + w + 16, y + h / 2, 'left'], left: [x - 16, y + h / 2, 'right'], top: [x + w / 2, y - s * .9, 'center'], bottom: [x + w / 2, y + h + s * .9, 'center'], inside: [x + 12, y + s * .9 + 4, 'left'] }[side];
          D.chip(o.label, pos[0] + (o.dx ?? 0), pos[1] + (o.dy ?? 0), { size: s, color: c, solid: true, align: pos[2], alpha: a });
        }
      }
    },
    chip(s, x, y, o = {}) {
      const size = o.size ?? 28, c = o.color ?? COL.acc, px = size * .55;
      X.font = FONT.cn(size, 600); const tw = spans(s).reduce((a, p) => a + X.measureText(p[0]).width, 0), w = tw + px * 2, h = size * 1.6;
      const align = o.align ?? 'center', x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      D.rect(x0, y - h / 2, w, h, { r: h / 2, fill: o.solid ? c : rgba(c, .16), stroke: o.solid ? null : rgba(c, .5), lw: 2, alpha: o.alpha ?? 1 });
      rich(spans(s, o.solid ? '#111' : c, o.solid ? '#111' : COL.fg), x0 + px, y, { size, align: 'left', alpha: o.alpha ?? 1, kind: o.kind });
      return { x: x0, y: y - h / 2, w, h };
    },
    // small source line, e.g. "图：论文 Figure 1"
    note(s, x, y, o = {}) { return D.text(s, x, y, { size: 22, weight: 500, color: COL.dim, align: 'right', kind: 'note', ...o }); },
    // a row (or rows) of word boxes. Returns their rects so you can draw lines between them.
    // style(i) → {alpha, fill, stroke, color, lw, dy, dx}
    tokens(words, cx, y, o = {}) {
      const size = o.size ?? 34, px = o.padX ?? 16, h = o.h ?? size * 1.75, gap = o.gap ?? 12, maxW = o.maxW ?? 980, rowGap = o.rowGap ?? 26;
      X.font = FONT[o.font ?? 'disp'](size, 600);
      const ws = words.map(w => X.measureText(w).width + px * 2);
      const rows = [[]]; let cur = 0;
      ws.forEach((w, i) => { const brk = o.breaks ? o.breaks.includes(i) : (cur + w > maxW && rows[rows.length - 1].length); if (brk) { rows.push([]); cur = 0; } rows[rows.length - 1].push(i); cur += w + gap; });
      const rects = [];
      rows.forEach((r, ri) => {
        const rw = r.reduce((a, i) => a + ws[i], 0) + gap * (r.length - 1); let x = cx - rw / 2;
        r.forEach(i => { rects[i] = { x, y: y + ri * (h + rowGap), w: ws[i], h }; x += ws[i] + gap; });
      });
      rects.forEach((r, i) => { r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2; r.top = r.y; r.bottom = r.y + r.h; r.word = words[i]; });
      if (o.draw === false) return rects;
      words.forEach((w, i) => {
        const st = { alpha: 1, fill: COL.panel, stroke: COL.faint, color: COL.fg, lw: 2, dx: 0, dy: 0, ...(o.style ? o.style(i, words[i]) : {}) };
        const r = rects[i];
        D.rect(r.x + st.dx, r.y + st.dy, r.w, r.h, { r: 12, fill: st.fill, stroke: st.stroke, lw: st.lw, alpha: st.alpha });
        D.text(w, r.cx + st.dx, r.cy + st.dy + 1, { size, font: o.font ?? 'disp', color: st.color, alpha: st.alpha });
      });
      return rects;
    },
    // a vector as a strip of cells; vals in 0..1 set the brightness. k reveals cells left to right.
    vec(x, y, vals, o = {}) {
      const c = o.cell ?? 28, g = o.gap ?? 3, col = o.color ?? COL.acc, n = vals.length, k = o.k ?? 1, vert = o.dir === 'v';
      vals.forEach((v, i) => {
        if (i >= Math.ceil(k * n - 1e-6)) return;
        const xx = vert ? x : x + i * (c + g), yy = vert ? y + i * (c + g) : y;
        D.rect(xx, yy, c, c, { r: 5, fill: rgba(col, .12 + .88 * clamp(v)), alpha: o.alpha ?? 1 });
      });
      const L = n * (c + g) - g;
      return vert ? { x, y, w: c, h: L } : { x, y, w: L, h: c };
    },
    // matrix of cells. M[i][j] in 0..1. rows/cols: labels. mask(i,j) → true greys the cell out. k reveals row by row.
    heat(x, y, M, o = {}) {
      const c = o.cell ?? 56, g = o.gap ?? 4, col = o.color ?? COL.acc, R = M.length, K = M[0].length, k = o.k ?? 1, a = o.alpha ?? 1;
      for (let i = 0; i < R; i++) for (let j = 0; j < K; j++) {
        const idx = i * K + j; if (idx >= Math.ceil(k * R * K - 1e-6)) continue;
        const xx = x + j * (c + g), yy = y + i * (c + g);
        if (o.mask && o.mask(i, j)) {
          D.rect(xx, yy, c, c, { r: 6, fill: '#1A1A1F', alpha: a });
          withA(a * .6, () => { X.strokeStyle = COL.faint; X.lineWidth = 2; X.beginPath(); X.moveTo(xx + 8, yy + c - 8); X.lineTo(xx + c - 8, yy + 8); X.stroke(); });
        } else D.rect(xx, yy, c, c, { r: 6, fill: rgba(col, .08 + .92 * clamp(M[i][j])), alpha: a });
        if (o.text && !(o.mask && o.mask(i, j))) { const s = o.text(i, j); if (s != null && s !== '') D.text(String(s), xx + c / 2, yy + c / 2 + 1, { size: o.textSize ?? Math.round(c * .36), font: 'disp', color: M[i][j] > .55 ? '#111' : COL.fg, alpha: a }); }
      }
      (o.hi || []).forEach(([i, j]) => D.rect(x + j * (c + g) - 3, y + i * (c + g) - 3, c + 6, c + 6, { r: 8, stroke: o.hiColor ?? COL.fg, lw: 4, alpha: a }));
      const ls = o.labelSize ?? 26;
      (o.rows || []).forEach((s, i) => D.text(s, x - 14, y + i * (c + g) + c / 2, { size: ls, align: 'right', color: COL.sub, font: 'disp', alpha: a }));
      (o.cols || []).forEach((s, j) => {
        const cx = x + j * (c + g) + c / 2;
        if (o.rotateCols) withA(a, () => { X.save(); X.translate(cx, y - 14); X.rotate(-Math.PI / 4); rich([[s, COL.sub]], 0, 0, { size: ls, align: 'left', font: 'disp' }); X.restore(); });
        else D.text(s, cx, y - ls * .9, { size: ls, color: COL.sub, font: 'disp', alpha: a });
      });
      return { x, y, w: K * (c + g) - g, h: R * (c + g) - g, cell: (i, j) => [x + j * (c + g) + c / 2, y + i * (c + g) + c / 2] };
    },
    // horizontal bars. items: {label, value, color?, hi?, text?}. o.min/o.max set the axis, o.log for log scale.
    bars(x, y, w, items, o = {}) {
      const lw = o.labelW ?? 300, bh = o.h ?? 50, gap = o.gap ?? 18, k = o.k ?? 1, vw = o.valueW ?? 130;
      const f = v => o.log ? Math.log10(v) : v;
      const lo = f(o.min ?? 0), hi = f(o.max ?? Math.max(...items.map(i => i.value)));
      const bx = x + lw, bw = w - lw - vw, out = [];
      if (o.title) D.text(o.title, x, y - 44, { size: 30, align: 'left', color: COL.sub, alpha: o.alpha ?? 1 });
      items.forEach((it, i) => {
        const yy = y + i * (bh + gap), col = it.color ?? (it.hi ? COL.acc : COL.faint), a = (o.alpha ?? 1) * (it.alpha ?? 1);
        const len = bw * clamp((f(it.value) - lo) / (hi - lo)) * E.out(clamp(k * 1.2 - i * .04));
        D.text(it.label, bx - 16, yy + bh / 2, { size: o.labelSize ?? 28, align: 'right', color: it.hi ? COL.fg : COL.sub, alpha: a });
        D.rect(bx, yy, Math.max(len, 4), bh, { r: 8, fill: col, alpha: a });
        D.text(it.text ?? String(it.value), bx + len + 14, yy + bh / 2, { size: o.labelSize ?? 28, align: 'left', font: 'disp', color: it.hi ? COL.acc : COL.sub, alpha: a * clamp(k * 3 - 2) });
        out.push({ x: bx, y: yy, w: len, h: bh });
      });
      return out;
    },
    // plot y = fn(u), u in 0..1, fn returning -1..1, inside the box. k draws it left to right.
    wave(x, y, w, h, fn, o = {}) {
      const pts = []; for (let i = 0; i <= 160; i++) { const u = i / 160; pts.push([x + u * w, y + h / 2 - fn(u) * h / 2]); }
      D.path(pts, { lw: 4, ...o });
    },
  };

  // ---------- chrome: header, captions, brand ----------
  function brandMark(x, y, size, a = 1, align = 'right') {
    X.font = FONT.cn(size, 700); const tw = X.measureText(BRAND).width, sq = size * .62;
    const x0 = align === 'right' ? x - tw - sq - 12 : align === 'center' ? x - (tw + sq + 12) / 2 : x;
    D.rect(x0, y - sq / 2, sq, sq, { r: sq * .28, fill: COL.acc, alpha: a });
    rich([[BRAND, COL.fg]], x0 + sq + 12, y + 1, { size, weight: 700, align: 'left', alpha: a, kind: 'brand' });
  }
  function header(sc, a) {
    if (sc.builtin) return;
    D.chip(String(sc.num).padStart(2, '0'), 56, 72, { size: 26, align: 'left', alpha: a, kind: 'chrome' });
    D.text(sc.name, 128, 72, { size: 30, align: 'left', color: COL.sub, alpha: a, kind: 'chrome', maxW: 700 });
  }
  // wrap caption spans into ≤2 lines of ≤940 px; ASCII words never split, closing punctuation never starts a line
  function wrapCaption(parts, size, maxW) {
    X.font = FONT.cn(size, 600);
    const units = [];
    const WORD = /[A-Za-z0-9\u0370-\u03ff\u0300-\u036f.,'’√_\-+=/%×·‖²³⁻ᵀ−∑∈≈≤≥()[\]{}<>|]+ ?|[^A-Za-z0-9]/g;
    parts.forEach(([s, c]) => (s.match(WORD) || []).forEach(u => units.push([u, c])));
    const lines = [[]]; let w = 0;
    units.forEach(u => {
      const uw = X.measureText(u[0]).width, cur = lines[lines.length - 1];
      if (w + uw > maxW && cur.length && !/^[，。、：；！？）」』”,.!?:;)\]]/.test(u[0])) {
        const carry = [];   // an opening bracket or quote moves down with the word it opens
        while (cur.length && /^[（「『“(\[]$/.test(cur[cur.length - 1][0])) carry.unshift(cur.pop());
        lines.push(carry); w = carry.reduce((a, q) => a + X.measureText(q[0]).width, 0);
      }
      lines[lines.length - 1].push(u); w += uw;
    });
    return lines.map(l => { const m = []; l.forEach(([s, c]) => { if (m.length && m[m.length - 1][1] === c) m[m.length - 1][0] += s; else m.push([s, c]); }); if (m.length) m[m.length - 1][0] = m[m.length - 1][0].trimEnd(); return m; });
  }
  function caption(sc, lt) {
    const l = sc.lines.find(l => lt >= l.t0 && lt < l.t1); if (!l) return;
    const a = Math.min(clamp((lt - l.t0) / .15), clamp((l.t1 - lt) / .12));
    let size = 42, lines = wrapCaption(spans(l.text, COL.fg, COL.acc), size, 940);
    if (lines.length > 2) { if (LOG) LOG.warn('字幕太长', `超过两行：「${l.text.replace(/\*\*/g, '')}」`); size = 36; lines = wrapCaption(spans(l.text, COL.fg, COL.acc), size, 960); }
    const lh = size * 1.45, y0 = ZONE.cap - (lines.length - 1) * lh / 2;
    lines.forEach((ln, i) => rich(ln, W / 2, y0 + i * lh, { size, alpha: a, kind: 'caption' }));
  }

  // ---------- built-in scenes ----------
  function wrapWords(s, size, maxW, font = 'disp', w = 800) {
    X.font = FONT[font](size, w); const out = [''];
    s.split(/(\s+)/).forEach(p => { const tryL = out[out.length - 1] + p; if (X.measureText(tryL.trim()).width > maxW && out[out.length - 1].trim()) out.push(p.trim()); else out[out.length - 1] = tryL; });
    return out.map(l => l.trim()).filter(Boolean);
  }
  function wrapCN(s, size, maxW, base = COL.fg, hl = COL.acc) { return wrapCaption(spans(s, base, hl), size, maxW); }
  // tool: false (local films) drops the tool name and keeps the slogan; the 张指导出品 credit always stays
  const tag = () => FILM.tool === false ? SLOGAN : `${TOOL} · ${SLOGAN}`;
  function intro(t) {
    const p = FILM.paper || {}, a0 = prog(t, 0, .7);
    D.text(tag(), 80, 214, { size: 28, align: 'left', color: COL.dim, alpha: .5 + .5 * a0 });
    const tl = wrapWords(p.title || '', 84, 920);
    tl.forEach((s, i) => D.text(s, 80, 360 + i * 104 + (1 - a0) * 30, { size: 84, weight: 800, font: 'disp', align: 'left', alpha: .35 + .65 * a0 }));
    const yb = 360 + tl.length * 104;
    D.line(80, yb - 10, 80 + 300 * prog(t, .3, 1.2, 'io'), yb - 10, { color: COL.acc, lw: 8 });
    D.text(p.byline || '', 80, yb + 50, { size: 32, align: 'left', color: COL.sub, alpha: prog(t, .4, .6) });
    const q = prog(t, 1.0, .7);
    D.text('这篇论文回答一个问题', 80, yb + 200, { size: 32, align: 'left', color: COL.dim, alpha: q });
    wrapCN(txt(FILM.question || ''), 56, 920, COL.acc, COL.fg).forEach((ln, i) => rich(ln, 80, yb + 285 + i * 80 + (1 - q) * 24, { size: 56, weight: 700, align: 'left', alpha: q }));
    brandMark(80, 1300, 40, prog(t, .2, .6), 'left');
  }
  function outro(t, sc) {
    const r = FILM.recap || [];
    D.text('最后回顾', 80, 220, { size: 34, align: 'left', color: COL.dim, alpha: prog(t, 0, .5) });
    r.forEach((q, i) => {
      const s = txt(q), a = prog(t, sc.recapT[i], .6), y = 330 + i * 170;
      D.circle(110, y, 30, { fill: COL.acc, alpha: a });
      D.text(String(i + 1), 110, y + 1, { size: 32, weight: 800, font: 'disp', color: '#111', alpha: a });
      const ls = wrapCN(s, 40, 840);
      ls.forEach((ln, j) => rich(ln, 170, y + j * 56 - (ls.length - 1) * 28, { size: 40, align: 'left', alpha: a }));
    });
    const b = prog(t, sc.dur - 3.0, .7);
    D.line(80, 1180, 80 + 920 * b, 1180, { color: COL.faint, lw: 2 });
    brandMark(W / 2, 1270, 56, b, 'center');
    D.text(tag(), W / 2, 1350, { size: 30, color: COL.dim, alpha: b });
  }

  // ---------- one frame ----------
  let SNAP = null;
  function render(t) {
    t = clamp(t, 0, TL.total - 1e-3);
    const sc = sceneAt(t), lt = t - sc.t0;
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.fillStyle = COL.bg; X.fillRect(0, 0, W, H);
    const fade = (sc.id === 'intro' ? 1 : clamp(lt / .35)) * clamp((sc.dur - lt) / .3);
    X.save(); X.globalAlpha = fade;
    try {
      if (sc.builtin === 'intro') intro(lt);
      else if (sc.builtin === 'outro') outro(lt, sc);
      else { header(sc, 1); sc.draw(G(sc, lt)); }
    } catch (e) {
      if (LOG) LOG.warn('报错', `${sc.id}: ${e.message}`); else console.error(e);
      X.restore(); X.save(); D.text('⚠ ' + e.message, W / 2, H / 2, { size: 28, color: COL.red, maxW: 980 });
    }
    X.restore();
    if (SNAP) SNAP(sc, lt);
    caption(sc, lt);
    if (!sc.builtin) brandMark(W - 56, 72, 26, .9);
  }
  function G(sc, t) {
    const L = i => { if (!sc.lines[i]) throw new Error(`L(${i}) 超出「${sc.id}」的字幕条数 ${sc.lines.length}`); return sc.lines[i].t0; };
    const Le = i => { L(i); return sc.lines[i].t1; };
    return { ...D, t, dur: sc.dur, W, H, COL, E, ZONE, ctx: X, clamp, lerp, rgba, L, Le,
      p: (a, d = .5, e = 'out') => prog(t, a, d, e), win: (a, b, fi, fo) => win(t, a, b, fi, fo) };
  }

  // ---------- assets ----------
  async function loadAssets() {
    const A = window.PM_ASSETS || {};
    await Promise.all(Object.entries(A).map(([k, src]) => new Promise((res, rej) => {
      const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => rej(new Error('图片加载失败 ' + k)); im.src = src;
    })));
  }

  // ---------- voice track ----------
  // All clips mixed into one track at their places on the timeline, so a single <audio> can seek, run at 2× and be unlocked by one tap.
  async function voiceTrack() {
    const items = TL.voice.filter(v => v.clip); if (!items.length) return null;
    const rate = 24000, ac = new OfflineAudioContext(1, 1, rate), out = new Float32Array(Math.ceil(TL.total * rate));
    for (const v of items) {
      const bytes = Uint8Array.from(atob(v.clip.src.split(',')[1]), c => c.charCodeAt(0));
      const d = (await ac.decodeAudioData(bytes.buffer)).getChannelData(0), at = Math.round(v.t * rate);
      for (let i = 0; i < d.length && at + i < out.length; i++) out[at + i] += d[i];
    }
    const b = new DataView(new ArrayBuffer(44 + out.length * 2)), str = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); b.setUint32(4, 36 + out.length * 2, true); str(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); str(36, 'data'); b.setUint32(40, out.length * 2, true);
    out.forEach((v, i) => b.setInt16(44 + i * 2, clamp(v, -1, 1) * 32767, true));
    return { url: URL.createObjectURL(new Blob([b], { type: 'audio/wav' })), clips: items.length, seconds: +(out.length / rate).toFixed(2) };
  }

  // ---------- self-check (?audit): sample the film, report problems, render a contact sheet ----------
  function runAudit(q) {
    const warns = [], seen = new Set();
    let cur = { t: 0, sc: null };
    const warn = (kind, msg) => { const key = kind + cur.sc + msg; if (seen.has(key)) return; seen.add(key); warns.push({ t: +cur.t.toFixed(2), scene: cur.sc, kind, msg }); };
    LOG = { items: [], warn };
    // content-only thumbnails (captured before captions are drawn) to tell whether the picture moves
    // 1/10 scale; "moved" = at least 6 thumbnail pixels changed visibly, so a label fading in counts, codec-level noise does not
    const small = document.createElement('canvas'); small.width = 108; small.height = 144; const sx = small.getContext('2d', { willReadFrequently: true });
    let grab = null; SNAP = () => { sx.drawImage(C, 0, 0, 108, 144); grab = sx.getImageData(0, 0, 108, 144).data; };
    const thumb = t => { render(t); return grab; };
    const diff = (p, d) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - p[i]) + Math.abs(d[i + 1] - p[i + 1]) + Math.abs(d[i + 2] - p[i + 2]) > 36) n++; return n >= 6 ? 1 : 0; };
    TL.scenes.filter(s => !s.builtin).forEach(sc => {
      cur.sc = sc.id;
      sc.lines.forEach((l, i) => { cur.t = sc.t0 + l.t0; if (!diff(thumb(sc.t0 + l.t0 + .25), thumb(sc.t0 + l.t1 - .1))) warn('这句画面不动', `第 ${i + 1} 句「${l.text.replace(/\*\*/g, '').slice(0, 14)}…」从头到尾画面没变化`); });
      let prev = thumb(sc.t0 + .5), run = 0, from = sc.t0 + .5;
      for (let t = sc.t0 + 1; t < sc.t0 + sc.dur - .4; t += .5) {
        const d = thumb(t);
        if (!diff(prev, d)) run += .5; else { if (run >= 6) { cur.t = from; warn('画面静止', `${from.toFixed(1)}s 起 ${run.toFixed(1)}s 没有动`); } run = 0; from = t; }
        prev = d;
      }
      if (run >= 6) { cur.t = from; warn('画面静止', `${from.toFixed(1)}s 起 ${run.toFixed(1)}s 没有动（到本幕结束）`); }
    });
    SNAP = null;
    const ov = {};
    for (let t = 0; t < TL.total; t += .25) {
      cur.t = t; const sc = sceneAt(t); cur.sc = sc.id; LOG.items = []; const nowOv = new Set();
      render(t);
      const capOn = sc.lines.some(l => t - sc.t0 >= l.t0 && t - sc.t0 < l.t1);
      for (const it of LOG.items) {
        if (it.kind === 'rect' || it.kind === 'caption') { if (it.kind === 'caption' && (it.x0 < 30 || it.x1 > W - 30)) warn('出界', '字幕超出画面'); continue; }
        if (it.x0 < 20 || it.x1 > W - 20 || it.y0 < 16 || it.y1 > H - 16) warn('出界', `${it.kind}「${(it.s || '').slice(0, 16)}」超出画面`);
        if (it.size && it.size < (it.kind === 'note' ? 20 : 22)) warn('字太小', `「${(it.s || '').slice(0, 16)}」只有 ${it.size}px`);
        if (capOn && !sc.builtin && it.kind !== 'brand' && it.kind !== 'chrome' && it.y1 > ZONE.bottom + 20) warn('压字幕', `${it.kind}「${(it.s || '').slice(0, 12)}」伸进字幕区（y>${ZONE.bottom}）`);
      }
      // two pieces of text drawn on top of each other for ≥ 1 s (moving things may cross briefly)
      const tx = LOG.items.filter(it => it.s && it.a > .9 && it.kind !== 'caption' && it.kind !== 'brand' && it.kind !== 'chrome');   // cross-fades are fine
      for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) {
        const a = tx[i], b = tx[j], ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ix > 4 && iy > 4 && ix * iy > .3 * Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0)) && a.s !== b.s) {
          const key = a.s + '|' + b.s; nowOv.add(key); ov[key] = (ov[key] || 0) + 1;
          if (ov[key] >= 4) warn('文字重叠', `「${a.s.slice(0, 10)}」和「${b.s.slice(0, 10)}」叠在一起`);
        }
      }
      for (const k in ov) if (!nowOv.has(k)) delete ov[k];
    }
    SNAP = null; LOG = null;
    if (window.PM_VOICE) TL.voice.forEach(v => {
      cur.t = v.t; cur.sc = v.sc.id;
      if (!v.clip) warn('配音', `「${v.say.slice(0, 16)}…」没有配音：改过字幕就重跑 voice.py`);
      else if (v.clip.end < .3 * lineDur(v.say)) warn('配音', `「${v.say.slice(0, 16)}…」的配音只有 ${v.clip.end.toFixed(1)} 秒，像是被截断了：重跑 voice.py`);
    });
    cur.t = 0; cur.sc = 'film';
    if (TL.total < 140) warn('总长', `只有 ${TL.total.toFixed(0)} 秒，目标 150–210 秒：加一幕或每幕加一两句`);
    if (TL.total > 240) warn('总长', `有 ${TL.total.toFixed(0)} 秒，超过 4 分钟：砍幕，不要压缩字幕`);
    // contact sheet: the moment each caption line finishes = the state the viewer is meant to see
    const shots = [];
    TL.scenes.forEach(sc => {
      if (sc.builtin === 'intro') shots.push([sc.t0 + sc.dur - .4, '片头']);
      else if (sc.builtin === 'outro') shots.push([sc.t0 + sc.dur - .4, '回顾']);
      else sc.lines.forEach((l, i) => shots.push([sc.t0 + l.t1 - .25, `${String(sc.num).padStart(2, '0')}·${i + 1}`]));
    });
    const cw = +(q.get('cell') || 270), ch = cw * 4 / 3, cols = +(q.get('cols') || 6), rows = Math.ceil(shots.length / cols);
    const sheet = document.createElement('canvas'); sheet.width = cols * cw; sheet.height = rows * (ch + 34); const S = sheet.getContext('2d');
    S.fillStyle = '#000'; S.fillRect(0, 0, sheet.width, sheet.height);
    shots.forEach(([t, lab], i) => {
      render(t); const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 34);
      S.drawImage(C, x, y + 34, cw - 4, ch - 4); S.fillStyle = '#ddd'; S.font = '600 20px -apple-system,"PingFang SC",sans-serif'; S.fillText(`${lab}  ${t.toFixed(1)}s`, x + 8, y + 24);
    });
    const frames = {};
    (q.get('at') || '').split(',').filter(Boolean).forEach(s => { render(+s); frames[s] = C.toDataURL('image/png'); });
    const vc = TL.voice.filter(v => v.clip);
    const voice = window.PM_VOICE ? { clips: vc.length, missing: TL.voice.length - vc.length, seconds: +vc.reduce((a, v) => a + v.clip.end, 0).toFixed(1), voice: window.PM_VOICE.voice } : null;
    const out = { total: +TL.total.toFixed(2), scenes: TL.scenes.map(s => ({ id: s.id, name: s.name, t0: +s.t0.toFixed(2), dur: +s.dur.toFixed(2), lines: s.lines.length })), voice, warnings: warns, sheet: sheet.toDataURL('image/png'), frames };
    const pre = document.createElement('pre'); pre.id = 'pm-audit'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  }

  // ---------- player ----------
  function player(track) {
    const $ = id => document.getElementById(id), fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    let t = 0, playing = false, last = 0, speed = 1;
    // sound: while the voice track plays it is the clock and the picture follows it; at 4× or muted, frames advance on their own
    const A = track ? new Audio(track.url) : null; let sound = !!A, blocked = false;
    const audible = () => A && sound && speed <= 2 && !blocked;
    function syncAudio() {
      if (!A) return;
      if (playing && audible()) {
        A.playbackRate = speed;
        if (Math.abs(A.currentTime - t) > .25) A.currentTime = t;
        if (A.paused) A.play().catch(() => { blocked = true; });
      } else if (!A.paused) A.pause();
    }
    if (A) {
      $('pm-snd').style.display = '';
      $('pm-snd').onclick = () => { sound = !sound; $('pm-snd').textContent = sound ? '🔊' : '🔇'; syncAudio(); };
      $('pm-keys').textContent += ' · M 开关声音';
    }
    const chapters = TL.scenes.filter(s => !s.builtin);
    $('pm-title').textContent = (FILM.paper && FILM.paper.title) || '';
    const ticks = $('pm-ticks');
    chapters.forEach(sc => {
      const b = document.createElement('button'); b.className = 'chap'; b.dataset.id = sc.id;
      b.innerHTML = `<span>${String(sc.num).padStart(2, '0')}</span>${sc.name}`; b.onclick = () => { seek(sc.t0 + .01); };
      $('pm-chaps').appendChild(b);
      const k = document.createElement('i'); k.style.left = (sc.t0 / TL.total * 100) + '%'; ticks.appendChild(k);
    });
    const seek = s => { t = clamp(s, 0, TL.total); if (A) A.currentTime = t; draw(); };
    function draw() {
      render(t);
      $('pm-time').textContent = `${fmt(t)} / ${fmt(TL.total)}`;
      $('pm-fill').style.width = (t / TL.total * 100) + '%';
      const cur = sceneAt(t).id; document.querySelectorAll('.chap').forEach(b => b.classList.toggle('on', b.dataset.id === cur));
    }
    function loop(ts) {
      if (playing) {
        if (audible() && !A.paused && A.currentTime > 0) t = A.currentTime;
        else if (last) t += (ts - last) / 1000 * speed;
        last = ts; if (t >= TL.total) { t = TL.total; setPlay(false); }
        syncAudio(); draw();
      }
      requestAnimationFrame(loop);
    }
    function setPlay(v) { playing = v; last = 0; blocked = false; if (v && t >= TL.total - .05) t = 0; $('pm-play').textContent = v ? '❚❚' : '▶'; $('pm-big').style.display = v ? 'none' : ''; syncAudio(); }
    const toggle = () => setPlay(!playing);
    $('pm-play').onclick = toggle; $('pm-big').onclick = toggle; C.onclick = toggle;
    document.querySelectorAll('.spd').forEach(b => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('.spd').forEach(x => x.classList.toggle('on', x === b)); syncAudio(); });
    const bar = $('pm-bar'), scrub = e => { const r = bar.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * TL.total); };
    bar.onpointerdown = e => { bar.setPointerCapture(e.pointerId); scrub(e); bar.onpointermove = scrub; };
    bar.onpointerup = () => { bar.onpointermove = null; };
    addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.code === 'ArrowLeft') seek(t - 5); else if (e.code === 'ArrowRight') seek(t + 5);
      else if (['1', '2', '4'].includes(e.key)) document.querySelector(`.spd[data-s="${e.key}"]`).click();
      else if (A && e.key.toLowerCase() === 'm') $('pm-snd').click();
    });
    const q = new URLSearchParams(location.search); if (q.has('t')) t = +q.get('t');
    draw(); requestAnimationFrame(loop);
  }

  async function boot() {
    C = document.getElementById('pm'); X = C.getContext('2d');
    if (!FILM) throw new Error('film.js 里没有调用 PM.film({...})');
    await loadAssets(); TL = timeline(FILM);
    const q = new URLSearchParams(location.search);
    if (q.has('script')) {   // voice.py: everything that will be read aloud, in order
      const pre = document.createElement('pre'); pre.id = 'pm-script';
      pre.textContent = JSON.stringify(TL.voice.map(v => ({ scene: v.sc.id, say: v.say }))); document.body.appendChild(pre); return;
    }
    if (q.has('audit')) { document.body.className = 'still'; return runAudit(q); }
    if (q.has('still')) { document.body.className = 'still'; render(+q.get('t') || 0); document.title = 'READY'; return; }
    let track = null;
    try { track = await voiceTrack(); } catch (e) { console.error('配音音轨合成失败，改为无声播放', e); }
    player(track);
  }

  return { film: f => { FILM = f; const ft = f.tool === false && document.getElementById('foot'); if (ft && ft.firstChild) ft.firstChild.nodeValue = BRAND; }, boot, W, H, COL };
})();
