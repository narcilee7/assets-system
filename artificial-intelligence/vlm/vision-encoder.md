# Vision Encoder

Vision Encoder 是 VLM 的"眼睛"，负责将图像转换为模型可理解的特征表示。

## 主流架构

### ViT (Vision Transformer)

```
Image (H×W×3)
  → Patchify (P×P patches)
  → Flatten + Linear Projection (→ d dim)
  + Positional Embedding
  → [Transformer Encoder] × L
  → Image Features (N patches × d)
```

**关键设计**：
- Patch size：通常 14×14 或 16×16
- 224×224 图像 → 14×14 = 196 patches
- 每个 patch 是一个"视觉 token"

### ViT 变体

| 模型 | 特点 | 规模 |
|------|------|------|
| ViT-B/16 | Base，16×16 patches | 86M |
| ViT-L/14 | Large，14×14 patches | 304M |
| ViT-H/14 | Huge | 632M |
| EVA-CLIP | 更大规模预训练 | 1B |
| SigLIP | 改进的对比学习 | 多规格 |
| DINOv2 | 自监督预训练 | ViT-L/G |

### CLIP Vision Encoder

```
核心：对比学习
- 图像编码器 + 文本编码器
- 训练目标：匹配图像-文本对的相似度最大化
- 损失：InfoNCE
```

**为什么 CLIP 成为 VLM 的标准视觉 backbone？**
1. 预训练数据量大（4 亿图像-文本对）
2. 语义对齐好（与语言空间兼容）
3. 开源可用
4. 不同规模可选（ViT-B/L/H）

## 图像分辨率

| 分辨率 | Patch 数 (14×14) | 影响 |
|--------|-----------------|------|
| 224×224 | 256 | 标准，速度快 |
| 336×336 | 576 | 更多细节 |
| 448×448 | 1024 | 更高精度 |
| 动态 | 可变 | 最佳，但复杂 |

**高分辨率策略**：
- Naive resize：简单但可能丢失细粒度信息
- 切图 (tiled)：将大图切分处理，再聚合
- 双分辨率：全局图 + 局部图分别编码

## 特征提取模式

| 模式 | 输出 | 用途 |
|------|------|------|
| CLS token | 1 × d | 全局图像表示（分类） |
| Patch tokens | N × d | 密集特征（检测、分割、VLM） |
| 多层特征 | L × N × d | 多尺度融合 |

**VLM 中**：通常使用 patch tokens（N×d）作为视觉 token 序列输入 LLM。

## 常见误区

| 误区 | 正解 |
|------|------|
| Vision Encoder 越大越好 | ⚠️ 需平衡与 LLM 的能力匹配，过大可能浪费 |
| 任何 ViT 都能做 VLM backbone | ❌ 需要与语言空间对齐的（如 CLIP、SigLIP） |
| 高分辨率 = 更好理解 | ⚠️ 是，但视觉 token 数增加会显著增加计算 |
| 视觉 token 和文本 token 等价 | ❌ 视觉 token 信息密度不同，通常需要 projector |

## 快速检查清单

- [ ] 理解 ViT 的 patchify 过程
- [ ] 知道 CLIP 预训练的核心方法（对比学习）
- [ ] 理解为什么 VLM 通常用 patch tokens 而非 CLS
- [ ] 知道高分辨率处理的几种策略
