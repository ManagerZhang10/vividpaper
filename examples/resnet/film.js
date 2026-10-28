// Deep Residual Learning for Image Recognition (ResNet) — 3 分钟动效解读 · 张指导出品
// 主线：网络越堆越深，为什么反而越训越差？主角：「多出来的那些层」，画成一排细竖条，一根 = 一层。
// 颜色：x / 捷径 = 蓝，残差 F = 赭橙，输出 H = 绿；20 层 = 黄、56 层 = 红（和论文图 1 的线同色）。

const XV = [.75, .35, .9, .5];          // 示意：输入 x
const FV = [.12, -.1, .08, .15];        // 示意：残差 F(x)

// a row of thin bars, one bar = one layer. Drawn with the raw context so 1202 bars stay cheap.
function layerRow(g, n, x, y, o = {}) {
  const w = o.w ?? 12, gap = o.gap ?? 4, h = o.h ?? 64, a = o.alpha ?? 1, X = g.ctx;
  const shown = Math.ceil(n * g.clamp(o.k ?? 1) - 1e-6);
  if (a > .001 && shown > 0) {
    X.save(); X.globalAlpha *= a;
    for (let i = 0; i < shown; i++) { X.fillStyle = typeof o.color === 'function' ? o.color(i) : (o.color ?? g.COL.sub); X.fillRect(x + i * (w + gap), y, w, h); }
    X.restore();
  }
  return { x0: x, x1: x + n * (w + gap) - gap, at: i => x + i * (w + gap) + w / 2, y, h };
}
// vertical bars for a small vector (bottom at `base`; negative values hang below `base`)
function barVec(g, cx, base, vals, color, o = {}) {
  const bw = 34, gap = 12, sc = o.scale ?? 220, k = o.k ?? 1, x0 = cx - (4 * bw + 3 * gap) / 2;
  vals.forEach((v, i) => {
    const h = v * sc * g.clamp((k - i * .08) / (1 - 3 * .08));
    const x = x0 + i * (bw + gap);
    if (Math.abs(h) > .5) g.rect(x, h > 0 ? base - h : base, bw, Math.abs(h), { r: 5, fill: color, alpha: o.alpha ?? 1 });
  });
  g.line(x0 - 10, base, x0 + 4 * bw + 3 * gap + 10, base, { color: g.COL.faint, lw: 3, alpha: o.alpha ?? 1 });
  return { x0, x1: x0 + 4 * bw + 3 * gap, bar: i => [x0 + i * (bw + gap), bw] };
}
// cubic Bézier point
function bez(p0, p1, p2, p3, u) {
  const v = 1 - u;
  return [0, 1].map(k => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k]);
}
// mark a region and hang a chip off to the right with a dashed leader
function callout(g, rect, label, cx, cy, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return;
  g.mark(rect, { k, color: o.color, lw: 4 });
  const [x, y, w, h] = rect;
  g.line(x + w + 4, y + h / 2, cx - 6, cy, { color: o.color, lw: 2, dash: [5, 6], k: g.clamp((k - .4) * 2), alpha: .8 });
  g.chip(label, cx, cy, { size: o.size ?? 28, color: o.color, align: 'left', alpha: g.clamp((k - .5) * 2) });
}

PM.film({
  paper: { title: 'Deep Residual Learning for Image Recognition', byline: 'Kaiming He 等 4 位作者 · Microsoft Research · 2015', arxiv: '1512.03385' },
  question: '网络越堆越深，为什么反而**越训越差**？',
  recap: [
    '层数加深，**训练误差**反而升高：退化',
    '多出的层只要照抄就行，可它们学不会照抄',
    '接一条**捷径**：层只学残差，输出 F(x) + x',
    '152 层照样好训，ImageNet **第一**（3.57%）',
  ],
  scenes: [
    {
      id: 'degrade', name: '怪现象：56 层反而比 20 层错得多',
      lines: [
        '2015 年，ImageNet 上最好的模型都在拼**深度**：16 到 30 层',
        '那层数越多越好吗？论文把普通网络从 **20 层**加到 **56 层**',
        '结果 56 层的**训练误差**反而更高，测试误差也更高',
        { text: '连训练集都学不好，就不是过拟合，是根本没训好。论文叫它**退化**（degradation）', hold: .6 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        // line 1: the leading models get deeper, 16 → 30 layers
        const a0 = g.p(.3, .5) * (1 - g.p(L(1), .5));
        if (a0 > 0) {
          const n = Math.round(g.lerp(16, 30, g.p(L(0) + 1, 2.4, 'io')));
          layerRow(g, n, 540 - (30 * 20 - 6) / 2, 300, { w: 14, gap: 6, h: 100, color: COL.sub, alpha: a0 });
          g.text(`**${n}** 层`, 540, 235, { size: 48, font: 'disp', alpha: a0 });
          g.text('一根竖条 = 一层', 540, 460, { size: 28, color: COL.dim, alpha: a0 * g.p(L(0) + .8, .4) });
        }
        // line 2: plain nets of 20 and 56 layers
        if (t > L(1) - .1) {
          const a = g.p(L(1), .4);
          layerRow(g, 20, 170, 220, { w: 10, gap: 5, h: 70, color: COL.yellow, k: g.p(L(1) + .3, 1), alpha: a });
          layerRow(g, 56, 170, 340, { w: 10, gap: 5, h: 70, color: COL.red, k: g.p(L(1) + 1.4, 2.2), alpha: a });
          g.text('20 层', 150, 255, { size: 32, font: 'disp', align: 'right', color: COL.yellow, alpha: a });
          g.text('56 层', 150, 375, { size: 32, font: 'disp', align: 'right', color: COL.red, alpha: g.p(L(1) + 1.4, .4) });
        }
        // line 3: the paper's Figure 1
        if (t > L(2) - .1) {
          const fa = g.p(L(2), .5);
          const F = g.img('fig1_degrade', 60, 520, 960, null, { card: true, alpha: fa });
          g.note('图：论文 Figure 1（CIFAR-10，普通网络）', 1020, 918, { alpha: fa });
          g.mark(F.box(.02, .02, .49, .99), { k: g.p(L(2) + .5, .6), label: '训练误差', side: 'top' });
          g.mark(F.box(.385, .55, .485, .70), { k: g.p(L(2) + 1.5, .5), color: COL.red, lw: 4 });
          g.mark(F.box(.385, .735, .485, .86), { k: g.p(L(2) + 2.0, .5), color: COL.yellow, lw: 4 });
          g.mark(F.box(.53, .02, .99, .99), { k: g.p(L(2) + 3.0, .6), color: COL.acc2, label: '测试误差', side: 'top' });
        }
        // line 4: not overfitting — degradation
        if (t > L(3) - .1) {
          g.chip('训练集上也更差 → **不是过拟合**', 540, 1000, { size: 34, color: COL.sub, alpha: g.p(L(3) + .4, .4) });
          g.chip('退化 · degradation', 540, 1100, { size: 44, solid: true, alpha: g.p(L(3) + 3.2, .5) });
        }
      },
    },
    {
      id: 'identity', name: '本不该更差：多出的层只要原样照抄',
      lines: [
        '想一想：拿训练好的 20 层，上面再叠 36 层，也是一个 56 层网络',
        '只要新加的 36 层把输入**原样照抄**出去，56 层至少和 20 层一样好',
        '这种「输出等于输入」的映射，叫 **identity mapping**（恒等映射）',
        { text: '可退化说明：优化器很难让一叠非线性层**学会原样照抄**', hold: .8 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const X0 = 92, Y = 280, ST = 16, XS = X0 + 20 * ST;   // XS: where the new 36 layers start
        const run = (t - (L(1) + .9)) / 2.4 * 36;              // the x vector walks through the 36 new layers
        layerRow(g, 20, X0, Y, { w: 12, gap: 4, h: 70, color: COL.yellow, alpha: g.p(.1, .5) });
        layerRow(g, 36, XS, Y, { w: 12, gap: 4, h: 70, k: g.p(L(0) + 1.2, 1.8),
          color: i => (t > L(1) && i < run) ? COL.blue : COL.sub });
        g.line(X0, 245, XS - 8, 245, { color: COL.yellow, lw: 3, k: g.p(.4, .5) });
        g.text('训练好的 20 层', (X0 + XS - 8) / 2, 215, { size: 28, color: COL.yellow, alpha: g.p(.4, .5) });
        g.line(XS, 245, XS + 36 * ST - 4, 245, { color: COL.sub, lw: 3, k: g.p(L(0) + 2.6, .6) });
        g.text('新加的 36 层', XS + 36 * ST / 2, 215, { size: 28, color: COL.sub, alpha: g.p(L(0) + 2.6, .5) });
        g.text('合起来 = **56 层**', 540, 395, { size: 30, color: COL.sub, alpha: g.p(L(0) + 3.4, .5) });
        // line 2: x goes in, comes out unchanged
        if (t > L(1) - .1) {
          const a = g.p(L(1) + .3, .4);
          g.text('进去的 x', 300, 455, { size: 26, color: COL.blue, alpha: a });
          g.vec(300 - 70, 480, XV, { cell: 32, gap: 4, color: COL.blue, alpha: a });
          if (run > 0 && run < 36) g.circle(XS + run * ST, Y + 35, 13, { fill: COL.blue });
          const b = g.p(L(1) + 3.4, .4);
          g.text('出来的', 780, 455, { size: 26, color: COL.blue, alpha: b });
          g.vec(780 - 70, 480, XV, { cell: 32, gap: 4, color: COL.blue, alpha: b });
          g.text('=', 540, 494, { size: 64, weight: 800, font: 'disp', color: COL.green, alpha: g.p(L(1) + 3.8, .4) });
          g.chip('不会比 20 层差', 540, 580, { size: 30, color: COL.green, alpha: g.p(L(1) + 4.2, .4) });
        }
        // line 3: name it
        if (t > L(2) - .1) {
          const a = g.p(L(2) + .5, .5);
          g.rich([['H(x)', COL.green], ['  =  ', COL.fg], ['x', COL.blue]], 540, 695, { size: 64, font: 'disp', alpha: a });
          g.text('identity mapping · 恒等映射', 540, 770, { size: 30, color: COL.sub, alpha: g.p(L(2) + 1.4, .5) });
        }
        // line 4: a stack of nonlinear layers fails to copy (illustration)
        if (t > L(3) - .1) {
          const a = g.p(L(3), .5);
          g.rect(60, 830, 960, 340, { r: 18, fill: COL.panel, stroke: COL.faint, lw: 2, alpha: a });
          g.note('示意', 1000, 860, { alpha: a });
          g.text('x', 175, 900, { size: 30, font: 'disp', color: COL.blue, alpha: a });
          g.vec(105, 930, XV, { cell: 32, gap: 4, color: COL.blue, alpha: a });
          ['weight layer', 'relu', 'weight layer', 'relu'].forEach((s, i) => {
            const ai = g.p(L(3) + .4 + i * .25, .3);
            g.rect(330, 865 + i * 68, 290, 54, { r: 10, fill: i % 2 ? COL.panel : '#22222A', stroke: COL.faint, lw: 2, alpha: ai });
            g.text(s, 475, 892 + i * 68, { size: 26, font: 'disp', color: COL.sub, alpha: ai });
          });
          g.arrow(260, 946, 318, 946, { color: COL.sub, lw: 3, head: 12, k: g.p(L(3) + .4, .4) });
          g.arrow(632, 1000, 690, 1000, { color: COL.sub, lw: 3, head: 12, k: g.p(L(3) + 1.4, .4) });
          // the actual output keeps wobbling around x and never settles on it
          const live = g.p(L(3) + 1.6, .5), tt = Math.max(0, t - L(3) - 1.6);
          const out = XV.map((v, i) => g.clamp(v + (.28 + .12 * Math.sin(tt * 1.3 + i)) * Math.sin(tt * 2.1 + i * 2.3)));
          g.vec(705, 920, XV, { cell: 32, gap: 4, color: COL.blue, alpha: live });
          g.text('目标 x', 865, 936, { size: 26, align: 'left', color: COL.blue, alpha: live });
          g.text('≠', 775, 1000, { size: 44, weight: 800, font: 'disp', color: COL.red, alpha: g.p(L(3) + 2.4, .4) });
          g.vec(705, 1035, out, { cell: 32, gap: 4, color: COL.red, alpha: live });
          g.text('实际输出', 865, 1051, { size: 26, align: 'left', color: COL.red, alpha: live });
          g.text('学不会照抄', 775, 1120, { size: 30, color: COL.red, alpha: g.p(L(3) + 3, .4) });
        }
      },
    },
    {
      id: 'residual', name: '核心想法：只学「差多少」',
      lines: [
        '论文的办法：在两层旁边接一条**捷径**（shortcut），把输入 x 直接送到后面',
        '这两层不再学整个目标 H(x)，只学差值 F(x) = H(x) − x，叫**残差**（residual）',
        '最后输出 F(x) + x：捷径带来的 x，加上两层学到的残差',
        { text: '要是原样照抄最好，只要把 F 推到 **0**，比让一叠层拼出恒等映射容易得多', hold: .8 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig2_block', 70, 190, 540, null, { card: true, alpha: g.p(0, .5) });
        g.note('图：论文 Figure 2', 628, 525);
        callout(g, F.box(.635, .03, .785, .84), 'shortcut 捷径', 650, 230, { color: COL.blue, k: g.p(L(0) + .6, .6) });
        // a dot runs along the shortcut, from x to the ⊕
        const u = g.p(L(0) + 1.6, 1.8, 'io');
        if (u > 0 && u < 1) { const [px, py] = bez(F.at(.45, .075), F.at(.86, .05), F.at(.84, .84), F.at(.48, .81), u); g.circle(px, py, 11, { fill: COL.blue }); }
        if (t > L(1) - .1) g.mark(F.box(.24, .15, .64, .68), { k: g.p(L(1) + .4, .6), lw: 4 });
        g.chip('F(x)：只学差值', 650, 330, { size: 28, align: 'left', alpha: g.p(L(1) + .9, .4) });
        if (t > L(2) - .1) g.mark(F.box(.02, .73, .52, .93), { k: g.p(L(2) + .3, .6), color: COL.green, lw: 4 });
        g.chip('F(x) + x', 650, 430, { size: 28, align: 'left', color: COL.green, alpha: g.p(L(2) + .8, .4) });

        // x + F = H, as bars (illustration)
        const s = 1 - g.p(L(3) + .8, 1.6, 'io');            // line 4: F shrinks to 0
        const fv = FV.map(v => v * s), hv = XV.map((v, i) => v + fv[i]);
        const B = 880, Z = 770;
        g.note('柱高为示意', 1040, 590, { alpha: g.p(L(0) + 1.8, .4) });
        barVec(g, 200, B, XV, COL.blue, { k: g.p(L(0) + 2, .8) });
        g.text('x', 200, 925, { size: 32, font: 'disp', color: COL.blue, alpha: g.p(L(0) + 2, .4) });
        if (t > L(1) - .1) {
          const ha = g.p(L(1) + .3, .5);
          const H = barVec(g, 880, B, hv, COL.green, { k: g.p(L(1) + .3, .8), alpha: ha });
          g.text('H(x) 想要的', 880, 925, { size: 30, color: COL.green, alpha: ha });
          // the part of H that x already gives — dashed outline
          XV.forEach((v, i) => { const [x, w] = H.bar(i); g.rect(x - 3, B - v * 220, w + 6, v * 220, { r: 5, stroke: COL.blue, lw: 3, dash: [6, 5], alpha: g.p(L(1) + 1.4, .4) }); });
          const fk = g.p(g.lerp(L(1), g.Le(1), .42), .8);   // 念到「只学差值 F(x)」时长出来
          barVec(g, 540, Z, fv, COL.acc, { k: fk, alpha: fk > 0 ? 1 : 0 });
          g.text('F(x) 残差', 540, 925, { size: 30, color: COL.acc, alpha: fk });
        }
        if (t > L(2) - .1) {
          const a = g.p(L(2) + .3, .4);
          g.text('+', 370, Z, { size: 60, weight: 800, font: 'disp', alpha: a });
          g.text('=', 710, Z, { size: 60, weight: 800, font: 'disp', alpha: a });
          g.rich([['y', COL.green], [' = ', COL.fg], ['F(x)', COL.acc], [' + ', COL.fg], ['x', COL.blue]], 540, 1010, { size: 48, font: 'disp', alpha: g.p(L(2) + 1.2, .5) });
          g.note('论文式 (1)', 1040, 1010, { alpha: g.p(L(2) + 1.2, .5) });
          // the sum, acted out: a copy of x slides into H, then F lands on top of it
          const mx = g.p(L(2) + 1.8, 1.2, 'io'), mf = g.p(L(2) + 3.2, 1.0, 'io');
          if (mx > 0 && mx < 1) barVec(g, g.lerp(200, 880, mx), B, XV, COL.blue, { alpha: .75 });
          if (mf > 0 && mf < 1) XV.forEach((v, i) => { const x0 = g.lerp(540, 880, mf) - 86 + i * 46, y0 = g.lerp(Z, B - v * 220, mf);
            g.rect(x0, fv[i] > 0 ? y0 - fv[i] * 220 : y0, 34, Math.abs(fv[i]) * 220, { r: 5, fill: COL.acc, alpha: .9 }); });
        }
        if (t > L(3) - .1) g.chip('F → 0：输出 = x，就是照抄', 540, 1110, { size: 32, color: COL.green, alpha: g.p(L(3) + 2.6, .5) });
      },
    },
    {
      id: 'free', name: '接进整张网络：捷径不加参数',
      lines: [
        '每两层 3×3 卷积旁边接一条这样的捷径，普通网络就变成了**残差网络**',
        '捷径只做一次逐元素相加，**不增加任何参数**，计算量也几乎不变',
        '所以 34 层 plain 和 34 层 ResNet 计算量一样，都是 **3.6 billion FLOPs**',
        { text: '通道数翻倍的地方用虚线捷径：补零，或用 1×1 卷积把维度对齐', hold: .6 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig3_arch', 70, 180, 545, null, { card: true, alpha: g.p(0, .5) });
        g.note('图：论文 Figure 3 上半段', 1040, 1130);
        g.note('左 plain · 右 residual', 1040, 1160);
        g.mark(F.box(0, .0, .335, 1), { k: g.p(L(0) + .3, .8), color: COL.sub, lw: 4, alpha: 1 - .6 * g.p(L(0) + 1.6, .5) });
        const ys = [.388, .480, .574, .667, .762, .856, .949, 1.0];
        for (let i = 0; i < 7; i++) {
          const top = ys[i] + .004, bot = Math.min(.996, ys[i + 1] - .004);
          g.mark(F.box(.465, top, .955, bot), { k: g.p(L(0) + 1.6 + i * .35, .45), lw: 4 });
        }
        g.chip('每 2 层一条捷径', 660, 300, { size: 30, align: 'left', alpha: g.p(L(0) + 2.4, .4) });
        // line 2: ⊕ costs nothing
        if (t > L(1) - .1) {
          const a = g.p(L(1) + .3, .4);
          g.circle(710, 450, 40, { stroke: COL.blue, lw: 5, fill: g.rgba(COL.blue, .15), alpha: a });
          g.line(688, 450, 732, 450, { color: COL.blue, lw: 5, alpha: a }); g.line(710, 428, 710, 472, { color: COL.blue, lw: 5, alpha: a });
          g.text('参数 **+0**', 775, 450, { size: 48, align: 'left', alpha: g.p(L(1) + 1, .4) });
          // a signal rides the shortcuts down the residual column
          const u = g.p(L(1) + .6, 4.2, 'lin') * 7;
          if (u > 0 && u < 7) { const i = Math.floor(u), y0 = ys[i], y1 = ys[i + 1];
            const [px, py] = bez(F.at(.535, y0), F.at(.97, y0), F.at(.97, y1), F.at(.535, y1), u - i);
            g.circle(px, py, 12, { fill: COL.blue }); }
        }
        // line 3: same FLOPs
        if (t > L(2) - .1) {
          const a = g.p(L(2) + .3, .4), b = g.p(L(2) + 1.3, .4);
          g.text('FLOPs（乘加次数）', 660, 600, { size: 26, align: 'left', color: COL.dim, alpha: a });
          g.text('plain-34', 660, 660, { size: 30, align: 'left', font: 'disp', color: COL.sub, alpha: a });
          g.text('3.6 billion', 1040, 660, { size: 30, align: 'right', font: 'disp', color: COL.sub, alpha: a });
          g.rect(660, 688, 380 * g.p(L(2) + .5, .8), 14, { r: 7, fill: COL.sub, alpha: a });
          g.text('ResNet-34', 660, 745, { size: 30, align: 'left', font: 'disp', color: COL.acc, alpha: b });
          g.text('3.6 billion', 1040, 745, { size: 30, align: 'right', font: 'disp', color: COL.acc, alpha: b });
          g.rect(660, 773, 380 * g.p(L(2) + 1.5, .8), 14, { r: 7, fill: COL.acc, alpha: b });
          g.chip('一样多', 850, 835, { size: 30, solid: true, alpha: g.p(L(2) + 2.6, .4) });
        }
        // line 4: the dotted shortcut where channels double
        if (t > L(3) - .1) {
          callout(g, F.box(.465, .667, .97, .762), '虚线：通道翻倍处', 660, 940, { color: COL.blue, k: g.p(L(3) + .3, .7) });
          g.text('补零（A）或 1×1 卷积（B）', 660, 1000, { size: 26, align: 'left', color: COL.sub, alpha: g.p(L(3) + 1.6, .4) });
        }
      },
    },
    {
      id: 'imagenet', name: '实验：加了捷径，越深越好',
      lines: [
        'ImageNet 上比 18 层和 34 层：没有捷径的 plain 网络，34 层误差更高',
        '加上捷径，情况**反过来**：ResNet-34 的误差比 ResNet-18 更低',
        'Top-1 错误率：plain-34 是 28.54%，ResNet-34 降到 **25.03%**',
        { text: '18 层时两者几乎一样，到 34 层差出 **3.5** 个点：越深越需要捷径', hold: .6 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const F = g.img('fig4_imagenet', 60, 200, 960, null, { card: true, alpha: g.p(0, .5) });
        g.note('图：论文 Figure 4（粗线 = 验证误差，细线 = 训练误差）', 1020, 160);
        g.mark(F.box(.035, .02, .475, .96), { k: g.p(L(0) + .4, .6), color: COL.sub, lw: 4 });
        g.mark(F.box(.385, .52, .475, .70), { k: g.p(L(0) + 2.0, .5), color: COL.red, lw: 4 });
        g.chip('plain：34 层更高', 290, 600, { size: 30, color: COL.red, alpha: g.p(L(0) + 2.4, .4) });
        if (t > L(1) - .1) {
          g.mark(F.box(.555, .02, .99, .96), { k: g.p(L(1) + .3, .6), lw: 4 });
          g.mark(F.box(.895, .57, .99, .88), { k: g.p(L(1) + 1.6, .5), color: COL.green, lw: 4 });
          g.chip('ResNet：34 层更低', 790, 600, { size: 30, color: COL.green, alpha: g.p(L(1) + 2.0, .4) });
        }
        if (t > L(2) - .1) {
          const a = g.p(L(2), .4);
          const items = [
            { label: 'plain-18', value: 27.94, color: COL.faint }, { label: 'ResNet-18', value: 27.88, color: COL.acc2 },
            { label: 'plain-34', value: 28.54, color: COL.faint }, { label: 'ResNet-34', value: 25.03, hi: true },
          ];
          const R = g.bars(60, 740, 960, items, { title: 'ImageNet top-1 错误率 % ↓ 越低越好', min: 24, max: 29, k: g.p(L(2) + .2, 1.4), labelW: 260, alpha: a });
          // 念到「plain-34 是 28.54%」「ResNet-34 降到 25.03%」时依次圈出
          g.mark(40, R[2].y - 6, 1000, R[2].h + 12, { k: g.p(g.lerp(L(2), g.Le(2), .3), .5), color: COL.sub, lw: 4, fill: .12, alpha: g.win(L(2), L(3), .3, .3) });
          g.mark(40, R[3].y - 6, 1000, R[3].h + 12, { k: g.p(g.lerp(L(2), g.Le(2), .62), .5), lw: 4, fill: .12, alpha: g.win(L(2), L(3), .3, .3) });
          g.note('横轴从 24 起 · 数据：论文 Table 2', 1020, 1022, { alpha: a });
          if (t > L(3) - .1) {
            g.mark(40, R[0].y - 8, 1000, R[1].y + R[1].h - R[0].y + 16, { k: g.p(L(3) + .3, .6), color: COL.sub, lw: 3 });
            g.mark(40, R[2].y - 8, 1000, R[3].y + R[3].h - R[2].y + 16, { k: g.p(L(3) + 2.2, .6), lw: 4 });
            g.chip('18 层：差 0.06', 290, 1100, { size: 32, color: COL.sub, alpha: g.p(L(3) + .8, .4) });
            g.chip('34 层：差 **3.51**', 790, 1100, { size: 32, alpha: g.p(L(3) + 2.7, .4) });
          }
        }
      },
    },
    {
      id: 'deeper', name: '继续加深：50、101、152 层',
      lines: [
        '再往深走，论文把两层的块换成 1×1、3×3、1×1 三层的**瓶颈块**，更省计算',
        '50、101、152 层：层数越多，错误率越低，没有再出现退化',
        { text: '152 层是 VGG 的 **8 倍**深，计算量 11.3 billion FLOPs，还比 VGG-19 少', hold: .8 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        // line 1: the bottleneck block (fades out for line 3)
        const ca = g.p(0, .5) * (1 - g.p(L(2), .5));
        if (ca > 0) {
          const F = g.img('fig5_bottleneck', 80, 190, 440, null, { card: true, alpha: ca });
          g.note('图：论文 Figure 5（右）', 538, 585, { alpha: ca });
          const one = (box, s, y, k, c) => { if (k > 0) { g.mark(F.box(...box), { k, color: c, lw: 4, alpha: ca }); g.line(F.x + box[2] * F.w + 4, F.y + (box[1] + box[3]) / 2 * F.h, 556, y, { color: c, lw: 2, dash: [5, 6], k: g.clamp((k - .4) * 2), alpha: .8 * ca }); g.chip(s, 560, y, { size: 28, color: c, align: 'left', alpha: g.clamp((k - .5) * 2) * ca }); } };
          one([.15, .25, .63, .355], '1×1：256 → 64，先降维', 290, g.p(L(0) + .8, .6), COL.acc);
          one([.15, .425, .63, .53], '3×3：只在 64 维上算', 357, g.p(L(0) + 2.4, .6), COL.yellow);
          one([.15, .60, .63, .705], '1×1：64 → 256，再还原', 424, g.p(L(0) + 3.8, .6), COL.acc);
        }
        // line 2: Table 3
        let R = null;
        if (t > L(1) - .1) {
          const a = g.p(L(1), .4);
          const items = [
            { label: 'VGG-16', value: 28.07, color: COL.faint }, { label: 'plain-34', value: 28.54, color: COL.faint },
            { label: 'ResNet-34 B', value: 24.52, color: COL.acc2 }, { label: 'ResNet-50', value: 22.85, color: COL.acc2 },
            { label: 'ResNet-101', value: 21.75, color: COL.acc2 }, { label: 'ResNet-152', value: 21.43, hi: true },
          ];
          R = g.bars(60, 690, 960, items, { title: 'ImageNet top-1 错误率 % ↓ 越低越好', min: 20, max: 29, k: g.p(L(1) + .2, 2), labelW: 270, h: 44, gap: 14, alpha: a });
          g.note('横轴从 20 起 · 数据：论文 Table 3', 1020, 1062, { alpha: a });
        }
        // line 3: 19 vs 152 layers, and FLOPs
        if (t > L(2) - .1) {
          const a = g.p(L(2) + .3, .5);
          g.text('VGG-19 · 19 层', 80, 215, { size: 28, align: 'left', color: COL.sub, alpha: a });
          layerRow(g, 19, 80, 240, { w: 4, gap: 2, h: 50, color: COL.sub, k: g.p(L(2) + .3, .5), alpha: a });
          g.text('19.6 billion FLOPs', 214, 265, { size: 28, align: 'left', font: 'disp', color: COL.sub, alpha: g.p(L(2) + .8, .4) });
          g.text('ResNet-152 · 152 层', 80, 335, { size: 28, align: 'left', color: COL.acc, alpha: g.p(L(2) + 1, .4) });
          layerRow(g, 152, 80, 360, { w: 4, gap: 2, h: 50, color: COL.acc, k: g.p(L(2) + 1, 1.8, 'io') });
          g.text('11.3 billion FLOPs', 80, 450, { size: 28, align: 'left', font: 'disp', color: COL.acc, alpha: g.p(L(2) + 3, .4) });
          g.chip('深 8 倍，计算量反而更少', 700, 450, { size: 30, solid: true, alpha: g.p(L(2) + 4, .4) });
          g.note('数据：论文 3.3 节、Table 1', 1020, 515, { alpha: g.p(L(2) + 3, .4) });
          if (R) g.mark(50, R[5].y - 6, 980, R[5].h + 12, { k: g.p(L(2) + 1.5, .6), lw: 4 });
        }
      },
    },
    {
      id: 'result', name: '结果：ImageNet 第一，换任务也好用',
      lines: [
        '几个不同深度的 ResNet 集成，ImageNet 测试集 top-5 错误率 **3.57%**，拿下 ILSVRC 2015 第一',
        '目标检测只把 VGG-16 换成 ResNet-101，COCO mAP 从 21.2 升到 **27.2**，相对提升 28%',
        { text: '在 CIFAR-10 上，论文还训通了 **1202 层**的网络，训练误差低于 0.1%', hold: .8 },
      ],
      draw(g) {
        const { t, L, COL } = g;
        const t5 = [
          { label: "VGG (ILSVRC'14)", value: 7.32 }, { label: "GoogLeNet (ILSVRC'14)", value: 6.66 }, { label: 'PReLU-net', value: 4.94 },
          { label: 'BN-inception', value: 4.82 }, { label: "ResNet (ILSVRC'15)", value: 3.57, hi: true },
        ];
        const A = g.bars(60, 270, 960, t5, { title: 'ImageNet 测试集 top-5 错误率 %（集成）↓', min: 0, max: 8, k: g.p(.3, 1.8), labelW: 350, h: 46, gap: 14, labelSize: 26 });
        g.mark(50, A[4].y - 6, 980, A[4].h + 12, { k: g.p(L(0) + 2.6, .6), lw: 4 });
        g.chip('ILSVRC 2015 第 1 名', 780, 610, { size: 30, solid: true, alpha: g.p(L(0) + 3.4, .4) });
        g.note('数据：论文 Table 5', 1020, 660, { alpha: g.p(.5, .4) });
        if (t > L(1) - .1) {
          const a = g.p(L(1), .4);
          const coco = [{ label: 'VGG-16', value: 21.2, color: COL.faint }, { label: 'ResNet-101', value: 27.2, hi: true }];
          const C = g.bars(60, 790, 960, coco, { title: 'COCO 检测 mAP@[.5, .95] % ↑ 越高越好', min: 0, max: 30, k: g.p(L(1) + .3, 1.4), labelW: 350, alpha: a });
          g.mark(50, C[1].y - 6, 980, C[1].h + 12, { k: g.p(g.lerp(L(1), g.Le(1), .55), .6), lw: 4, alpha: a });
          g.chip('+6.0，相对提升 28%', 540, 948, { size: 30, color: COL.acc, alpha: g.p(g.lerp(L(1), g.Le(1), .78), .4) });
          g.note('数据：论文 Table 8（Faster R-CNN）', 1020, 992, { alpha: a });
        }
        if (t > L(2) - .1) {
          const a = g.p(L(2) + .2, .4);
          g.text('**1202** 层 · CIFAR-10', 60, 1035, { size: 28, align: 'left', alpha: a });
          layerRow(g, 1202, 60, 1060, { w: .8, gap: 0, h: 46, color: COL.acc, k: g.p(L(2) + .4, 2.4, 'io') });
          g.chip('训练误差 < 0.1%', 1020, 1140, { size: 28, color: COL.green, align: 'right', alpha: g.p(L(2) + 3, .4) });
        }
      },
    },
  ],
});
