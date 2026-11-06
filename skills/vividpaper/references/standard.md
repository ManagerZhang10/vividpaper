# 标准版：合同和接口

标准版的画面用 [HyperFrames](https://github.com/heygen-com/hyperframes)（HTML / CSS / SVG + GSAP）来画。**怎么画，看 HyperFrames 自带的 skill**：`$PM/node_modules/hyperframes/dist/skills/hyperframes/SKILL.md` 和它的 `references/`（讲解片先读 `references/types/explainer.md`）。装的是锁定的 0.9.19，文档和 CLI 版本一致。

VividPaper 只管「合同」：播放器、字幕、右上角品牌、片尾署名和徽章、配音配乐对时、竖屏安全区、可选的片头和回顾模板、论文原图的出处。这份文件只写这些约定和接口，不写画面口味；Flash 版的 `craft.md` 里讲内容的几节（主线、真图真数、术语、时长）照样适用，讲 `g.*` 画法的部分不要搬过来。

## 1. 片子目录

```text
<短名>/
├── film.json                 论文信息、版式、每一幕的字幕（唯一的时间表来源）
├── compositions/<id>.html    每一幕一个 HyperFrames 子合成，id 和 film.json 一致
├── assets/
│   ├── figures/              论文原图（crop.py -o <短名>/assets/figures/<名字>.png）
│   ├── film-lib.js           可选：每一幕都能用的公共函数（先于各幕加载）
│   ├── film.css              可选：公共样式
│   └── fonts/                可选：别的字体文件（要自己写 @font-face）
├── voice/                    voice.py 生成
└── source/                   fetch_paper.py 生成
```

`index.html` 和 `assets/vp/` 是 build.py 每次重写的（时间表、播放器用的字体子集、GSAP、字幕层），不要手改。`build.py` 看到 `film.json` 就走标准版，看到 `film.js` 就走 Flash 版，两个都有会报错。

## 2. film.json

```json
{
  "paper": { "title": "Transformer", "full": "Attention Is All You Need", "byline": "Vaswani 等 · Google · NeurIPS 2017", "arxiv": "1706.03762" },
  "brand": "可选：右上角的署名，默认 VividPaper",
  "layout": "可选：不写 = 3:4；portrait = 9:16；landscape = 16:9",
  "theme": "可选：dark（默认）或 light",
  "pronounce": { "d_k": "d k" },
  "scenes": [
    { "id": "opening", "name": "片头", "chapter": false, "lead": 0, "badges": ["Google", "NeurIPS 2017"], "points": ["BLEU 28.4"],
      "lines": ["问题", "今天解读……", "为什么值得读"] },
    { "id": "rnn", "name": "老办法：RNN 一个词一个词地算", "lines": ["第一句", { "text": "第二句", "say": "念法" }] }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `paper.title` | 方法名，进页面标题；`full`、`byline` 给片头模板用 |
| `brand` | 每帧右上角和播放器右上角的署名；片尾的工具署名不受它影响，也去不掉 |
| `layout` | 见下表；场景里用 `VP.layout` 读尺寸，同一套场景三种版式都能出 |
| `theme` / `background` | 字幕层的深浅配色；`background` 可直接写颜色 |
| `pronounce` | 配音时统一替换的念法（同 Flash 版） |
| `checkLength` | 写 `false` 关掉总长检查（只给短样片用） |
| `scenes[].id` | 小写英文开头，只用字母、数字、`-`、`_`；对应 `compositions/<id>.html`。`outro`、`vpchrome`、`main`、`root` 是保留字 |
| `scenes[].name` | 章节名：进播放器章节列表和画面左上的幕标题 |
| `scenes[].lines` | 字幕。一句是字符串，或 `{ text, say, dur, hold }`：`say` 是念法，`dur` 固定这句的秒数，`hold` 在这句后面多停几秒。`**强调**` 会标成强调色 |
| `scenes[].chapter` | 写 `false`：这一幕不编号、不进章节列表、不画幕标题，字幕自动切成 ≤ 28 字的小段（片头、回顾用） |
| `scenes[].lead` / `tail` | 第一句之前空几秒（默认 0.5）、最后一句之后留几秒（默认 0.8） |
| 其他字段 | 原样传给 `VP.scene(id)`，例如片头模板的 `badges`、`points` |

每句字幕多长：配了音就是这句音频念完再加 0.4 秒；没配音按字数估，和 Flash 版一样。所以场景里**不要写死秒数**，动作都挂在字幕上（见第 3 节），配不配音都对得上。

| 版式 | 画面 | 内容区（y） | 再往下 | 安全区 `[x0, y0, x1, y1]` |
| --- | --- | --- | --- | --- |
| 不写（3:4） | 1080×1440 | 130–1190 | 字幕区 | `[20, 16, 1060, 1424]` |
| `portrait`（9:16） | 1080×1920 | 350–1310 | 字幕区 | `[80, 250, 1000, 1480]`：短视频平台的按钮和标题会盖住外圈 |
| `landscape`（16:9） | 1920×1080 | 130–880 | 字幕区 | `[20, 16, 1900, 1064]` |

## 3. 一幕怎么写：compositions/<id>.html

`standard.py new` 会放一个骨架（`engine/standard/templates/scene.html`）。合同只有这几条，其余怎么画都行：

1. 样式、标记和脚本都放在 `<template>` 里，根元素是 `<div id="root" data-composition-id="<id>">`。
2. 建**一条 paused 的 GSAP 时间线**，建完登记：`window.__timelines['<id>'] = tl`。
3. **画面是时间的纯函数**：不读 `Date.now()` / `new Date()` / `performance.now()`，不用无种子的 `Math.random()`（要随机就在 `film-lib.js` 里写个带种子的），不用 `setTimeout` / `setInterval` / `requestAnimationFrame`，不写 `repeat: -1`，不联网。否则拖进度、倍速、自查和 mp4 都会错。
4. **动作挂在字幕上**：
   ```js
   const S = VP.scene('<id>'), { L } = S;   // 本幕内的秒数
   tl.fromTo(box, { opacity: 0 }, { opacity: 1, duration: .4 }, L(1) + .3);   // 第 2 句开始后 0.3 秒
   S.Le(1);          // 第 2 句结束
   S.at(2, .6);      // 第 3 句念到六成
   S.dur; S.lines;   // 本幕总长、每句的 { text, t0, t1 }；film.json 里的其他字段也在 S 上
   ```
5. 量字的宽高之前先 `await VP.fontsReady`。
6. 内容放在 `VP.layout.zone.top` 到 `VP.layout.zone.bottom` 之间，再往下是字幕区；竖屏只用 `VP.layout.safe` 里面。尺寸用 `VP.layout.W` / `H` 算，不要写死。
7. **字体用 `font-family: "VP Sans"`**：Noto Sans SC 的 400 和 700 两档，build 时按这部片子实际用到的字裁剪后内嵌。要别的字体，把文件放进 `assets/fonts/` 并写 `@font-face`。不用网上的字体；HyperFrames 文档里说「按名字就能用」的那些字体（Inter、Roboto 等）只带拉丁字母，渲染时还会去 Google Fonts 下载，不要用。
8. **字幕、幕标题、右上角品牌、片尾署名都由引擎的字幕层画**（在所有幕的最上层），场景里不画也不遮。场景里不放 `<audio>` 和有声视频：声音只走 voice.py 和 `--bgm`。
9. 文件路径写 `assets/...`，不带开头的 `/`。图片、脚本、字体都放进 `assets/`，不引用网上的文件，成片要能离线打开。

HyperFrames 自己的合同（`class="clip"` 的时间属性、不对 `.clip` 补间 `display`、GSAP 动 transform 不动 `left/top` 等）照它的 SKILL.md 做；`check.py` 会把它的 lint 一起跑。

## 4. 论文原图和出处

```js
const fig = VP.figure(stage, { id: 'self-fig', src: 'assets/figures/fig4_its.png', source: '图：论文 Figure 4', x: 120, y: 260, w: 840 });
tl.fromTo(fig, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .5 }, L(0) + .3);
```

- `VP.figure(parent, { src, source, x, y, w, id?, className?, alt? })` 生成 `<figure class="vp-figure"><img><figcaption class="vp-source">出处</figcaption></figure>`，返回 `<figure>`，像别的元素一样动它。也可以手写同样的标记。
- 默认样式在 `engine/standard/kit.css`（白底卡片、出处在图下方右对齐）；要改就在 `assets/film.css` 或这一幕的 `<style>` 里覆盖，例如把出处挪到图上方。
- check 报「出处」：画面上有 `<img>` 不在 `.vp-figure` 里，或出处看不见。不是论文原图的图片加 `data-no-source`。
- 示意用的数字旁边写「示意」（AGENTS.md 规则 4）；这一条 check 查不了，自己核对。
- 字号下限：一般文字 22px，出处和注释小字（`.vp-source`、加了 `data-vp-note` 的元素）20px；再小 check 报「字太小」。

## 5. 片头、回顾和片尾

- `standard.py new` 会把 `engine/standard/templates/opening.html`、`recap.html` 复制进 `compositions/`。两个模板都是可选的，可以随意改或删。
  - 片头：film.json 里配 `{ "id": "opening", "chapter": false, "lead": 0, "badges": [...], "points": [...], "lines": [问题, 出处, 为什么值得读] }`。`#opening-hero` 是主图区，换成这篇论文的机制，第 0 秒就要动（check 比较第 0 秒和第 0.6 秒，不动报「开场不动」）。
  - 回顾：`{ "id": "recap", "chapter": false, "lines": ["我们最后回顾一下", "第一条", …] }`，第一句是引子，之后每句一条，右边 `#recap-box-<i>` 留给那一幕的小动效。
- **片尾署名**（分隔线、「本视频由开源工具 VividPaper 生成」、徽章「★ Star | ManagerZhang10/vividpaper」）由引擎在最后一幕之后自动加 3.6 秒，不可去掉（AGENTS.md 规则 1）。

## 6. 命令

```bash
python3 $PM/scripts/standard.py doctor                     # 体检：Node、依赖、Chrome、ffmpeg
python3 $PM/scripts/standard.py new <短名> [--layout portrait|landscape]
python3 $PM/scripts/build.py <短名>                         # → <短名>/<短名>.html；--mute 无声版，--bgm <mp3> 配乐，--open 打开
python3 $PM/scripts/check.py <短名>                          # 也可以传成片 HTML；--at 12.5,40 导整帧到 _frames/
python3 $PM/scripts/voice.py <短名>                          # 配音，同 Flash 版
python3 $PM/scripts/build.py <短名> --mp4                   # 另出 <短名>.mp4（要 ffmpeg 和 ffprobe）
python3 $PM/scripts/standard.py hf <命令> …                 # 其他 hyperframes 本地命令，例如 hf snapshot <短名> --at 3
```

- **check** 三部分：读源文件（报错、字体、出处）、在成片页里逐句查（出界 / 超出安全区、字太小、压字幕、文字重叠、字幕太长、开场不动、这句画面不动、画面静止）、跑 `hyperframes check`（它的布局、对比度、运行时报错并进同一个清单，报成「HF <代码>」或对应的中文类别）。另外还查总长和配音。HyperFrames 的 craft 一节是它自己的口味（3 秒不动、28px 字号、要有配乐），单独列成「建议」，不算问题。产物：`<短名>_sheet.png`（每句结束那一刻一格）、`<短名>_audit.json`。
- **mp4**：HyperFrames 按 30 fps 逐帧渲染画面（用本机 Chrome），声音用成片页面自己混的那一轨（配音 + 配乐 + 自动压低），所以视频和网页听起来一样。
- 所有脚本调 HyperFrames 时都关掉遥测和更新检查，缓存、配置、浏览器临时目录都放在一次性的临时目录里，跑完删掉，不往 `~` 写东西，也会关掉自己起的 Chrome。

## 7. 用 HyperFrames 自带的 skill 时

画面相关的照它做：合同、`references/look.md`、`motion.md`、`format.md`、`runtimes.md`、`types/explainer.md` 等。下面这些换成 VividPaper 的做法：

| 它说的 | 这里怎么做 |
| --- | --- |
| 开头跑 `npx hyperframes events`（usage beacon）、`usage --json` | 不跑：这是遥测和账号用量 |
| `npx hyperframes <命令>` | `python3 $PM/scripts/standard.py hf <命令>`：锁定版本、关遥测、用本机 Chrome。`publish`、`cloud`、`auth`、`events`、`usage`、`update` 这类联网或上传的命令一律拒绝 |
| `npx hyperframes init` | `standard.py new` |
| 根合成 `index.html`、变量（`data-var-*`） | build.py 生成，不手改 |
| 新视频默认 1920×1080 | 版式由 film.json 的 `layout` 定 |
| 三条故事线让人选、`SPEC.md` 的故事部分 | 主线和分幕按 SKILL.md 第 2 步写在 `story.md`；`SPEC.md` 的画面部分可以照写 |
| 字幕（`captions.md`）、配音配乐（`sound.md`、`/media-use`、HeyGen） | VividPaper 的字幕层、`voice.py` 和 `--bgm` |
| `check` | `check.py`（已经包含 `hyperframes check`） |
| Studio 预览、桌面 App、Framey、`catch-up`、`history` | 不开：预览就是打开 build 出来的 HTML |
| `render` | `build.py --mp4` |
| 按名字用它内置的字体 | 用 VP Sans，或 `assets/fonts/` + `@font-face`（见第 3 节第 7 条） |
