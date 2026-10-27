# ViT 分镜

论文：An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale（arXiv 2010.11929，ICLR 2021）

- question：图像能不能像句子一样，**直接交给 Transformer**？
- 主角：猫图（作者指定示例图 cat_2048.jpg，裁成正方形）里猫左眼所在的那一块 patch（第 6 行第 5 列，序号 75）。从被切出来、拉平投影、贴位置编码，到在编码器里看全图，一路跟着它。
- 用到的论文原图：Figure 1（p3，模型总览）、Figure 3（p7 左半，预训练数据量 vs ImageNet 准确率）。
- 数字来源：224 训练分辨率（附录 B.1）、D=768 / 12 层（Table 1，ViT-Base）、130 万 / 1400 万 / 3.03 亿张（4.1 节）、76.53 / 85.15 / 87.12（Table 5，ViT-L/16）、88.55 / 87.76 / 87.54 / 88.4 与 2.5k / 0.68k / 9.9k / 12.3k TPUv3 核·天（Table 2）。

| # | 标题 | 画面主体 | 原图 |
| --- | --- | --- | --- |
| 1 | 问题：图像能不能像句子一样丢给 Transformer | 一句话进 Transformer；猫图进 CNN；一个像素一个词 → 50176 个、两两配对 25 亿对 | — |
| 2 | 切块：一张图切成 196 个 patch | 猫图画 14×14 网格，主角块放大，196 块飞成一行序列 | — |
| 3 | 每块拉平、乘 E，变成一个向量 | 主角块的 16×16 像素 → RGB 三层 → 拉平 768 → ×E → D 维向量 | Figure 1 局部（Linear Projection） |
| 4 | 贴座位号，再加一个 [class] token | 序列打乱演示 → 位置编号落下 → [class] 插到最前 | Figure 1（编号那一排、0*） |
| 5 | 后面就是原样的 Transformer 编码器 | Figure 1 右侧编码器逐块标框；主角块连到全图；12 层；[class] → MLP Head → 类别 | Figure 1 |
| 6 | 关键：数据少不如 CNN，数据大了反超 | Figure 3 标 ImageNet 列和 JFT 列；CNN 局部窗口 vs ViT 全连；ViT-L/16 三档数据条形图 | Figure 3 + Table 5 |
| 7 | 结果：更准，而且更省算力 | 准确率、算力两组条形图 | Table 2 |
