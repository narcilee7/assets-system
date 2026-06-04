# VLM

VLM 主线用于理解视觉语言模型：图像如何被编码、如何和语言空间对齐、如何完成视觉问答、OCR、grounding 和多模态推理。

## 典型结构

```text
Image
-> Vision Encoder
-> Projector / Adapter
-> LLM
-> Text / Action
```

## 必会主题

| 主题 | 关键点 |
| --- | --- |
| Vision Encoder | ViT、CNN、patch embedding |
| Projector | linear、MLP、Q-Former、adapter |
| Alignment | image-text pair、contrastive、caption |
| Instruction Tuning | multimodal SFT |
| Grounding | box、region、coordinate |
| OCR / Document | layout、table、dense text |
| Video | frame sampling、temporal modeling |

## 资产

| 资产 | 状态 |
| --- | --- |
| [Vision Encoder](./vision-encoder.md) | ✅ |
| [Projector / Adapter](./projector.md) | ✅ |
| [多模态指令微调](./multimodal-sft.md) | ✅ |

## 追问

- CLIP 和 LLaVA 类模型的差别是什么？
- 视觉 token 数量如何影响成本？
- VLM 为什么容易看错细节？
- OCR、图表、表格为什么是难点？
