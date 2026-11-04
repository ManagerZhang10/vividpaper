// Attention Is All You Need — 3 分钟动效解读 · VividPaper
// 主线：翻译模型能不能完全不用 RNN，只靠注意力？主角：句子里的 its（论文图 4 的同一句话）。

const WORDS = ['The', 'Law', 'will', 'never', 'be', 'perfect', ',', 'but', 'its', 'application', 'should', 'be', 'just'];
const ITS = 8, LAW = 1, APP = 9;
// 论文图 4：its 在两个注意力头里分别盯住 Law 和 application；其余是示意的小权重（总和为 1）
const ATT = [.03, .38, .03, .03, .02, .05, .01, .05, .04, .30, .02, .02, .02];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function vals(seed, n = 4) { const r = rng(seed); return Array.from({ length: n }, () => .15 + .85 * r()); }
// the same sentence, laid out the same way in every scene that shows it
const sentence = (g, y, style, o = {}) => g.tokens(WORDS, 540, y, { breaks: [7], rowGap: 200, size: 38, style, ...o });

PM.film({
  paper: { title: 'Attention Is All You Need', byline: 'Vaswani 等 8 位作者 · Google · NIPS 2017', arxiv: '1706.03762' },
  question: '翻译模型能不能**完全不用 RNN**，只靠注意力？',
  recap: [   // 每条一行（≤ 12 字），右边的小框画那一幕机制的简化版（函数在文件末尾）
    { text: 'RNN 逐词传：**慢**、传不远', draw: recapRnn },
    { text: '注意力：每个词**直接看**全句', draw: recapSelf },
    { text: 'Q·K 打分，按权重**加起 V**', draw: recapQkv },
    { text: '拼起来就是 **Transformer**', draw: recapArch },
  ],
  scenes: [
    {
      id: 'rnn', name: '老办法：RNN 只能一个词一个词地传',
      lines: [
        '2017 年以前，机器翻译主要靠 **RNN**：从左往右，一个词一个词地读',
        '每读一个词，就更新一次「记忆」，再交给下一个词',
        '想弄清 **its** 指的是谁，Law 的信息要往后传 **7 步**才到',
        '而且每一步都要等上一步算完，GPU 再多也**没法并行**',
      ],
      draw(g) {
        const { t, L } = g;
        const R = sentence(g, 250, i => ({ alpha: g.p(L(0) + .4 + i * .3, .3), stroke: (t > L(2) && (i === LAW || i === ITS)) ? g.COL.acc : g.COL.faint, lw: (t > L(2) && (i === LAW || i === ITS)) ? 4 : 2 }), { draw: false });
        // memory cells under every word, chained left to right (row 1 → row 2)
        const M = R.map(r => [r.cx, r.bottom + 70]);
        const run = clamp01((t - L(1)) / 4.6) * 12;       // a "memory" dot walks the chain
        for (let i = 0; i < 12; i++) {
          const k = g.clamp((run - i) / 1), [a, b] = [M[i], M[i + 1]];
          const inPath = t > L(2) && i >= LAW && i < ITS;
          const c = inPath ? g.COL.acc : g.COL.sub;
          if (i === 6) g.curve(a[0], a[1], b[0], b[1], { bend: -160, color: g.rgba(c, .25), lw: 3, dash: [6, 8] });
          if (i === 6) g.curve(a[0], a[1], b[0], b[1], { bend: -160, color: c, lw: 4, k, head: 14 });
          else { g.arrow(a[0] + 24, a[1], b[0] - 24, b[1], { color: g.rgba(c, .25), lw: 3, head: 0 }); g.arrow(a[0] + 24, a[1], b[0] - 24, b[1], { color: c, lw: 4, k, head: 14 }); }
          if (inPath) { const m = i === 6 ? [(a[0] + b[0]) / 2, a[1] + 100] : [(a[0] + b[0]) / 2, a[1] - 26]; g.text(String(i), m[0], m[1], { size: 24, font: 'disp', color: g.COL.acc, alpha: g.p(L(2) + (i - 1) * .25, .3) }); }
        }
        R.forEach((r, i) => {
          const lit = run >= i - .05 && t > L(1);
          g.circle(M[i][0], M[i][1], 22, { fill: lit ? g.rgba(g.COL.acc, .25) : g.COL.panel, stroke: lit ? g.COL.acc : g.COL.faint, lw: 3, alpha: g.p(L(0) + .6 + i * .3, .3) });
          g.line(r.cx, r.bottom + 4, r.cx, M[i][1] - 24, { color: g.COL.faint, lw: 3, k: g.p(L(0) + .6 + i * .3, .3) });
        });
        sentence(g, 250, i => ({ alpha: g.p(L(0) + .4 + i * .3, .3), stroke: (t > L(2) && (i === LAW || i === ITS)) ? g.COL.acc : g.COL.faint, lw: (t > L(2) && (i === LAW || i === ITS)) ? 4 : 2 }));
        if (t > L(1)) { const i = Math.min(12, Math.floor(run)), u = run - i, nx = M[Math.min(12, i + 1)];
          g.circle(g.lerp(M[i][0], nx[0], i === 6 ? 0 : u), g.lerp(M[i][1], nx[1], i === 6 ? 0 : u), 12, { fill: g.COL.acc }); }
        g.text('记忆', M[0][0] - 2, M[0][1] + 52, { size: 24, color: g.COL.dim, alpha: g.p(L(1), .4) });
        if (t > L(2)) g.chip('Law → its：**7 步**', 540, 860, { size: 34, alpha: g.p(L(2) + 1.8, .4) * (1 - g.p(L(3), .3)) });
        // GPU cores: only one is ever busy
        if (t > L(3) - .1) {
          const a = g.p(L(3), .4), busy = Math.floor(((t - L(3)) / .45)) % 8;
          g.text('8 个 GPU 核心（示意）', 540, 905, { size: 28, color: g.COL.sub, alpha: a });
          for (let k = 0; k < 8; k++) g.rect(180 + k * 92, 950, 72, 72, { r: 10, fill: k === busy ? g.COL.acc : g.COL.panel, stroke: g.COL.faint, lw: 2, alpha: a });
          g.text('同一时刻只有 1 个在干活', 540, 1080, { size: 30, color: g.COL.acc, alpha: g.p(L(3) + 1.2, .4) });
        }
        function clamp01(v) { return Math.min(1, Math.max(0, v)); }
      },
    },
    {
      id: 'self', name: '新办法：每个词直接看所有词',
      lines: [
        'Transformer 不再往后传，而是让每个词**直接看**句子里所有的词',
        'its 向每个词连一条线，线越粗，表示看得越多',
        '论文图 4：两个注意力头里，its 分别盯住了 **Law** 和 **application**',
        '任意两个词之间只隔 **1 步**，13 个词还能**同时**算',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const gap = g.lerp(200, 240, g.p(.2, 1, 'io')), Y = 230;
        const R = sentence(g, Y, null, { draw: false, rowGap: gap });
        // the old memory chain from the last scene fades away
        const chain = 1 - g.p(.4, 1);
        if (chain > 0) for (let i = 0; i < 12; i++) g.line(R[i].cx, R[i].bottom + 70, R[i + 1].cx, R[i + 1].bottom + 70, { color: COL.sub, lw: 3, alpha: chain * .6 });
        // its "looks around": a ring sweeps out over the whole sentence
        const ring = g.p(L(0) + 1.2, 2.4, 'io');
        if (ring > 0 && ring < 1) g.circle(R[ITS].cx, R[ITS].cy, 40 + ring * 760, { stroke: COL.acc, lw: 4, alpha: .7 * (1 - ring) });
        // everyone looks at everyone (line 4)
        const web = g.p(L(3), 1.2);
        if (web > 0) for (let i = 0; i < 13; i++) for (let j = i + 1; j < 13; j++)
          g.curve(R[i].cx, R[i].cy, R[j].cx, R[j].cy, { bend: 30 + 4 * (j - i), color: g.rgba(COL.blue, .25), lw: 2, k: g.p(L(3) + i * .08, .8) });
        // its looks at every word, one line after another
        R.forEach((r, j) => { if (j === ITS) return;
          const w = ATT[j], key = (j === LAW || j === APP) && t > L(2), up = r.cy < R[ITS].cy;
          g.curve(R[ITS].cx, up ? R[ITS].top : R[ITS].bottom, r.cx, up ? r.bottom : r.bottom, { bend: up ? 0 : -70 - 8 * Math.abs(j - ITS),
            color: key ? COL.acc : g.rgba(COL.acc, .4 + w), lw: 2 + 34 * w, k: g.p(L(1) + .3 + Math.abs(j - ITS) * .22, .6, 'io'), alpha: 1 - .7 * web }); });
        sentence(g, Y, i => ({ stroke: i === ITS || ((i === LAW || i === APP) && t > L(2)) ? COL.acc : COL.faint, lw: i === ITS ? 4 : 2,
          fill: i === ITS ? g.rgba(COL.acc, .2) : COL.panel }), { rowGap: gap });
        // the evidence: the paper's own figure
        const fa = g.win(L(2), L(3) + .2, .4, .35);
        if (fa > 0) {
          const F = g.img('fig4_its', 150, 690, 780, null, { card: true, alpha: fa });
          g.mark(F.box(.298, 0, .342, .3), { k: g.p(L(2) + .4, .6), color: COL.blue, label: 'its', side: 'right', alpha: fa });
          g.mark(F.box(.05, .67, .095, .985), { k: g.p(L(2) + 1.6, .6), label: 'Law', side: 'left', alpha: fa });
          g.mark(F.box(.335, .67, .378, .985), { k: g.p(L(2) + 3.0, .6), label: 'application', side: 'right', alpha: fa });
          g.note('图：论文 Figure 4（第 5 层的两个注意力头）', 930, 650, { alpha: fa });
        }
        if (t > L(3)) {
          g.chip('任意两个词：**1 步**', 300, 860, { size: 38, alpha: g.p(L(3) + 1.4, .4) });
          g.chip('13 个词：**同时算**', 780, 860, { size: 38, color: COL.blue, alpha: g.p(L(3) + 2, .4) });
          for (let k = 0; k < 8; k++) g.rect(180 + k * 92, 960, 72, 72, { r: 10, fill: COL.acc, alpha: g.p(L(3) + 2.4 + k * .06, .3) });
          g.text('8 个 GPU 核心全部开工', 540, 1080, { size: 30, color: COL.sub, alpha: g.p(L(3) + 2.8, .4) });
        }
      },
    },
    {
      id: 'qkv', name: '怎么「看」：Q、K、V 三个向量',
      lines: [
        '具体怎么看？每个词先算出三个向量：**Q** 查询、**K** 键、**V** 值',
        'its 拿自己的 Q，和每个词的 K 做点积，得到一个相关分数',
        '分数先除以 **√d_k**（d_k = 64，防止分数太大），再用 softmax 变成和为 1 的权重',
        '最后按权重把每个词的 V 加起来，就是 its 看完之后的新表示',
        '整个过程，论文写成了一行公式',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const ws = ['The', 'Law', 'never', 'perfect', 'its', 'application'], me = 4;
        const raw = [2.1, 14.0, 1.6, 3.4, 4.6, 12.0], ex = raw.map(v => Math.exp(v / 8)), Z = ex.reduce((a, b) => a + b), wt = ex.map(v => v / Z);
        const y0 = 280, dy = 112, X = { q: 220, k: 470, s: 650, w: 705, v: 930 }, cell = { cell: 24, gap: 3 }, VW = 105;
        const hdr = (s, x, c, a) => g.text(s, x, 215, { size: 28, color: c, alpha: a });
        hdr('Q 查询', X.q + VW / 2, COL.acc, g.p(L(0) + .6, .4)); hdr('K 键', X.k + VW / 2, COL.blue, g.p(L(0) + 1.8, .4)); hdr('V 值', X.v + VW / 2, COL.green, g.p(L(0) + 3, .4));
        const div = g.p(L(2) + .6, .6);
        if (t > L(1)) { hdr('点积', X.s, COL.sub, g.p(L(1) + .6, .4) * (1 - div)); hdr('**÷ 8**', X.s, COL.sub, div); }
        if (t > L(2)) hdr('softmax 权重', X.w + 80, COL.sub, g.p(L(2) + 2.2, .4));
        g.note('示意：只画 6 个词，数字为示意', 1040, 160, { alpha: g.p(.5, .4) });
        const focus = g.p(L(1), .4), qy = y0 + me * dy;
        ws.forEach((w, i) => {
          const y = y0 + i * dy, mine = i === me;
          g.tokens([w], 110, y - 30, { size: 30, style: () => ({ stroke: mine ? COL.acc : COL.faint, lw: mine ? 4 : 2, fill: mine ? g.rgba(COL.acc, .2) : COL.panel }) });
          g.vec(X.q, y - 12, vals(i * 3 + 1), { ...cell, color: COL.acc, k: g.p(L(0) + .6 + i * .1, .4), alpha: mine ? 1 : 1 - .8 * focus });
          g.vec(X.k, y - 12, vals(i * 3 + 2), { ...cell, color: COL.blue, k: g.p(L(0) + 1.8 + i * .1, .4) });
          g.vec(X.v, y - 12, vals(i * 3 + 3), { ...cell, color: COL.green, k: g.p(L(0) + 3 + i * .1, .4) });
          if (t > L(1)) {
            g.curve(X.q + VW + 4, qy, X.k - 6, y, { bend: (i - me) * 8, color: g.rgba(COL.acc, .75), lw: 3, head: 12, k: g.p(L(1) + .5 + i * .35, .5) });
            g.text(raw[i].toFixed(1), X.s, y, { size: 32, font: 'disp', alpha: g.p(L(1) + .9 + i * .35, .3) * (1 - div) });
            if (div > 0) g.text((raw[i] / 8).toFixed(2), X.s, y, { size: 32, font: 'disp', alpha: div * (1 - .5 * g.p(L(2) + 2.4, .4)) });
          }
          if (t > L(2)) {
            const k = g.p(L(2) + 2.4 + i * .35, .6), bw = 160 * wt[i] / .4 * k;
            g.rect(X.w, y - 15, Math.max(bw, 3), 30, { r: 6, fill: (i === 1 || i === 5) ? COL.acc : COL.faint });
            g.text(Math.round(wt[i] * 100) + '%', X.w + bw + 34, y, { size: 26, font: 'disp', color: COL.sub, alpha: g.p(L(2) + 2.8 + i * .35, .4) });
          }
          if (t > L(3)) {   // each V flies down, as strong as its weight, and merges into the result
            const k = g.p(L(3) + .4 + i * .35, .8, 'io');
            if (k > 0 && k < 1) g.vec(X.v, g.lerp(y - 12, 958, k), vals(i * 3 + 3), { ...cell, color: COL.green, alpha: (.25 + 1.8 * wt[i]) * Math.sin(Math.PI * k) });
          }
        });
        if (t > L(3)) {
          const a = g.p(L(3) + .9, 1.6), mix = [0, 1, 2, 3].map(c => wt.reduce((s, w, i) => s + w * vals(i * 3 + 3)[c], 0));
          g.vec(X.v, 958, mix, { ...cell, color: COL.green, alpha: a });
          g.text('its 的新表示 →', X.v - 20, 970, { size: 28, color: COL.green, align: 'right', alpha: a });
        }
        if (t > L(4)) {
          const a = g.p(L(4), .5);
          g.rect(50, 1062, 980, 96, { r: 16, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: a });
          g.rich([['Attention(Q,K,V) = softmax( ', COL.fg], ['Q', COL.acc], ['·', COL.fg], ['K', COL.blue], ['ᵀ', COL.blue], [' / √d_k ) · ', COL.fg], ['V', COL.green]],
            540, 1110, { size: 40, font: 'disp', alpha: a, maxW: 940 });
          // the formula, read left to right, points back at the columns above
          [[X.q - 12, COL.acc], [X.k - 12, COL.blue], [X.w - 12, COL.acc], [X.v - 12, COL.green]].forEach(([x, c], n) =>
            g.mark(x, 190, n === 2 ? 230 : VW + 24, 690, { k: g.p(L(4) + .8 + n * .7, .5), color: c, lw: 4 }));
        }
      },
    },
    {
      id: 'multi', name: '多头：8 组注意力，各看各的',
      lines: [
        '一组 Q、K、V 只学得会一种「看法」，论文同时用了 **8 组**，叫多头注意力',
        '每个头关注不同的关系：论文图 4 里，第 5 个头让 its 找 Law，第 6 个头找 application',
        '8 个头的结果拼在一起，每个 64 维，正好拼回 **512 维**',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig2_attn', 80, 200, 400, null, { card: true, crop: [.5, 0, 1, 1], alpha: g.p(0, .5) });
        g.mark(F.box(.16, .34, .93, .54), { k: g.p(L(0) + 1.2, .6) });
        g.chip('**h = 8**：8 个头并排算', 280, F.y + F.h + 60, { size: 30, alpha: g.p(L(0) + 1.8, .4) });
        g.note('图：论文 Figure 2（右）', 480, F.y + F.h + 120);
        const pat = [
          (i, j) => i === j ? 1 : .05,                    // 看自己
          (i, j) => j === i - 1 ? 1 : .05,                // 看前一个词
          () => .3,                                       // 平均地看
          (i, j) => j === i + 1 ? 1 : .05,                // 看后一个词
          (i, j) => j === 1 ? .95 : .05,                  // 头 5：看 Law（论文图 4）
          (i, j) => j === 5 ? .95 : .05,                  // 头 6：看 application（论文图 4）
          (i, j) => j === 0 ? .9 : .08,                   // 看句首
          (i, j) => (i * 7 + j * 3) % 5 === 0 ? .8 : .1,  // 别的规律
        ];
        const at = h => [560 + (h % 2) * 250, 190 + Math.floor(h / 2) * 205];
        const k = g.p(L(2), 1.4, 'io');
        pat.forEach((f, h) => {
          const [x, y] = at(h), a = g.p(L(0) + 2 + h * .3, .4);
          const M = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => f(i, j)));
          const hk = h === 4 ? g.p(L(1) + 1.6, .6) : h === 5 ? g.p(L(1) + 3.4, .6) : 0, dim = h === 4 || h === 5 ? 0 : g.p(L(1) + .4, .8);
          g.heat(x, y, M, { cell: 22, gap: 3, color: COL.purple, alpha: a * (1 - .6 * dim) * (1 - .6 * k) });
          if (hk > 0) g.heat(x, y, M, { cell: 22, gap: 3, color: COL.acc, alpha: hk * (1 - .6 * k) });
          g.text(hk > .5 ? `头 ${h + 1}：找 ${h === 4 ? 'Law' : 'application'}` : `头 ${h + 1}`, x + 75, y + 172, { size: 26, color: hk > .5 ? COL.acc : COL.sub, alpha: a * (1 - .6 * k) * (1 - .6 * dim), maxW: 240 });
        });
        g.note('每格：行 = 正在看的词，列 = 被看的词（示意）', 1040, 1035, { alpha: g.p(L(0) + 3, .4) * (1 - k) });
        if (t > L(2)) {
          for (let h = 0; h < 8; h++) {
            const [sx, sy] = at(h), dx = 80 + h * 115, dy = 1010;
            g.rect(g.lerp(sx + 25, dx, k), g.lerp(sy + 55, dy, k), 105, 44, { r: 6, fill: COL.purple, alpha: k });
            g.text('64', g.lerp(sx + 25, dx, k) + 52, g.lerp(sy + 55, dy, k) + 23, { size: 26, font: 'disp', color: '#111', alpha: k });
          }
          g.line(80, 1080, 80 + 915 * g.p(L(2) + 1.6, .8), 1080, { color: COL.acc, lw: 5 });
          g.text('8 × 64 = **512 维**', 540, 1125, { size: 34, alpha: g.p(L(2) + 2.2, .4) });
        }
      },
    },
    {
      id: 'pos', name: '位置：注意力自己分不清先后',
      lines: [
        '但注意力有个毛病：把词的顺序打乱，算出来的结果**一模一样**',
        '所以论文给每个位置加一串**正弦波**编码，相当于给每个词贴座位号',
        '每一维用不同频率的波，任意两个位置的编码都不一样',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const ws = ['but', 'its', 'application', 'should', 'be', 'just'], order = [3, 5, 0, 4, 2, 1];
        const R0 = g.tokens(ws, 540, 220, { size: 38, draw: false }), R1 = g.tokens(order.map(i => ws[i]), 540, 220, { size: 38, draw: false });
        const to = []; order.forEach((w, k) => { to[w] = R1[k].cx; });
        // words move one after another, alternately lifted above / dropped below the row, so none pass through each other
        const sh = i => g.p(L(0) + 1.2 + i * .3, .7, 'io') * (1 - g.p(L(1) + i * .15, .6, 'io'));
        g.tokens(ws, 540, 220, { size: 38, style: i => ({ dx: (to[i] - R0[i].cx) * sh(i), dy: Math.sin(sh(i) * Math.PI) * (i % 2 ? -80 : 80), stroke: i === 1 ? COL.acc : COL.faint, lw: i === 1 ? 4 : 2 }) });
        const a1 = (1 - g.p(L(1), .4));
        g.text('原顺序：its 的结果', 300, 400, { size: 28, color: COL.sub, alpha: a1 * g.p(L(0) + .4, .4) });
        g.vec(300 - 64, 430, vals(42, 4), { color: COL.green, cell: 30, alpha: a1 * g.p(L(0) + .4, .4) });
        g.text('打乱后：its 的结果', 780, 400, { size: 28, color: COL.sub, alpha: a1 * g.p(L(0) + 2.6, .4) });
        g.vec(780 - 64, 430, vals(42, 4), { color: COL.green, cell: 30, alpha: a1 * g.p(L(0) + 2.6, .4) });
        g.text('=', 540, 446, { size: 72, weight: 800, font: 'disp', color: COL.acc, alpha: a1 * g.p(L(0) + 3.2, .4) });
        if (t > L(1) - .2) {
          const a = g.p(L(1), .5), per = [2.2, 4.4, 8.8, 17.6], x0 = 220, w = 780, step = w / 5;
          per.forEach((P, d) => {
            const y = 470 + d * 125;
            g.text(`维度 ${d + 1}`, 160, y, { size: 26, color: COL.sub, align: 'right', alpha: a });
            g.line(x0, y, x0 + w, y, { color: COL.line, lw: 2, alpha: a });
            g.wave(x0, y - 45, w, 90, u => Math.sin(2 * Math.PI * u * 5 / P), { color: [COL.acc, COL.yellow, COL.blue, COL.purple][d], k: g.p(L(1) + .3 + d * .4, 1.2, 'io') });
          });
          for (let i = 0; i < 6; i++) {
            const x = x0 + i * step, k = g.p(L(1) + 2.2 + i * .25, .4);
            g.line(x, 405, x, 880, { color: COL.faint, lw: 2, dash: [6, 8], alpha: k });
            per.forEach((P, d) => g.circle(x, 470 + d * 125 - 45 * Math.sin(2 * Math.PI * i / P), 10, { fill: COL.fg, alpha: k }));
            g.text(`位置 ${i + 1}`, x, 910, { size: 26, color: COL.sub, alpha: k });
          }
          if (t > L(2)) {
            [1, 4].forEach((i, n) => {
              const x = x0 + i * step, k = g.p(L(2) + .4 + n * 1.2, .5), c = n ? COL.blue : COL.acc;
              g.mark(x - 32, 400, 64, 540, { k, color: c });
              g.vec(x - 66, 1000, per.map(P => .5 + .5 * Math.sin(2 * Math.PI * i / P)), { cell: 30, color: c, alpha: k });
              g.text(`位置 ${i + 1} 的编码`, x, 1065, { size: 26, color: c, alpha: k });
            });
            g.text('≠', x0 + 2.5 * step, 1015, { size: 60, weight: 800, font: 'disp', color: COL.fg, alpha: g.p(L(2) + 2.2, .4) });
          }
        }
      },
    },
    {
      id: 'arch', name: '拼起来：Transformer 整体结构',
      lines: [
        '这些零件拼起来，就是论文图 1：左边**编码器**读原文，右边**解码器**写译文',
        '每一层 = 多头注意力 + 前馈网络，外面加残差和归一化，各叠 **6 层**',
        '解码器多一个 **mask**：写第 3 个词时，只能看已经写出的词，不许偷看后面',
        '中间这条线是编码器-解码器注意力：译文的每个词，回头去看整句原文',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig1_arch', 90, 190, 560, null, { card: true, alpha: g.p(0, .5) });
        g.note('图：论文 Figure 1', 650, F.y + F.h + 50);
        const on = (i, j = i + 1) => g.win(L(i), j < 4 ? L(j) : g.dur, .3, .3);
        g.mark(F.box(.12, .37, .48, .725), { k: g.p(L(0) + .5, .7), label: '编码器：读原文', side: 'bottom', alpha: on(0) });
        g.mark(F.box(.515, .21, .87, .70), { k: g.p(L(0) + 2.0, .7), color: COL.blue, label: '解码器：写译文', side: 'right', alpha: on(0) });
        g.mark(F.box(.2, .58, .46, .66), { k: g.p(L(1) + .3, .5), label: '多头注意力', side: 'bottom', alpha: on(1) });
        g.mark(F.box(.2, .425, .46, .505), { k: g.p(L(1) + 1.0, .5), color: COL.green, label: '前馈网络', side: 'top', alpha: on(1) });
        g.mark(F.box(.01, .52, .1, .6), { k: g.p(L(1) + 2.0, .5), color: COL.yellow, alpha: on(1) });
        g.chip('N = 6：每边叠 6 层', 840, 470, { size: 30, color: COL.yellow, alpha: g.p(L(1) + 2.2, .4) * on(1) });
        g.mark(F.box(.545, .555, .79, .665), { k: g.p(L(2) + .3, .5), label: 'mask', side: 'right', alpha: on(2) });
        if (t > L(2) - .1) {
          const a = on(2), M = Array.from({ length: 5 }, () => Array(5).fill(.85));
          g.heat(760, 720, M, { cell: 48, gap: 4, rows: ['写1', '写2', '写3', '写4', '写5'], cols: ['<s>', '1', '2', '3', '4'], labelSize: 22,
            mask: (i, j) => j > i, hi: t > L(2) + 1.5 ? [[2, 0], [2, 1], [2, 2]] : [], color: COL.acc, alpha: a, k: g.p(L(2) + .6, 1) });
          g.text('灰色 = 不许看', 890, 1010, { size: 24, color: COL.sub, alpha: a * g.p(L(2) + 1.4, .4) });
        }
        g.mark(F.box(.545, .405, .79, .48), { k: g.p(L(3) + .3, .5), color: COL.purple, label: '回头看原文', side: 'right', alpha: on(3) });
        g.mark(F.box(.3, .35, .56, .52), { k: g.p(L(3) + 1.0, .6), color: COL.purple, alpha: on(3) });
      },
    },
    {
      id: 'result', name: '结果：翻得更好，训练还更便宜',
      lines: [
        '英译德：**28.4 BLEU**，比之前最好的模型（含多模型集成）高出 2 分以上',
        '训练只用了 8 块 P100 GPU、**3.5 天**，成本只是之前最好模型的一小部分',
        '连只训了 **12 小时**的小版本 base，也超过了此前所有模型',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const base = t > L(2);
        const bleu = [
          { label: 'ByteNet', value: 23.75 }, { label: 'GNMT + RL', value: 24.6 }, { label: 'ConvS2S', value: 25.16 }, { label: 'MoE', value: 26.03 },
          { label: 'ConvS2S 集成', value: 26.36, color: COL.sub }, { label: 'Transformer base', value: 27.3, hi: base, color: base ? COL.acc : COL.acc2 },
          { label: 'Transformer big', value: 28.4, hi: !base, color: base ? COL.acc2 : COL.acc },
        ];
        const A = g.bars(60, 280, 960, bleu, { title: '英译德 BLEU ↑ 越高越好', min: 22, max: 29, k: g.p(.3, 1.6), labelW: 290 });
        if (base) g.mark(A[5].x - 300, A[5].y - 8, 940, A[5].h + 16, { k: g.p(L(2) + .4, .6) });
        g.note('横轴从 22 起 · 数据：论文 Table 2', 1020, 760, { alpha: g.p(1.5, .4) });
        if (t > L(1) - .1) {
          const a = g.p(L(1), .4);
          const cost = [
            { label: 'GNMT + RL 集成', value: 1.8e20, text: '1.8×10²⁰' }, { label: 'ConvS2S 集成', value: 7.7e19, text: '7.7×10¹⁹' },
            { label: 'Transformer big', value: 2.3e19, text: '2.3×10¹⁹ · 8 卡 3.5 天', hi: !base, color: base ? COL.acc2 : COL.acc },
            { label: 'Transformer base', value: 3.3e18, text: '3.3×10¹⁸ · 12 小时', hi: base, color: base ? COL.acc : COL.acc2 },
          ];
          const B = g.bars(60, 880, 960, cost, { title: '训练算力 FLOPs ↓ 越少越好（对数刻度）', log: true, min: 1e18, max: 3e20, k: g.p(L(1) + .2, 1.4), labelW: 290, valueW: 300, alpha: a });
          if (base) g.mark(B[3].x - 300, B[3].y - 8, 940, B[3].h + 16, { k: g.p(L(2) + 1.2, .6) });
        }
      },
    },
  ],
});

// ---------- 最后回顾的小动效：每条画那一幕机制的简化版，box = {x, y, w, h}，u(延迟, 时长, 缓动) 从这条出现时算起 ----------
// ① RNN：记忆一格一格往后传，越传越淡
function recapRnn(g, b, u) {
  const n = 7, cy = b.y + 50, xs = Array.from({ length: n }, (_, j) => b.x + 34 + j * (b.w - 68) / (n - 1)), run = u(.2, 1.6, 'lin') * (n - 1);
  for (let j = 0; j + 1 < n; j++) g.line(xs[j] + 12, cy, xs[j + 1] - 12, cy, { color: g.COL.faint, lw: 3 });
  xs.forEach((x, j) => g.circle(x, cy, 11, { fill: run >= j - .05 ? g.rgba(g.COL.acc, .25) : g.COL.panel, stroke: run >= j - .05 ? g.COL.acc : g.COL.faint, lw: 3 }));
  const i = Math.min(n - 2, Math.floor(run)), k = run - i, fade = run / (n - 1);
  g.circle(g.lerp(xs[i], xs[i + 1], k), cy, 8 - 4 * fade, { fill: g.COL.acc, alpha: 1 - .6 * fade });
  g.text('一步一步传', b.x + b.w / 2, b.y + 96, { size: 24, color: g.COL.dim, alpha: u(.4, .4) });
}
// ② 自注意力：its 同时连向所有词，连 Law、application 的两条最粗（权重同第 2 幕）
function recapSelf(g, b, u) {
  const c = 16, gap = 6, x0 = b.x + (b.w - (13 * (c + gap) - gap)) / 2, y = b.y + b.h - 34, cx = j => x0 + j * (c + gap) + c / 2, k = u(.3, .9, 'io');
  ATT.forEach((w, j) => { if (j === ITS) return;
    const d = cx(j) - cx(ITS), key = j === LAW || j === APP;
    g.curve(cx(ITS), y, cx(j), y, { bend: (d < 0 ? 1 : -1) * (Math.abs(d) * .5 + 12), color: key ? g.COL.acc : g.rgba(g.COL.acc, .35 + w), lw: 1.5 + 12 * w, k }); });
  for (let j = 0; j < 13; j++) g.rect(cx(j) - c / 2, y, c, c, { r: 4, fill: j === ITS ? g.COL.acc : g.COL.panel, stroke: j === ITS || ((j === LAW || j === APP) && k > .9) ? g.COL.acc : g.COL.faint, lw: 2 });
}
// ③ Q·K 打分成权重（橙条），各词的 V（绿格）按权重合成一个新表示
function recapQkv(g, b, u) {
  const W = [.05, .45, .05, .1, .05, .3], col = j => b.x + 24 + j * 28, merge = u(1.1, .7, 'io'), rx = b.x + b.w - 74;
  W.forEach((w, j) => {
    const h = 44 * w / .45 * u(.2 + j * .08, .4);
    g.rect(col(j), b.y + 62 - Math.max(h, 3), 20, Math.max(h, 3), { r: 4, fill: j === 1 || j === 5 ? g.COL.acc : g.COL.faint });
    g.rect(g.lerp(col(j), rx + 8, merge), b.y + 78, 20, 20, { r: 5, fill: g.rgba(g.COL.green, .25 + 1.6 * w), alpha: 1 - merge });
  });
  g.arrow(col(5) + 34, b.y + 88, rx - 14, b.y + 88, { color: g.COL.green, lw: 3, head: 10, k: u(.8, .4) });
  g.rect(rx, b.y + 70, 36, 36, { r: 6, fill: g.COL.green, alpha: merge });
  g.text('新表示', rx + 18, b.y + 36, { size: 24, color: g.COL.green, alpha: merge });
}
// ④ 编码器、解码器各叠几层，中间一条编码器-解码器注意力（颜色同第 6 幕的标框）
function recapArch(g, b, u) {
  const sw = 96, sh = 16, ex = b.x + 36, dx = b.x + b.w - 36 - sw, bot = b.y + b.h - 44;
  for (let j = 0; j < 3; j++) {
    g.rect(ex, bot - j * 22 - sh, sw, sh, { r: 4, fill: g.rgba(g.COL.acc, .3), stroke: g.COL.acc, lw: 2, alpha: u(.1 + j * .15, .3) });
    g.rect(dx, bot - j * 22 - sh, sw, sh, { r: 4, fill: g.rgba(g.COL.blue, .3), stroke: g.COL.blue, lw: 2, alpha: u(.5 + j * .15, .3) });
  }
  g.text('编码器', ex + sw / 2, b.y + b.h - 22, { size: 24, color: g.COL.acc, alpha: u(.1, .4) });
  g.text('解码器', dx + sw / 2, b.y + b.h - 22, { size: 24, color: g.COL.blue, alpha: u(.5, .4) });
  g.curve(ex + sw + 6, bot - 2 * 22 - sh / 2, dx - 6, bot - 22 - sh / 2, { bend: -16, color: g.COL.purple, lw: 4, head: 12, k: u(1.1, .6, 'io') });
}
