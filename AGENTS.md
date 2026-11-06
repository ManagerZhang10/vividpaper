# AGENTS.md — VividPaper

把一篇论文做成约 3 分钟的动效解读页（单文件 HTML）。张指导出品。

## 目录

| 路径 | 内容 |
| --- | --- |
| `skills/vividpaper/` | skill 本体：`SKILL.md`（流程）、`references/`（Flash 版接口 api.md、画法规则 craft.md、范例 film.js；标准版合同 standard.md）、`engine/`（Flash 版：pm.js 引擎 + player.html 播放器；`engine/standard/`：标准版的播放器、字幕层、kit、片头/回顾/一幕模板）、`scripts/`（拉论文、裁图、打包、自查、配音；`standard.py` + `standard_node.mjs` 只给标准版用） |
| `skills/vividpaper/package.json`、`package-lock.json` | 标准版的可选依赖，锁定版本（hyperframes 0.9.19、GSAP、Noto Sans SC）；`standard.py install` 按它装进 `node_modules/`（不提交） |
| `examples/<短名>/` | 做好的 demo：`film.js`、`figures/`、`story.md`、成片 `<短名>.html`、关键帧 `<短名>_sheet.png`，配了音的还有 `voice/`（voice.py 生成）。`source/` 只提交 `meta.json` |
| `tests/standard-attention/` | 标准版的最小回归样例（Transformer 的两幕 + 片头、回顾），不是正式 demo，不上首页 |
| `index.html`、`docs/media/` | GitHub Pages 在线展示首页、各 demo 的动图片段和 README 主图（`hero.html` → `hero.png`，重出方法写在 hero.html 开头）；demo 改了之后动图和主图要重出 |

`examples/attention/film.js` 是指向 `skills/vividpaper/references/example-attention.js` 的软链，范例只在后者维护。

## 规则

1. **片尾的工具署名不可去掉。** 两个版本的引擎都在每部片子的片尾分隔线下画一行小字「本视频由开源工具 VividPaper 生成」和徽章「★ Star | ManagerZhang10/vividpaper」，播放器页脚带可点的仓库链接，页面标题和 `<meta name="generator">` 写 VividPaper：任何人导出的片子都带着它，看到的人才能找到仓库。这些不随配置变，不加开关去掉它们。
   每帧右上角（含片头模板 `opening` 和 `introDraw` 主图片头）、默认片头左上的品牌字和播放器右上角显示 film.js / film.json 的 `brand`，默认「VividPaper」。仓库里（引擎、文档、示例）不写死任何个人署名；作者自己要发的片子在本地 film.js / film.json 里写 `brand`。改引擎或播放器时保留这些位置。
2. 改了 `engine/` 或 `scripts/` 后，按各自的引擎重新 build + check，全部零问题再提交；改了 build.py、check.py、voice.py 这类两边共用的脚本，两边都跑：
   - Flash 版（`engine/pm.js`、`engine/player.html` 等）：`examples/` 下每个 demo 都重跑，`git status` 里成片不该有意外的变化：
     ```bash
     for d in examples/*/; do n=$(basename $d); python3 skills/vividpaper/scripts/build.py $d -o $d$n.html && python3 skills/vividpaper/scripts/check.py $d$n.html; done
     ```
   - 标准版（`engine/standard/`、`scripts/standard.py`、`scripts/standard_node.mjs`、`package.json`）：跑回归样例。需要 Node 和装好的依赖（`standard.py doctor` 全是 ✓）：
     ```bash
     python3 skills/vividpaper/scripts/build.py tests/standard-attention && python3 skills/vividpaper/scripts/check.py tests/standard-attention
     ```
3. 画面必须是时间的纯函数（不读真实时间、不用无种子随机），否则拖进度、倍速、自查和 mp4 都会错。Flash 版是 draw(g)；标准版每一幕的 GSAP 时间线必须建成 paused 并登记到 `window.__timelines`，能 seek 到任意时刻，不用 `Date.now()` / `performance.now()`、无种子的 `Math.random()`、计时器（`setTimeout` / `setInterval` / `requestAnimationFrame`）和 `repeat: -1`。
4. demo 里的事实和数字只从论文原文取，示意数字在画面上标「示意」；论文原图必须在画面上写出处。
5. Flash 版的依赖不变：Python 标准库 + PyMuPDF + 本机 Chrome，不引入 npm、Playwright 或其他运行时；配音是唯一例外，`voice.py` 需要 `edge-tts`，只在配音时装，其余脚本不能依赖它。标准版是可选项，需要 Node 加锁定版本的 hyperframes（`skills/vividpaper/package.json` + `package-lock.json`），只在用标准版时安装，Flash 版脚本不得依赖它（不 import、不调用 node）。
6. 提交身份：`git config user.email 30391848+ManagerZhang10@users.noreply.github.com`（仓库级）。push 和改仓库可见性之前先问作者。
