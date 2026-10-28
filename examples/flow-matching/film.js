// Flow Matching for Generative Modeling — 3 分钟动效解读 · 张指导出品
// 主线：一团噪声要流成数据，每一点该往哪走，怎么教给模型？主角：论文 Figure 4 的二维棋盘，和其中一颗噪声粒子 x₀ 与它的落点 x₁。
// 画面上的流动是真算的：按论文式 (8)(21) 求整团数据的理想箭头，欧拉法积分；σ_min 论文只说「足够小」，这里取 0.05（示意）。

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function gauss(r) { const u = Math.max(r(), 1e-9), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const SIG = 0.05;
// 4×4 checkerboard on [-4, 4]² (cells 2 wide), 8 filled cells (lower-left corners), the shape of the paper's Figure 4 data;
// noise is N(0, I), so the blob starts small in the middle and spreads out onto the board, as in Figure 4
const CELL = 2, CELLS = [];
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 1) CELLS.push([-4 + CELL * i, -4 + CELL * j]);

// the ideal (marginal) vector field of eq. (8) with the OT conditional field of eq. (21), over the data points D
function field(x, t, D) {
  const s = 1 - (1 - SIG) * t, lw = new Float64Array(D.length); let m = -Infinity;
  for (let j = 0; j < D.length; j++) { const dx = x[0] - t * D[j][0], dy = x[1] - t * D[j][1]; lw[j] = -(dx * dx + dy * dy) / (2 * s * s); if (lw[j] > m) m = lw[j]; }
  let Z = 0, ux = 0, uy = 0;
  for (let j = 0; j < D.length; j++) { const w = Math.exp(lw[j] - m); Z += w; ux += w * (D[j][0] - (1 - SIG) * x[0]); uy += w * (D[j][1] - (1 - SIG) * x[1]); }
  return [ux / Z / s, uy / Z / s];
}
function weights(x, t, D) {
  const s = 1 - (1 - SIG) * t, lw = D.map(d => -((x[0] - t * d[0]) ** 2 + (x[1] - t * d[1]) ** 2) / (2 * s * s)), m = Math.max(...lw);
  const w = lw.map(v => Math.exp(v - m)), Z = w.reduce((a, b) => a + b); return w.map(v => v / Z);
}
const condU = (x, t, x1) => { const s = 1 - (1 - SIG) * t; return [(x1[0] - (1 - SIG) * x[0]) / s, (x1[1] - (1 - SIG) * x[1]) / s]; };   // eq. (21)

// everything below is computed once from fixed seeds — a pure function of nothing, memoised
let FLOW = null;
function flow() {
  if (FLOW) return FLOW;
  const r = rng(11), D = [], X0 = [];
  CELLS.forEach(([cx, cy]) => { for (let k = 0; k < 40; k++) D.push([cx + .1 + 1.8 * r(), cy + .1 + 1.8 * r()]); });
  for (let i = 0; i < 560; i++) X0.push([gauss(r), gauss(r)]);
  const K = 120, T = Array.from({ length: K + 1 }, (_, k) => 1 - Math.pow(1 - k / K, 2));
  const tr = X0.map(p => [p.slice()]); let cur = X0.map(p => p.slice());
  for (let k = 0; k < K; k++) {
    const t = T[k], dt = T[k + 1] - t;
    cur = cur.map(x => { const u = field(x, t, D); return [x[0] + u[0] * dt, x[1] + u[1] * dt]; });
    cur.forEach((x, i) => tr[i].push(x));
  }
  // the protagonist: the particle (starting 1.2–2.2 from the centre) that travels farthest; x₁ = the data point it lands on
  let hero = 0, best = -1;
  X0.forEach((p, i) => { const r0 = Math.hypot(...p), e = tr[i][K], d = Math.hypot(p[0] - e[0], p[1] - e[1]); if (r0 > 1.2 && r0 < 2.2 && d > best) { best = d; hero = i; } });
  const end = tr[hero][K]; let x1 = 0; D.forEach((d, j) => { if (Math.hypot(d[0] - end[0], d[1] - end[1]) < Math.hypot(D[x1][0] - end[0], D[x1][1] - end[1])) x1 = j; });
  // scene 4 draws one more noise point x₀ on the far side, so the training pair spans the plane
  let far = 0; X0.forEach((p, i) => { if (Math.hypot(p[0] + 1.4, p[1] - 1.3) < Math.hypot(X0[far][0] + 1.4, X0[far][1] - 1.3)) far = i; });
  // a batch of random training pairs for scene 4
  const pairs = Array.from({ length: 46 }, () => [[gauss(r), gauss(r)], D[Math.floor(r() * D.length)]]);
  // a few random data points for the "average of single-point arrows" demo
  const picks = [5, 47, 96, 150, 201, 262, 300].map(j => D[j]);
  FLOW = { D, X0, T, K, tr, hero, x1: D[x1], far, pairs, picks };
  return FLOW;
}
function pos(i, tau) {
  const F = flow(), u = F.K * (1 - Math.sqrt(1 - Math.min(1, Math.max(0, tau)))), k = Math.min(F.K - 1, Math.floor(u)), f = u - k;
  const a = F.tr[i][k], b = F.tr[i][k + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
const PROBE_T = .35;

// ---------- the plane, laid out the same in every scene ----------
const PL = { cx: 540, cy: 665, s: 80, x0: 180, y0: 305, w: 720, h: 720 };
const P = (x, y) => [PL.cx + x * PL.s, PL.cy - y * PL.s];
function frame(g, a) { g.rect(PL.x0, PL.y0, PL.w, PL.h, { r: 18, stroke: g.COL.line, lw: 2, alpha: a }); }
function clipPlane(g, fn) { const X = g.ctx; X.save(); X.beginPath(); X.rect(PL.x0 + 2, PL.y0 + 2, PL.w - 4, PL.h - 4); X.clip(); fn(X); X.restore(); }
function board(g, a, each) {
  CELLS.forEach(([cx, cy], n) => {
    const k = each ? each(n) : 1, [x, y] = P(cx, cy + CELL);
    g.rect(x, y, CELL * PL.s, CELL * PL.s, { r: 4, fill: g.rgba(g.COL.yellow, .12), stroke: g.rgba(g.COL.yellow, .55), lw: 2, alpha: a * k });
  });
}
function dataDots(g, a) {
  if (a <= 0) return;
  clipPlane(g, X => { X.globalAlpha *= a; X.fillStyle = g.COL.yellow; flow().D.forEach(d => { const [x, y] = P(d[0], d[1]); X.fillRect(x - 2, y - 2, 4, 4); }); });
}
// all particles at flow time tau; alphaOf(i) lets them fade in one after another
function particles(g, tau, a, alphaOf, color) {
  if (a <= 0) return;
  const F = flow();
  clipPlane(g, X => {
    const base = X.globalAlpha; X.fillStyle = color || g.COL.fg;
    F.X0.forEach((_, i) => { if (i === F.hero) return; const k = alphaOf ? alphaOf(i) : 1; if (k <= 0) return;
      const [x, y] = P(...pos(i, tau)); X.globalAlpha = base * a * k * .85; X.beginPath(); X.arc(x, y, 3.2, 0, 7); X.fill(); });
  });
}
function hero(g, tau, a, trail) {
  if (a <= 0) return;
  const F = flow();
  if (trail) { const pts = []; for (let k = 0; k <= 40; k++) pts.push(P(...pos(F.hero, tau * k / 40))); g.path(pts, { color: g.COL.acc, lw: 3, alpha: a * .8 }); }
  const [x, y] = P(...pos(F.hero, tau)); g.circle(x, y, 9, { fill: g.COL.acc, alpha: a });
}
// a velocity arrow drawn at plane point p; len = pixels per unit of speed
function vel(g, p, u, o = {}) {
  const [x, y] = P(p[0], p[1]), L = o.len ?? 26, mx = o.max ?? 999, sp = Math.hypot(u[0], u[1]), f = sp * L > mx ? mx / (sp * L) : 1;
  g.arrow(x, y, x + u[0] * L * f, y - u[1] * L * f, { color: o.color ?? g.COL.fg, lw: o.lw ?? 5, head: o.head ?? 16, k: o.k ?? 1, alpha: o.alpha ?? 1 });
  return [x + u[0] * L * f, y - u[1] * L * f];
}
// an arrow grid over the plane; fn(x) gives the velocity
function arrows(g, fn, a, o = {}) {
  if (a <= 0) return;
  const n = 9;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -4 + 8 * i / (n - 1), y = -4 + 8 * j / (n - 1), u = fn([x, y]), sp = Math.hypot(u[0], u[1]);
    if (sp < 1e-6) continue;
    const L = Math.min(30, 9 * sp) / sp, [px, py] = P(x, y);
    g.arrow(px - u[0] * L / 2, py + u[1] * L / 2, px + u[0] * L / 2, py - u[1] * L / 2, { color: o.color ?? g.rgba(g.COL.fg, .55), lw: 2, head: 9, k: o.k ?? 1, alpha: a });
  }
}
function timebar(g, tau, a, label) {
  if (a <= 0) return;
  const x0 = 360, x1 = 900, y = 205;
  g.text(`t = ${tau.toFixed(2)}`, 190, y, { size: 34, font: 'mono', align: 'left', alpha: a });
  g.line(x0, y, x1, y, { color: g.COL.faint, lw: 8, alpha: a });
  g.line(x0, y, x0 + (x1 - x0) * tau, y, { color: g.COL.acc, lw: 8, alpha: a });
  g.text(label?.[0] ?? '0：噪声', x0, y + 42, { size: 24, color: g.COL.sub, align: 'left', alpha: a });
  g.text(label?.[1] ?? '1：数据', x1, y + 42, { size: 24, color: g.COL.sub, align: 'right', alpha: a });
}
const formula = (g, parts, a, note) => {
  g.rect(60, 1062, 960, 96, { r: 16, fill: g.COL.panel, stroke: g.COL.faint, lw: 2, alpha: a });
  g.rich(parts, 540, 1110, { size: 34, font: 'disp', alpha: a, maxW: 920 });
  if (note) g.note(note, 1020, 1040, { alpha: a });
};

// ---------- scene 5: one conditional path, diffusion (VP, eq. 18) vs OT (eq. 22) ----------
const Tvp = s => .1 * s + .5 * s * s * (20 - .1);                 // T(s) = ∫β, β from 0.1 to 20 (Appendix E.1)
const vp = (x0, x1, t) => { const al = Math.exp(-.5 * Tvp(1 - t)), sd = Math.sqrt(1 - al * al); return [sd * x0[0] + al * x1[0], sd * x0[1] + al * x1[1]]; };
const ot = (x0, x1, t) => { const sd = 1 - (1 - SIG) * t; return [sd * x0[0] + t * x1[0], sd * x0[1] + t * x1[1]]; };
const X1C = [1.5, 1.35], STARTS = [[-1.9, .9], [-1.3, -1.2], [.1, -1.9], [1.7, -1.3], [2.3, .1], [.4, 2.1], [-.7, .2]];
const SCOL = ['#FF6A2C', '#5AA9FF', '#3DDC97', '#FFD23F', '#B48CFF', '#FF4B4B', '#F4F3EF'];
function pathPanel(g, x, y, sz, fn, a, k, title, color, ticks) {
  const S = sz / 5.4, M = (px, py) => [x + (px + 2.5) * S, y + sz - (py + 2.5) * S];
  g.rect(x, y, sz, sz, { r: 16, fill: g.COL.panel, stroke: g.COL.faint, lw: 2, alpha: a });
  const X = g.ctx; X.save(); X.globalAlpha *= a;   // the noise blob p0
  const [ox, oy] = M(0, 0), gr = X.createRadialGradient(ox, oy, 0, ox, oy, 1.6 * S); gr.addColorStop(0, g.rgba(g.COL.blue, .35)); gr.addColorStop(1, g.rgba(g.COL.blue, 0));
  X.fillStyle = gr; X.beginPath(); X.arc(ox, oy, 1.6 * S, 0, 7); X.fill(); X.restore();
  g.text(title, x + sz / 2, y - 34, { size: 32, weight: 700, color, alpha: a });
  STARTS.forEach((s0, n) => {
    const pts = []; for (let i = 0; i <= 60; i++) pts.push(M(...fn(s0, X1C, i / 60)));
    g.path(pts, { color: SCOL[n], lw: 4, k, alpha: a * .9 });
    const h = M(...fn(s0, X1C, k)); g.circle(h[0], h[1], 7, { fill: SCOL[n], alpha: a });
    if (ticks > 0) for (let q = 1; q < 10; q++) { const p = M(...fn(s0, X1C, q / 10)); g.circle(p[0], p[1], 5, { fill: g.COL.fg, alpha: a * ticks }); }
  });
  const [tx, ty] = M(...X1C); g.circle(tx, ty, 10, { fill: g.COL.yellow, stroke: g.COL.bg, lw: 3, alpha: a });
  return M;
}

PM.film({
  paper: { title: 'Flow Matching for Generative Modeling', byline: 'Lipman 等 5 位作者 · Meta AI (FAIR) + Weizmann · 2022', arxiv: '2210.02747' },
  question: '一团噪声要流成数据，**每一点该往哪走**，怎么教给模型？',
  pronounce: { 'w/': 'with' },                                // 配音念法
  recap: [
    '向量场：每一点、每一刻都有一个箭头',
    '只盯一个数据点，箭头就有现成公式',
    '训练：两点连一线，学它的方向，不用解方程',
    'OT 走直线：图出来得更早，步数更少',
  ],
  scenes: [
    {
      id: 'flow', name: '问题：一团噪声，怎么「流」成数据？',
      lines: [
        '生成模型要做的事：从一团随手采的**噪声**出发，变出像真数据一样的样本',
        '论文用了一个二维例子：数据是一张**棋盘格**，平面上每个点就是一个样本',
        'CNF（连续归一化流）的想法：给平面上每一点、每个时刻都配一个箭头，叫**向量场**',
        { text: '每个点顺着脚下的箭头走，从 t = 0 走到 t = 1，噪声就**流**成了棋盘', hold: 2.6 },
      ],
      draw(g) {
        const { t, L, COL } = g, F = flow();
        const tau = g.p(L(3) + .4, 5.6, 'io');
        frame(g, g.p(0, .5));
        board(g, 1, n => g.p(L(1) + .3 + n * .18, .4));
        if (t > L(2) - .2) arrows(g, x => field(x, tau, F.D), g.p(L(2) + .4, .8) * (1 - .45 * g.p(L(3) + .2, .6)), { k: g.p(L(2) + .4, 1.2) });
        particles(g, tau, 1, i => g.p(.6 + 1.8 * i / F.X0.length, .4));
        hero(g, tau, g.p(2.6, .4), t > L(3));
        g.chip('噪声 p₀ = N(0, I)', 540, 1075, { size: 30, color: COL.blue, alpha: g.p(1.2, .4) * (1 - g.p(L(1), .4)) });
        g.chip('数据 q：棋盘格（论文 Figure 4 的例子）', 540, 1075, { size: 30, color: COL.yellow, alpha: g.p(L(1) + .4, .4) * (1 - g.p(L(2), .4)) });
        g.chip('向量场 v_t(x)：每一点、每一刻的箭头', 540, 1075, { size: 30, alpha: g.p(L(2) + .8, .4) * (1 - g.p(L(3), .4)) });
        if (t > L(3) - .1) {
          timebar(g, tau, g.p(L(3), .4));
          g.note('示意：理想箭头按论文式 (8)(21) 算出，欧拉法积分', 1020, 1075, { alpha: g.p(L(3) + .6, .4) });
        }
      },
    },
    {
      id: 'hard', name: '难点：正确的箭头，没法直接算',
      lines: [
        '箭头交给神经网络来画：输入位置 x 和时间 t，输出一个速度 v',
        '以前训练 CNF，要把整条路模拟一遍：每走一小步都要解一次微分方程，又慢又难放大',
        'flow matching 换了个思路：只要知道每一点**正确的箭头** u，就直接让网络去对齐它',
        { text: '可是正确的箭头由**所有**数据一起决定：这一点往哪走，要看它可能流向哪个数据点', hold: 1.2 },
      ],
      draw(g) {
        const { t, L, COL } = g, F = flow(), q = pos(F.hero, PROBE_T), uq = field(q, PROBE_T, F.D);
        const rot = (u, a, s) => [s * (u[0] * Math.cos(a) - u[1] * Math.sin(a)), s * (u[0] * Math.sin(a) + u[1] * Math.cos(a))];
        frame(g, 1);
        board(g, .55);
        const sim = g.win(L(1), L(2) + .1, .3, .4);
        particles(g, PROBE_T, .3 * (1 - sim));
        // the network box
        const na = g.p(L(0) + .3, .5);
        g.rect(330, 150, 420, 92, { r: 16, fill: g.COL.panel, stroke: COL.acc, lw: 3, alpha: na });
        g.text('神经网络 v_t(x; θ)', 540, 196, { size: 32, weight: 700, alpha: na });
        g.text('x, t', 250, 196, { size: 32, font: 'mono', color: COL.sub, alpha: na });
        g.arrow(290, 196, 322, 196, { color: COL.sub, lw: 3, head: 12, alpha: na });
        g.arrow(758, 196, 800, 196, { color: COL.acc, lw: 3, head: 12, alpha: na });
        g.text('v', 830, 196, { size: 36, font: 'mono', color: COL.acc, alpha: na });
        // the probe: where the hero is at t = 0.35, with the network's guess v
        const pa = g.p(L(0) + 1, .4) * (1 - sim);
        if (pa > 0) {
          const [px, py] = P(...q);
          g.circle(px, py, 10, { fill: COL.acc, alpha: pa });
          g.curve(800, 230, px + 6, py - 16, { bend: -60, color: g.rgba(COL.acc, .5), lw: 2, dash: [6, 8], k: g.p(L(0) + 1.3, .6), alpha: pa * (1 - g.p(L(2), .4)) });
          const v = rot(uq, 1.1, .8);
          const tv = vel(g, q, v, { color: COL.acc, k: g.p(L(0) + 1.6, .5), alpha: pa });
          g.text('v（网络猜的）', tv[0] - 14, tv[1] - 34, { size: 28, color: COL.acc, align: 'right', alpha: g.p(L(0) + 2, .4) * pa });
          if (t > L(2)) {
            const tu = vel(g, q, uq, { color: COL.green, k: g.p(L(2) + .5, .5), alpha: pa });
            g.text('u（正确的）', tu[0] + 18, tu[1] + 6, { size: 28, color: COL.green, align: 'left', alpha: g.p(L(2) + .9, .4) * pa });
            g.line(tv[0], tv[1], tu[0], tu[1], { color: COL.fg, lw: 3, dash: [6, 6], k: g.p(L(2) + 1.4, .5), alpha: pa * (1 - g.p(L(3), .4)) });
            formula(g, [['L_FM = ‖ ', COL.fg], ['v_t(x)', COL.acc], [' − ', COL.fg], ['u_t(x)', COL.green], [' ‖²', COL.fg]], g.p(L(2) + 1.8, .4) * (1 - g.p(L(3) + .2, .4)), '式 (5)');
          }
          if (t > L(3)) {   // u is a weighted vote of every data point
            const w = weights(q, PROBE_T, F.D), wm = Math.max(...w), [px2, py2] = P(...q);
            F.D.forEach((d, j) => { if (w[j] / wm < .04) return; const [dx, dy] = P(...d);
              g.line(px2, py2, dx, dy, { color: COL.yellow, lw: 1.5, k: g.p(L(3) + .3 + (j % 40) * .02, .8), alpha: pa * .9 * (w[j] / wm) }); });
            dataDots(g, pa * g.p(L(3) + .2, .4));
            g.chip('式 (8)：对所有数据点加权平均', 540, 1080, { size: 30, color: COL.yellow, alpha: g.p(L(3) + 1.2, .4) });
            g.text('真实图像：要对所有图积分，算不出', 540, 1150, { size: 28, color: COL.sub, alpha: g.p(L(3) + 2.4, .4) });
          }
        }
        // the old way: simulate the whole path, one ODE step at a time
        if (sim > 0) {
          const n = Math.min(F.K, Math.floor(g.clamp((t - L(1) - .3) / 5) * F.K)), pts = [];
          for (let k = 0; k <= n; k++) pts.push(P(...F.tr[F.hero][k]));
          pts.forEach(p => g.circle(p[0], p[1], 3, { fill: COL.acc, alpha: sim }));
          if (pts.length) g.circle(pts[pts.length - 1][0], pts[pts.length - 1][1], 9, { fill: COL.acc, alpha: sim });
          g.chip(`解 ODE：第 ${n} 步`, 540, 1080, { size: 32, alpha: sim });
          g.text('老办法：最大似然训练，每个样本都要这样走一遍', 540, 1150, { size: 28, color: COL.sub, alpha: sim * g.p(L(1) + 1.4, .4) });
        }
      },
    },
    {
      id: 'cond', name: '关键：只盯一个数据点，箭头就有公式',
      lines: [
        '论文的办法：先只挑**一个**真数据点 x₁，让噪声只流向它',
        '这条路是一团高斯：中心从 0 走到 x₁，宽度从 1 缩到一个很小的 σ_min',
        { text: '每一点该往哪走，都有现成的公式，叫**条件向量场** u_t(x | x₁)', say: '每一点该往哪走，都有现成的公式，叫条件向量场 u t' },
        '每次随机挑一个 x₁ 练一下，练多了，网络学到的就是这些单点箭头的**平均**',
        { text: '论文定理 2：用单点箭头训练，和对齐那个算不出的总箭头，**梯度完全一样**', hold: 1.2 },
      ],
      draw(g) {
        const { t, L, COL } = g, F = flow(), x1 = F.x1;
        const tau = g.p(L(1) + .3, 3.6, 'io'), demo = g.win(0, L(3) - .1, .01, .4), av = g.win(L(3) - .1, g.dur, .4, .3);
        frame(g, 1);
        board(g, .45);
        dataDots(g, .5 * g.p(.3, .5));
        const [ax, ay] = P(...x1);
        g.circle(ax, ay, 18, { stroke: COL.yellow, lw: 4, alpha: g.p(L(0) + .5, .4) });
        g.text('x₁', ax + 30, ay - 26, { size: 34, weight: 700, color: COL.yellow, align: 'left', alpha: g.p(L(0) + .7, .4) });
        if (demo > 0) {
          // the conditional Gaussian path (eq. 10, 20): centre t·x₁, std 1 − (1 − σ_min)t
          const s = 1 - (1 - SIG) * tau, c = P(tau * x1[0], tau * x1[1]);
          g.circle(c[0], c[1], s * PL.s, { stroke: COL.blue, lw: 3, dash: [8, 8], alpha: demo * g.p(L(0) + 1.2, .5) });
          g.circle(c[0], c[1], 2 * s * PL.s, { stroke: g.rgba(COL.blue, .5), lw: 2, dash: [4, 8], alpha: demo * g.p(L(0) + 1.2, .5) });
          clipPlane(g, X => { X.fillStyle = COL.fg; X.globalAlpha *= demo * .8 * g.p(L(0) + 1.4, .5);
            F.X0.forEach((p, i) => { if (i % 2) return; const [x, y] = P(...ot(p, x1, tau)); X.beginPath(); X.arc(x, y, 3, 0, 7); X.fill(); }); });
          if (t > L(1) - .1) {
            timebar(g, tau, g.p(L(1), .4), ['0：N(0, I)', '1：只剩 x₁']);
            g.chip('中心 μ_t：0 → x₁', 330, 1080, { size: 30, color: COL.blue, alpha: g.p(L(1) + .8, .4) * (1 - g.p(L(2), .4)) });
            g.chip('宽度 σ_t：1 → σ_min', 750, 1080, { size: 30, color: COL.blue, alpha: g.p(L(1) + 1.6, .4) * (1 - g.p(L(2), .4)) });
          }
          if (t > L(2) - .1) {
            arrows(g, x => condU(x, tau, x1), g.p(L(2) + .3, .6), { color: g.rgba(COL.green, .75), k: g.p(L(2) + .3, 1.2) });
            formula(g, [['u_t(x|x₁) = ( ', COL.fg], ['x₁', COL.yellow], [' − (1−σ_min)·x ) / ( 1 − (1−σ_min)·t )', COL.fg]], g.p(L(2) + 1.2, .4), '式 (21) · 每个箭头都指向 x₁');
          }
        }
        if (av > 0) {
          // back at the probe: single-point arrows for several random x₁, the network ends up at their average
          const q = pos(F.hero, PROBE_T), uq = field(q, PROBE_T, F.D), [px, py] = P(...q);
          particles(g, PROBE_T, .25 * av);
          g.circle(px, py, 10, { fill: COL.acc, alpha: av });
          F.picks.forEach((d, n) => {
            const k = g.p(L(3) + .4 + n * .45, .4), [dx, dy] = P(...d);
            g.line(px, py, dx, dy, { color: g.rgba(COL.yellow, .5), lw: 2, dash: [5, 7], k, alpha: av * (1 - .6 * g.p(L(4), .4)) });
            g.circle(dx, dy, 7, { fill: COL.yellow, alpha: av * k });
            vel(g, q, condU(q, PROBE_T, d), { color: g.rgba(COL.green, .85), lw: 4, head: 14, len: 26, k, alpha: av * (1 - .6 * g.p(L(4), .4)) });
          });
          const m = g.p(L(3) + 3.8, 1.2, 'io'), v0 = [uq[0] * .2 - uq[1] * .7, uq[1] * .2 + uq[0] * .7], v = [g.lerp(v0[0], uq[0], m), g.lerp(v0[1], uq[1], m)];
          const tv = vel(g, q, v, { color: COL.acc, len: 26, lw: 8, head: 20, alpha: av * g.p(L(3) + 3.4, .4) });
          g.text('网络学到 = 平均', tv[0] + 16, tv[1] - 20, { size: 28, color: COL.acc, align: 'left', alpha: av * g.p(L(3) + 4.8, .4) });
          if (t > L(4)) {
            const a = g.p(L(4), .4);
            g.rect(80, 1050, 400, 110, { r: 16, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: a });
            g.text('L_FM：对齐总箭头 u_t(x)', 280, 1086, { size: 28, alpha: a });
            g.text('✗ 算不出', 280, 1128, { size: 28, color: COL.red, alpha: a });
            g.rect(600, 1050, 400, 110, { r: 16, fill: COL.panel, stroke: COL.green, lw: 3, alpha: g.p(L(4) + .6, .4) });
            g.text('L_CFM：对齐单点箭头', 800, 1086, { size: 28, alpha: g.p(L(4) + .6, .4) });
            g.text('✓ 有公式', 800, 1128, { size: 28, color: COL.green, alpha: g.p(L(4) + .6, .4) });
            g.text('=', 540, 1100, { size: 56, weight: 800, font: 'disp', color: COL.acc, alpha: g.p(L(4) + 1.4, .4) });
            g.note('梯度相同 · 定理 2', 1020, 1028, { alpha: g.p(L(4) + 1.6, .4) });
          }
        }
      },
    },
    {
      id: 'train', name: '训练：两点连一线，学它的方向',
      lines: [
        '训练一步：随手抽一个噪声点 x₀、一个真数据点 x₁，再抽一个时间 t',
        '按 t 把两点混在一起，得到 x_t：就像一道「画到一半」的练习题',
        { text: '标准答案就是这条线的方向：x₁ − (1 − σ_min)·x₀，网络要在 x_t 这里把它猜出来', say: '标准答案就是这条线的方向：x 1 减去 1 减 σ min 倍的 x 0，网络要在 x t 这里把它猜出来' },
        '损失就是两个箭头之差的平方：不用模拟、不用解方程，**一步就算完**',
        { text: '一批又一批点对反复练，网络就学会了整个平面上的箭头', hold: 1.4 },
      ],
      draw(g) {
        const { t, L, COL } = g, F = flow(), x0 = F.X0[F.far], x1 = F.x1, TT = .6;
        const one = 1 - g.p(L(4) + .2, .5);
        frame(g, 1);
        board(g, .45);
        dataDots(g, .35);
        particles(g, 0, .18);
        // t slider
        const ta = g.p(L(0) + 1.6, .4), tk = g.p(L(0) + 1.8, .9, 'io') * TT;
        g.text('t', 215, 205, { size: 34, font: 'mono', alpha: ta });
        g.line(260, 205, 900, 205, { color: COL.faint, lw: 8, alpha: ta });
        g.line(260, 205, 260 + 640 * tk, 205, { color: COL.acc, lw: 8, alpha: ta });
        g.circle(260 + 640 * tk, 205, 14, { fill: COL.acc, alpha: ta });
        g.text(`t = ${tk.toFixed(1)}（示意）`, 260 + 640 * TT, 252, { size: 26, color: COL.sub, alpha: g.p(L(0) + 2.6, .4) });
        const [ax, ay] = P(...x0), [bx, by] = P(...x1);
        g.circle(ax, ay, 11, { fill: COL.blue, alpha: g.p(L(0) + .4, .4) * one });
        g.text('x₀', ax - 22, ay + 30, { size: 34, weight: 700, color: COL.blue, align: 'right', alpha: g.p(L(0) + .5, .4) * one });
        g.circle(bx, by, 11, { fill: COL.yellow, alpha: g.p(L(0) + 1, .4) * one });
        g.text('x₁', bx + 22, by - 26, { size: 34, weight: 700, color: COL.yellow, align: 'left', alpha: g.p(L(0) + 1.1, .4) * one });
        if (t > L(1) - .1) {
          g.line(ax, ay, bx, by, { color: COL.sub, lw: 3, dash: [8, 8], k: g.p(L(1) + .2, .7), alpha: one });
          const m = g.p(L(1) + 1, 1.2, 'io') * TT, xm = ot(x0, x1, m), [mx, my] = P(...xm);
          g.circle(mx, my, 13, { fill: COL.fg, stroke: COL.acc, lw: 4, alpha: one });
          g.text('x_t', mx - 24, my - 30, { size: 34, weight: 700, align: 'right', alpha: g.p(L(1) + 2.2, .4) * one });
          formula(g, [['x_t = (1 − (1−σ_min)·t)·', COL.fg], ['x₀', COL.blue], [' + t·', COL.fg], ['x₁', COL.yellow]], g.p(L(1) + .8, .4) * (1 - g.p(L(3), .4)), '式 (22)');
          if (t > L(2)) {
            const xt = ot(x0, x1, TT), ans = [x1[0] - (1 - SIG) * x0[0], x1[1] - (1 - SIG) * x0[1]];
            const tu = vel(g, xt, ans, { color: COL.green, len: 21, lw: 6, k: g.p(L(2) + .4, .5), alpha: one });
            g.text('标准答案', tu[0] - 18, tu[1] + 30, { size: 28, color: COL.green, align: 'right', alpha: g.p(L(2) + .8, .4) * one });
            const fit = g.p(L(3) + 1.2, 1.4, 'io'), ang = 1.25 * (1 - fit), sc = g.lerp(.65, 1, fit);
            const v = [sc * (ans[0] * Math.cos(ang) - ans[1] * Math.sin(ang)), sc * (ans[0] * Math.sin(ang) + ans[1] * Math.cos(ang))];
            const tv = vel(g, xt, v, { color: COL.acc, len: 21, lw: 6, k: g.p(L(2) + 2, .5), alpha: one });
            g.text('网络猜的', tv[0] - 14, tv[1] - 22, { size: 28, color: COL.acc, align: 'right', alpha: g.p(L(2) + 2.4, .4) * one * (1 - fit) });
            if (t > L(3)) {
              g.line(tv[0], tv[1], tu[0], tu[1], { color: COL.fg, lw: 3, dash: [6, 6], k: g.p(L(3) + .3, .4), alpha: one * (1 - fit) });
              formula(g, [['L_CFM = ‖ ', COL.fg], ['v_t(x_t)', COL.acc], [' − ( ', COL.fg], ['x₁', COL.yellow], [' − (1−σ_min)·', COL.fg], ['x₀', COL.blue], [' ) ‖²', COL.fg]], g.p(L(3) + .3, .4), '式 (23) · 一步算完');
            }
          }
        }
        if (t > L(4)) {   // many pairs, then the learned field everywhere
          F.pairs.forEach(([p0, p1], n) => {
            const k = g.p(L(4) + .2 + n * .05, .4), [sx, sy] = P(...p0), [ex, ey] = P(...p1), xm = P(...ot(p0, p1, TT));
            g.line(sx, sy, ex, ey, { color: g.rgba(COL.green, .35), lw: 2, k, alpha: 1 - .6 * g.p(L(4) + 3, .6) });
            g.circle(xm[0], xm[1], 4, { fill: COL.fg, alpha: k * (1 - .6 * g.p(L(4) + 3, .6)) });
          });
          arrows(g, x => field(x, TT, F.D), g.p(L(4) + 2.8, .6), { color: g.rgba(COL.acc, .85), k: g.p(L(4) + 2.8, 1) });
        }
      },
    },
    {
      id: 'path', name: '路线：扩散绕弯，OT 走直线',
      lines: [
        '中心和宽度怎么随时间变，可以自己挑：照扩散模型那样挑，扩散就成了 flow matching 的一个特例',
        '论文推荐最简单的挑法：中心和宽度都随时间**直线变化**，这就是最优传输（OT）路径',
        '扩散的路是弯的，有的还冲过头再折回来；OT 每条都是直线，而且**匀速**',
        '论文图 3 画的就是这件事：左边扩散绕弯，右边 OT 全是直线',
        { text: '论文图 2 还显示：OT 的箭头方向从头到尾不变，网络要学的东西更简单', hold: 1 },
      ],
      draw(g) {
        const { t, L, COL } = g, sz = 470, y = 240;
        const ka = g.p(L(0) + .6, 3.4, 'io'), kb = g.p(L(1) + .6, 3, 'io'), tk = g.p(L(2) + .6, .6);
        const Ma = pathPanel(g, 45, y, sz, vp, g.p(L(0) + .2, .4), ka, '扩散（VP）', COL.purple, tk);
        pathPanel(g, 565, y, sz, ot, g.p(L(1) + .2, .4), kb, 'OT', COL.green, tk);
        g.note('按论文式 (18)(22) 计算：β 0.1→20（附录 E.1），σ_min = 0.05（示意）', 1035, 750, { alpha: g.p(L(1) + 1, .4) });
        if (t > L(2)) {
          // the path from (2.3, 0.1) bulges past x₁ before coming back
          const p = Ma(...vp(STARTS[4], X1C, .78));
          g.mark(p[0] - 46, p[1] - 46, 92, 92, { k: g.p(L(2) + 1.4, .5), color: COL.red, label: '冲过头', side: 'bottom', alpha: 1 - g.p(L(3), .3) });
          g.chip('白点 = 每过 0.1 的时间', 540, 830, { size: 30, alpha: g.p(L(2) + 2.2, .4) * (1 - g.p(L(3), .3)) });
        }
        const f3 = g.win(L(3), L(4) + .1, .4, .35);
        if (f3 > 0) {
          const F = g.img('fig3_traj', 250, 820, 580, null, { card: true, alpha: f3 });
          g.mark(F.box(.03, .04, .45, .83), { k: g.p(L(3) + .6, .5), color: COL.purple, label: '扩散', side: 'left', alpha: f3 });
          g.mark(F.box(.56, .04, .99, .83), { k: g.p(L(3) + 1.6, .5), color: COL.green, label: 'OT', side: 'right', alpha: f3 });
          g.note('图：论文 Figure 3', 830, 790, { alpha: f3 });
        }
        if (t > L(4)) {
          const a = g.p(L(4) + .2, .4), F = g.img('fig2_vf', 60, 880, 960, null, { card: true, alpha: a });
          g.mark(F.box(.14, .03, .545, .97), { k: g.p(L(4) + .6, .5), color: COL.purple, label: '扩散：方向随 t 变', side: 'bottom', alpha: a });
          g.mark(F.box(.575, .03, .998, .97), { k: g.p(L(4) + 1.6, .5), color: COL.green, label: 'OT：方向不变', side: 'bottom', alpha: a });
          g.note('图：论文 Figure 2（t = 0 → 1）', 1020, 840, { alpha: a });
        }
      },
    },
    {
      id: 'early', name: '效果：图出来得更早，步数更少',
      lines: [
        '同样学棋盘：OT 路径一半就出现了格子，扩散要到快结束才成形',
        '换成真图：ImageNet 64×64 上同一个噪声起点，OT 的噪声差不多匀速变少',
        '扩散这边，噪声一直盖着，到最后两三格才去掉',
        { text: '少步数采样时，OT 达到同样的误差，只要扩散大约 **60%** 的步数', hold: 1 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const f4 = g.win(0, L(1) + .1, .5, .4);
        if (f4 > 0) {
          const F = g.img('fig4_left', 60, 300, 960, null, { card: true, alpha: f4 });
          g.mark(F.box(.0, .02, 1, .29), { k: g.p(L(0) + .5, .5), color: COL.purple, alpha: f4 });
          g.mark(F.box(.0, .715, 1, .98), { k: g.p(L(0) + 1.2, .5), color: COL.green, alpha: f4 });
          g.mark(F.box(.5, .7, .61, .99), { k: g.p(L(0) + 2.2, .5), color: COL.acc, lw: 5, label: 'OT：一半就成形', side: 'bottom', alpha: f4 });
          g.mark(F.box(.8, .01, .91, .3), { k: g.p(L(0) + 3.4, .5), color: COL.acc, lw: 5, label: '扩散：快结束才成形', side: 'top', alpha: f4 });
          g.note('图：论文 Figure 4（左）· 从左到右 t = 0 → 1', 1020, 760, { alpha: f4 });
        }
        const f6 = g.win(L(1), L(3) + .1, .4, .4);
        if (f6 > 0) {
          const A = g.img('fig6_ot', 90, 230, 900, null, { card: true, alpha: f6 });
          g.text('Flow Matching w/ OT', 90, A.y + A.h + 46, { size: 28, color: COL.green, align: 'left', alpha: f6 });
          g.mark(A.box(.33, .0, .56, 1), { k: g.p(L(1) + 1.4, .5), color: COL.green, label: '已经看得出图', side: 'right', dx: 0, alpha: f6 });
          const ba = g.win(L(2), L(3) + .1, .4, .4);
          if (ba > 0) {
            const B = g.img('fig6_sm', 90, 680, 900, null, { card: true, alpha: ba });
            g.text('Score Matching w/ Diffusion', 90, B.y + B.h + 46, { size: 28, color: COL.purple, align: 'left', alpha: ba });
            g.mark(B.box(.0, .0, .66, 1), { k: g.p(L(2) + .5, .6), color: COL.purple, label: '还是满屏噪声', side: 'top', alpha: ba });
          }
          g.note('图：论文 Figure 6（ImageNet 64×64，第 1、3 组）', 1020, 205, { alpha: f6 });
        }
        if (t > L(3)) {
          const a = g.p(L(3), .4);
          g.bars(60, 500, 960, [
            { label: '扩散路径', value: 100, text: '100%', color: COL.purple },
            { label: 'FM w/ OT', value: 60, text: '约 60%', hi: true, color: COL.green },
          ], { title: '达到同样误差要算的步数 ↓ 越少越好', min: 0, max: 110, k: g.p(L(3) + .2, 1.2), labelW: 240, h: 110, gap: 70, alpha: a });
          g.note('论文 6.2 节 · Figure 7（ImageNet 32×32，midpoint 求解器）', 1020, 880, { alpha: a });
        }
      },
    },
    {
      id: 'result', name: '结果：同一个网络，只换训练目标',
      lines: [
        'ImageNet 64×64，同一个 U-Net、同样的超参数，只换训练目标：FID 从 DDPM 的 17.36 降到 **14.45**',
        '采样时求解器要算的步数：DDPM 264 步，FM w/ OT 只要 **138** 步',
        { text: 'ImageNet 128×128 上 FID **20.9**，训练看过的图片总量还比 Dhariwal & Nichol 少 33%', hold: 1.2 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const rows = (vals, txt) => [
          { label: 'DDPM', value: vals[0], text: txt?.[0] }, { label: 'Score Matching', value: vals[1], text: txt?.[1] }, { label: 'ScoreFlow', value: vals[2], text: txt?.[2] },
          { label: 'FM w/ Diffusion', value: vals[3], text: txt?.[3], color: COL.acc2 }, { label: 'FM w/ OT', value: vals[4], text: txt?.[4], hi: true, color: COL.acc },
        ];
        const sayAt = (i, f) => g.lerp(L(i), g.Le(i), f);   // 第 i 句念到 f（0–1）的时刻
        const up = g.p(L(2), .6, 'io');
        const R = g.bars(60, 230 - 30 * up, 960, rows([17.36, 19.74, 24.95, 16.88, 14.45], ['17.36', '19.74', '24.95', '16.88', '14.45']),
          { title: 'ImageNet 64×64 · FID ↓ 越低越好', min: 10, max: 26, k: g.p(.4, 1.4), labelW: 280, alpha: 1 - .5 * up });
        g.note('横轴从 10 起 · 数据：论文 Table 1', 1020, 600 - 30 * up, { alpha: g.p(1.2, .4) * (1 - .5 * up) });
        // 念到「从 DDPM 的 17.36」圈 DDPM，念到「降到 14.45」圈 FM w/ OT
        g.mark(R[0].x - 286, R[0].y - 5, 990, R[0].h + 10, { k: g.p(sayAt(0, .62), .5), color: COL.sub, lw: 3, alpha: g.win(sayAt(0, .62), sayAt(0, .85), .3, .3) });
        g.mark(R[4].x - 286, R[4].y - 5, 990, R[4].h + 10, { k: g.p(sayAt(0, .82), .5), lw: 4, alpha: 1 - .5 * up });
        if (t > L(1) - .1) {
          g.bars(60, 680 - 30 * up, 960, rows([264, 441, 601, 187, 138]),
            { title: '采样步数 NFE ↓ 越少越好（自适应求解器）', min: 0, max: 650, k: g.p(L(1) + .2, 1.4), labelW: 280, alpha: g.p(L(1), .4) * (1 - .5 * up) });
        }
        if (t > L(2)) {
          const a = g.p(L(2) + .3, .4);
          g.rect(120, 1000, 840, 150, { r: 18, fill: COL.panel, stroke: COL.acc, lw: 3, alpha: a });
          g.text('ImageNet 128×128', 330, 1048, { size: 30, color: COL.sub, alpha: a });
          g.text('FID **20.9**', 330, 1104, { size: 46, weight: 800, font: 'disp', alpha: a });
          g.text('看过的图片总量', 740, 1048, { size: 30, color: COL.sub, alpha: g.p(sayAt(2, .4), .4) });
          g.text('**少 33%**', 740, 1104, { size: 46, weight: 800, font: 'disp', alpha: g.p(sayAt(2, .4), .4) });
          g.mark(548, 1012, 384, 126, { k: g.p(sayAt(2, .65), .6), lw: 4, alpha: a });
        }
      },
    },
  ],
});
