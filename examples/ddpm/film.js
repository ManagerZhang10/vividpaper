// Denoising Diffusion Probabilistic Models — 3 分钟动效解读 · 张指导出品
// 主线：怎么从纯噪声一步步「洗」出一张图？主角：一张猫图，被一步步加噪、再一步步还原。
// 加噪是在真图上逐像素加固定种子的高斯噪声：x_t = √ᾱ_t · x_0 + √(1−ᾱ_t) · ε，ᾱ_t 按论文的 schedule 算。

// ---------- noise schedule（论文 §4：T = 1000，β 从 1e-4 线性涨到 0.02）----------
const T = 1000;
const BETA = Array.from({ length: T + 1 }, (_, t) => t === 0 ? 0 : 1e-4 + (0.02 - 1e-4) * (t - 1) / (T - 1));
const ABAR = []; BETA.reduce((a, b, t) => (ABAR[t] = a * (1 - b)), 1);
const sa = t => Math.sqrt(ABAR[Math.round(t)]), sb = t => Math.sqrt(1 - ABAR[Math.round(t)]);

// ---------- the cat's pixels ----------
// The engine keeps its images private, so film.js decodes its own copy of figures/cat.png
// and holds PM.boot until it is ready (otherwise the first frames could miss the pixels).
const CAT = new Image();
const CAT_READY = new Promise((res, rej) => { CAT.onload = res; CAT.onerror = () => rej(new Error('猫图加载失败')); });
CAT.src = window.PM_ASSETS.cat;
{ const boot0 = PM.boot; PM.boot = () => CAT_READY.then(boot0); }

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) + .5) / 4294967296; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r()); }
const BASE = {}, CACHE = {};
// x_0 in [-1, 1] (论文 §3.3 的缩放) plus two fixed noise fields, at resolution n × n
function base(n) {
  if (BASE[n]) return BASE[n];
  const c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(CAT, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data, N = n * n * 3, x0 = new Float32Array(N), e = new Float32Array(N), e2 = new Float32Array(N);
  const r = rng(20200619 + n);
  for (let i = 0, k = 0; i < d.length; i += 4) for (let ch = 0; ch < 3; ch++, k++) { x0[k] = d[i + ch] / 127.5 - 1; e[k] = gauss(r); e2[k] = gauss(r); }
  return (BASE[n] = { x0, e, e2 });
}
// kind: 'x' = x_t at step, 'eps' = the true noise ε, 'hat' = the network's guess ε̂（示意：ε 加一点偏差）
// cached per (kind, n, step) — depends only on fixed parameters, never on time
function tileCanvas(kind, step, n) {
  step = kind === 'x' ? Math.max(0, Math.min(T, Math.round(step / 5) * 5)) : 0;
  const key = `${kind}|${n}|${step}`; if (CACHE[key]) return CACHE[key];
  const B = base(n), c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), im = x.createImageData(n, n), d = im.data, a = sa(step), b = sb(step);
  for (let i = 0, k = 0; i < d.length; i += 4) {
    for (let ch = 0; ch < 3; ch++, k++) {
      const v = kind === 'x' ? a * B.x0[k] + b * B.e[k] : kind === 'eps' ? B.e[k] * .5 : (.85 * B.e[k] + .5 * B.e2[k]) * .5;
      d[i + ch] = Math.max(0, Math.min(255, (v + 1) * 127.5));
    }
    d[i + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return (CACHE[key] = c);
}
// draw one tile; returns its rect. Grain stays crisp: 128 px source for thumbnails, 256 px for big tiles.
function tile(g, kind, step, x, y, s, o = {}) {
  const a = o.alpha ?? 1, R = { x, y, w: s, h: s, cx: x + s / 2, cy: y + s / 2, r: x + s, b: y + s };
  if (a <= .001) return R;
  const n = o.n ?? (s > 180 ? 256 : 128), cv = tileCanvas(kind, step, n), X = g.ctx;
  X.save(); X.globalAlpha *= a; X.imageSmoothingEnabled = s < n; X.imageSmoothingQuality = 'high';
  X.beginPath(); X.roundRect(x, y, s, s, 8); X.clip(); X.drawImage(cv, x, y, s, s); X.restore();
  g.rect(x, y, s, s, { r: 8, stroke: o.stroke ?? g.COL.faint, lw: o.lw ?? 2, alpha: a });
  return R;
}
const fmt2 = v => v.toFixed(2);

PM.film({
  paper: { title: 'Denoising Diffusion Probabilistic Models', byline: 'Ho, Jain, Abbeel · UC Berkeley · NeurIPS 2020', arxiv: '2006.11239' },
  question: '怎么从**纯噪声**一步步「洗」出一张图？',
  recap: [
    '前向：每步加一点噪声，1000 步后只剩**纯噪声**',
    '捷径：任意第 t 步都能**一步**加噪得到',
    '训练：网络只学一件事，**猜出噪声 ε**',
    '生成：从纯噪声出发，一步步**减掉**猜出的噪声',
  ],
  scenes: [
    {
      id: 'forward', name: '前向：一步步往图上加噪声',
      lines: [
        '先反过来想：把一张图**毁掉**很容易，每一步往上加一点点高斯噪声',
        '这叫 forward process（前向过程），论文一共走 **T = 1000** 步',
        '每步加多少由 noise schedule 决定：β_t 从 **0.0001** 线性涨到 **0.02**',
        '走到第 1000 步，猫已经完全看不出来，只剩一张**纯噪声**',
        { text: 'Diffusion 的想法：只要学会每一步**去掉**一点噪声，就能从纯噪声倒着走回一张图', hold: .6 },
      ],
      draw(g) {
        const { t, L, Le, COL } = g;
        const step = Math.round(20 * g.p(L(0) + 1.5, Le(0) - L(0) - 1.8, 'lin') + 230 * g.p(L(1) + .3, 4, 'io')
          + 150 * g.p(L(2) + .5, 5, 'lin') + 600 * g.p(L(3) + .3, 3.2, 'io'));
        const big = tile(g, 'x', step, 300, 175, 480, { alpha: g.p(.1, .5) });
        g.chip(`第 **${step}** 步`, 540, 700, { size: 34, alpha: g.p(L(0) + 1.2, .4) });
        if (t > L(3)) g.mark(big.x - 6, big.y - 6, big.w + 12, big.h + 12, { k: g.p(L(3) + 3.4, .6), label: '纯噪声 x_T', side: 'right', labelSize: 28 });
        // β_t: a straight line from 1e-4 to 0.02, with a dot at the current step
        const P = { x: 170, y: 790, w: 760, h: 150 }, px = s => P.x + P.w * (s - 1) / (T - 1), py = b => P.y + P.h - P.h * b / .02;
        const a2 = g.p(L(2), .4) * (1 - g.p(L(4), .5));
        if (a2 > 0) {
          g.text('β_t：每一步加的噪声量', P.x, P.y - 32, { size: 28, align: 'left', color: COL.sub, alpha: a2 });
          g.line(P.x, P.y + P.h, P.x + P.w, P.y + P.h, { color: COL.faint, lw: 2, alpha: a2 });
          g.line(P.x, P.y + P.h, P.x, P.y - 6, { color: COL.faint, lw: 2, alpha: a2 });
          g.line(px(1), py(1e-4), px(T), py(.02), { color: COL.acc, lw: 5, k: g.p(L(2) + .3, 1.6, 'io'), alpha: a2 });
          g.text('0.0001', P.x + 12, py(1e-4) - 24, { size: 24, font: 'disp', align: 'left', color: COL.sub, alpha: g.p(L(2) + .6, .4) });
          g.text('**0.02**', px(T) - 4, py(.02) - 28, { size: 28, font: 'disp', align: 'right', color: COL.sub, alpha: g.p(L(2) + 1.8, .4) });
          g.text('t = 1', P.x, P.y + P.h + 26, { size: 24, font: 'disp', color: COL.dim, alpha: a2 });
          g.text('1000', P.x + P.w, P.y + P.h + 26, { size: 24, font: 'disp', color: COL.dim, alpha: a2 });
          const s = Math.max(1, step);
          g.circle(px(s), py(BETA[s]), 11, { fill: COL.fg, alpha: g.p(L(2) + 1.9, .4) * a2 });
        }
        // progress strip: each frame appears when the counter reaches it
        const marks = [0, 100, 250, 400, 600, 1000], labs = ['x_0', 't=100', 't=250', 't=400', 't=600', 'x_T'];
        const back = g.p(L(4) + .5, 2.4, 'io');   // line 5: walk the strip backwards, x_T → x_0
        marks.forEach((v, i) => {
          const a = v === 0 ? g.p(L(0) + .6, .4) : g.clamp((step - v + 25) / 25);
          const lit = t > L(4) && back >= (5 - i) / 5 - .02;
          const r = tile(g, 'x', v, 70 + i * 160, 1000, 140, { alpha: a, stroke: lit ? COL.green : v === step || (v === 1000 && step >= 1000) ? COL.acc : COL.faint, lw: lit ? 4 : 2 });
          g.text(labs[i], r.cx, 1166, { size: 24, font: 'disp', color: COL.sub, alpha: a });
        });
        if (t > L(4)) {
          g.curve(70 + 5 * 160 + 70, 985, 140, 985, { bend: 130, color: COL.green, lw: 5, head: 20, k: back });
          g.chip('denoising：要学会的方向', 540, 880, { size: 30, color: COL.green, alpha: g.p(L(4) + 1.2, .4) });
        }
      },
    },
    {
      id: 'jump', name: '捷径：任意一步可以直接算出来',
      lines: [
        { text: '不用真的加 1000 次：高斯噪声叠高斯噪声还是高斯，可以**一步**跳到任意第 t 步', hold: .6 },
        '公式：x_t = √ā_t · x_0 + √(1−ā_t) · ε，ε 是一份标准高斯噪声',
        { text: 'ā_t 是前 t 步「保留比例」的连乘：t 越大，原图那份越小，噪声那份越大', hold: 1 },
        '所以训练时随手抽一个 t，**一步**就能造出一个加噪样本',
      ],
      draw(g) {
        const { t, L, COL } = g;
        // which step is shown: 250 → sweep (line 3) → random picks (line 4)
        let step = 250;
        if (t > L(2)) step = 250 + 650 * g.p(L(2) + .8, 2.4, 'io') - 850 * g.p(L(2) + 3.4, 2.4, 'io') + 200 * g.p(L(2) + 6, 1, 'io');
        if (t > L(3)) { const picks = [100, 600, 850], k = Math.floor((t - L(3) - .5) / 1.3); if (k >= 0) step = picks[Math.min(2, k)]; }
        step = Math.round(step);
        const A = tile(g, 'x', 0, 70, 210, 220, { alpha: g.p(.1, .4) });
        const B = tile(g, 'eps', 0, 430, 210, 220, { alpha: g.p(L(0) + .8, .4), stroke: COL.blue });
        const C = tile(g, 'x', step, 790, 210, 220, { alpha: g.p(L(0) + 1.6, .4), stroke: COL.acc });
        g.text('+', 360, 320, { size: 64, weight: 800, font: 'disp', alpha: g.p(L(0) + .8, .4) });
        g.text('=', 720, 320, { size: 64, weight: 800, font: 'disp', alpha: g.p(L(0) + 1.6, .4) });
        g.text('x_0 原图', A.cx, 462, { size: 28, color: COL.sub, alpha: g.p(.1, .4) });
        g.text('ε 噪声', B.cx, 462, { size: 28, color: COL.blue, alpha: g.p(L(0) + .8, .4) });
        g.text(`x_t（t = ${step}）`, C.cx, 462, { size: 28, color: COL.acc, alpha: g.p(L(0) + 1.6, .4) });
        g.curve(A.cx, A.y - 8, C.cx, C.y - 8, { bend: -60, color: COL.acc, lw: 4, head: 16, k: g.p(L(0) + 2.4, .9, 'io') });
        g.chip('**一步**', 540, 148 + 10, { size: 26, alpha: g.p(L(0) + 3.1, .4) });
        // the coefficients, live
        const ca = g.p(L(1) + .5, .4);
        g.chip(`× √ā_t = **${fmt2(sa(step))}**`, A.cx, 520, { size: 28, alpha: ca });
        g.chip(`× √(1−ā_t) = **${fmt2(sb(step))}**`, B.cx + 10, 520, { size: 28, color: COL.blue, alpha: g.p(L(1) + 1.1, .4) });
        const fa = g.p(L(1), .5);
        g.rect(60, 572, 960, 92, { r: 16, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: fa });
        g.rich([['x_t', COL.acc], [' = ', COL.fg], ['√ā_t', COL.acc], [' · x_0 + ', COL.fg], ['√(1−ā_t)', COL.blue], [' · ε', COL.blue]], 540, 618, { size: 44, font: 'disp', alpha: fa });
        // the two coefficient curves over t, with a scan line at the current step
        const P = { x: 170, y: 740, w: 780, h: 250 }, px = s => P.x + P.w * s / T, py = v => P.y + P.h - P.h * v;
        const a2 = g.p(L(2), .4);
        if (a2 > 0) {
          g.line(P.x, P.y + P.h, P.x + P.w, P.y + P.h, { color: COL.faint, lw: 2, alpha: a2 });
          g.line(P.x, P.y + P.h, P.x, P.y - 10, { color: COL.faint, lw: 2, alpha: a2 });
          g.text('1', P.x - 18, py(1), { size: 24, font: 'disp', color: COL.dim, alpha: a2 });
          g.text('0', P.x - 18, py(0), { size: 24, font: 'disp', color: COL.dim, alpha: a2 });
          ['t = 0', '500', '1000'].forEach((s, i) => g.text(s, P.x + i * P.w / 2, P.y + P.h + 28, { size: 24, font: 'disp', color: COL.dim, alpha: a2 }));
          const ck = g.p(L(2) + .2, 1.2, 'io'), ptsA = [], ptsB = [];
          for (let s = 0; s <= T; s += 10) { ptsA.push([px(s), py(sa(s))]); ptsB.push([px(s), py(sb(s))]); }
          g.path(ptsA, { color: COL.acc, lw: 5, k: ck }); g.path(ptsB, { color: COL.blue, lw: 5, k: ck });
          g.text('√ā_t 原图那份', px(560), py(.62), { size: 26, align: 'left', color: COL.acc, alpha: g.p(L(2) + 1.2, .4) });
          g.text('√(1−ā_t) 噪声那份', px(560), py(1.08), { size: 26, align: 'left', color: COL.blue, alpha: g.p(L(2) + 1.2, .4) });
          const sx = px(step), la = g.p(L(2) + .8, .3);
          g.line(sx, P.y - 10, sx, P.y + P.h, { color: COL.fg, lw: 2, dash: [6, 6], alpha: la });
          g.circle(sx, py(sa(step)), 10, { fill: COL.acc, alpha: la }); g.circle(sx, py(sb(step)), 10, { fill: COL.blue, alpha: la });
          g.note('按论文 noise schedule 计算', P.x + P.w, P.y + P.h + 66, { alpha: a2 });
        }
        if (t > L(3)) g.chip('训练时：t ~ Uniform{1, …, 1000}', 540, 1135, { size: 28, color: COL.yellow, alpha: g.p(L(3) + .3, .4) });
      },
    },
    {
      id: 'train', name: '训练：让网络猜出加进去的噪声',
      lines: [
        '训练只做一件事：抽一张图 x_0、一个步数 t、一份噪声 ε',
        '一步造出 x_t，交给网络 ε_θ，让它猜刚才加进去的是哪份噪声',
        '损失就是猜的和真的之差的平方：‖ε − ε_θ‖²',
        '注意：网络从不直接画图，它只回答一个问题：这张图里混进了哪份噪声',
        { text: '论文 Algorithm 1 就这几行。网络是一个 U-Net，所有步共用，t 用正弦位置编码告诉它', hold: .8 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        // last line: the same network serves every t — cycle t (and x_t) through a few values
        const cyc = Math.floor((t - L(4) - 5) / 1.1), STEP = cyc >= 0 ? [120, 860, 330, 700, 500][cyc % 5] : 500;
        const a0 = i => g.p(L(0) + .4 + i * .6, .4);
        const X0 = tile(g, 'x', 0, 60, 200, 170, { alpha: a0(0) });
        const E = tile(g, 'eps', 0, 60, 470, 170, { alpha: a0(2), stroke: COL.blue });
        g.text('x_0', X0.cx, X0.b + 28, { size: 28, color: COL.sub, alpha: a0(0) });
        g.text('ε', E.cx, E.b + 28, { size: 30, color: COL.blue, alpha: a0(2) });
        g.chip(`t = ${STEP}`, 690, 238, { size: 30, color: COL.yellow, alpha: a0(1) });
        // build x_t, feed the network
        const k1 = g.p(L(1) + .2, .6, 'io');
        g.arrow(X0.r + 10, X0.cy, 320, 360, { color: COL.sub, lw: 4, k: k1 });
        g.arrow(E.r + 10, E.cy, 320, 450, { color: COL.blue, lw: 4, k: k1 });
        const XT = tile(g, 'x', STEP, 330, 300, 200, { alpha: g.p(L(1) + .6, .4), stroke: COL.acc });
        g.text('x_t', XT.cx, XT.b + 28, { size: 28, color: COL.acc, alpha: g.p(L(1) + .6, .4) });
        const nb = { x: 590, y: 330, w: 200, h: 140 }, na = g.p(L(1) + 1.2, .4);
        g.arrow(XT.r + 8, XT.cy, nb.x - 6, nb.y + nb.h / 2, { color: COL.sub, lw: 4, k: g.p(L(1) + 1.2, .4) });
        g.rect(nb.x, nb.y, nb.w, nb.h, { r: 18, fill: g.rgba(COL.purple, .18), stroke: COL.purple, lw: 3, alpha: na });
        const un = g.p(L(4) + 2.4, .5);
        g.text('ε_θ', nb.x + nb.w / 2, nb.y + nb.h / 2 - 18 * un, { size: 48, font: 'disp', color: COL.purple, alpha: na });
        g.text('U-Net', nb.x + nb.w / 2, nb.y + nb.h / 2 + 34, { size: 28, font: 'disp', color: COL.sub, alpha: un });
        // t enters as a sinusoidal position embedding (§4)
        const se = g.p(L(4) + 4.2, .5);
        if (se > 0) {
          g.wave(770, 216, 110, 44, u => Math.sin(2 * Math.PI * u * 2.5), { color: COL.yellow, lw: 3, k: g.p(L(4) + 4.2, 1.2) });
          g.text('正弦编码', 900, 238, { size: 26, align: 'left', color: COL.yellow, alpha: se });
        }
        g.arrow(690, 262, 690, nb.y - 6, { color: COL.yellow, lw: 3, k: g.p(L(1) + 1.6, .4) });
        g.arrow(nb.x + nb.w + 6, nb.y + nb.h / 2, 846, nb.y + nb.h / 2, { color: COL.sub, lw: 4, k: g.p(L(1) + 2.2, .4) });
        const HAT = tile(g, 'hat', 0, 852, 315, 170, { alpha: g.p(L(1) + 2.5, .4), stroke: COL.purple });
        g.text('猜的噪声（示意）', HAT.cx - 10, HAT.y - 26, { size: 26, color: COL.purple, alpha: g.p(L(1) + 2.5, .4) });
        // compare with the true noise: ε flies over
        const fk = g.p(L(2) + .2, 1.1, 'io');
        if (fk > 0) {
          const E2 = tile(g, 'eps', 0, g.lerp(60, 852, fk), g.lerp(470, 560, fk), 170, { stroke: COL.blue });
          g.text('真的 ε', E2.cx, E2.b + 28, { size: 26, color: COL.blue, alpha: g.p(L(2) + 1.1, .4) });
        }
        const la = g.p(L(2) + 1.4, .4);
        g.curve(852, HAT.cy + 20, 852, 645, { bend: 60, color: COL.faint, lw: 3, alpha: la });
        g.chip('**‖ε − ε_θ‖²**', 680, 645, { size: 34, alpha: la });
        g.arrow(680, 620, 680, nb.y + nb.h + 8, { color: COL.acc, lw: 3, dash: [8, 8], k: g.p(L(2) + 2.2, .6) });
        g.text('更新 θ', 610, 560, { size: 26, color: COL.acc, alpha: g.p(L(2) + 2.6, .4) });
        g.mark(HAT.x - 8, HAT.y - 8, HAT.w + 16, HAT.h + 16, { k: g.p(L(3) + .8, .6), color: COL.purple, alpha: g.win(L(3), L(4), .3, .3) });
        g.mark(XT.x - 8, XT.y - 8, XT.w + 16, XT.h + 16, { k: g.p(L(3) + .2, .6), color: COL.sub, alpha: g.win(L(3), L(4), .3, .3) });
        // the paper's own recipe, marked line by line
        const F = g.img('alg1_train', 240, 820, 600, null, { card: true, alpha: g.p(.3, .5) });
        g.note('图：论文 Algorithm 1', 1040, 1160, { alpha: g.p(.3, .5) });
        const on = i => g.win(L(i), i < 4 ? L(i + 1) : g.dur, .3, .3);
        g.mark(F.box(.02, .29, .62, .61), { k: g.p(L(0) + .4, .6), color: COL.yellow, alpha: on(0) });
        g.mark(F.box(.39, .68, .87, .85), { k: g.p(L(1) + .4, .6), color: COL.purple, alpha: on(1) });
        g.mark(F.box(.17, .67, .94, .86), { k: g.p(L(2) + .4, .6), alpha: on(2) });
        g.mark(F.box(.02, .18, .26, .29), { k: g.p(L(4) + .3, .5), color: COL.green, alpha: on(4) });
        g.mark(F.box(.02, .83, .43, .95), { k: g.p(L(4) + .8, .5), color: COL.green, label: '反复做', side: 'right', labelSize: 26, alpha: on(4) });
      },
    },
    {
      id: 'why', name: '为什么猜噪声：论文的对比实验',
      lines: [
        '网络也可以不猜噪声，直接猜去噪后那张图的均值。论文把两种做法放在一起比',
        '猜均值：用完整的变分下界训练，最好 FID **13.22**；换成简单的平方误差，训不稳',
        '猜噪声 + 简化损失 L_simple：FID 降到 **3.17**（越低越好）',
        '简化损失让网络少花力气在噪声很少的步上，专心练更难的 denoising',
      ],
      draw(g) {
        const { t, L, COL } = g;
        // top: what each choice outputs (fades out on line 4)
        const top = 1 - g.p(L(3), .5);
        const panel = (cx, title, c, kind, outLab, d) => {
          const a = g.p(L(0) + d, .4) * top;
          g.text(title, cx, 205, { size: 32, color: c, alpha: a });
          tile(g, 'x', 500, cx - 190, 250, 130, { alpha: a });
          g.arrow(cx - 50, 315, cx + 50, 315, { color: c, lw: 4, k: g.p(L(0) + d + .4, .4) * top });
          tile(g, kind, kind === 'x' ? 480 : 0, cx + 60, 250, 130, { alpha: g.p(L(0) + d + .6, .4) * top, stroke: c });
          g.text('x_t', cx - 125, 410, { size: 26, color: COL.sub, alpha: a });
          g.text(outLab, cx + 125, 410, { size: 26, color: c, alpha: g.p(L(0) + d + .6, .4) * top });
        };
        panel(285, '猜均值', COL.blue, 'x', '均值（一张图）', .3);
        panel(795, '猜噪声 ε', COL.acc, 'eps', 'ε（一份噪声）', 1.8);
        // bottom: FID from Table 2
        const opt = { min: 0, max: 25, labelW: 330, h: 54, gap: 20, labelSize: 26 };
        g.bars(60, 560, 960, [
          { label: '猜均值 · 下界 · 学 Σ', value: 23.69, color: COL.blue }, { label: '猜均值 · 下界 · 固定 Σ', value: 13.22, color: COL.blue, hi: true },
        ], { ...opt, title: 'FID ↓ 越低越好（无条件 CIFAR-10）', k: g.p(L(1) + .3, 1.2), alpha: g.p(L(1), .4) });
        g.bars(60, 708, 960, [
          { label: '猜 ε · 下界 · 固定 Σ', value: 13.51, color: COL.acc2 }, { label: '猜 ε · L_simple', value: 3.17, color: COL.acc, hi: true },
        ], { ...opt, k: g.p(L(2) + .3, 1.2), alpha: g.p(L(2), .4) });
        g.chip('猜均值 + 简单平方误差：**训不稳**', 540, 905, { size: 28, color: COL.blue, alpha: g.p(L(1) + 3.2, .4) });
        g.note('数据：论文 Table 2', 1020, 960, { alpha: g.p(L(1), .4) });
        // line 4: small t vs large t（示意）
        const a3 = g.p(L(3) + .3, .5);
        if (a3 > 0) {
          [[20, 270, '小 t：噪声少，好猜', .25], [700, 810, '大 t：噪声多，难猜', 1]].forEach(([s, cx, lab, w], i) => {
            const R = tile(g, 'x', s, cx - 75, 190, 150, { alpha: a3 });
            g.text(lab, cx, R.b + 32, { size: 28, color: i ? COL.acc : COL.sub, alpha: a3 });
            const bw = 260 * g.lerp(.6, w, g.p(L(3) + 1.4, 1.2, 'io'));
            g.rect(cx - 130, R.b + 66, 260, 26, { r: 8, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: a3 });
            g.rect(cx - 130, R.b + 66, bw, 26, { r: 8, fill: i ? COL.acc : COL.dim, alpha: a3 });
          });
          g.text('训练权重', 540, 425, { size: 26, color: COL.sub, alpha: a3 });
          g.arrow(420, 265, 660, 265, { color: COL.acc, lw: 4, k: g.p(L(3) + 1.4, .8) });
          g.note('权重条为示意', 1040, 480, { alpha: a3 });
        }
      },
    },
    {
      id: 'sample', name: '生成：从纯噪声一步步洗出图',
      lines: [
        '生成时反过来走。论文图 2 就是这条链：从纯噪声 x_T 出发，一步步走回 x_0',
        { text: '每一步：网络估出噪声 ε_θ，减掉一部分，再加回一点小随机 σ_t·z', hold: .8 },
        '重复 1000 步，噪声一点点被洗掉，图就出来了',
        { text: '论文图 6 是真实的生成过程：大轮廓先出现，细节最后才补上', hold: .6 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F2 = g.img('fig2_chain', 70, 200, 940, null, { card: true, alpha: g.p(.1, .5) });
        g.note('图：论文 Figure 2', 1030, F2.y + F2.h + 42, { alpha: g.p(.1, .5) });
        const on0 = g.win(L(0), L(2), .3, .3);
        g.mark(F2.box(.025, .17, .19, .96), { k: g.p(L(0) + 2.2, .5), label: 'x_T', side: 'top', labelSize: 26, alpha: on0 });
        g.mark(F2.box(.81, .17, .975, .96), { k: g.p(L(0) + 4.2, .5), color: COL.green, label: 'x_0', side: 'top', labelSize: 26, alpha: on0 });
        g.mark(F2.box(.395, .1, .545, .5), { k: g.p(L(1) + .3, .5), color: COL.purple, label: 'p_θ：去噪一步', side: 'top', labelSize: 26, alpha: g.win(L(1), L(2), .3, .3) });
        // Algorithm 2 + the cat run backwards
        const A2 = g.img('alg2_sample', 80, 470, 520, null, { card: true, alpha: g.p(L(0) + .6, .5) });
        g.note('图：论文 Algorithm 2', 600, A2.y + A2.h + 46, { alpha: g.p(L(0) + .6, .5) });
        g.mark(A2.box(.0, .2, .46, .33), { k: g.p(L(0) + 1.2, .5), color: COL.yellow, alpha: g.win(L(0), L(1), .3, .3) });
        g.mark(A2.box(.0, .55, .95, .73), { k: g.p(L(1) + .5, .5), color: COL.purple, alpha: g.win(L(1), L(2), .3, .3) });
        g.mark(A2.box(.0, .32, .37, .44), { k: g.p(L(2) + .3, .5), alpha: g.win(L(2), L(3), .3, .3) });
        const step = Math.round(1000 * (1 - g.p(L(2) + .5, 4.6, 'io')));
        const R = tile(g, 'x', step, 680, 470, 320, { alpha: g.p(L(0) + .3, .5), stroke: step === 0 ? COL.green : COL.faint });
        g.chip(`t = **${step}** · 示意：前向倒放`, R.cx - 20, R.b + 36, { size: 26, alpha: g.p(L(0) + .3, .5) });
        // line 2: one update, piece by piece
        const parts = [['x_t', COL.fg], ['− ε_θ', COL.purple], ['+ σ_t·z', COL.yellow]];
        parts.forEach(([s, c], i) => g.chip(s, 160 + i * 175, 820, { size: 28, color: c, alpha: g.p(L(1) + 1 + i * .8, .4) * (1 - g.p(L(3), .4)) }));
        // line 4: the paper's real progressive generation
        const a6 = g.p(L(3), .5);
        if (a6 > 0) {
          const F6 = g.img('fig6_progressive', 60, 900, 960, null, { card: true, alpha: a6 });
          g.note('图：论文 Figure 6（CIFAR-10，从左到右）', 1020, F6.y + F6.h + 48, { alpha: a6 });
          g.mark(F6.box(.39, 0, .6, 1), { k: g.p(L(3) + 1.6, .5), label: '大轮廓', side: 'top', labelSize: 26 });
          g.mark(F6.box(.75, 0, 1, 1), { k: g.p(L(3) + 3.2, .5), color: COL.green, label: '细节', side: 'top', labelSize: 26 });
        }
      },
    },
    {
      id: 'result', name: '结果：CIFAR-10 上 FID 3.17',
      lines: [
        '无条件 CIFAR-10 上，DDPM 的 FID 是 **3.17**（越低越好），Inception Score **9.46**',
        '比当时所有无条件模型都好，包括 StyleGAN2 + ADA 的 3.26',
        '甚至好过要喂类别标签的 BigGAN（14.73）',
        { text: '256×256 的 LSUN 上，卧室 FID 4.90、教堂 7.89，和 ProgressiveGAN 相当', hold: 1 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const big = g.p(L(2) + .3, .5);
        const items = [
          { label: 'Gated PixelCNN', value: 65.93 }, { label: 'PixelIQN', value: 49.46 }, { label: 'EBM', value: 38.2 },
          { label: 'NCSNv2', value: 31.75 }, { label: 'NCSN', value: 25.32 }, { label: 'SNGAN', value: 21.7 },
          { label: 'SNGAN-DDLS', value: 15.42 }, { label: 'BigGAN（有条件）', value: 14.73, color: COL.purple, alpha: big },
          { label: 'StyleGAN2 + ADA', value: 3.26, color: t > L(1) ? COL.blue : COL.faint }, { label: 'DDPM', value: 3.17, hi: true },
        ];
        const B = g.bars(60, 250, 960, items, { title: 'FID ↓ 越低越好 · 无条件 CIFAR-10', min: 0, max: 70, k: g.p(.4, 2), labelW: 300, h: 42, gap: 14, labelSize: 26 });
        g.note('数据：论文 Table 1（BigGAN 为有条件模型）', 1020, 830, { alpha: g.p(.6, .4) });
        g.mark(B[9].x - 306, B[9].y - 6, 950, B[9].h + 12, { k: g.p(L(0) + .6, .6) });
        g.chip('IS **9.46** ↑', 840, B[9].y + 21, { size: 28, alpha: g.p(L(0) + 2.4, .4) });
        g.mark(B[8].x - 306, B[8].y - 6, 950, B[8].h + 12, { k: g.p(L(1) + .4, .6), color: COL.blue, alpha: g.win(L(1), L(2), .3, .3) });
        g.mark(B[7].x - 306, B[7].y - 6, 950, B[7].h + 12, { k: g.p(L(2) + .7, .6), color: COL.purple, alpha: g.win(L(2), L(3), .3, .3) });
        if (t > L(3) - .1) {
          const a = g.p(L(3), .4);
          g.bars(60, 950, 960, [
            { label: '卧室 · ProgressiveGAN', value: 8.34, color: COL.faint }, { label: '卧室 · DDPM', value: 4.9, hi: true },
            { label: '教堂 · ProgressiveGAN', value: 6.42, color: COL.faint }, { label: '教堂 · DDPM', value: 7.89, hi: true },
          ], { title: 'LSUN 256×256 · FID ↓', min: 0, max: 10, k: g.p(L(3) + .3, 1.4), labelW: 330, h: 34, gap: 10, labelSize: 24, alpha: a });
          g.note('数据：论文 Table 3（卧室为 large 模型）', 1020, 1166, { alpha: a, size: 20 });
        }
      },
    },
  ],
});
