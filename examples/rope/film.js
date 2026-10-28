// RoFormer: Enhanced Transformer with Rotary Position Embedding（RoPE）— 3 分钟动效解读 · 张指导出品
// 主线：注意力分不清词序，怎样让分数只看两个词隔多远？主角：论文图 1 那句话里的 Embedding（q，第 6 个）和 Transformer（k，第 2 个）。

const WORDS = ['Enhanced', 'Transformer', 'with', 'Rotary', 'Position', 'Embedding'];
const Q = 5, K = 1;                         // q = Embedding（位置 6），k = Transformer（位置 2）
const TH = 12, Q0 = 30, K0 = 10;            // 二维演示（示意）：θ = 12°，q、k 本来的方向
const D = 128;                              // 多组演示用 d = 128（示意）
const thetaOf = i => Math.pow(10000, -2 * i / D);              // 论文 3.3 节：θ_i = 10000^(−2i/d)，弧度 / 位置
const degOf = i => thetaOf(i) * 180 / Math.PI;

const rad = a => a * Math.PI / 180;
const at = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a))];
function arc(g, cx, cy, r, a0, a1, o = {}) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 3)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(at(cx, cy, r, a0 + (a1 - a0) * i / n));
  g.path(pts, o);
}
function plane(g, cx, cy, R, a = 1) {
  g.line(cx - R - 24, cy, cx + R + 24, cy, { color: g.COL.faint, lw: 2, alpha: a });
  g.line(cx, cy + R + 24, cx, cy - R - 24, { color: g.COL.faint, lw: 2, alpha: a });
  arc(g, cx, cy, R, 0, 360, { color: g.COL.faint, lw: 2, dash: [6, 10], alpha: a });
}
function vecArrow(g, cx, cy, len, ang, color, o = {}) {
  const [x, y] = at(cx, cy, len, ang);
  g.arrow(cx, cy, x, y, { color, lw: o.lw ?? 7, head: o.head ?? 24, alpha: o.alpha ?? 1, k: o.k ?? 1, dash: o.dash });
  return [x, y];
}
function mix(a, b, u) {
  const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = h(a), B = h(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * u)).join(',')})`;
}
const fmtDeg = v => v >= 10 ? `${Math.round(v)}°` : v >= 1 ? `${v.toFixed(1)}°` : v >= .1 ? `${v.toFixed(2)}°` : `${v.toFixed(3)}°`;
const fmtTurn = v => v >= 360 ? `${(v / 360).toFixed(1)} 圈` : fmtDeg(v);

// 远程衰减（公式 35–37）：S_j = Σ_{i<j} e^{iΔθ_i}，图 2 画的是 (1/(d/2))·Σ_j |S_j|
function chain(delta) {
  const pts = [[0, 0]]; let x = 0, y = 0;
  for (let i = 0; i < D / 2; i++) { x += Math.cos(delta * thetaOf(i)); y += Math.sin(delta * thetaOf(i)); pts.push([x, y]); }
  return pts;
}
const bound = delta => chain(delta).slice(1).reduce((s, [x, y]) => s + Math.hypot(x, y), 0) / (D / 2);
const UB = Array.from({ length: 251 }, (_, k) => bound(k));

// 第 1 幕的一列词：每行一个词，左边是位置号
const ROW = i => 300 + i * 104;
const SH = [2, 4, 5, 0, 1, 3];              // 打乱后每个词去哪一行（向上的、向下的各自保持先后，不会穿过彼此）
const SCORE = [0.9, 2.6, 0.4, 1.1, 3.0];    // Embedding 给前 5 个词的分数（示意）

PM.film({
  paper: { title: 'RoFormer: Enhanced Transformer with Rotary Position Embedding', byline: 'Su 等 6 位作者 · 追一科技 · 2021', arxiv: '2104.09864' },
  question: '注意力**分不清词序**，怎样让分数只看两个词隔多远？',
  pronounce: { 'RoFormer': 'Roformer', '−': '减' },             // 配音念法：RoFormer 不逐字母念，m − n 念「m 减 n」
  recap: [
    '注意力本身**分不清顺序**，位置要另外塞进去',
    'RoPE：第 m 个位置，把 q、k **转 m·θ**',
    '点积只看夹角，分数里只剩**相对距离 m − n**',
    '每组转速不同，像一套**长短不同的尺子**',
  ],
  scenes: [
    {
      id: 'problem', name: '问题：注意力分不清词的先后',
      lines: [
        'Transformer 里，每个词拿自己的 **q** 和别的词的 **k** 做点积，给它们打分',
        '可这个分数**不管顺序**：把句子打乱，分数跟着词走，一模一样',
        '老办法是给每个位置**加上**一个位置向量，相当于贴座位号',
        '但注意力真正关心的是**隔多远**：Embedding 在第 6 个，Transformer 在第 2 个，隔 4 个',
        'RoFormer 想要的是：q·k 的分数里，位置只以 **m − n** 的形式出现',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const sh = g.p(L(1) + .5, 1, 'io') * (1 - g.p(L(2) + .1, .9, 'io'));
        const rowOf = i => g.lerp(ROW(i), ROW(SH[i]), sh), dxOf = i => Math.sin(sh * Math.PI) * (SH[i] > i ? 120 : -120);
        g.text('位置', 84, 236, { size: 24, color: COL.dim, alpha: g.p(.3, .4) });
        g.text('Embedding 打的分（示意）', 790, 236, { size: 24, color: COL.dim, alpha: g.p(L(0) + 1.2, .4) });
        for (let r = 0; r < 6; r++) {
          const hot = t > L(3) && (r === Q || r === K);
          g.text(String(r + 1), 84, ROW(r), { size: 34, font: 'disp', color: hot ? COL.yellow : COL.sub, alpha: g.p(.3 + r * .12, .4) });
        }
        // 位置向量：只有第 3 句出现，贴在位置号旁边
        const pa = g.win(L(2) + .3, L(4) + .4, .5, .4);
        if (pa > 0) for (let r = 0; r < 6; r++) {
          g.text('+', 140, ROW(r), { size: 34, font: 'disp', color: COL.yellow, alpha: pa * g.p(L(2) + .3 + r * .15, .3) });
          g.vec(160, ROW(r) - 11, [.3 + .1 * r, .9 - .1 * r, .5, .2 + .12 * r], { cell: 22, color: COL.yellow, k: g.p(L(2) + .3 + r * .15, .4), alpha: pa });
        }
        WORDS.forEach((w, i) => {
          const y = rowOf(i), dx = dxOf(i), me = i === Q, hot = t > L(3) && (i === Q || i === K);
          g.tokens([w], 420 + dx, y - 26, { size: 30, style: () => ({ alpha: g.p(.3 + i * .12, .4), stroke: me ? COL.acc : hot ? COL.blue : COL.faint, lw: me || hot ? 4 : 2, fill: me ? g.rgba(COL.acc, .18) : COL.panel }) });
          if (me) g.chip('q', 590 + dx, y, { size: 26, solid: true, alpha: g.p(L(0) + .6, .4) });
          else g.text(SCORE[i].toFixed(1), 790 + dx, y, { size: 34, font: 'disp', color: i === K && hot ? COL.blue : COL.fg, alpha: g.p(L(0) + 1.2 + i * .3, .3) });
        });
        if (sh > .05) g.chip('分数跟着词走：**一模一样**', 790, 940, { size: 30, alpha: g.p(L(1) + 1.6, .4) * (1 - g.p(L(2), .3)) });
        if (t > L(3)) {   // 隔 4 个位置
          const k = g.p(L(3) + 1.2, .8, 'io'), x = 960;
          g.path([[x - 20, ROW(K)], [x, ROW(K)], [x, ROW(Q)], [x - 20, ROW(Q)]], { color: COL.yellow, lw: 4, k });
          g.chip('m − n = 6 − 2 = **4**', 1030, 940, { size: 30, color: COL.yellow, align: 'right', alpha: g.p(L(3) + 2, .4) * (1 - g.p(L(4), .3)) });
        }
        if (t > L(4)) {
          const a = g.p(L(4), .5);
          g.rect(50, 900, 980, 100, { r: 16, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: a });
          g.rich([['⟨ f', COL.fg], ['q', COL.acc], ['(x, ', COL.fg], ['m', COL.yellow], ['),  f', COL.fg], ['k', COL.blue], ['(x, ', COL.fg], ['n', COL.yellow], [') ⟩  =  g( x, x, ', COL.fg], ['m − n', COL.acc], [' )', COL.fg]],
            540, 950, { size: 40, font: 'disp', alpha: a, maxW: 940 });
          g.note('论文公式 (11)', 1030, 1030, { alpha: a });
          g.mark(700, 920, 230, 60, { k: g.p(L(4) + 1.4, .6), lw: 4 });
        }
      },
    },
    {
      id: 'rotate', name: '核心想法：不加位置，把向量转一个角度',
      lines: [
        '先看最简单的情况：向量只有 2 维，就是平面上的一根箭头',
        'RoPE 不往向量上加东西，而是按位置把箭头**转**一下：第 m 个位置，转 **m·θ**',
        'Embedding 在第 6 个位置，q 转 **6θ**；Transformer 在第 2 个，k 转 **2θ**',
        '旋转不改长度，箭头只是换了方向，词本身的信息都还在',
        { text: '写成矩阵，就是论文里的一个 2×2 **旋转矩阵**', hold: 1 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const cx = 540, cy = 540, R = 300, lq = 290, lk = 260;
        plane(g, cx, cy, R, g.p(.2, .6));
        g.text('第 1 维', cx + R + 10, cy + 34, { size: 24, color: COL.dim, align: 'right', alpha: g.p(.4, .4) });
        g.text('第 2 维', cx + 16, cy - R - 10, { size: 24, color: COL.dim, align: 'left', alpha: g.p(.4, .4) });
        const qa = Q0 + 6 * TH * g.p(L(2) + .4, 1.4, 'io'), ka = K0 + 2 * TH * g.p(L(2) + 2.4, 1, 'io');
        if (t > L(2)) { vecArrow(g, cx, cy, lq, Q0, COL.acc, { alpha: .3, dash: [8, 8], head: 16 }); vecArrow(g, cx, cy, lk, K0, COL.blue, { alpha: .3, dash: [8, 8], head: 16 }); }
        if (t > L(3)) {   // 尖端一直在原来的圆上：长度没变
          arc(g, cx, cy, lq, 0, 360, { color: g.rgba(COL.acc, .7), lw: 3, dash: [4, 8], k: g.p(L(3) + .4, 1.2) });
          arc(g, cx, cy, lk, 0, 360, { color: g.rgba(COL.blue, .7), lw: 3, dash: [4, 8], k: g.p(L(3) + .8, 1.2) });
          g.chip('长度不变', 330, 770, { size: 30, color: COL.green, alpha: g.p(L(3) + 1.6, .4) });
        }
        if (qa > Q0 + .5) { arc(g, cx, cy, 120, Q0, qa, { color: COL.acc, lw: 6 }); g.text(`6θ = ${6 * TH}°`, ...at(cx, cy, 165, (Q0 + qa) / 2), { size: 28, font: 'disp', color: COL.acc, alpha: g.p(L(2) + 1.4, .4) }); }
        if (ka > K0 + .5) { arc(g, cx, cy, 200, K0, ka, { color: COL.blue, lw: 6 }); g.text(`2θ = ${2 * TH}°`, ...at(cx, cy, 255, 18), { size: 28, font: 'disp', color: COL.blue, alpha: g.p(L(2) + 3.2, .4) }); }
        const pq = vecArrow(g, cx, cy, lq, qa, COL.acc, { k: g.p(L(0) + .4, .6) });
        const pk = vecArrow(g, cx, cy, lk, ka, COL.blue, { k: g.p(L(0) + 1.2, .6) });
        g.chip('q · Embedding', ...at(cx, cy, lq + 56, qa), { size: 26, alpha: g.p(L(0) + .9, .4) });
        g.chip('k · Transformer', ...at(cx, cy, lk + 60, ka), { size: 26, color: COL.blue, alpha: g.p(L(0) + 1.7, .4) });
        // 位置条：每往后一个位置多转一个 θ
        const sa = g.p(L(1) + .3, .5) * (1 - g.p(L(4), .4));
        if (sa > 0) {
          g.text('每往后一个位置，多转一个 θ', 80, 900, { size: 28, color: COL.sub, align: 'left', alpha: sa });
          g.note('θ = 12°（示意）', 1000, 900, { alpha: sa });
          for (let m = 1; m <= 6; m++) {
            const x = 540 + (m - 3.5) * 150, hot = t > L(2) && (m === 6 || m === 2), c = m === 6 ? COL.acc : COL.blue;
            const a = sa * g.p(L(1) + .5 + m * .2, .3);
            g.rect(x - 55, 935, 110, 64, { r: 12, fill: hot ? g.rgba(c, .2) : COL.panel, stroke: hot ? c : COL.faint, lw: hot ? 4 : 2, alpha: a });
            g.text(String(m), x, 967, { size: 32, font: 'disp', color: hot ? c : COL.fg, alpha: a });
            g.text(`${m * TH}°`, x, 1035, { size: 26, font: 'disp', color: hot ? c : COL.sub, alpha: a });
          }
        }
        if (t > L(4)) {   // 公式 (13)
          const a = g.p(L(4) + .2, .5), y1 = 945, y2 = 1010;
          g.rich([['f(x, ', COL.fg], ['m', COL.yellow], [') =', COL.fg]], 70, (y1 + y2) / 2, { size: 34, font: 'disp', align: 'left', alpha: a });
          g.path([[340, 905], [322, 905], [322, 1050], [340, 1050]], { color: COL.fg, lw: 3, alpha: a });
          g.path([[730, 905], [748, 905], [748, 1050], [730, 1050]], { color: COL.fg, lw: 3, alpha: a });
          [[['cos ', COL.fg], ['m', COL.yellow], ['θ', COL.fg]], [['−sin ', COL.fg], ['m', COL.yellow], ['θ', COL.fg]], [['sin ', COL.fg], ['m', COL.yellow], ['θ', COL.fg]], [['cos ', COL.fg], ['m', COL.yellow], ['θ', COL.fg]]]
            .forEach((p, n) => g.rich(p, n % 2 ? 640 : 440, n < 2 ? y1 : y2, { size: 34, font: 'disp', alpha: g.p(L(4) + .4 + n * .25, .3) }));
          g.rich([['· W x', COL.fg]], 770, (y1 + y2) / 2, { size: 34, font: 'disp', align: 'left', alpha: a });
          g.note('论文公式 (13)', 1030, 1090, { alpha: a });
        }
      },
    },
    {
      id: 'relative', name: '为什么只剩相对位置：分数只看夹角',
      lines: [
        '两个向量的点积 = 长度 × 长度 × **cos(夹角)**',
        { text: '长度没变；夹角 = 原来的 20° 加上 **(6 − 2)·θ**，只跟两个词隔多远有关', say: '长度没变；夹角等于原来的 20 度，加上 6 减 2，再乘 θ，只跟两个词隔多远有关' },
        '整句前面再加 3 个词：Embedding 挪到第 9 个，Transformer 挪到第 5 个',
        '两根箭头都多转了 3θ：夹角还是 68°，分数**一模一样**',
        { text: '位置是按**绝对**位置转进去的，分数里却只剩**相对**距离：这就是 RoPE', hold: .8 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const cx = 540, cy = 470, R = 270, lq = 255, lk = 230;
        const sp = g.p(L(2) + .5, 1.2, 'io'), rot = g.p(L(3) + .3, 1.4, 'io');
        const qa = Q0 + 6 * TH + 3 * TH * rot, ka = K0 + 2 * TH + 3 * TH * rot;
        plane(g, cx, cy, R);
        if (t > L(1)) {   // 原来的方向和原来的夹角
          const a = g.p(L(1) + .3, .5);
          vecArrow(g, cx, cy, lq, Q0, COL.acc, { alpha: .3 * a, dash: [8, 8], head: 16 });
          vecArrow(g, cx, cy, lk, K0, COL.blue, { alpha: .3 * a, dash: [8, 8], head: 16 });
          arc(g, cx, cy, 150, K0, Q0, { color: COL.sub, lw: 4, alpha: a });
          g.text('20°', ...at(cx, cy, 190, (K0 + Q0) / 2), { size: 26, font: 'disp', color: COL.sub, alpha: a });
        }
        arc(g, cx, cy, 95, ka, qa, { color: COL.yellow, lw: 6, k: g.p(L(0) + .5, .8) });
        g.text('68°', ...at(cx, cy, 130, (ka + qa) / 2), { size: 30, font: 'disp', color: COL.yellow, alpha: g.p(L(0) + 1, .4) });
        vecArrow(g, cx, cy, lq, qa, COL.acc);
        vecArrow(g, cx, cy, lk, ka, COL.blue);
        const m = sp > .5 ? 9 : 6, n = sp > .5 ? 5 : 2;
        g.chip(`q · Embedding（m = ${m}）`, ...at(cx, cy, lq + 62, qa), { size: 26 });
        g.chip(`k · Transformer（n = ${n}）`, ...at(cx, cy, lk + 64, ka), { size: 26, color: COL.blue });
        g.text('q·k = 0.34（示意）', cx, 650, { size: 32, font: 'disp', alpha: g.p(L(0) + 1.4, .4) });
        if (t > L(3)) g.chip('加词前后：都是 0.34', cx, 708, { size: 28, color: COL.green, alpha: g.p(L(3) + 1.8, .4) });
        g.chip('q·k = |q| × |k| × cos(夹角)', cx, 790, { size: 30, color: COL.yellow, alpha: g.p(L(0) + .3, .4) });
        if (t > L(1)) {
          const fa = g.p(L(1) + 1, .4) * (1 - .6 * g.p(L(2), .4));
          const r = g.rich([['夹角 ', COL.fg], ['68°', COL.yellow], [' = ', COL.fg], ['20°', COL.sub], [' + ', COL.fg], ['(6 − 2)', COL.acc], [' × 12°', COL.fg]], cx, 856, { size: 32, font: 'disp', alpha: fa });
          g.mark(r.x - 14, r.y - 10, r.w + 28, r.h + 20, { k: g.p(L(1) + 3, .6), color: COL.acc, lw: 4, alpha: fa });
        }
        // 位置格子：前面插进 3 个词，两个词一起往后挪 3 格
        if (t > L(2) - .2) {
          const a = g.p(L(2), .4), sx = s => 540 + (s - 5) * 108;
          for (let s = 1; s <= 9; s++) {
            const add = s <= 3 ? sp : 1, a2 = a * (s > 6 ? sp : 1);
            g.rect(sx(s) - 46, 980, 92, 56, { r: 10, fill: s <= 3 && sp > .5 ? g.rgba(COL.purple, .25) : COL.panel, stroke: COL.faint, lw: 2, alpha: a2 * (s <= 3 ? .5 + .5 * add : 1) });
            g.text(String(s), sx(s), 1009, { size: 26, font: 'disp', color: COL.sub, alpha: a2 });
          }
          g.chip('Transformer', g.lerp(sx(2), sx(5), sp), 938, { size: 24, color: COL.blue, alpha: a });
          g.chip('Embedding', g.lerp(sx(6), sx(9), sp), 938, { size: 24, alpha: a });
          g.chip('新加的 3 个词', sx(2), 938, { size: 24, color: COL.purple, alpha: g.p(L(2) + 1.5, .4) });
        }
        if (t > L(4)) {
          const a = g.p(L(4), .5);
          const r = g.rich([['(R', COL.fg], ['m', COL.yellow], [' q)ᵀ (R', COL.fg], ['n', COL.yellow], [' k)  =  qᵀ R', COL.fg], ['n − m', COL.acc], [' k', COL.fg]], cx, 1105, { size: 38, font: 'disp', alpha: a });
          g.mark(r.x - 16, r.y - 10, r.w + 32, r.h + 20, { k: g.p(L(4) + 2.6, .6), color: COL.acc, lw: 4, alpha: a });
          g.note('论文公式 (16)，R 表示按位置旋转', 1030, 1160, { alpha: a });
        }
      },
    },
    {
      id: 'freqs', name: '真实向量：两两一组，每组转速不同',
      lines: [
        '真实的 q、k 有很多维。RoPE 把它们**两两分组**，每组就是一个小平面',
        { text: '每组的转速不一样：**θ_i = 10000^(−2i/d)**，第一组最快，越往后越慢', say: '每组的转速不一样：第 i 组的 θ，是一万的负 2i 除以 d 次方，第一组最快，越往后越慢' },
        { text: '让 Embedding 从第 0 个位置一路往后走，每一组的箭头**同时转**', hold: 1.2 },
        { text: '走到第 100 个位置：第一组已经转了 **16 圈**，最后一组几乎没动', hold: .8 },
        '论文图 1 画的就是这件事：每一对维度配一个 θ，按位置 m 转 m·θ',
      ],
      draw(g) {
        const { t, L, Le, COL } = g;
        const G = [0, 8, 16, 24, 32, 48], PHI = [70, 20, 130, 45, 100, 160];
        const C = G.map((_, k) => [190 + (k % 3) * 350, k < 3 ? 440 : 850]), r = 120;
        const sweep0 = L(2) + .4, m = 100 * g.p(sweep0, Le(3) - sweep0 - .3, 'io');
        const out = 1 - g.p(L(4), .5);
        // 一行向量两两分组（只在第 1 句）
        const va = g.win(L(0) + .3, L(1) + .3, .4, .5);
        if (va > 0) {
          g.text('q 的维度（d = 128，示意）', 540, 170, { size: 26, color: COL.dim, alpha: va });
          G.forEach((gi, k) => {
            const x = 150 + k * 140;
            g.vec(x, 205, [.8, .5], { cell: 34, gap: 4, color: COL.acc, alpha: va * g.p(L(0) + .4 + k * .15, .3) });
            if (k < 5) g.text('…', x + 105, 222, { size: 30, color: COL.dim, alpha: va });
            g.curve(x + 36, 246, C[k][0], C[k][1] - r - 52, { bend: 0, color: g.rgba(COL.acc, .5), lw: 3, k: g.p(L(0) + 1.4 + k * .15, .6), alpha: va });
          });
        }
        if (t > L(1)) {
          const a = g.p(L(1), .5) * out;
          g.rect(190, 160, 700, 84, { r: 16, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: a });
          g.rich([['θ', COL.fg], ['i', COL.yellow], ['  =  10000', COL.fg], [' ^ (−2i / d)', COL.acc]], 540, 202, { size: 40, font: 'disp', alpha: a });
        }
        G.forEach((gi, k) => {
          const [cx, cy] = C[k], a = g.p(L(0) + 1.4 + k * .15, .5) * out, dg = degOf(gi), sw = m * dg, ang = PHI[k] + sw;
          if (a <= 0) return;
          plane(g, cx, cy, r, a * .8);
          if (sw > .5) arc(g, cx, cy, r * .72, ang - Math.min(sw, 300), ang, { color: g.rgba(COL.acc, .35), lw: 8, alpha: a });
          vecArrow(g, cx, cy, r - 6, ang, COL.acc, { lw: 6, head: 20, alpha: a });
          g.text(`第 ${gi} 组`, cx, cy - r - 30, { size: 28, color: COL.fg, alpha: a });
          g.text(`每个位置 ${fmtDeg(dg)}`, cx, cy + r + 32, { size: 26, font: 'disp', color: k === 0 ? COL.acc : COL.sub, alpha: a * g.p(L(1) + .6 + k * .35, .4) });
          if (t > sweep0) g.text(`已转 ${fmtTurn(sw)}`, cx, cy + r + 70, { size: 26, font: 'disp', color: COL.yellow, alpha: a * g.p(sweep0, .4) });
        });
        if (t > sweep0 - .3) g.chip(`位置 m = **${Math.round(m)}**`, 540, 1125, { size: 36, color: COL.yellow, alpha: g.p(sweep0 - .3, .4) * out });
        if (t > L(4)) {
          const a = g.p(L(4) + .3, .5);
          const F = g.img('fig1_rope', 60, 330, 960, null, { card: true, alpha: a });
          g.mark(F.box(.42, .03, .67, .41), { k: g.p(L(4) + .9, .6), label: '转 m·θ', leader: [730, 270], alpha: a });
          g.mark(F.box(.135, .465, .37, .525), { k: g.p(L(4) + 2.0, .6), color: COL.yellow, label: '每对维度一个 θ', leader: [250, 940], alpha: a });
          g.mark(F.box(.43, .485, .475, .885), { k: g.p(L(4) + 3.0, .6), color: COL.blue, label: '位置 m', leader: [560, 940], alpha: a });
          g.note('图：论文 Figure 1', 1030, 1010, { alpha: a });
        }
      },
    },
    {
      id: 'ruler', name: '为什么转速要不同：一套长短不同的尺子',
      lines: [
        '为什么不让所有组一样快？把每组转满一圈要走几个位置，看成一把**尺子**',
        '量近处，隔 1 和隔 2：快尺子分得很开，慢尺子两根箭头几乎重合',
        { text: '量远处，隔 40 和隔 50：快尺子已经绕了 6 圈多，只剩零头，读不出转了几圈', hold: .6 },
        '一圈 63 个位置的那把，正好一次分开；最慢那把还挤在一起',
        '所以要快慢搭配：近的远的，总有几把尺子量得准。全用一个转速，就只剩一把尺子',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const G = [0, 16, 48], NAME = ['快', '中', '慢'], CX = [190, 540, 890], cy = 420, r = 130;
        const near = t < L(2), u = near ? g.p(L(1) + .3, 1.2, 'io') : g.p(L(2) + .3, 3.4, 'io');
        const [da, db] = near ? [1, 2] : [40, 50];
        const fade = near ? g.p(L(1) + .2, .3) : g.p(L(2), .3);
        g.note('d = 128（示意）', 1030, 160, { alpha: g.p(.5, .4) });
        G.forEach((gi, k) => {
          const cx = CX[k], dg = degOf(gi), a = g.p(.3 + k * .3, .5), per = 360 / dg;
          plane(g, cx, cy, r, a * .7);
          if (dg >= 2) for (let s = 0; s * dg < 360 - 1e-6; s++) {
            const [x1, y1] = at(cx, cy, r - 12, 90 + s * dg), [x2, y2] = at(cx, cy, r + 4, 90 + s * dg);
            g.line(x1, y1, x2, y2, { color: COL.sub, lw: s === 0 ? 4 : 2, alpha: a });
            if (k === 0 && s > 0) g.text(String(s), ...at(cx, cy, r + 24, 90 + s * dg), { size: 22, font: 'disp', color: COL.dim, alpha: a });
          } else arc(g, cx, cy, r - 4, 0, 360, { color: g.rgba(COL.sub, .5), lw: 14, alpha: a });
          g.text(`第 ${gi} 组 · ${NAME[k]}`, cx, cy - r - 62, { size: 28, color: COL.fg, alpha: a });
          g.text(`一圈 ${per >= 10 ? Math.round(per) : per.toFixed(1)} 个位置`, cx, cy + r + 58, { size: 26, color: COL.sub, alpha: a * g.p(L(0) + 1 + k * .5, .4) });
          if (t > L(1)) {
            const sa = da * dg * u, sb = db * dg * u;
            vecArrow(g, cx, cy, r - 18, 90 + sb, COL.purple, { lw: 6, head: 20, alpha: fade });
            vecArrow(g, cx, cy, r - 18, 90 + sa, COL.green, { lw: 6, head: 20, alpha: fade });
            g.text(`隔 ${da} → ${fmtTurn(sa)}`, cx, cy + r + 100, { size: 24, font: 'disp', color: COL.green, alpha: fade });
            g.text(`隔 ${db} → ${fmtTurn(sb)}`, cx, cy + r + 134, { size: 24, font: 'disp', color: COL.purple, alpha: fade });
          }
        });
        // 对错表：近处一行，远处一行
        const verdict = (row, k, ok, s, a) => {
          const x = CX[k], y = row ? 990 : 830, c = ok === 1 ? COL.green : ok === 0 ? COL.red : COL.sub;
          g.text(ok === 1 ? '✓' : ok === 0 ? '✗' : '≈', x - 70, y, { size: 44, weight: 800, font: 'disp', color: c, alpha: a });
          g.text(s, x + 10, y, { size: 26, color: c, alpha: a, maxW: 250 });
        };
        if (t > L(1)) {
          g.text('近处：隔 1 和 隔 2', 540, 770, { size: 26, color: COL.dim, alpha: g.p(L(1) + .3, .4) });
          verdict(0, 0, 1, '分得开', g.p(L(1) + 1.8, .4));
          verdict(0, 1, -1, '只差 6°', g.p(L(1) + 2.2, .4));
          verdict(0, 2, 0, '几乎重合', g.p(L(1) + 2.6, .4));
        }
        if (t > L(2)) {
          g.text('远处：隔 40 和 隔 50', 540, 930, { size: 26, color: COL.dim, alpha: g.p(L(2) + .3, .4) });
          verdict(1, 0, 0, '绕晕了', g.p(L(2) + 3.8, .4));
          verdict(1, 1, 1, '一次分开', g.p(L(3) + .6, .4));
          verdict(1, 2, 0, '挤在一起', g.p(L(3) + 2.2, .4));
        }
        if (t > L(4)) {
          G.forEach((_, k) => g.mark(CX[k] - r - 20, cy - r - 20, 2 * r + 40, 2 * r + 40, { k: g.p(L(4) + .3 + k * .3, .5), r: 20, lw: 4 }));
          g.chip('快慢搭配：近的远的，都有尺子量得准', 540, 1110, { size: 32, alpha: g.p(L(4) + 1.4, .4) });
        }
      },
    },
    {
      id: 'decay', name: '附带的好处：离得越远，关联越弱',
      lines: [
        '这套转速还带来一个性质，论文叫**远程衰减**：两个词离得越远，分数的上限越低',
        '把 64 组箭头首尾相接：离得近时，它们几乎朝同一个方向，连起来很长',
        { text: '距离一拉开，快的组先转散，链条卷成一团，离起点越来越近', hold: 1.4 },
        '论文图 2 就是这条线：相对距离从 0 到 250，上界一路往下掉',
        '这也合直觉：隔得很远的两个词，关系通常更弱',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const ox = 170, oy = 430, u = 12;
        const dlt = t < L(2) ? 3 * g.p(L(1) + .6, 1.6, 'io') : 3 + 247 * g.p(L(2) + .3, g.Le(2) - L(2) + .6, 'io');
        const P = chain(dlt).map(([x, y]) => [ox + u * x, oy - u * y]), ca = g.p(L(0) + .3, .6) * (1 - .55 * g.p(L(3), .5));
        P.slice(1).forEach(p => g.line(ox, oy, p[0], p[1], { color: g.rgba(COL.sub, .14), lw: 2, alpha: ca * g.p(L(1), .5) }));
        for (let i = 0; i < D / 2; i++) g.line(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], { color: mix(COL.acc, COL.blue, i / 63), lw: 5, k: g.p(L(0) + .3 + i * .02, .3), alpha: ca });
        g.circle(ox, oy, 9, { fill: COL.fg, alpha: ca });
        g.text('起点', ox - 22, oy, { size: 24, color: COL.dim, align: 'right', alpha: ca });
        g.text('快的组', ox + 40, oy - 34, { size: 24, color: COL.acc, align: 'left', alpha: ca * (1 - g.p(L(2) + .5, .4)) });
        g.text('慢的组', ox + u * 64 - 10, oy - 34, { size: 24, color: COL.blue, align: 'right', alpha: ca * (1 - g.p(L(2) + .5, .4)) });
        g.text(`相对距离 = ${Math.round(dlt)}`, 1030, 170, { size: 30, font: 'disp', color: COL.yellow, align: 'right', alpha: g.p(L(1), .4) });
        g.text(`上界 ≈ ${bound(dlt).toFixed(1)}`, 1030, 215, { size: 30, font: 'disp', color: COL.fg, align: 'right', alpha: g.p(L(1) + .4, .4) });
        g.note('示意：按 d = 128 计算', 1030, 600, { alpha: g.p(L(1), .4) * (1 - g.p(L(3), .4)) });
        // 一边转一边画出上界曲线，再换成论文原图
        const pa = g.p(L(1) + .5, .5) * (1 - g.p(L(3), .6)), X0 = 160, Y0 = 1120, PW = 820, PH = 360;
        if (pa > 0) {
          g.line(X0, Y0, X0 + PW, Y0, { color: COL.faint, lw: 2, alpha: pa });
          g.line(X0, Y0, X0, Y0 - PH, { color: COL.faint, lw: 2, alpha: pa });
          g.text('上界', X0, Y0 - PH - 26, { size: 24, color: COL.dim, alpha: pa });
          [0, 50, 100, 150, 200, 250].forEach(v => g.text(String(v), X0 + PW * v / 250, Y0 + 26, { size: 22, font: 'disp', color: COL.dim, alpha: pa }));
          g.text('相对距离', X0 + PW, Y0 - 24, { size: 24, color: COL.dim, align: 'right', alpha: pa });
          const n = Math.floor(dlt), pts = UB.slice(0, n + 1).map((v, k) => [X0 + PW * k / 250, Y0 - PH * v / 34]);
          if (pts.length > 1) g.path(pts, { color: COL.yellow, lw: 4, alpha: pa });
          g.circle(X0 + PW * dlt / 250, Y0 - PH * bound(dlt) / 34, 10, { fill: COL.yellow, alpha: pa });
        }
        if (t > L(3)) {
          const a = g.p(L(3) + .2, .6);
          const F = g.img('fig2_decay', 120, 780, 700, null, { card: true, alpha: a });
          g.mark(F.box(.12, .1, .82, .93), { k: g.p(L(3) + 1, .6), label: '越远越低', leader: [860, 900], alpha: a * (1 - g.p(L(4), .3)) });
          g.note('图：论文 Figure 2', 1030, 740, { alpha: a });
          if (t > L(4)) {   // 近处高、远处低：图上两头各标一下
            g.mark(F.box(.11, .08, .2, .34), { k: g.p(L(4) + .3, .5), color: COL.green, lw: 4, label: '离得近：上界高', leader: [860, 840], labelSize: 26 });
            g.mark(F.box(.75, .76, .83, .95), { k: g.p(L(4) + 1.6, .5), color: COL.red, lw: 4, label: '离得远：上界低', leader: [860, 1080], labelSize: 26 });
          }
        }
      },
    },
    {
      id: 'result', name: '结果：翻译、预训练、长文本都更好',
      lines: [
        '英译德翻译，只把位置编码换成 RoPE：BLEU 从 27.3 提到 **27.5**',
        '把 BERT 的位置编码换成 RoPE 再预训练，loss **降得更快**',
        { text: '中文长文本匹配：输入放长到 1024，测试准确率 **69.79%**，四个里最高', hold: 1 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const d1 = 1 - .6 * g.p(L(1), .4), d2 = 1 - .6 * g.p(L(2), .4);
        g.bars(60, 250, 960, [{ label: 'Transformer-base', value: 27.3 }, { label: 'RoFormer', value: 27.5, hi: true }],
          { title: '英译德翻译 BLEU ↑ 越高越好', min: 27, max: 27.6, k: g.p(L(0) + .4, 1.4), labelW: 300, valueW: 120, h: 46, gap: 14, alpha: d1 });
        g.note('横轴从 27 起 · 数据：论文 Table 1', 1020, 206, { alpha: g.p(L(0) + .4, .4) * d1 });
        if (t > L(1) - .1) {
          const a = g.p(L(1), .5) * d2;
          const F = g.img('fig3_loss', 70, 440, 560, null, { card: true, crop: [0, 0, .5, 1], alpha: a });
          g.mark(F.box(.16, .36, .52, .76), { k: g.p(L(1) + 1.2, .6), color: COL.blue, label: 'RoFormer 先降下来', leader: [690, 560], alpha: a, labelSize: 26 });
          g.text('蓝线：RoFormer（RoPE）', 680, 660, { size: 26, color: COL.blue, align: 'left', alpha: a * g.p(L(1) + .6, .4) });
          g.text('橙线：BERT（原来的位置编码）', 680, 705, { size: 26, color: COL.acc, align: 'left', alpha: a * g.p(L(1) + .9, .4), maxW: 360 });
          g.note('图：论文 Figure 3（左）', 1020, 800, { alpha: a });
        }
        if (t > L(2) - .1) {
          const a = g.p(L(2), .5);
          const B = g.bars(60, 950, 960, [
            { label: 'BERT-512', value: 67.77, text: '67.77%' }, { label: 'WoBERT-512', value: 68.10, text: '68.10%' },
            { label: 'RoFormer-512', value: 68.29, text: '68.29%' }, { label: 'RoFormer-1024', value: 69.79, text: '69.79%', hi: true },
          ], { title: '中文长文本匹配 测试准确率 ↑', min: 67, max: 70, k: g.p(L(2) + .3, 1.4), labelW: 330, valueW: 150, h: 40, gap: 12, alpha: a });
          const top = B[3];
          g.mark(top.x - 340, top.y - 8, top.w + 500, top.h + 16, { k: g.p(L(2) + 3.6, .6), color: COL.acc, lw: 4, alpha: a });
          g.note('横轴从 67 起 · 数据：论文 Table 5', 1020, 906, { alpha: a });
        }
      },
    },
  ],
});
