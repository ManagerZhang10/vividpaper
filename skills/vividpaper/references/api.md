# film.js 接口

film.js 只做一件事：调用一次 `PM.film({...})`。

```js
PM.film({
  paper: { title: 'Attention Is All You Need', byline: 'Vaswani 等 · Google · NIPS 2017', arxiv: '1706.03762' },
  tool: false,                                                // 可选：不显示「VividPaper」字样（本地自用的片子），「张指导出品」照旧
  question: '翻译模型能不能**完全不用 RNN**，只靠注意力？',   // 片头的主线问题，**…** 是强调色
  intro: '今天我们来讲 Google 的 Transformer……',               // 可选：片头念的整段开场白（原样念），替换默认的「这篇论文回答一个问题：」+ question
  recap: ['…', '…', '…'],                                     // 片尾「最后回顾」，3–4 条，每条 ≤ 25 字
  pronounce: { 'RoFormer': 'Roformer', '−': '减' },            // 可选，配音时的统一念法替换（见下文「配音」）
  scenes: [
    {
      id: 'rnn',                       // 英文短名，报错和自查里用
      name: '老办法：RNN 只能一个词一个词地传',   // 章节名 = 画面左上角标题，说清这一幕要回答什么
      lines: ['字幕第 1 句', '字幕第 2 句', { text: '想停久一点的句子', hold: 1.5 }, { text: 'θ_i = 10000^(−2i/d)', say: '第 i 组的 θ，是一万的负 2i 除以 d 次方' }],
      draw(g) { /* 画这一幕，g.t 是本幕内的秒数 */ },
    },
  ],
});
```

片头（3.6 秒）、片尾回顾、每幕的淡入淡出、左上角章节号、右上角「张指导出品」、底部字幕，引擎都会自动画，film.js 不用管。

## 时间

- 每句字幕的时长按字数自动算（约 0.17 秒/汉字、0.3 秒/英文词，最短 2.4 秒）。`hold` 加时，`dur` 直接指定。
- 一幕从第 0.5 秒开始出第一句字幕；最后一句之后留 0.8 秒（`tail` 可改）。
- **配了音**（`voice/` 存在）时，每句的时长 = 念完的时间 + 0.4 秒（再加 `hold`），不再按字数估；片头问题和片尾回顾也按念完的时间排。
- `g.L(i)`：第 i 句字幕开始的时刻；`g.Le(i)`：结束的时刻。**动作都挂在字幕上**，例如 `g.p(L(2) + .5, .6)`，这样字幕改了长度，动作会跟着走。
- `g.p(a, d = .5, ease = 'out')`：从 a 秒开始、用 d 秒，从 0 走到 1。缓动有 `lin out in io back`。
- `g.win(a, b, fi, fo)`：a 到 b 之间显示，两头淡入淡出，返回 0–1。
- `g.t` 本幕内的秒数，`g.dur` 本幕总长，`g.lerp g.clamp g.rgba(hex, a)`。

draw(g) 必须是 t 的纯函数：不用 `Date.now()`、`Math.random()`（要随机用固定种子），不存跨帧状态。

## 配音

`scripts/voice.py` 念的是：片头「这篇论文回答一个问题：」+ `question`、每句字幕、片尾先念「我们最后回顾一下」，再念 `recap` 每一条。默认念字幕去掉 `**` 后的原文，并自动把公式写法改成能念的：`x_t` → x t、`x₁` → x 1、`N²` → N 平方、两项之间的 `−` → 减、`→` → 停顿。

- `say`：这一句实际念的话，原样念，不做替换。公式、符号多的句子写它，字幕照旧显示 `text`。`question` 和 `recap` 的条目也可以写成 `{ text, say }`。
- `pronounce`：整部片统一的念法替换，`{ 原文: 念法 }`，对所有没写 `say` 的句子生效。常用：`'−': '减'`（否则 m − n 会念成「m 负 n」）、逐字母念的英文名换成读得顺的写法。
- 改了 `text`、`say` 或 `pronounce` 后重跑 voice.py：只重新合成变了的句子。没重跑就 build，check 会报「配音」。
- 动作要等「念到」再出：`g.lerp(g.L(i), g.Le(i), .6)` 是第 i 句念到六成的时刻，配不配音都对得上。
- 片头的开场白、片尾的「我们最后回顾一下」和每条回顾，配了音就自动出字幕：长的按标点切成 28 字以内的几段，按字数分时间。

## 导出接口（给转视频之类的外部工具用）

- 打开成片时带 `?capture`：只加载、画第 0 秒，不起播放器、不解码配音；`document.title` 变成 `READY` 就可以开始截。
- `PM.render(t)`：把第 t 秒画到 `<canvas id="pm">`（1080×1440）。
- `PM.timeline()`：时间轴。`scenes[i].t0 / dur`（秒）、`scenes[i].lines[j].text / t0 / t1`（字幕，相对本幕起点）；`voice[k].t`（这段配音在全片的起点）、`voice[k].say`、`voice[k].clip`（`src` 音频 data URL、`end` 念完的时刻）。
- 版面约定：每一幕（含片头片尾）y ≤ 1190 是画面（章节标题、署名、内容），y > 1190 只放字幕。所以外部工具可以只取上面 1190 行，自己按别的尺寸重排字幕。

## 画布

1080 × 1440。内容放在 **y 130–1190**；y > 1190 是字幕区，字幕在播时不要放东西。左右各留 20 以上。

颜色 `g.COL`：`bg panel fg sub dim faint line acc(赭橙，强调) acc2 blue green yellow purple red white`。

## 画图函数（坐标都是画布绝对坐标）

| 函数 | 用途 | 参数 |
| --- | --- | --- |
| `g.text(s, x, y, o)` | 文字，`**词**` 自动变强调色；返回 `{x, y, w, h}` | `size weight color hl align('center'/'left'/'right') font('cn'/'disp'/'mono') alpha maxW` |
| `g.rich(parts, x, y, o)` | 多色一行，`parts=[[文字, 颜色], …]`，写公式用 | 同上 |
| `g.rect(x, y, w, h, o)` | 圆角矩形 | `fill stroke lw r dash alpha` |
| `g.circle(x, y, r, o)` | 圆 | `fill stroke lw alpha` |
| `g.poly(points, o)` | 多边形，`points=[[x, y], …]` | `fill stroke lw close alpha` |
| `g.line / g.arrow(x1, y1, x2, y2, o)` | 直线 / 箭头，`k` 控制画出多少（0–1） | `color lw k dash head alpha` |
| `g.curve(x1, y1, x2, y2, o)` | 弯曲连线 | `bend`（侧向弯曲像素，可负）+ 同上 |
| `g.path(points, o)` | 折线 | 同上 |
| `g.along(points, u)` | 折线上走了 u（0–1）那一点的坐标，让一个点沿路径走 | |
| `g.img(name, x, y, w, h?, o)` | figures/ 里的图（文件名，不带扩展名）；h 省略按比例 | `card`（白底卡片，**论文原图都加**；照片不加）`pad cardColor crop:[x0,y0,x1,y1] alpha radius`（圆角）`smooth:false`（像素格不模糊）`tint:{color, alpha}`（叠色） |
| 　返回值 `F` | `F.x F.y F.w F.h`；`F.box(fx0, fy0, fx1, fy1)` 把图内 0–1 坐标换成画布矩形；`F.at(fx, fy)` 换成点。坐标从 `_grid/<名字>.png` 读 | |
| `g.mark(rect或x,y,w,h, o)` | 会自己画出来的高亮框 + 标签 | `k color lw r fill alpha label labelSize side('right'/'left'/'top'/'bottom'/'inside') dx dy leader:[x, y]` |
| 　`leader` | 标签放到 `[x, y]`（图外的空地），虚线引回框；标签会盖住原图内容时用它 | |
| `g.chip(s, x, y, o)` | 胶囊标签；返回矩形。**默认以 x 居中**，贴在图右边要写 `align:'left'` | `size color solid align alpha` |
| `g.note(s, x, y, o)` | 小字出处，默认右对齐，如「图：论文 Figure 1」 | `size color align alpha` |
| `g.tokens(words, cx, y, o)` | 一排词块，返回每个词的矩形（`cx cy top bottom`）方便连线 | `size font padX h gap maxW breaks:[换行处下标] rowGap draw:false style(i)→{alpha fill stroke color lw dx dy}` |
| `g.vec(x, y, vals, o)` | 向量：一排小格，值 0–1 决定亮度 | `cell gap color dir('h'/'v') k alpha` |
| `g.heat(x, y, M, o)` | 矩阵热图，返回 `cell(i,j)` 中心点 | `cell gap color rows cols labelSize rotateCols mask(i,j) hi:[[i,j]] hiColor text(i,j)`（格内数字）`textSize k alpha` |
| `g.bars(x, y, w, items, o)` | 横向条形图，items `{label, value, text?, hi?, color?, alpha?}`，返回每根条的矩形。数值默认 `String(value)`（23.0 会显示成 23），要固定小数位就传 `text` | `title min max log k labelW valueW labelSize h gap alpha` |
| `g.wave(x, y, w, h, fn, o)` | 画函数曲线 `fn(u)`，u∈0–1，返回 -1–1 | `color lw k` |
| `g.image(name)` | 取已加载好的 Image 对象（读像素、自己处理时用） | |
| `g.cache(key, w, h, fn)` | 离屏 canvas，`fn(ctx, canvas)` 只在第一次调用时执行；用来预先算好加噪图、像素格这类重活。key 只能依赖固定参数，不能依赖 t | |
| `g.ctx` | 原生 CanvasRenderingContext2D，上面不够用时直接画 | |

直接用 `g.ctx` 画时：先 `save()` 后 `restore()`；改透明度要写 `ctx.globalAlpha *= a`（乘，不要赋值），否则幕间淡入淡出会失效；自查只检查通过上面函数画的东西。

同一个东西在多幕里出现，写一个布局函数放在 film.js 顶部复用（例如 `sentence(g, y, style)`），保证位置和样式一致。
