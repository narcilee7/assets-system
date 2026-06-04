# Multimodal

多模态主线覆盖文本、图像、音频、视频和结构化信号的融合。

## 融合方式

| 方式 | 特点 |
| --- | --- |
| Early Fusion | 早期合并 token / feature |
| Late Fusion | 各模态独立编码后融合 |
| Cross Attention | 一个模态 attend 另一个模态 |
| Shared Embedding Space | 对比学习对齐 |
| Tool-based Multimodal | 模型调用 OCR、ASR、检测器等工具 |

## 资产

| 资产 | 状态 |
| --- | --- |
| [融合策略详解](./fusion-strategies.md) | ✅ |
| [跨模态对齐](./cross-modal-alignment.md) | ✅ |
