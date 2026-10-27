// CLIP — 3 分钟动效解读 · 张指导出品
// 主线：不给人工标签，模型能不能光靠网上的图文配对学会认图？
// 主角：一张猫图和它配的那句话（示意），从「被人工打标签」一路走到「被 zero-shot 认出来」。

// four (image, text) pairs used across scenes; k = 0 is the real cat photo, the rest are drawn icons (示意)
const PAIRS = [
  { k: 0, t: ['my cat staring', 'at the camera'], short: 'my cat…' },
  { k: 1, t: ['sunset over', 'the mountains'], short: 'sunset…' },
  { k: 2, t: ['a red car', 'parked outside'], short: 'red car…' },
  { k: 3, t: ['morning coffee', 'on my desk'], short: 'coffee…' },
];
const SENT = PAIRS.map(p => p.t.join(' '));
// 示意：4 对图文两两的余弦相似度，对角线是真配对
const S = [
  [.82, .11, .05, .20],
  [.08, .77, .15, .10],
  [.12, .18, .80, .09],
  [.21, .06, .10, .74],
];
const IMG_C = '#3DDC97', TXT_C = '#B48CFF', POS_C = '#5AA9FF';   // image = green, text = purple, true pair = blue (as in Figure 1)

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function vals(seed, n = 6) { const r = rng(seed); return Array.from({ length: n }, () => .15 + .85 * r()); }
const softmax = (xs, scale) => { const e = xs.map(v => Math.exp(v * scale)), z = e.reduce((a, b) => a + b); return e.map(v => v / z); };

// filled polygon (the engine only strokes paths)
function poly(g, pts, fill, a = 1) {
  if (a <= .001) return;
  const c = g.ctx; c.save(); c.globalAlpha *= a; c.fillStyle = fill; c.beginPath();
  pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.restore();
}
// one image of a pair: the real cat photo, or a simple drawn icon
function tile(g, k, x, y, s, a = 1, o = {}) {
  if (a <= .001) return;
  if (k === 0) g.img('cat', x, y, s, s, { alpha: a });
  else {
    g.rect(x, y, s, s, { r: 10, fill: ['', '#2A2242', '#1C2733', '#2B231C'][k], alpha: a });
    const c = g.ctx; c.save(); c.beginPath(); c.roundRect(x, y, s, s, 10); c.clip();
    const P = (u, v) => [x + u * s, y + v * s];
    if (k === 1) {
      g.circle(...P(.66, .42), .14 * s, { fill: g.COL.yellow, alpha: a });
      poly(g, [P(-.1, 1), P(.35, .5), P(.8, 1)], '#5B4A8A', a);
      poly(g, [P(.3, 1), P(.72, .58), P(1.15, 1)], '#7E63B8', a);
    } else if (k === 2) {
      g.rect(...P(0, .8), s, .2 * s, { r: 0, fill: '#2E3A46', alpha: a });
      poly(g, [P(.28, .52), P(.36, .38), P(.64, .38), P(.74, .52)], '#E5484D', a);
      g.rect(...P(.12, .5), .76 * s, .2 * s, { r: 8, fill: '#E5484D', alpha: a });
      g.circle(...P(.3, .72), .08 * s, { fill: '#111', alpha: a }); g.circle(...P(.7, .72), .08 * s, { fill: '#111', alpha: a });
    } else {
      g.rect(...P(.2, .76), .6 * s, .06 * s, { r: 4, fill: '#C9B49A', alpha: a });
      g.rect(...P(.3, .44), .34 * s, .32 * s, { r: 6, fill: '#F4F3EF', alpha: a });
      g.circle(...P(.68, .58), .07 * s, { stroke: '#F4F3EF', lw: .03 * s, alpha: a });
      [.38, .5].forEach(u => g.curve(...P(u, .38), ...P(u + .02, .18), { bend: 8, color: '#8A8A92', lw: .025 * s, alpha: a }));
    }
    c.restore();
  }
  if (o.stroke) g.rect(x - 3, y - 3, s + 6, s + 6, { r: 12, stroke: o.stroke, lw: o.lw ?? 4, alpha: a });
}
// a pair card: image + its two-line caption
function card(g, i, x, y, a = 1, o = {}) {
  if (a <= .001) return;
  g.rect(x, y, 460, 150, { r: 16, fill: g.COL.panel, stroke: o.stroke ?? g.COL.faint, lw: 2, alpha: a });
  tile(g, PAIRS[i].k, x + 15, y + 15, 120, a);
  PAIRS[i].t.forEach((s, j) => g.text(s, x + 158, y + 52 + j * 46, { size: 28, font: 'mono', align: 'left', color: TXT_C, alpha: a }));
}
const fmt1 = v => (v * 100).toFixed(0) + '%';

PM.film({
  paper: { title: 'Learning Transferable Visual Models From Natural Language Supervision', byline: 'Radford 等 12 位作者 · OpenAI · 2021', arxiv: '2103.00020' },
  question: '不给人工标签，模型能不能**光靠网上的图文配对**学会认图？',
  recap: [
    '人工标签只认固定类别；网上有**现成的图文**',
    '不猜原句，只猜**哪张图配哪句话**，学得快',
    'N×N 表里**对角线拉高**、其余压低',
    '类别名写成句子 → **zero-shot**：ImageNet 76.2%',
  ],
  scenes: [
    // ───────────────────────────── 1
    {
      id: 'label', name: '老办法：只认得事先定好的类别',
      lines: [
        '过去的视觉模型靠人工标签训练，比如 ImageNet：**128 万张**图，**1000 个**类别',
        '模型最后只有 1000 个出口，每个出口对应一个固定的类别',
        '想认第 1001 种东西？只能再标一批数据、重新训练',
        '可网上本来就有海量配了文字的图片，文字里说到的东西远不止 1000 种',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const top = 1 - .65 * g.p(L(3), .6);
        tile(g, 0, 90, 200, 240, g.p(.1, .5) * top);
        g.chip('人工标注：猫', 210, 490, { size: 28, alpha: g.p(L(0) + 1.0, .4) * top });
        g.chip('ImageNet · 128 万张 · 1000 类', 300, 575, { size: 28, color: COL.sub, alpha: g.p(L(0) + 2.2, .4) * top });
        // model + exits
        const ma = g.p(L(0) + .5, .4) * top;
        g.arrow(345, 320, 415, 320, { color: COL.sub, lw: 4, k: g.p(L(0) + .4, .4), alpha: top });
        g.rect(420, 260, 190, 120, { r: 16, fill: COL.panel, stroke: COL.sub, lw: 3, alpha: ma });
        g.text('视觉模型', 515, 320, { size: 32, alpha: ma });
        const slots = ['类别 1', '类别 2', '类别 3', '⋮', '类别 999', '类别 1000'], lit = 2;
        slots.forEach((s, i) => {
          const y = 196 + i * 58, a = g.p(L(1) + .2 + i * .25, .35) * top, on = t > L(1) + 2.2 && i === lit;
          g.line(612, 320, 700, y + 23, { color: on ? COL.acc : COL.faint, lw: on ? 4 : 2, alpha: a });
          if (s === '⋮') { g.text('⋮', 845, y + 23, { size: 32, color: COL.dim, alpha: a }); return; }
          g.rect(700, y, 290, 46, { r: 10, fill: on ? g.rgba(COL.acc, .25) : COL.panel, stroke: on ? COL.acc : COL.faint, lw: on ? 3 : 2, alpha: a });
          g.text(on ? '类别 3 · 猫' : s, 845, y + 24, { size: 26, color: on ? COL.fg : COL.sub, alpha: a });
        });
        g.chip('**1000** 个出口，固定不变', 845, 575, { size: 26, color: COL.sub, alpha: g.p(L(1) + 2.6, .4) * top });
        // the 1001st class
        const na = g.p(L(2) + .3, .4) * top;
        g.rect(700, 640, 290, 50, { r: 10, stroke: COL.red, lw: 3, dash: [8, 8], alpha: na });
        g.text('第 1001 类？', 845, 666, { size: 28, color: COL.red, alpha: na });
        g.text('✗', 1025, 666, { size: 36, weight: 800, color: COL.red, alpha: g.p(L(2) + 1.0, .3) * top });
        g.chip('再标数据 → 重新训练', 400, 666, { size: 28, color: COL.red, alpha: g.p(L(2) + 1.8, .4) * top });
        // web pairs arrive
        [[70, 770], [550, 770], [70, 945], [550, 945]].forEach(([x, y], i) => {
          const a = g.p(L(3) + .4 + i * .45, .5);
          card(g, i, x, y + (1 - a) * 40, a);
        });
        g.note('网上的图文配对（示意）', 1010, 1130, { alpha: g.p(L(3) + 2.4, .4) });
      },
    },
    // ───────────────────────────── 2
    {
      id: 'data', name: '新数据：从网上收集 4 亿对图文',
      lines: [
        '于是作者从互联网上收集了 **4 亿对**（图片，文字），起名 WIT',
        '用 **50 万个**查询词去搜，每个词最多收 2 万对，尽量覆盖各种视觉概念',
        '不需要人工标注：每张图配的那句话，就是它的「标签」',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const k = g.p(L(0) + .3, 3.4, 'io'), dimG = 1 - .78 * g.p(L(2), .5);
        g.text(k < 1 ? `${(4 * k).toFixed(2)} 亿对` : '**4 亿**对', 540, 235, { size: 84, weight: 800, font: 'disp', alpha: g.p(.2, .4) * dimG });
        g.text('（图片，文字）· WIT 数据集', 540, 320, { size: 30, color: COL.sub, alpha: g.p(L(0) + 1, .4) * dimG });
        const r = rng(7), C = 24, R = 13;
        for (let i = 0; i < C * R; i++) {
          const at = L(0) + .3 + 3.2 * r(), a = g.p(at, .3) * dimG; if (a <= 0) continue;
          const x = 108 + (i % C) * 36, y = 380 + Math.floor(i / C) * 36;
          g.rect(x, y, 15, 30, { r: 3, fill: g.rgba(IMG_C, .7), alpha: a });
          g.rect(x + 15, y, 15, 30, { r: 3, fill: g.rgba(TXT_C, .7), alpha: a });
        }
        g.note('每格代表一大批图文对（示意）· 左绿 = 图，右紫 = 文字', 972, 885, { alpha: g.p(L(0) + 2, .4) * dimG });
        const qs = ['cat', 'sunset', 'red car', 'coffee', 'banana', '…'];
        g.tokens(qs, 540, 925, { size: 30, style: i => ({ alpha: g.p(L(1) + .3 + i * .35, .3) * dimG, stroke: g.rgba(TXT_C, .7), color: TXT_C }) });
        g.text('**50 万**个查询词 × 每个最多 **2 万**对', 540, 1050, { size: 36, alpha: g.p(L(1) + 2.4, .4) * dimG });
        // zoom into one pair: the cat
        const za = g.p(L(2) + .2, .5);
        if (za > 0) {
          const y0 = 470 + (1 - za) * 40;
          g.rect(140, y0, 800, 340, { r: 20, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: za });
          tile(g, 0, 175, y0 + 35, 270, za);
          PAIRS[0].t.forEach((s, j) => g.text(s, 490, y0 + 100 + j * 52, { size: 36, font: 'mono', align: 'left', color: TXT_C, alpha: za }));
          g.arrow(640, y0 + 190, 640, y0 + 240, { color: COL.acc, lw: 4, k: g.p(L(2) + 1.2, .4), alpha: za });
          g.chip('这句话 = 标签', 640, y0 + 280, { size: 34, solid: true, alpha: g.p(L(2) + 1.5, .4) });
        }
      },
    },
    // ───────────────────────────── 3
    {
      id: 'objective', name: '训练目标：不猜原句，只猜配对',
      lines: [
        '最直接的想法：看图，把配的那句话逐字写出来，作者先试了这个',
        '可同一张图有千百种说法，逐字去猜太难，论文图 2 里这条线学得最慢',
        '只猜句子里有哪些词、不管顺序，同样的准确率快了 **3 倍**',
        '再改成只判断「哪句话和哪张图是一对」，又快了 **4 倍**，这就是 CLIP',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const BL = '#2F8FD8', OR = '#FF8C1A', GR = '#2CA02C';   // the paper's line colours in Figure 2
        tile(g, 0, 90, 190, 190, g.p(.1, .4));
        const mA = g.win(0, L(2) + .2, .3, .3), mB = g.win(L(2), L(3) + .2, .3, .3), mC = g.p(L(3), .4);
        // A: write the caption word by word
        if (mA > 0) {
          g.chip('做法 A：逐字写出原句', 90, 440, { size: 28, color: BL, align: 'left', alpha: mA });
          const s = SENT[0], kk = g.p(L(0) + .6, 2.4, 'lin'), n = Math.floor(s.length * kk);
          g.rect(312, 204, 20 + 580 * kk, 54, { r: 10, fill: g.rgba(BL, .18), stroke: BL, lw: 2, alpha: mA * g.p(L(0) + .5, .3) });
          g.arrow(290, 285, 310, 245, { color: BL, lw: 3, head: 12, k: g.p(L(0) + .3, .4), alpha: mA });
          g.text(s.slice(0, n) + (n < s.length ? '▍' : ''), 320, 230, { size: 34, font: 'mono', align: 'left', color: TXT_C, alpha: mA });
          ['look at those eyes!', 'a scottish fold kitten', 'Mochi, 2 years old'].forEach((s2, i) =>
            g.text(s2 + '  ?', 320, 300 + i * 50, { size: 30, font: 'mono', align: 'left', color: COL.dim, alpha: mA * g.p(L(1) + .3 + i * .5, .4) }));
          g.note('同一张图的其他说法（示意）', 1040, 450, { alpha: mA * g.p(L(1) + 1.8, .4) });
        }
        // B: bag of words
        if (mB > 0) {
          g.chip('做法 B：只猜有哪些词', 90, 440, { size: 28, color: OR, align: 'left', alpha: mB });
          const ws = ['camera', 'my', 'staring', 'cat', 'the', 'at'];
          g.tokens(ws, 670, 215, { size: 32, breaks: [3], rowGap: 22, style: i => ({ alpha: mB * g.p(L(2) + .3 + i * .2, .3), stroke: g.rgba(OR, .7), color: TXT_C, dy: (1 - g.p(L(2) + .3 + i * .2, .4)) * 30 }) });
        }
        // C: which caption goes with this image
        if (mC > 0) {
          g.chip('做法 C：只判断哪句是一对', 90, 440, { size: 28, color: GR, align: 'left', alpha: mC });
          SENT.forEach((s, i) => {
            const y = 205 + i * 58, ok = i === 0, done = t > L(3) + 2.2;
            g.curve(285, 285, 320, y, { bend: 0, color: ok && done ? GR : COL.faint, lw: ok && done ? 4 : 2, k: g.p(L(3) + .3 + i * .2, .4) });
            g.text(s, 330, y, { size: 26, font: 'mono', align: 'left', color: done && !ok ? COL.dim : TXT_C, alpha: mC * g.p(L(3) + .3 + i * .2, .3) });
            g.text(ok ? '✓' : '✗', 1010, y, { size: 30, weight: 800, color: ok ? GR : COL.dim, alpha: g.p(L(3) + 2.2 + i * .15, .3) });
          });
        }
        // Figure 2
        const F = g.img('fig2_eff', 160, 640, 760, null, { card: true, alpha: .25 + .75 * g.p(L(1), .6) });
        g.note('图：论文 Figure 2（横轴：见过的图片数，纵轴：zero-shot ImageNet 准确率）', 1040, 600, { alpha: g.p(L(1), .4), maxW: 1000 });
        const lg = { b: F.box(.445, .75, .935, .805), o: F.box(.445, .695, .935, .75), gr: F.box(.445, .64, .935, .695) };
        g.mark(lg.b, { k: g.p(L(1) + 1.2, .6), color: BL, lw: 4, alpha: 1 - .6 * g.p(L(2), .4) });
        g.mark(lg.o, { k: g.p(L(2) + .4, .6), color: OR, lw: 4, alpha: 1 - .6 * g.p(L(3), .4) });
        g.mark(F.box(.39, .48, .945, .555), { k: g.p(L(2) + 1.2, .6), color: OR, lw: 4, label: '3 倍', side: 'bottom', alpha: 1 - g.p(L(3), .4) });
        g.mark(lg.gr, { k: g.p(L(3) + .4, .6), color: GR, lw: 4 });
        g.mark(F.box(.17, .48, .41, .555), { k: g.p(L(3) + 1.2, .6), color: GR, lw: 4, label: '4 倍', side: 'top' });
      },
    },
    // ───────────────────────────── 4
    {
      id: 'matrix', name: '核心：一个 batch 里的 N×N 配对表',
      lines: [
        '具体做法见论文图 1：一次拿 N 对图文，图片进**图像编码器**，文字进**文本编码器**',
        '每张图、每句话都变成一个向量，叫 **embedding**，放进同一个空间里比较',
        '两两算相似度，得到一张 N×N 的表：I1·T1 就是第 1 张图和第 1 句话有多像',
        '对角线上的 N 格是真配对，其余 N²−N 格全是配错的',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig1_train', 90, 200, 900, null, { card: true, alpha: g.p(0, .5) });
        g.note('图：论文 Figure 1（1）对比预训练', 990, 165, { alpha: g.p(.4, .4) });
        const on = (a, b) => g.win(a, b, .3, .3);
        g.mark(F.box(.285, .1, .445, .42), { k: g.p(L(0) + 1.4, .6), color: TXT_C, label: '文本编码器', side: 'top', alpha: on(L(0), L(1) + .2) });
        g.mark(F.box(.285, .54, .445, .86), { k: g.p(L(0) + 2.6, .6), color: IMG_C, label: '图像编码器', side: 'bottom', alpha: on(L(0), L(1) + .2) });
        g.mark(F.box(.61, .325, .975, .435), { k: g.p(L(1) + .4, .6), color: TXT_C, label: 'T：文字 embedding', side: 'top', alpha: on(L(1), L(2) + .2) });
        g.mark(F.box(.52, .445, .605, .955), { k: g.p(L(1) + 1.4, .6), color: IMG_C, label: 'I：图片 embedding', side: 'bottom', alpha: on(L(1), L(2) + .2) });
        // bottom: one image and one sentence become vectors in the same space
        const ea = on(L(1), L(2) + .1);
        if (ea > 0) {
          tile(g, 0, 110, 945, 80, ea);
          g.arrow(205, 985, 255, 985, { color: COL.sub, lw: 3, k: g.p(L(1) + .8, .4), alpha: ea });
          g.vec(265, 971, vals(11), { cell: 28, color: IMG_C, k: g.p(L(1) + 1, .5), alpha: ea });
          g.text('my cat staring…', 190, 1090, { size: 26, font: 'mono', color: TXT_C, alpha: ea * g.p(L(1) + .6, .4) });
          g.arrow(318, 1090, 368, 1090, { color: COL.sub, lw: 3, k: g.p(L(1) + 1.4, .4), alpha: ea });
          g.vec(378, 1076, vals(12), { cell: 28, color: TXT_C, k: g.p(L(1) + 1.6, .5), alpha: ea });
          // the shared space: pairs land close to each other
          const cx = 830, cy = 1050, rr = 112;
          g.circle(cx, cy, rr, { stroke: COL.faint, lw: 2, alpha: ea });
          g.text('同一个空间', cx, cy - rr - 22, { size: 24, color: COL.sub, alpha: ea });
          [[-60, -45], [55, -55], [-40, 60], [65, 45]].forEach(([dx, dy], i) => {
            const a = ea * g.p(L(1) + 2.2 + i * .3, .4);
            g.circle(cx + dx - 12, cy + dy, 11, { fill: IMG_C, alpha: a }); g.circle(cx + dx + 12, cy + dy + 4, 11, { fill: TXT_C, alpha: a });
          });
        }
        // the table
        const ta = on(L(2), g.dur);
        g.mark(F.box(.605, .445, .98, .96), { k: g.p(L(2) + .3, .7), color: COL.acc, alpha: ta * (1 - .6 * g.p(L(3), .4)) });
        g.mark(F.box(.612, .452, .687, .555), { k: g.p(L(2) + 1.8, .4), color: COL.acc, lw: 5, fill: .25, label: 'I1·T1', side: 'left', alpha: on(L(2), L(3) + .2) });
        g.chip('N × N 个相似度', 540, 1000, { size: 34, alpha: g.p(L(2) + 1.0, .4) });
        for (let i = 0; i < 5; i++)
          g.mark(F.box(.612 + i * .0726, .452 + i * .1005, .687 + i * .0726, .555 + i * .1005), { k: g.p(L(3) + .3 + i * .3, .3), color: POS_C, lw: 5, fill: .3 });
        g.chip('**N** 格真配对', 330, 1090, { size: 32, color: POS_C, alpha: g.p(L(3) + 1.8, .4) });
        g.chip('**N² − N** 格配错', 750, 1090, { size: 32, color: COL.sub, alpha: g.p(L(3) + 2.4, .4) });
      },
    },
    // ───────────────────────────── 5
    {
      id: 'loss', name: '训练：每一行、每一列都是选择题',
      lines: [
        '拿 4 对的小 batch 看一下：第 1 行是猫图，它和 4 句话分别算出相似度',
        '对这一行做 softmax，变成加起来 100% 的概率，训练要让正确那句最高',
        '每一列也一样：每句话要从 4 张图里挑出自己那张，两个方向的损失取平均',
        '论文里 N = **32,768**：每张图都要从三万多句话里，认出自己那一句',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const X0 = 300, Y0 = 380, C = 130, GP = 10, cx = j => X0 + j * (C + GP), cy = i => Y0 + i * (C + GP);
        const zoom = g.p(L(3) + .2, .8, 'io'), base = 1 - zoom;
        const P0 = softmax(S[0], 6);
        // headers and row images
        PAIRS.forEach((p, j) => {
          const a = g.p(.2 + j * .15, .4) * base;
          g.rect(cx(j), 250, C, 105, { r: 12, fill: COL.panel, stroke: g.rgba(TXT_C, .7), lw: 2, alpha: a });
          g.text('T' + (j + 1), cx(j) + C / 2, 282, { size: 28, weight: 700, font: 'disp', color: TXT_C, alpha: a });
          g.text(p.short, cx(j) + C / 2, 325, { size: 24, font: 'mono', color: COL.sub, alpha: a });
          tile(g, p.k, 140, cy(j) + 10, 110, g.p(.4 + j * .15, .4) * base);
          g.text('I' + (j + 1), 118, cy(j) + C / 2, { size: 26, font: 'disp', color: IMG_C, align: 'right', alpha: a });
        });
        g.note('句子见第 1 幕 · 相似度和概率都是示意', 1040, 215, { alpha: g.p(.6, .4) * base });
        // cells
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const row0 = i === 0;
          const show = row0 ? g.p(L(0) + .8 + j * .45, .35) : g.p(L(2) + .3 + (i * 4 + j) * .06, .3);
          const v = S[i][j], pct = row0 ? g.p(L(1) + .5 + j * .25, .5) : 0;
          const lum = row0 ? g.lerp(v, P0[j], pct) : v;
          g.rect(cx(j), cy(i), C, C, { r: 10, fill: show > 0 ? g.rgba(POS_C, .08 + .8 * lum * show) : '#17171C', stroke: COL.line, lw: 2, alpha: base });
          if (show > 0) {
            const txt = pct > .5 ? fmt1(P0[j]) : v.toFixed(2);
            g.text(txt, cx(j) + C / 2, cy(i) + C / 2, { size: 32, font: 'disp', weight: 700, color: lum > .45 ? '#0B0B0E' : COL.fg, alpha: show * base });
          }
        }
        g.mark(cx(0) - 8, cy(0) - 8, 4 * C + 3 * GP + 16, C + 16, { k: g.p(L(0) + .4, .6), color: COL.acc, lw: 4, alpha: g.win(0, L(2) + .3, .3, .3) * base });
        g.chip('softmax', cx(3) + C + 30, cy(0) + 30, { size: 26, align: 'left', alpha: g.p(L(1) + .2, .4) * base });
        g.chip('和 = 100%', cx(3) + C + 30, cy(0) + 95, { size: 26, color: COL.sub, align: 'left', alpha: g.p(L(1) + 1.6, .4) * base });
        g.mark(cx(0) - 4, cy(0) - 4, C + 8, C + 8, { k: g.p(L(1) + 2.2, .4), color: COL.fg, lw: 5, label: '正确那句最高', side: 'bottom', alpha: g.win(L(1), L(2) + .2, .3, .3) * base });
        // columns: each sentence picks its image
        g.mark(cx(0) - 8, cy(0) - 8, C + 16, 4 * C + 3 * GP + 16, { k: g.p(L(2) + 1.4, .6), color: TXT_C, lw: 4, alpha: g.win(L(2), L(3) + .3, .3, .3) * base });
        for (let i = 1; i < 4; i++) g.mark(cx(i) - 3, cy(i) - 3, C + 6, C + 6, { k: g.p(L(2) + 2.2 + i * .25, .3), color: COL.fg, lw: 4, alpha: base });
        const la = g.p(L(2) + 3, .4) * base;
        g.rich([['loss = ( ', COL.fg], ['按行', COL.acc], [' + ', COL.fg], ['按列', TXT_C], [' ) / 2', COL.fg]], 540, 1000 + 0 * 1, { size: 38, font: 'cn', alpha: la });
        g.note('论文 Figure 3：对称交叉熵', 1040, 1060, { alpha: la });
        // zoom out to the real batch size
        if (zoom > 0) {
          const n = 48, side = 640, x0 = 220, y0 = 300, cs = side / n, c = g.ctx;
          c.save(); c.globalAlpha *= zoom;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            c.fillStyle = i === j ? POS_C : (i + j) % 2 ? '#1B1B21' : '#202027';
            c.fillRect(x0 + j * cs + .5, y0 + i * cs + .5, cs - 1, cs - 1);
          }
          c.restore();
          g.rect(x0, y0, side, side, { r: 2, stroke: COL.faint, lw: 2, alpha: zoom });
          g.mark(x0 - 4, y0 - 4, cs + 8, cs + 8, { k: g.p(L(3) + 1.4, .4), color: COL.acc, lw: 4 });
          g.text('猫图在这一行', x0 + 50, y0 - 36, { size: 28, color: COL.acc, align: 'left', alpha: g.p(L(3) + 1.6, .4) });
          g.text('**32,768 × 32,768** ≈ 10.7 亿格', 540, 1010, { size: 40, weight: 700, font: 'disp', alpha: g.p(L(3) + 1, .4) });
          g.text('蓝色对角线 = 真配对（缩略示意）', 540, 1080, { size: 26, color: COL.sub, alpha: g.p(L(3) + 2, .4) });
        }
      },
    },
    // ───────────────────────────── 6
    {
      id: 'zeroshot', name: '用起来：把类别名写成一句话',
      lines: [
        '训练完，分类时不用再训练：把每个类别名填进模板 a photo of a {label}.',
        '文本编码器把这几句话变成 embedding，相当于现场造出了一个分类器',
        '猫图的 embedding 和每句话比相似度，最像的那句就是答案',
        '光换成这个 prompt 模板，ImageNet 就涨了 **1.3%**；再集成 **80 个**模板，又涨 **3.5%**',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const fa = g.win(0, L(1) + .4, .4, .4);
        if (fa > 0) {
          const F = g.img('fig1_zs', 160, 220, 760, null, { card: true, alpha: fa });
          g.note('图：论文 Figure 1（2）（3）', 920, 830, { alpha: fa });
          g.mark(F.box(.005, .085, .12, .47), { k: g.p(L(0) + .6, .5), label: '类别名', side: 'bottom', alpha: fa });
          g.mark(F.box(.19, .2, .395, .36), { k: g.p(L(0) + 2.0, .5), label: 'prompt 模板', side: 'top', alpha: fa });
          g.mark(F.box(.42, .12, .6, .44), { k: g.p(L(1) - .2, .4), color: TXT_C, alpha: fa });
        }
        const da = g.p(L(1) + .2, .5);
        if (da <= 0) return;
        const CL = ['plane', 'car', 'dog', 'cat', 'bird'], SIM = [.12, .09, .21, .31, .15], HIT = 3;
        tile(g, 0, 80, 190, 200, da, { stroke: t > L(2) + 3.2 ? POS_C : null });
        g.arrow(295, 290, 345, 290, { color: COL.sub, lw: 3, k: g.p(L(2), .4), alpha: da });
        const ia = g.p(L(2) + .2, .4);
        g.vec(355, 276, vals(31), { cell: 28, color: IMG_C, alpha: ia });
        g.text('猫图的 embedding', 355, 238, { size: 26, color: IMG_C, align: 'left', alpha: ia });
        g.chip('文本编码器', 620, 425, { size: 26, color: TXT_C, alpha: da * g.p(L(1) + .6, .4) });
        const BX = 760, BW = 220;
        CL.forEach((c, i) => {
          const y = 500 + i * 110, a = g.p(L(1) + .5 + i * .3, .35), hit = i === HIT;
          g.rich([['a photo of a ', COL.sub], [c, TXT_C], ['.', COL.sub]], 80, y, { size: 30, font: 'mono', align: 'left', alpha: a });
          g.arrow(475, y, 520, y, { color: COL.faint, lw: 3, head: 12, k: g.p(L(1) + .8 + i * .3, .3) });
          g.vec(530, y - 14, vals(40 + i, 6), { cell: 28, color: TXT_C, k: g.p(L(1) + 1 + i * .3, .4) });
          // similarity to the cat image
          const k = g.p(L(2) + .8 + i * .35, .6);
          if (k > 0) {
            const w = BW * SIM[i] / .31 * k;
            g.rect(BX, y - 18, Math.max(w, 3), 36, { r: 8, fill: hit && t > L(2) + 3 ? POS_C : COL.faint });
            g.text(SIM[i].toFixed(2), BX + w + 12, y, { size: 26, font: 'disp', align: 'left', color: hit ? COL.fg : COL.sub, alpha: g.p(L(2) + 1.1 + i * .35, .3) });
          }
        });
        g.text('与猫图的相似度（示意）', BX + 120, 432, { size: 24, color: COL.sub, alpha: g.p(L(2) + .6, .4) });
        g.mark(66, 500 + HIT * 110 - 40, 954, 80, { k: g.p(L(2) + 3.0, .5), color: POS_C, lw: 4, label: '答案：cat', side: 'bottom', alpha: 1 - g.p(L(3), .4) });
        // prompt engineering gains (ImageNet, paper 3.1.4)
        g.chip('单个模板：**+1.3%**', 300, 1110, { size: 30, alpha: g.p(L(3) + .6, .4) });
        g.chip('80 个模板集成：再 **+3.5%**', 740, 1110, { size: 30, alpha: g.p(L(3) + 2.4, .4) });
      },
    },
    // ───────────────────────────── 7
    {
      id: 'result', name: '结果：一张 ImageNet 训练图都没用',
      lines: [
        'ImageNet zero-shot：之前从文字学的方法只有 **11.5%**，CLIP 做到 **76.2%**',
        '这追平了原版 ResNet-50，而它是用 128 万张标注图专门训练出来的',
        '另外两个数据集也大幅领先：aYahoo 72.4% → **98.4%**，SUN 23.0% → **58.5%**',
      ],
      draw(g) {
        const { t, L, COL } = g;
        g.text('zero-shot 准确率（%）↑ 越高越好', 60, 200, { size: 30, align: 'left', color: COL.sub, alpha: g.p(.2, .4) });
        const grp = (title, a, b, y, k, alpha) => g.bars(60, y, 960, [
          { label: 'Visual N-Grams', value: a, text: a.toFixed(1) }, { label: 'CLIP', value: b, text: b.toFixed(1), hi: true },
        ], { title, min: 0, max: 100, k, labelW: 250, h: 56, gap: 14, alpha });
        const A = grp('ImageNet', 11.5, 76.2, 320, g.p(L(0) + .3, 1.6), g.p(.2, .4));
        // ResNet-50 marker at the same accuracy
        const m = g.p(L(1) + .3, .6), xm = A[1].x + A[1].w;
        g.line(xm, 290, xm, 290 + 160 * m, { color: COL.yellow, lw: 4, dash: [8, 8] });
        g.chip('≈ 原版 ResNet-50', xm, 490, { size: 30, color: COL.yellow, align: 'right', alpha: g.p(L(1) + .8, .4) });
        g.text('它用 **128 万张**标注图训练，CLIP 一张都没用', 540, 560, { size: 30, alpha: g.p(L(1) + 2, .4) });
        grp('aYahoo', 72.4, 98.4, 720, g.p(L(2) + .3, 1.4), g.p(L(2), .4));
        grp('SUN', 23.0, 58.5, 930, g.p(L(2) + 1.4, 1.4), g.p(L(2) + 1.1, .4));
        g.note('数据：论文 Table 1', 1020, 1110, { alpha: g.p(1, .4) });
      },
    },
    // ───────────────────────────── 8
    {
      id: 'robust', name: '换个画风也认得：分布变了更稳',
      lines: [
        '再看「变了样」的图：论文图 13 把香蕉换成卡通、素描、刁钻的拍法',
        '两个模型在标准 ImageNet 上都是 **76.2%**：ResNet-101 和 zero-shot CLIP',
        '换成卡通和艺术画，ResNet-101 掉到 37.7%，CLIP 还有 **88.9%**',
        '最难的 ImageNet-A，ResNet-101 只剩 **2.7%**，CLIP 是 **77.1%**',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig13_robust', 90, 200, 900, null, { card: true, alpha: g.p(L(0) + .2, .6) });
        g.note('图：论文 Figure 13（右）', 990, 165, { alpha: g.p(L(0) + .6, .4) });
        const rowY = [.075, .222, .368, .514, .658, .804, .95];
        const row = (r, x0 = .0, x1 = 1) => F.box(x0, rowY[r] + .004, x1, rowY[r + 1] - .004);
        const on0 = g.win(L(0), L(1) + .2, .3, .3);
        [[2, 'ImageNet-R：卡通、艺术画'], [4, 'Sketch：素描'], [3, 'ObjectNet：刁钻拍法']].forEach(([r, lab], n) =>
          g.mark(row(r, .155, .7), { k: g.p(L(0) + 1.2 + n * 1.0, .5), color: COL.yellow, lw: 6, fill: .18, alpha: on0 }));
        g.mark(row(0, .703, .895), { k: g.p(L(1) + .4, .5), color: COL.acc, lw: 4, label: '都是 76.2', side: 'right', labelSize: 26, alpha: g.win(L(1), L(2) + .2, .3, .3) });
        g.mark(row(2, .703, .895), { k: g.p(L(2) + .3, .5), color: COL.acc, lw: 4, alpha: g.win(L(2), L(3) + .2, .3, .3) });
        g.mark(row(5, .703, .895), { k: g.p(L(3) + .3, .5), color: COL.acc, lw: 4 });
        // redrawn bars: ResNet-101 vs zero-shot CLIP
        const RW = 560, BX = 300, Y = 880;
        const legA = g.p(L(1) + .6, .4);
        g.rect(300, 838, 22, 22, { r: 4, fill: COL.faint, alpha: legA }); g.text('ResNet-101', 332, 849, { size: 24, align: 'left', color: COL.sub, alpha: legA });
        g.rect(520, 838, 22, 22, { r: 4, fill: COL.acc, alpha: legA }); g.text('zero-shot CLIP', 552, 849, { size: 24, align: 'left', color: COL.sub, alpha: legA });
        [['ImageNet', 76.2, 76.2, L(1) + .8], ['ImageNet-R', 37.7, 88.9, L(2) + .8], ['ImageNet-A', 2.7, 77.1, L(3) + .8]].forEach(([name, a, b, at], i) => {
          const y = Y + i * 100, al = g.p(at, .4), k = g.p(at + .2, 1);
          g.text(name, BX - 20, y + 34, { size: 28, align: 'right', color: COL.fg, alpha: al });
          [[a, COL.faint], [b, COL.acc]].forEach(([v, c], j) => {
            const w = RW * v / 100 * k, yy = y + j * 36;
            g.rect(BX, yy, Math.max(w, 3), 30, { r: 6, fill: c, alpha: al });
            g.text(v.toFixed(1), BX + w + 12, yy + 15, { size: 24, font: 'disp', align: 'left', color: j ? COL.acc : COL.sub, alpha: al * g.p(at + .9, .3) });
          });
        });
      },
    },
  ],
});
