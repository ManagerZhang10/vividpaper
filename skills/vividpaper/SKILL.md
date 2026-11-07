---
name: vividpaper
description: VividPaper——把一篇论文做成约 3 分钟的动效解读页（张指导出品）：一个双击就能在浏览器打开的单文件 HTML，画面配字幕，可播放、拖进度、按章节跳、切 1×/2×/4× 倍速，可选一键配音（免费的 edge-tts 中文男声，字幕和动作自动跟着声音走）。有两个版本：标准版用 HyperFrames 画画面、能另出 mp4（要装 Node）；Flash 版零安装。流程是拉原文和原图、定一个主线问题、拆成 5–8 幕、用论文原图加动效讲机制，最后自动自查（出界、字太小、压字幕、画面不动）。用户说「把这篇论文做成动效」「3 分钟看懂这篇论文」「动效解读」「视觉化读论文」「vividpaper」「VividPaper」「给动效配个音」，或丢一个 arXiv 链接或 PDF 说「做成动画讲讲」时用。不用于：写文字版解读、做 PPT/deck、真人出镜的口播视频。
---

# VividPaper · 视觉化读论文

> **署名。** 引擎会在片尾自动画上「本视频由开源工具 VividPaper 生成」和徽章「★ Star | ManagerZhang10/vividpaper」，页面标题和页脚（带仓库链接）也写着 VividPaper。**不要删、不要改、不要遮挡**，也不要在画面里另画东西盖住它们。每一帧右上角和片头的品牌字默认是「VividPaper」；用户要署自己的名字时，在 film.js / film.json 写 `brand`（见 api.md「署名」），不要用别的办法改。

产物是一个单文件 HTML：读者看完动效，3 分钟左右就能直观建立对这篇论文的理解。默认画面 1080×1440（3:4），要出竖屏视频时写 `layout: 'portrait'`（1080×1920，9:16）。每一帧都是时间 t 的纯函数，所以能拖、能倍速，也能自动自查。

有两个版本，流程、字幕、配音、播放器、自查都一样，只是画面的写法不同：

| | 标准版 | Flash 版 |
| --- | --- | --- |
| 画面怎么写 | 每一幕是一个 HyperFrames 子合成（HTML / CSS / SVG + GSAP），上限高 | `film.js` 里用 `g.*` 在 canvas 上画 |
| 要装什么 | Node ≥ 22，再一键装锁定版本的依赖（约 120 MB） | 不用装 |
| 版式 | 3:4、9:16、16:9 | 3:4、9:16 |
| 出 mp4 | `build.py --mp4` | 不支持，只出网页 |
| 片子目录里 | `film.json` + `compositions/<id>.html` | `film.js` |

下文 `$PM` 指本 skill 所在目录（SKILL.md 旁边）。两个版本都要：Python 3、`pip install pymupdf`、本机装有 Chrome（或设环境变量 `CHROME`）。

## 第 0 步：先看标准版装没装

```bash
python3 $PM/scripts/standard.py doctor
```

- **最后一行是「标准版可以用」**：新片用标准版（用户点名要 Flash 版时除外）。画面怎么做读 HyperFrames 自带的 skill：`$PM/node_modules/hyperframes/dist/skills/hyperframes/SKILL.md`；VividPaper 的合同和接口读 `references/standard.md`（第 7 节列了它的哪些步骤换成这里的做法）。
- **「标准版还不能用」**：把两个选择告诉用户，让他选，不要替他装：
  - 标准版：要 Node ≥ 22，再跑 `python3 $PM/scripts/standard.py install`（`npm ci` 装锁定版本的 hyperframes 0.9.19、GSAP 和中文字体，约 120 MB，只装在 skill 目录的 `node_modules/` 里，不碰全局）。本机没有 Chrome 时另要约 190 MB 的 chrome-headless-shell；要出 mp4 还要 ffmpeg 和 ffprobe。缺哪样 doctor 都列出来了。
  - Flash 版：零安装，现在就能做。
  用户选标准版就照 doctor 的提示装，装完再跑一次 doctor；选 Flash 版就直接往下做。
- **改已有的片子**：目录里是 `film.json` 就是标准版，是 `film.js` 就是 Flash 版，脚本自动识别，不用加参数。

## 流程

1. **拉原文**：`python3 $PM/scripts/fetch_paper.py <arXiv id | 链接 | 本地.pdf> -o <短名>`
   得到 `<短名>/source/`：`paper.pdf`、`meta.json`、`paper.txt`（带页码）、`captions.txt`（全部图表标题）、`pages/pNN.png`（每页缩略图）。
   读论文用 `grep` 和按页读 `paper.txt`，先读摘要、引言、方法和主结果；数字只从原文取。
   - `paper.txt` 里表格的数字一个一行、和行名列名是分开的：**表格数字一律对着裁出来的表格图核对**，确认每个数归哪一行哪一列。
   - 片头 `byline` 的会议名：先看 `meta.json` 的 `comment` / `journal_ref`（作者自己填的）；都没有就只写年份，不凭记忆补。
2. **定主线**（最重要，写在 `<短名>/story.md`）：
   - 一句话主线问题：这篇论文到底回答了什么问题。Flash 版写进 `question`，标准版是片头的第一句字幕。
   - **片头用 `opening` 模板**（Flash 版见 `references/api.md`「片头模板」，标准版见 `references/standard.md` 第 5 节）：先抛问题，再说「今天解读<机构 会议>的论文 <方法名>」，最后一句讲为什么值得读（具体的结果、落地、开源）；主图第 0 帧就在动。`paper.title` 只写方法名。
   - 一个**主角**：一个具体的例子（一句话、一张图、一个 token），从头跟到尾。优先用论文自己图里用过的例子。
   - 6–8 幕，每幕一句标题，都在回答主线；不回答主线的内容删掉。总长 2.5–3.5 分钟：6 幕时每幕 4–5 句，7–8 幕时每幕 3–4 句。
   - 每幕列出：字幕、画面上的主体、要用的论文原图。
   - 用户只说「做一个」就直接往下做，不停下来等确认；用户说「先给我看分镜」才停在这里。
3. **裁图**：先看 `pages/` 缩略图找到图在哪页，再
   `python3 $PM/scripts/crop.py <短名>/source/paper.pdf <页码> --fig <N> -o <短名>/figures/<名字>.png`（标准版放 `<短名>/assets/figures/`）
   - 自动模式按图注所在的栏裁，只取图注正上方紧挨着的图，分辨率自动定（输出 ≥ 1400px 宽）。
   - 表格、算法框、图注在图下方以外的情况、自动裁不准时：先 `crop.py <pdf> <页码> --page-grid` 出带 0.05 网格的整页图，读出坐标后用 `--box x0 y0 x1 y1`（0–1 页面比例）。
   - 每次裁图还会在 `<短名>/_grid/` 下出一张带 0.1 网格的同名图，**标框的坐标直接从这张图上读**，不要凭感觉估。
   - **裁完一定打开看一眼**：子图小标题被切、带进了图注或旁边一栏的正文，都要重裁。
   - Flash 版 `figures/` 里的每张图都会打进 HTML，没用到的删掉；文件名以 `_` 开头的不打包。
4. **写画面**：
   - **标准版**：`python3 $PM/scripts/standard.py new <短名> [--layout portrait|landscape]` 起骨架（film.json + 片头、一幕、回顾三个模板），然后写 `film.json`（每一幕的字幕）和 `compositions/<id>.html`（每一幕的画面）。合同照 `references/standard.md`：时间线 paused、动作挂在 `VP.scene(id).L(i)` 上、不读真实时间、论文原图用 `VP.figure` 带出处、字体用 VP Sans。画面设计照 HyperFrames 自带的 skill 做。不要拿 Flash 版范例 `references/example-attention.js` 或 `examples/` 里的旧片子当画面参考：同一段内容盲测，参考了旧片的标准版不如完全不参考的。
   - **Flash 版**：写 `<短名>/film.js`，照 `references/api.md` 的接口和 `references/craft.md` 的画法规则写。完整范例：`references/example-attention.js`（Attention Is All You Need），先通读一遍再动笔。
   - 片尾回顾 3–4 条，**新片默认每条配一个小动效**，画那一幕机制的简化版，文字压到一行（≤ 12 字）。Flash 版条目写成 `{ text, draw(g, box, u) }`（api.md「回顾小动效」、craft.md 第 7 条）；标准版画在回顾模板的 `#recap-box-<i>` 里。
   - `craft.md` 讲内容的几节（主线、真图真数、术语、时长）两个版本都照做。
5. **打包 + 自查**：
   ```bash
   python3 $PM/scripts/build.py <短名> -o <短名>/<短名>.html
   python3 $PM/scripts/check.py <短名>/<短名>.html            # 可加 --at 12.5,40 导出整帧
   ```
   check 会出 `<短名>_sheet.png`（每句字幕结束那一刻一格）和问题清单。**有 ✗ 就改到没有**，然后**打开 sheet 自己看一遍**：check 查不出线条压住字、标签盖住原图里的字、大块空屏，这些只能靠眼睛。需要细看就 `--at 12.5,40` 导整帧（放在 `_frames/`，草稿用，不算产物）。
   - 标准版的 check 还会跑 `hyperframes check`；单独列出的「HyperFrames 的建议」是它自己的口味，不算问题，看情况采纳。
   - 标准版要视频时：`build.py <短名> --mp4`，另出 `<短名>.mp4`（要 ffmpeg 和 ffprobe）。
6. **配音（可选，用户要声音时做）**：画面定稿后再配，字幕每改一次都要重跑。
   ```bash
   pip install -U edge-tts                                    # 只有配音要它；微软改接口后旧版会 403，所以带 -U
   python3 $PM/scripts/voice.py <短名>                         # 默认云希男声、+30% 语速；--voice zh-CN-YunyangNeural 换声音
   python3 $PM/scripts/build.py <短名> -o <短名>/<短名>.html && python3 $PM/scripts/check.py <短名>/<短名>.html
   ```
   - 念的是每句字幕、片头的主线问题和片尾回顾（标准版就是 film.json 里的每一句），存在 `<短名>/voice/`；只合成新增或改过的句子。配了音以后每句字幕念完才切下一句，挂在字幕上的动作（Flash 版 `g.L(i)`，标准版 `VP.scene(id).L(i)`）自动跟着走。
   - 念得比按字数估的慢，总长一般会多出 15–20%。check 报「画面静止」时，在那句后半段补一个动作，挂在「这句念到几成」的时刻：Flash 版 `g.lerp(L(i), g.Le(i), .6)`，标准版 `S.at(i, .6)`，例如念到「降到 14.45」时圈出那根条。这样配不配音都对得上。
   - **公式要写口语念法**：引擎已自动处理下划线（`x_t` 念「x t」）、下标数字、`²`、两项之间的 `−`（念「减」）和 `→`；括号、`^`、`/`、`{}` 还会念坏，比如 `(6 − 2)` 念成「左圆括号」，`10000^(−2i/d)` 念成一串乱数。voice.py 会列出带这些符号的句子：给那句写 `say`，或者在 `pronounce` 里统一替换（见 api.md）。英文名逐字母念时也这样处理（如 `RoFormer` → `Roformer`）。
   - edge-tts 偶尔只返回开头一小段，voice.py 会自动重试；check 报「配音太短」时重跑 voice.py 即可。
   - 播放器多一个 🔊 按钮（M 键）；1×、2× 有声，4× 静音只看画面。`build.py --mute` 打包无声版。
   - 要配乐：`build.py <短名> --bgm <自己的配乐.mp3>`。仓库不带配乐，用户给文件才加；播放器把它垫在配音下面，念的时候自动压低（见 api.md「配乐」）。
   - 换别的 TTS：`voice.py <短名> --cmd '<命令> {text} {out}'`，命令把 {text} 念成 {out}（.wav）就行，例如在有 GPU 的机器上跑 CosyVoice。
7. **交付**：打开 HTML（macOS `open <文件>`），给用户 HTML 的绝对路径、总时长和每幕标题；出了 mp4 也给它的绝对路径。

## 报错怎么办

| 现象 | 处理 |
| --- | --- |
| `fetch_paper` 说查不到 | 确认 arXiv id；没有 arXiv 的论文下载 PDF 后传本地路径 |
| `crop --fig` 找不到标题 / 裁得不对 | `--page-grid` 出网格整页图，读坐标改用 `--box` |
| check 报「报错」 | Flash 版是 film.js 抛异常，消息里有幕名，常见是 `L(i)` 超出字幕条数、图片名写错；标准版还会报时间线没建成 paused、没登记 `__timelines`、读了真实时间、用了无种子随机数、计时器或 `repeat: -1` |
| check 报「这句画面不动」「画面静止」 | 给那一句加一个跟字幕同步的动作（出现、移动、标框、连线），见 craft.md 第 3 条 |
| check 报「压字幕」 | 内容伸到了字幕区（3:4 是 y>1190；标准版看 `VP.layout.zone.bottom`），往上挪或缩小 |
| check 报「出界」「超出安全区」 | 东西从画面外滑进来也算出界：入场改成在画面内淡入或短距离位移；竖屏只用安全区 |
| check 报「文字重叠」 | 两段字画在了同一处，挪开或让前一个先淡出 |
| check 报「总长」 | 不到 140 秒加一幕或每幕加句；超过 240 秒砍幕，不要压字幕。配了音超时也可以 `voice.py --rate +40%` |
| check 报「配音」 | 有字幕改过但没重新配音：重跑 `voice.py <短名>` 再 build |
| check 报「字体」（标准版） | 用了没内嵌的字体：改用 `"VP Sans"`，或把字体文件放进 `assets/fonts/` 写 `@font-face` |
| check 报「出处」（标准版） | 论文原图要用 `VP.figure` 放、写上出处；不是论文原图的图片加 `data-no-source` |
| build 说「标准版还不能用」 | 跑 `standard.py doctor` 看缺什么；不想装就让用户改用 Flash 版 |
| `--mp4` 说缺 ffprobe | `brew install ffmpeg`（两个都有）；ffprobe 在别处时设 `HYPERFRAMES_FFPROBE_PATH=<路径>` |
| voice.py 报 edge-tts 失败 / 403 | `pip install -U edge-tts`；还不行就检查网络（要能连 speech.platform.bing.com） |
| check 没跑出结果 | 找不到 Chrome 时设 `CHROME=<路径>`；其余看报出的错误信息 |
