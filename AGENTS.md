# AGENTS.md — paper-motion

把一篇论文做成约 3 分钟的动效解读页（单文件 HTML）。张指导出品。

## 目录

| 路径 | 内容 |
| --- | --- |
| `skills/paper-motion/` | skill 本体：`SKILL.md`（流程）、`references/`（接口、画法规则、范例 film.js）、`engine/`（pm.js 引擎 + player.html 播放器）、`scripts/`（拉论文、裁图、打包、自查） |
| `examples/<短名>/` | 做好的 demo：`film.js`、`figures/`、`story.md`、成片 `<短名>.html`、关键帧 `<短名>_sheet.png`。`source/` 只提交 `meta.json` |
| `index.html`、`docs/media/` | GitHub Pages 在线展示首页和各 demo 的动图片段；demo 改了之后动图要重出 |

`examples/attention/film.js` 是指向 `skills/paper-motion/references/example-attention.js` 的软链，范例只在后者维护。

## 规则

1. **署名不可去掉。** 引擎在片头、每帧右上角、片尾和页面标题里画「张指导出品」。改引擎或播放器时保留这些位置，不加开关去掉它。
2. 改了 `engine/` 或 `scripts/` 后，把 `examples/` 下每个 demo 重新 build + check 一遍，全部零问题再提交：
   ```bash
   for d in examples/*/; do n=$(basename $d); python3 skills/paper-motion/scripts/build.py $d -o $d$n.html && python3 skills/paper-motion/scripts/check.py $d$n.html; done
   ```
3. draw(g) 必须是时间的纯函数（不读真实时间、不用无种子随机），否则拖进度、倍速和自查都会错。
4. demo 里的事实和数字只从论文原文取，示意数字在画面上标「示意」；论文原图必须在画面上写出处。
5. 依赖保持最少：Python 标准库 + PyMuPDF + 本机 Chrome。不引入 npm、Playwright 或其他运行时。
6. 提交身份：`git config user.email 30391848+ManagerZhang10@users.noreply.github.com`（仓库级）。push 和改仓库可见性之前先问作者。
