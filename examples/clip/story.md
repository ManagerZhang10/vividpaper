# CLIP · 分镜

- 论文：Learning Transferable Visual Models From Natural Language Supervision（arXiv 2103.00020，OpenAI，2021-02-26）
- 主线问题：不给人工标签，模型能不能光靠网上的图文配对学会认图？
- 主角：一张猫图（作者指定示例图 cat_2048.jpg）和它配的那句话「my cat staring at the camera」（示意）。
  它在第 1 幕是被人工打标签的图，第 2 幕是 4 亿对里的一对，第 3 幕是三种训练目标的例子，
  第 5 幕是 N×N 表的第 1 行，第 6 幕被 zero-shot 分类成 cat。

| # | id | 标题 | 画面主体 | 原图 |
| --- | --- | --- | --- | --- |
| 1 | label | 老办法：只认得事先定好的类别 | 猫图 → 模型 → 1000 个出口；第 1001 类 ✗；底部出现网上的图文配对 | — |
| 2 | data | 新数据：从网上收集 4 亿对图文 | 计数到 4 亿的格子墙；查询词；猫图那一对放大，「这句话 = 标签」 | — |
| 3 | objective | 训练目标：不猜原句，只猜配对 | 顶部三种做法（逐字写 / 猜词 / 配对）随字幕切换；底部 Figure 2 对应曲线标框，3 倍、4 倍 | Figure 2 |
| 4 | matrix | 核心：一个 batch 里的 N×N 配对表 | Figure 1 左，依次框编码器、embedding、整张表、对角线 | Figure 1 (1) |
| 5 | loss | 训练：每一行、每一列都是选择题 | 自画 4×4 表（猫在第 1 行），行 softmax 变百分比，列方向，最后拉远到 32,768×32,768 | — |
| 6 | zeroshot | 用起来：把类别名写成一句话 | Figure 1 右先框 prompt 模板；再自画猫图 vs 5 句 prompt 的相似度条，cat 最高；+1.3% / +3.5% | Figure 1 (2)(3) |
| 7 | result | 结果：一张 ImageNet 训练图都没用 | Table 1 重画条形图：11.5 → 76.2，追平原版 ResNet-50；aYahoo、SUN | Table 1 |
| 8 | robust | 换个画风也认得：分布偏移更稳 | Figure 13 右（香蕉）逐行框；下方重画 ImageNet / -R / -A 两模型对比条 | Figure 13 |

数字出处：4 亿对、50 万查询词、每词 ≤2 万对（2.2 节）；3 倍 / 4 倍（Figure 2、2.3 节）；
N²−N、对称交叉熵（2.3 节、Figure 3）；batch 32,768（2.5 节）；1.3%、80 个模板 +3.5%（3.1.4 节）；
11.5 / 76.2、72.4 / 98.4、23.0 / 58.5（Table 1）；ResNet-101 vs CLIP 各数据集（Figure 13）。
示意数字：相似度、softmax 百分比、zero-shot 相似度条、格子墙。
