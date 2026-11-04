# film.js 接口

film.js 只做一件事：调用一次 `PM.film({...})`。

```js
PM.film({
  paper: { title: 'Attention Is All You Need', byline: 'Vaswani 等 · Google · NIPS 2017', arxiv: '1706.03762' },
  brand: '你的名字',                                           // 可选：每帧右上角和默认片头的品牌字，不写就是「VividPaper」；片尾的工具署名不变（见下文「署名」）
  layout: 'portrait',                                         // 可选：9:16 竖屏视频版式（1080×1920），不写就是 3:4 网页版式；见下文「画布」
  question: '翻译模型能不能**完全不用 RNN**，只靠注意力？',   // 片头的主线问题，**…** 是强调色
  opening: { source: 'Google NIPS 2017', badges: ['Google', 'NIPS 2017'], why: '…', points: ['…', '…'], hero(g, box) { /* … */ } },
                                                              // 推荐：片头模板（见下文「片头模板」）；写了它就不用写 intro / introDraw
  intro: '今天我们来讲 Google 的 Transformer……',               // 可选：片头念的开场白（原样念），替换默认的「这篇论文回答一个问题：」+ question；
                                                              //   分几段念就写成数组，每段是字符串或 { text, say }
  introDraw(g) { /* … */ },                                   // 可选：片头主图（见下文「片头主图」）
  recap: [{ text: '…', draw(g, box, u) { /* … */ } }, '…'],   // 片尾「最后回顾」，3–4 条；推荐每条带 draw 配一个小动效（见下文「回顾小动效」），
                                                              //   这时每条 ≤ 12 字；纯文字条目 ≤ 25 字
  ending: '……',                                               // 可选：回顾之后念的一句收尾（字符串或 { text, say }），念到时片尾署名出现
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

片头（3.6 秒）、片尾回顾和工具署名、每幕的淡入淡出、左上角章节号、右上角品牌字（`brand`，默认「VividPaper」）、底部字幕，引擎都会自动画，film.js 不用管。

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

## 片头模板（opening，推荐）

新片默认用这个片头。它分三句念完，前后大约 15 秒：

1. 先念 `question`，画面上的大标题一字不差就是这句。
2. 再念「今天解读<source>的论文 <paper.title>」。念这句时，`badges` 逐个弹出，最后一个用实心强调色。
3. 最后念 `why`，讲这篇为什么值得读。念这句时，`points` 逐个弹出。

**第 0 秒就开口、出字幕、画面在动**：片头配音从第 0 秒开始念，字幕同时出。第 0 帧就是最终版式，不再先放大标题再缩：顶上一行小字方法名和作者行，下面是问题大标题，再下面是 `hero` 主图。问题大标题先是灰的，跟着念到哪个字就点亮到哪个字。

```js
paper: { title: 'PromptEnhancer', byline: 'Linqing Wang 等 16 位作者 · 腾讯混元 · CVPR 2026', arxiv: '2509.04545' },
question: '不动生图模型，只训一个**改提示词**的模型，能让图画得更准吗？',
opening: {
  source: '腾讯混元 CVPR 2026',                      // 第 2 句：今天解读腾讯混元 CVPR 2026 的论文 PromptEnhancer
  badges: ['腾讯混元', 'CVPR 2026'],                  // 第 2 句时弹出；不写就是 [source]
  why: '生图模型一个参数不改，整体准确率涨了 **5.1** 个点；混元生图 2.1 自带的改写模型就是它',   // 第 3 句：为什么值得读
  points: ['生图模型参数不改', '整体准确率 **+5.1**', '混元生图 2.1 自带'],   // 第 3 句时依次弹出，2–4 个、每个 ≤ 10 字
  hero(g, box) {                                     // 封面主图，画在 box = {x, y, w, h} 里
    // 用 box.x / box.y 写坐标。第 0 秒就要开始动，比如 g.p(0, .4) 时打 ✗、g.p(.5, .4) 时打 ✓，或者线从第 0 秒开始画
    // 换版式、整体淡入不算动；自查会比较主图第 0 秒和第 0.6 秒，没变化就报「开场不动」
  },
},
```

- `paper.title` 写方法名或简称。arXiv 全名太长，放在顶部会占好几行，全名放在 `story.md` 里。
- `why` 要写具体的东西：效果涨了多少、已经用在哪个产品里、开源了什么。不写「很重要」「很强」这种空话。数字要能在原文里找到。
- `hero` 优先用论文自己的对比图，比如同一输入下用和不用这个方法的两张结果。在 `hero` 里，`g.L(i)` / `g.Le(i)` 是第 i 句开场白的起止时刻。
- 想换说法时自己写 `intro`，但要按「问题 → 出处 → 理由」的顺序写三段，`badges` 和 `points` 会按第 2、3 段出现。

## 片头主图

默认片头只有标题、作者和主线问题。写了 `introDraw(g)`，片头就换成「标题 + 主图」：标题第一帧是大字，0.45–1.25 秒缩成顶部一行小字，其余画面都交给 `introDraw` 画（例如这篇论文的核心结构图，一边念开场白一边动）。片头不再画问题和口号，问题靠开场白念出来、出在字幕里。

- 在 `introDraw` 里，`g.L(i)` / `g.Le(i)` 是开场白第 i 段的起止时刻（`intro` 写成数组时一段一项；没写 `intro` 就只有默认那一段）。
- `g.p(.45, .8, 'io')` 和标题缩小用的是同一条曲线，主图可以跟着标题一起上移。
- 不配音时每段按字数估时长，开场白照样出字幕。

## 回顾小动效（recap 条目的 draw，推荐）

片尾「最后回顾」的每一条都可以写成 `{ text, say?, draw(g, box, u) }`，右边就会多一个小框，里面画那一幕机制的简化版，让观众一眼想起是哪一段。字符串和 `{ text, say }` 写法照旧可用，可以和带 draw 的条目混写；一条 draw 都没有时，回顾和原来完全一样。

- 小框由引擎来画：每条右边一个圆角框，3:4 版式是 x 690、320×124，竖版收进安全区，是 300×124。框纵向以这一条为中心，panel 底色加 faint 描边，跟着这条一起淡入。draw 里画的东西也跟着淡入，不用自己乘透明度。
- 带 draw 的条目，文字换行宽度会收窄到框的左边。按一行写，大约 12 个汉字；放不下就折成两行，最多两行。
- `box = {x, y, w, h}` 是框的位置。坐标都用 `box.x + …`、`box.w` 这样的相对写法，两种版式就都能用。画的东西不要伸出框。
- `u(delay = 0, len = .5, ease = 'out')` 是从这一条出现那一刻算起的进度（0 到 1），用法同 `g.p`。例如 `u(.3, .6)` 表示这条出现 0.3 秒后开始，0.6 秒走完。
- `g` 和 `draw(g)` 里的一样，画图函数都能用；`g.t` 是回顾这一幕里的秒数。框里的东西照常参加自查：出界、字太小、文字重叠。

```js
recap: [
  { text: 'RNN 逐词传：**慢**、传不远', draw(g, b, u) {          // 第 1 幕的记忆链：一格一格亮下去
      const n = 7, x = j => b.x + 34 + j * (b.w - 68) / (n - 1), run = u(.2, 1.6, 'lin') * (n - 1);
      for (let j = 0; j < n; j++) g.circle(x(j), b.y + 50, 11, { stroke: run >= j ? g.COL.acc : g.COL.faint, lw: 3 });
      g.text('一步一步传', b.x + b.w / 2, b.y + 96, { size: 24, color: g.COL.dim, alpha: u(.4, .4) });
  } },
  '纯文字的条目照旧可用',
],
```

完整写法见 `example-attention.js` 末尾的 `recapRnn / recapSelf / recapQkv / recapArch`。画什么、怎么画，看 craft.md 第 7 条。

## 署名（brand）

- **片尾的工具署名每部片子都有，没有开关**：分隔线下一行小字「本视频由开源工具 VividPaper 生成」，下面一个徽章，左段灰底「★ Star」、右段橙底「ManagerZhang10/vividpaper」。播放器页脚也带这个仓库的链接，页面标题写 VividPaper。film.js 不要另画东西盖住它。
- **右上角品牌字由 `brand` 决定**：每一帧右上角（含片头模板和 `introDraw` 片头）、默认片头左上的品牌字、播放器右上角都显示它，不写就是「VividPaper」。要署自己的名字就写 `brand: '你的名字'`，页脚会写成「你的名字 · VividPaper · ★ github.com/ManagerZhang10/vividpaper」。
- `brand` 写短一点，8 个字以内。太长时左上角的章节名会自动缩小让位，缩到太小自查会报「字太小」。写空字符串或不是文字会直接报错。

## 导出接口（给转视频之类的外部工具用）

- 打开成片时带 `?capture`：只加载、画第 0 秒，不起播放器、不解码配音；`document.title` 变成 `READY` 就可以开始截。
- `PM.render(t)`：把第 t 秒画到 `<canvas id="pm">`（`PM.W × PM.H`：3:4 是 1080×1440，`layout: 'portrait'` 是 1080×1920）。
- `window.PM_TRACK`（音频 data URL）：设了它，播放器就放这一条预先混好的音轨（比如配音 + 配乐），不再自己拼配音。外部工具把它写进页面，网页里就能听到和成片一样的声音。
- `PM.timeline()`：时间轴。`scenes[i].t0 / dur`（秒）、`scenes[i].lines[j].text / t0 / t1`（字幕，相对本幕起点）；`voice[k].t`（这段配音在全片的起点）、`voice[k].say`、`voice[k].clip`（`src` 音频 data URL、`end` 念完的时刻）。
- 版面约定：每一幕（含片头片尾）y ≤ `ZONE.bottom`（3:4 是 1190，竖版是 1310）是画面（章节标题、署名、内容），再往下只放字幕。所以外部工具可以只取上面这部分，自己按别的尺寸重排字幕。

## 画布

1080 × 1440。内容放在 **y 130–1190**；y > 1190 是字幕区，字幕在播时不要放东西。左右各留 20 以上。

`layout: 'portrait'`（做竖屏短视频用）：1080 × 1920，看得见的东西都在短视频平台的安全区 **x 80–1000、y 250–1480** 里，四周留给播放器的按钮和文案。章节标题和右上角署名在 y 300 一行，内容放在 **y 350–1310**，字幕在 1310 以下。自查按这个安全区查出界。竖版不是把 3:4 缩小，要按这个尺寸重新排 draw(g)：坐标写成 `g.W`、`g.ZONE.top` 这样的相对写法，两种版式都能用。

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
