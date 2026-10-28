// An Image is Worth 16x16 Words（ViT）— 3 分钟动效解读 · 张指导出品
// 主线：图像能不能像句子一样，直接交给 Transformer？主角：猫图里猫左眼那一块 patch（第 6 行第 5 列，序号 75）。

const N = 14, PR = 5, PC = 4, PID = PR * N + PC;          // 224 / 16 = 14 块一行；主角是第 75 块
const cropOf = (r, c) => [c / N, r / N, (c + 1) / N, (r + 1) / N];

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function vals(seed, n = 4) { const r = rng(seed); return Array.from({ length: n }, () => .15 + .85 * r()); }

// one patch of the cat photo, drawn smooth (for tiles) or as hard pixels (from the 224×224 copy)
const tile = (g, r, c, x, y, w, a = 1) => g.img('cat', x, y, w, w, { crop: cropOf(r, c), alpha: a });
function pixels(g, crop, x, y, w, h, a = 1) {
  g.ctx.save(); g.ctx.imageSmoothingEnabled = false;
  const F = g.img('cat224', x, y, w, h, { crop, alpha: a });
  g.ctx.restore(); return F;
}
// tint a region in place (shows one colour channel of the patch)
function tint(g, x, y, w, h, color, a) {
  if (a <= .01) return;
  g.ctx.save(); g.ctx.globalAlpha *= a; g.ctx.globalCompositeOperation = 'multiply'; g.ctx.fillStyle = color; g.ctx.fillRect(x, y, w, h); g.ctx.restore();
}
// fill a polygon (the paper's grey BiT band)
function poly(g, pts, color, a) {
  if (a <= .01) return;
  g.ctx.save(); g.ctx.globalAlpha *= a; g.ctx.fillStyle = color; g.ctx.beginPath();
  pts.forEach(([x, y], i) => i ? g.ctx.lineTo(x, y) : g.ctx.moveTo(x, y)); g.ctx.closePath(); g.ctx.fill(); g.ctx.restore();
}
// the cat cut into a 14×14 grid; returns cell(r, c) → {x, y, w, cx, cy}
function catGrid(g, x, y, s, o = {}) {
  const a = o.alpha ?? 1, c = s / N, k = o.k ?? 1;
  g.img('cat', x, y, s, s, { alpha: a });
  if (k > 0) for (let i = 1; i < N; i++) {
    const kk = g.clamp(k * 1.6 - i * .045);
    g.line(x + i * c, y, x + i * c, y + s, { color: g.rgba('#FFFFFF', .8), lw: o.lw ?? 2, k: kk, alpha: a });
    g.line(x, y + i * c, x + s, y + i * c, { color: g.rgba('#FFFFFF', .8), lw: o.lw ?? 2, k: kk, alpha: a });
  }
  return (r, cc) => ({ x: x + cc * c, y: y + r * c, w: c, cx: x + (cc + .5) * c, cy: y + (r + .5) * c });
}

PM.film({
  paper: { title: 'An Image is Worth 16x16 Words', byline: 'Dosovitskiy 等 12 位作者 · Google Research · ICLR 2021', arxiv: '2010.11929' },
  question: '图像能不能像句子一样，**直接交给 Transformer**？',
  recap: [
    '把图切成 16×16 的 **patch**，一块当一个词',
    { text: '拉平 → 乘 E → 加位置编码，前面插 **[class]**', say: '拉平，乘 E，加位置编码，前面插一个 class token' },
    '后面是原样的 Transformer，用 [class] 的输出分类',
    '数据少不如 CNN，数据到 3 亿张就**反超**，还更省算力',
  ],
  scenes: [
    {
      id: 'pixel', name: '问题：图像能不能像句子一样交给 Transformer',
      lines: [
        '2020 年，**Transformer** 已经统治了 NLP：一句话切成一个个词，直接送进去',
        '图像识别却还是 **CNN** 的天下。图像能不能也像句子一样，直接交给 Transformer？',
        '最直接的想法是一个像素当一个词，可一张 224×224 的图就有 **50176** 个像素',
        '注意力要让每两个词都配一次对，算量随长度的**平方**增长，这条路走不通',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const gone = 1 - g.p(L(2), .6), dimS = 1 - .65 * g.p(L(1), .5);
        // the Transformer box that both the sentence and the image want to get into
        const TB = { x: 300, y: 440, w: 480, h: 110 }, tbA = g.p(.2, .5) * gone;
        g.rect(TB.x, TB.y, TB.w, TB.h, { fill: g.rgba(COL.blue, .14), stroke: COL.blue, lw: 3, alpha: tbA });
        g.text('Transformer', 540, TB.y + 56, { size: 42, font: 'disp', weight: 700, color: COL.blue, alpha: tbA });
        const words = ['An', 'image', 'is', 'worth', '16x16', 'words'];
        const R = g.tokens(words, 540, 220, { size: 36, style: i => ({ alpha: g.p(L(0) + .3 + i * .18, .3) * dimS * gone }) });
        R.forEach((r, i) => g.arrow(r.cx, r.bottom + 12, g.lerp(TB.x + 50, TB.x + TB.w - 50, i / 5), TB.y - 12,
          { color: COL.sub, lw: 3, head: 12, k: g.p(L(0) + 1.6 + i * .12, .6), alpha: dimS * gone }));
        g.chip('NLP：一个词 = 一个 token', 540, 160, { size: 26, color: COL.sub, alpha: g.p(L(0) + 2.6, .4) * dimS * gone });
        // line 2: images go to a CNN; can they go to the Transformer instead?
        if (t > L(1) - .1) {
          const ca = g.p(L(1) + .3, .5) * gone;
          const mv = g.p(L(2), 1, 'io'), cx = g.lerp(120, 80, mv), cy = g.lerp(690, 200, mv), cs = g.lerp(340, 560, mv);
          g.img('cat', cx, cy, cs, cs, { alpha: Math.max(ca, g.p(L(2), .3)) });
          g.rect(650, 805, 300, 110, { fill: g.rgba(COL.green, .14), stroke: COL.green, lw: 3, alpha: g.p(L(1) + .6, .4) * gone });
          g.text('CNN', 800, 861, { size: 42, font: 'disp', weight: 700, color: COL.green, alpha: g.p(L(1) + .6, .4) * gone });
          g.arrow(475, 860, 636, 860, { color: COL.green, lw: 4, k: g.p(L(1) + 1, .5), alpha: gone });
          g.curve(290, 676, 470, 566, { bend: -60, color: COL.acc, lw: 4, dash: [10, 10], head: 16, k: g.p(L(1) + 3.2, .8), alpha: gone });
          g.chip('**?**', 300, 600, { size: 40, alpha: g.p(L(1) + 3.8, .4) * gone });
        }
        // line 3: one pixel = one word → 50176 words
        if (t > L(2)) {
          const X0 = 80, Y0 = 200, S = 560, a = g.p(L(2) + 1, .5);
          const px = [65, 83, 77, 95];                     // a 12×12-pixel region around the eye highlight
          const bx = X0 + px[0] / 224 * S, by = Y0 + px[1] / 224 * S, bw = 12 / 224 * S;
          g.rect(bx, by, bw, bw, { stroke: COL.acc, lw: 3, r: 2, alpha: a });
          pixels(g, px.map(v => v / 224), 690, 230, 320, 320, a);
          g.rect(690, 230, 320, 320, { stroke: COL.acc, lw: 3, r: 4, alpha: a });
          g.line(bx + bw, by, 690, 230, { color: COL.acc, lw: 2, alpha: a * .7 });
          g.line(bx + bw, by + bw, 690, 550, { color: COL.acc, lw: 2, alpha: a * .7 });
          g.text('放大：每一格是一个像素', 850, 590, { size: 26, color: COL.sub, alpha: a });
          g.chip('224 × 224 = **50176** 个像素 = 50176 个词', 540, 830, { size: 34, alpha: g.p(L(2) + 2.2, .4) });
        }
        // line 4: every pixel pairs with every other pixel
        if (t > L(3)) {
          const r = rng(7), ox = 80 + 71 / 224 * 560, oy = 200 + 89 / 224 * 560;
          for (let i = 0; i < 70; i++) {
            const tx = 80 + r() * 560, ty = 200 + r() * 560;
            g.line(ox, oy, tx, ty, { color: g.rgba(COL.acc, .55), lw: 2, k: g.p(L(3) + .3 + i * .02, .5) });
          }
          g.text('两两配对：50176 × 50176 ≈ **25 亿**对', 540, 930, { size: 38, alpha: g.p(L(3) + 1.6, .4) });
          g.chip('算不动', 540, 1030, { size: 36, color: COL.red, solid: true, alpha: g.p(L(3) + 2.6, .4) });
        }
      },
    },
    {
      id: 'patch', name: '切块：一张图切成 196 个 patch',
      lines: [
        '论文的办法：不按像素切，按 **16×16** 像素的小块切，每一块叫一个 **patch**',
        '224 ÷ 16 = 14，横竖各 14 块，一共 **196** 块，序列一下子短了 256 倍',
        '标题里的「16x16 words」说的就是它：一个 patch，当一个词',
        '再按从左到右、从上到下排成一行，一张图就成了 196 个词的「句子」',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const X0 = 60, Y0 = 190, S = 560;
        const cell = catGrid(g, X0, Y0, S, { k: g.p(L(0) + .3, 1.4) });
        const e = cell(PR, PC);
        g.mark(e.x, e.y, e.w, e.w, { k: g.p(L(0) + 2, .5), lw: 4 });
        // the protagonist, enlarged on the right
        const ea = g.p(L(0) + 2.4, .5);
        g.curve(e.x + e.w, e.cy, 730, 330, { bend: -40, color: COL.acc, lw: 3, k: ea });
        tile(g, PR, PC, 730, 200, 260, ea);
        g.rect(730, 200, 260, 260, { stroke: COL.acc, lw: 4, r: 4, alpha: ea });
        g.text('16 × 16 像素', 860, 492, { size: 28, color: COL.sub, alpha: ea });
        // line 2: 14 per side, 196 in all
        for (let i = 0; i < N; i++) g.text(String(i + 1), X0 + (i + .5) * S / N, 168, { size: 24, font: 'disp', color: COL.sub, alpha: g.p(L(1) + .3 + i * .08, .3) });
        g.chip('14 × 14 = **196** 块', 860, 650, { size: 34, alpha: g.p(L(1) + 1.8, .4) });
        g.chip('50176 → 196：短了 256 倍', 860, 730, { size: 28, color: COL.blue, alpha: g.p(L(1) + 3, .4) });
        // line 3: patch = word
        g.chip('1 个 patch = 1 个词', 860, 560, { size: 32, solid: true, alpha: g.p(L(2) + .5, .4) });
        if (t > L(2)) g.mark(730 - 8, 200 - 8, 276, 276, { k: g.p(L(2) + .3, .6), color: COL.yellow, lw: 4 });
        // line 4: the patches fly out, row by row, into one sequence
        if (t > L(3) - .1) {
          const slots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, null, PID, null, N * N - 1];
          const sx = k => 60 + k * 60, sy = 900;
          g.line(60, sy + 28, 60 + 960 * g.p(L(3) + .2, 1.2), sy + 28, { color: COL.faint, lw: 2 });
          slots.forEach((id, k) => {
            const f = g.p(L(3) + .4 + k * .14, .7, 'io');
            if (id == null) { g.text('…', sx(k) + 28, sy + 28, { size: 34, color: COL.sub, alpha: f }); return; }
            const c = cell(Math.floor(id / N), id % N), x = g.lerp(c.x, sx(k), f), y = g.lerp(c.y, sy, f), w = g.lerp(c.w, 56, f);
            if (f > 0) tile(g, Math.floor(id / N), id % N, x, y, w);
            if (id === PID && f > 0) g.rect(x - 3, y - 3, w + 6, w + 6, { stroke: COL.acc, lw: 4, r: 4 });
            g.text(String(id + 1), sx(k) + 28, sy + 88, { size: 24, font: 'disp', color: id === PID ? COL.acc : COL.sub, alpha: g.p(L(3) + .9 + k * .14, .3) });
          });
          g.text('一行 196 个 patch', 540, 1040, { size: 30, color: COL.sub, alpha: g.p(L(3) + 3, .4) });
        }
      },
    },
    {
      id: 'embed', name: '每块拉平、乘 E，变成一个向量',
      lines: [
        '跟着主角走：猫眼睛所在的第 **75** 块 patch',
        '它有 16×16 个像素，每个像素有 R、G、B 三个数，一共 16×16×3 = **768** 个数',
        '把这 768 个数**拉平**成一长条，乘上一个可学习的矩阵 **E**，变成一个 D 维向量',
        '所有 patch 共用同一个 E，这一步叫 **patch embedding**，相当于 NLP 里的词向量',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const cell = catGrid(g, 60, 190, 240, { lw: 1, alpha: g.p(0, .4) }), e = cell(PR, PC);
        g.mark(e.x - 2, e.y - 2, e.w + 4, e.w + 4, { k: g.p(L(0) + .2, .5), lw: 3 });
        g.chip('第 75 块', 180, 470, { size: 28, alpha: g.p(L(0) + .5, .4) });
        // the protagonist as real pixels (16×16 from the 224×224 image)
        const grow = g.p(L(0) + .6, .9, 'io'), BX = 360, BY = 190, BS = 300;
        const bx = g.lerp(e.x, BX, grow), by = g.lerp(e.y, BY, grow), bs = g.lerp(e.w, BS, grow);
        if (grow > 0) {
          pixels(g, cropOf(PR, PC), bx, by, bs, bs);
          for (let i = 1; i < 16; i++) {
            g.line(bx + i * bs / 16, by, bx + i * bs / 16, by + bs, { color: g.rgba('#000000', .35), lw: 1 });
            g.line(bx, by + i * bs / 16, bx + bs, by + i * bs / 16, { color: g.rgba('#000000', .35), lw: 1 });
          }
          g.rect(bx, by, bs, bs, { stroke: COL.acc, lw: 4, r: 3 });
        }
        g.text('16', BX + BS / 2, BY - 24, { size: 26, font: 'disp', color: COL.sub, alpha: g.p(L(0) + 1.6, .4) });
        g.text('16', BX - 26, BY + BS / 2, { size: 26, font: 'disp', color: COL.sub, alpha: g.p(L(0) + 1.6, .4) });
        // line 2: three colour channels
        if (t > L(1)) {
          [[COL.red, 700, 190, 'R'], [COL.green, 750, 240, 'G'], [COL.blue, 800, 290, 'B']].forEach(([c, x, y, s], n) => {
            const k = g.p(L(1) + .5 + n * .5, .6, 'io'), xx = g.lerp(BX + 150, x, k), yy = g.lerp(BY + 150, y, k), w = 150 * k + .01;
            pixels(g, cropOf(PR, PC), xx, yy, w, w, k);
            tint(g, xx, yy, w, w, c, .55 * k);
            g.rect(xx, yy, w, w, { stroke: c, lw: 4, r: 4, alpha: k });
            g.chip(s, xx + 26, yy + 26, { size: 24, color: c, solid: true, alpha: g.p(L(1) + 1 + n * .5, .3) });
          });
          g.chip('R · G · B 三层', 835, 475, { size: 26, color: COL.sub, alpha: g.p(L(1) + 2, .4) });
          g.text('16 × 16 × 3 = **768** 个数', 540, 560, { size: 38, font: 'disp', alpha: g.p(L(1) + 2.6, .4) });
        }
        // line 3: flatten row by row → × E → a vector
        if (t > L(2)) {
          const segs = [0, 1, 2, null, 15], SX = [70, 280, 490, 700, 760], SY = 650, SW = 192, SH = 22;
          g.text('拉平', 60, SY - 32, { size: 28, color: COL.sub, align: 'left', alpha: g.p(L(2) + .3, .3) });
          segs.forEach((r, n) => {
            const k = g.p(L(2) + .3 + n * .3, .7, 'io');
            if (r == null) { g.text('…', 730, SY + 11, { size: 30, color: COL.sub, alpha: k }); return; }
            const c0 = cropOf(PR, PC), crop = [c0[0], c0[1] + r / 224, c0[2], c0[1] + (r + 1) / 224];
            if (k > 0) {
              const x = g.lerp(BX, SX[n], k), y = g.lerp(BY + r * BS / 16, SY, k), w = g.lerp(BS, SW, k), h = g.lerp(BS / 16, SH, k);
              pixels(g, crop, x, y, w, h);
              g.rect(x - 2, y - 2, w + 4, h + 4, { stroke: COL.acc2, lw: 2, r: 3 });
              if (n === 0 || r === 15) g.text(`第 ${r + 1} 行`, x + w / 2, y + h + 22, { size: 24, color: COL.sub, alpha: g.p(L(2) + 1.2 + n * .3, .3) });
            }
          });
          const ek = g.p(L(2) + 2.2, .5);
          g.arrow(540, SY + 34, 540, 718, { color: COL.sub, lw: 3, head: 12, k: ek });
          g.rect(370, 722, 340, 86, { fill: g.rgba(COL.purple, .16), stroke: COL.purple, lw: 3, alpha: ek });
          g.rich([['× ', COL.fg], ['E', COL.purple], ['  可学习', COL.sub]], 540, 766, { size: 36, font: 'disp', alpha: ek });
          const vk = g.p(L(2) + 3.2, .6);
          g.arrow(540, 812, 540, 846, { color: COL.sub, lw: 3, head: 12, k: vk });
          g.vec(108, 856, vals(75, 24), { cell: 32, gap: 4, color: COL.acc, k: vk });
          g.text('D = 768 维（ViT-Base）', 540, 922, { size: 28, color: COL.acc, alpha: g.p(L(2) + 3.8, .4) });
          g.note('格子亮度为示意', 1000, 958, { alpha: g.p(L(2) + 3.8, .4) });
        }
        // line 4: other patches go through the same E; the paper's figure
        if (t > L(3)) {
          [[0, 0, 60], [9, 11, 920], [11, 2, 160], [3, 10, 830]].forEach(([r, c, x], n) => {
            const k = g.p(L(3) + .3 + n * .35, .9, 'io');
            if (k > 0 && k < 1) tile(g, r, c, g.lerp(x, 520, k), g.lerp(730, 745, k), 40, Math.sin(Math.PI * k));
          });
          const a = g.p(L(3) + 1.4, .5);
          const F = g.img('fig1_overview', 120, 1000, 560, null, { card: true, crop: [.03, .645, .68, .99], alpha: a });
          g.mark(F.box(.33, .0, .975, .23), { k: g.p(L(3) + 2.2, .6), color: COL.purple, lw: 4 });
          g.note('图：论文 Figure 1（局部）', 1020, 1150, { alpha: a });
        }
      },
    },
    {
      id: 'pos', name: '贴上座位号，再加一个 [class] token',
      lines: [
        '可注意力本身不管顺序：把 patch 打乱，每块算出来的结果都不变',
        '所以每个 patch 再加上一个**可学习的位置编码**，相当于贴上座位号',
        '序列最前面再插一个特殊的 **[class] token**，它不对应任何图块，专门用来汇总整张图',
        '196 个 patch 加 1 个 [class]，一共 **197** 个 token，这就是论文图 1 下面那一排',
      ],
      draw(g) {
        const { t, L, COL } = g;
        // slots: [class]? , 1..5, …, 75, …, 196
        const ids = [0, 1, 2, 3, 4, null, PID, null, N * N - 1];
        const cls = g.p(L(2) + .3, .9, 'io'), n = 9 + cls, SW = 96, TW = 72, Y = 200;
        const sx = k => 540 - n * SW / 2 + (k + cls) * SW + (SW - TW) / 2;
        // line 1: shuffle the patches and put them back; each one keeps its own result
        const tilesAt = [0, 1, 2, 3, 4, 6, 8], perm = [6, 3, 8, 0, 2, 1, 4];
        const sh = g.p(L(0) + .6, .9, 'io') * (1 - g.p(L(0) + 3.4, .9, 'io'));
        let ti = 0;
        ids.forEach((id, k) => {
          if (id == null) { g.text('…', sx(k) + TW / 2, Y + TW / 2, { size: 34, color: COL.sub }); return; }
          const tgt = perm[ti++], x = g.lerp(sx(k), sx(tgt), sh), y = Y + Math.sin(Math.PI * sh) * (k % 2 ? -40 : 40);
          tile(g, Math.floor(id / N), id % N, x, y, TW);
          if (id === PID) g.rect(x - 3, y - 3, TW + 6, TW + 6, { stroke: COL.acc, lw: 4, r: 4 });
          g.vec(x + TW / 2 - 9, y + TW + 14, vals(id + 1), { cell: 18, gap: 3, dir: 'v', color: COL.green, alpha: g.p(L(0) + .2, .4) });
          // line 2: a position number drops in under each patch (purple, like Figure 1)
          const pk = g.p(L(1) + .5 + k * .15, .5, 'back');
          if (pk > 0) {
            const py = g.lerp(Y + 210, Y + 185, pk);
            g.rect(x + 4, py, TW - 8, 46, { r: 12, fill: COL.purple, alpha: Math.min(1, pk) });
            g.text(String(id + 1), x + TW / 2, py + 24, { size: 26, font: 'disp', weight: 700, color: '#111', alpha: Math.min(1, pk) });
            g.text('+', x + TW / 2, Y + TW + 108, { size: 28, color: COL.sub, alpha: Math.min(1, pk) });
          }
        });
        g.chip('打乱顺序：每块的结果（绿色）跟着走，一点没变', 540, 520, { size: 28, color: COL.green, alpha: g.win(L(0) + 1.4, L(1), .4, .3) });
        // line 3: the [class] token slides in at the front
        if (cls > 0) {
          const x = 540 - 10 * SW / 2 + (SW - 88) / 2 - 40 * (1 - cls);   // its final slot is the first of 10
          g.rect(x, Y, 88, TW, { r: 12, fill: g.rgba(COL.acc, .2), stroke: COL.acc, lw: 3, alpha: cls });
          g.text('[class]', x + 44, Y + TW / 2, { size: 24, font: 'disp', weight: 700, color: COL.acc, alpha: cls });
          g.vec(x + 44 - 9, Y + TW + 14, vals(999), { cell: 18, gap: 3, dir: 'v', color: COL.acc, alpha: cls });
          g.rect(x + 12, Y + 185, 64, 46, { r: 12, fill: COL.purple, alpha: cls });
          g.text('0', x + 44, Y + 209, { size: 26, font: 'disp', weight: 700, color: '#111', alpha: cls });
        }
        // the paper's own picture of the same row
        const fa = g.p(L(1) + 2.4, .5);
        const F = g.img('fig1_overview', 70, 600, 940, null, { card: true, alpha: fa });
        g.note('图：论文 Figure 1', 1010, 1130, { alpha: fa });
        g.mark(F.box(.245, .55, .66, .645), { k: g.p(L(1) + 3, .6), color: COL.purple });
        g.mark(F.box(.19, .55, .243, .645), { k: g.p(L(2) + 1.8, .6), label: '[class]', side: 'top' });
        if (t > L(3)) {
          g.chip('196 + 1 = **197** 个 token', 540, 540, { size: 34, alpha: g.p(L(3) + .5, .4) });
          g.mark(F.box(.18, .54, .67, .655), { k: g.p(L(3) + 1.4, .6), color: COL.yellow, lw: 4 });
        }
      },
    },
    {
      id: 'encoder', name: '后面就是原样的 Transformer 编码器',
      lines: [
        '接下来就是标准的 Transformer 编码器，论文刻意不改，NLP 的现成实现拿来就能用',
        '每层两步：**多头注意力**让 patch 互相看，**MLP** 再逐个加工；前面有 Norm，外面有残差',
        'ViT-Base 叠 **12 层**。从第一层起，猫眼睛这块就能直接看到全图任意一块',
        '最后只取 [class] token 的输出，接一个 **MLP Head**，给出这张图的类别',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const up = g.p(L(2) - .2, .8, 'io'), F = g.img('fig1_overview', 70, g.lerp(360, 180, up), 940, null, { card: true, alpha: g.p(0, .5) });
        g.note('图：论文 Figure 1', 1010, F.y + F.h + 38);
        const on = i => g.win(L(i), i < 3 ? L(i + 1) : g.dur, .3, .3);
        g.mark(F.box(.178, .335, .662, .505), { k: g.p(L(0) + .5, .6), color: COL.blue, label: 'Transformer 编码器', side: 'top', alpha: on(0) });
        g.mark(F.box(.762, .085, .978, .835), { k: g.p(L(0) + 2, .7), color: COL.blue, alpha: on(0) });
        g.mark(F.box(.785, .55, .94, .665), { k: g.p(L(1) + .3, .5), color: COL.green, label: '多头注意力', side: 'left', alpha: on(1) });
        g.mark(F.box(.785, .235, .94, .32), { k: g.p(L(1) + 1.6, .5), color: COL.blue, label: 'MLP', side: 'left', alpha: on(1) });
        g.mark(F.box(.785, .715, .94, .8), { k: g.p(L(1) + 3, .5), color: COL.yellow, alpha: on(1) });
        g.mark(F.box(.785, .36, .94, .445), { k: g.p(L(1) + 3, .5), color: COL.yellow, alpha: on(1) });
        g.mark(F.box(.77, .12, .83, .21), { k: g.p(L(2) + .3, .5), color: COL.acc, label: 'L = 12', side: 'right', alpha: on(2) });
        // line 3: from layer 1, the eye patch reaches every patch
        if (t > L(2) - .1) {
          const a = g.p(L(2), .5) * (1 - .6 * g.p(L(3), .5));
          const cell = catGrid(g, 80, 760, 360, { lw: 1, alpha: a }), e = cell(PR, PC);
          for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
            if (r === PR && c === PC) continue;
            const q = cell(r, c), d = Math.hypot(r - PR, c - PC);
            g.line(e.cx, e.cy, q.cx, q.cy, { color: g.rgba(COL.acc, .5), lw: 1.5, k: g.p(L(2) + 1 + d * .12, .5), alpha: a });
          }
          g.rect(e.x, e.y, e.w, e.w, { stroke: COL.acc, lw: 3, r: 2, alpha: a });
          // 12 layers light up from the bottom
          const la = g.p(L(2) + .6, .4) * (1 - g.p(L(3), .4));
          for (let i = 0; i < 12; i++) {
            const y = 1100 - i * 30, lit = g.p(L(2) + 1.2 + i * .25, .3);
            g.rect(560, y, 420, 22, { r: 6, fill: lit > .5 ? g.rgba(COL.blue, .75) : COL.panel, stroke: COL.faint, lw: 1, alpha: la });
          }
          g.text('第 1 层', 545, 1111, { size: 24, color: COL.sub, align: 'right', alpha: la });
          g.text('第 12 层', 545, 781, { size: 24, color: COL.sub, align: 'right', alpha: la });
        }
        // line 4: [class] output → MLP Head → class
        if (t > L(3)) {
          g.mark(F.box(.17, .165, .268, .325), { k: g.p(L(3) + .3, .5), label: 'MLP Head', side: 'right' });
          g.mark(F.box(.055, .095, .13, .37), { k: g.p(L(3) + 1, .5), color: COL.yellow });
          const k1 = g.p(L(3) + 1.4, .4), k2 = g.p(L(3) + 2.2, .4), k3 = g.p(L(3) + 3, .4);
          g.chip('[class] 的输出', 770, 800, { size: 30, alpha: k1 });
          g.arrow(770, 835, 770, 885, { color: COL.sub, lw: 3, head: 12, k: k2 });
          g.chip('MLP Head', 770, 920, { size: 30, color: COL.acc2, alpha: k2 });
          g.arrow(770, 955, 770, 1005, { color: COL.sub, lw: 3, head: 12, k: k3 });
          g.chip('类别：猫', 770, 1040, { size: 34, color: COL.yellow, solid: true, alpha: k3 });
          g.note('类别为示意', 1000, 1100, { alpha: k3 });
        }
      },
    },
    {
      id: 'data', name: '关键：数据少时不如 CNN，数据大了反超',
      lines: [
        '但只在 ImageNet（**130 万**张图）上训练时，ViT 比同等大小的 ResNet 还差几个点',
        '因为 CNN 天生带着「只看邻居」「平移不变」这些先验，ViT 没有，只能从数据里自己学',
        '论文图 3：灰色带是 CNN（BiT），数据从 130 万涨到 1400 万再到 **3 亿**张，ViT 追上并**反超**',
        '同一个 ViT-L/16：只用 ImageNet 预训练是 76.5%，换成 JFT-300M 涨到 **87.1%**',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig3_data', 170, 180, 740, null, { card: true, alpha: g.p(0, .5) });
        g.note('图：论文 Figure 3', 1000, 762);
        // line 1: at ImageNet scale the ViT dots sit below the CNN band
        g.mark(F.box(.15, .33, .25, .79), { k: g.p(L(0) + .6, .6), color: COL.red, label: 'ViT 落后', side: 'right', alpha: 1 - g.p(L(2), .4) });
        // line 2: what a CNN is told for free (locality) vs ViT (nothing)
        const ia = g.win(L(1), L(3), .4, .4);
        if (ia > 0) {
          const C = 36, G0 = [150, 830], G1 = [714, 830];
          for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
            g.rect(G0[0] + j * C, G0[1] + i * C, C - 4, C - 4, { r: 5, fill: COL.panel, stroke: COL.faint, lw: 1, alpha: ia });
            g.rect(G1[0] + j * C, G1[1] + i * C, C - 4, C - 4, { r: 5, fill: COL.panel, stroke: COL.faint, lw: 1, alpha: ia });
          }
          // a 3×3 window walks over the CNN grid
          const s = Math.max(0, t - L(1) - .6), step = Math.floor(s / .7) % 16, wx = step % 4, wy = Math.floor(step / 4);
          g.rect(G0[0] + wx * C - 3, G0[1] + wy * C - 3, 3 * C + 2, 3 * C + 2, { r: 8, fill: g.rgba(COL.green, .25), stroke: COL.green, lw: 4, alpha: ia * g.p(L(1) + .6, .4) });
          // the ViT cell is wired to everything, near or far
          const c0 = [G1[0] + 2 * C + 16, G1[1] + 2 * C + 16];
          for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
            if (i === 2 && j === 2) continue;
            g.line(c0[0], c0[1], G1[0] + j * C + 16, G1[1] + i * C + 16, { color: g.rgba(COL.acc, .7), lw: 2, k: g.p(L(1) + 2.6 + (i + j) * .05, .5), alpha: ia });
          }
          g.rect(G1[0] + 2 * C, G1[1] + 2 * C, C - 4, C - 4, { r: 5, fill: COL.acc, alpha: ia * g.p(L(1) + 2.4, .3) });
          g.text('CNN：先验写死「只看邻居」', 258, 1080, { size: 28, color: COL.green, alpha: ia * g.p(L(1) + .8, .4) });
          g.text('ViT：没有先验，全靠学', 822, 1080, { size: 28, color: COL.acc, alpha: ia * g.p(L(1) + 2.6, .4) });
        }
        // line 3: the BiT band, then the three dataset sizes, then the JFT column
        if (t > L(2)) {
          const band = [[118, 168], [326, 105], [535, 68], [535, 203], [326, 188], [118, 237]].map(([x, y]) => F.at(x / 599, y / 436));
          poly(g, band, COL.acc2, .28 * g.win(L(2) + .3, L(3) + .2, .4, .4));
          g.chip('CNN（BiT）', F.at(.38, .52)[0], F.at(.38, .52)[1], { size: 26, color: COL.sub, solid: true, alpha: g.win(L(2) + .5, L(3) + .2, .4, .4) });
          [['130 万张', .197], ['1400 万张', .544], ['3 亿张', .893]].forEach(([s, fx], i) =>
            g.chip(s, F.at(fx, 0)[0], 810, { size: 28, color: i === 2 ? COL.acc : COL.sub, alpha: g.p(L(2) + 2 + i * .7, .4) }));
          g.mark(F.box(.84, .09, .95, .46), { k: g.p(L(2) + 4.2, .6), color: COL.green, label: 'ViT 反超', side: 'top' });
        }
        // line 4: ViT-L/16 from Table 5
        if (t > L(3)) {
          const a = g.p(L(3) + .2, .4);
          const sayAt = f => g.lerp(L(3), g.Le(3), f);   // 这一句念到 f（0–1）的时刻
          const R = g.bars(60, 920, 960, [
            { label: 'ImageNet', value: 76.53, color: COL.faint },
            { label: 'ImageNet-21k', value: 85.15, color: COL.acc2 },
            { label: 'JFT-300M', value: 87.12, hi: true },
          ], { title: 'ViT-L/16 · ImageNet 准确率 % ↑ 越高越好', min: 70, max: 90, k: g.p(L(3) + .4, 1.6), labelW: 230, alpha: a, h: 44, gap: 14 });
          g.note('横轴从 70 起 · 数据：论文 Table 5', 1020, 1124, { alpha: a });
          g.mark(40, R[0].y - 6, 1000, R[0].h + 12, { k: g.p(sayAt(.35), .5), color: COL.sub, lw: 3, alpha: a * g.win(sayAt(.35), sayAt(.7), .3, .3) });
          g.mark(40, R[2].y - 6, 1000, R[2].h + 12, { k: g.p(sayAt(.7), .5), lw: 4, alpha: a });
        }
      },
    },
    {
      id: 'result', name: '结果：更准，而且更省算力',
      lines: [
        'JFT-300M 预训练后，ViT-H/14 在 ImageNet 上拿到 **88.55%**，超过 CNN 强基线 BiT-L',
        '预训练只花了 **2.5k** 个 TPUv3 核·天，BiT-L 要 9.9k，Noisy Student 要 12.3k',
        '小一号的 ViT-L/16 只花 **0.68k**，在论文测的所有任务上也都超过了 BiT-L',
      ],
      draw(g) {
        const { t, L, COL } = g;
        const sm = t > L(2);
        const col = (isH) => sm ? (isH ? COL.acc2 : COL.acc) : (isH ? COL.acc : COL.acc2);
        const A = g.bars(60, 280, 960, [
          { label: 'Noisy Student', value: 88.4, color: COL.faint },
          { label: 'BiT-L', value: 87.54, color: COL.green },
          { label: 'ViT-L/16', value: 87.76, color: col(false), hi: sm },
          { label: 'ViT-H/14', value: 88.55, color: col(true), hi: !sm },
        ], { title: 'ImageNet 准确率 % ↑ 越高越好', min: 86, max: 89, k: g.p(.3, 1.6), labelW: 260 });
        g.note('横轴从 86 起 · 数据：论文 Table 2', 1020, 560, { alpha: g.p(1, .4) });
        g.mark(A[3].x - 268, A[3].y - 8, 940, A[3].h + 16, { k: g.p(L(0) + 2.2, .6), alpha: 1 - g.p(L(2), .3) });
        if (t > L(1) - .1) {
          const a = g.p(L(1), .4);
          const B = g.bars(60, 720, 960, [
            { label: 'Noisy Student', value: 12.3, text: '12.3k', color: COL.faint },
            { label: 'BiT-L', value: 9.9, text: '9.9k', color: COL.green },
            { label: 'ViT-L/16', value: .68, text: '0.68k', color: col(false), hi: sm },
            { label: 'ViT-H/14', value: 2.5, text: '2.5k', color: col(true), hi: !sm },
          ], { title: '预训练算力 TPUv3 核·天 ↓ 越少越好', min: 0, max: 12.3, k: g.p(L(1) + .2, 1.4), labelW: 260, alpha: a });
          g.note('数据：论文 Table 2', 1020, 1000, { alpha: a });
          if (sm) {
            g.mark(A[2].x - 268, A[2].y - 8, 940, A[2].h + 16, { k: g.p(L(2) + .4, .6) });
            g.mark(B[2].x - 268, B[2].y - 8, 940, B[2].h + 16, { k: g.p(L(2) + 1.2, .6) });
          }
          g.chip('ViT-H/14 算力 ≈ BiT-L 的 1/4', 540, 1080, { size: 30, alpha: g.p(L(1) + 2.8, .4) * (1 - g.p(L(2), .3)) });
          g.chip('ViT-L/16 算力 ≈ BiT-L 的 1/15', 540, 1080, { size: 30, alpha: g.p(L(2) + 2, .4) });
        }
      },
    },
  ],
});
