# AGENTS.md — VividPaper

把一篇论文做成约 3 分钟的动效解读页（单文件 HTML）。张指导出品。

## 目录

| 路径 | 内容 |
| --- | --- |
| `skills/vividpaper/` | skill 本体：`SKILL.md`（流程）、`references/`（接口、画法规则、范例 film.js）、`engine/`（pm.js 引擎 + player.html 播放器）、`scripts/`（拉论文、裁图、打包、自查） |
| `examples/<短名>/` | 做好的 demo：`film.js`、`figures/`、`story.md`、成片 `<短名>.html`、关键帧 `<短名>_sheet.png`，配了音的还有 `voice/`（voice.py 生成）。`source/` 只提交 `meta.json` |
| `index.html`、`docs/media/` | GitHub Pages 在线展示首页、各 demo 的动图片段和 README 主图（`hero.html` → `hero.png`，重出方法写在 hero.html 开头）；demo 改了之后动图和主图要重出 |

`examples/attention/film.js` 是指向 `skills/vividpaper/references/example-attention.js` 的软链，范例只在后者维护。

## 规则

1. **片尾的工具署名不可去掉。** 引擎在每部片子的片尾分隔线下画一行小字「本视频由开源工具 VividPaper 生成」和徽章「★ Star | ManagerZhang10/vividpaper」，播放器页脚带可点的仓库链接，页面标题和 `<meta name="generator">` 写 VividPaper：任何人导出的片子都带着它，看到的人才能找到仓库。这些不随配置变，不加开关去掉它们。
   每帧右上角（含片头模板 `opening` 和 `introDraw` 主图片头）、默认片头左上的品牌字和播放器右上角显示 film.js 的 `brand`，默认「VividPaper」；作者自己的片子写 `brand: '张指导出品'`。旧写法 `tool: false` 等价于 `brand: '张指导出品'`，继续兼容。改引擎或播放器时保留这些位置。
2. 改了 `engine/` 或 `scripts/` 后，把 `examples/` 下每个 demo 重新 build + check 一遍，全部零问题再提交：
   ```bash
   for d in examples/*/; do n=$(basename $d); python3 skills/vividpaper/scripts/build.py $d -o $d$n.html && python3 skills/vividpaper/scripts/check.py $d$n.html; done
   ```
3. draw(g) 必须是时间的纯函数（不读真实时间、不用无种子随机），否则拖进度、倍速和自查都会错。
4. demo 里的事实和数字只从论文原文取，示意数字在画面上标「示意」；论文原图必须在画面上写出处。
5. 依赖保持最少：Python 标准库 + PyMuPDF + 本机 Chrome。不引入 npm、Playwright 或其他运行时。配音是唯一例外：`voice.py` 需要 `edge-tts`，只在配音时装，其余脚本不能依赖它。
6. 提交身份：`git config user.email 30391848+ManagerZhang10@users.noreply.github.com`（仓库级）。push 和改仓库可见性之前先问作者。
