# Artificial Intelligence

这条主线用于建立完整的人工智能算法与模型体系。目标不是只会调用模型 API，而是理解从传统机器学习、深度学习、Transformer、LLM、VLM、多模态，到预训练、Post-training、对齐、推理部署和评估的完整链路。

它和 `ai-fullstack/` 的分工：

- `artificial-intelligence/`：模型、算法、训练、后训练、推理、评估、安全。
- `ai-fullstack/`：Agent、RAG、Tool Calling、Streaming UI、应用工程闭环。

## 能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 ML Foundation | 概率、线代、优化、传统 ML | 能解释模型学习的基本机制 |
| L2 Deep Learning | MLP、CNN、RNN、Embedding、Loss、Optimizer | 能训练和诊断神经网络 |
| L3 Transformer | Attention、Position、Normalization、Scaling | 能解释现代大模型核心结构 |
| L4 Foundation Models | LLM、VLM、多模态、Embedding、Diffusion | 能理解模型家族和能力边界 |
| L5 Training System | 数据、预训练、SFT、RLHF/DPO、评估 | 能理解模型如何被训练出来 |
| L6 Inference System | KV Cache、量化、并行、Serving、成本 | 能让模型高效服务 |
| L7 AI Research / Architecture | 读论文、做取舍、设计模型应用系统 | 能把研究和工程连接起来 |

## 知识图谱

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI 知识体系全景                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [L1 基础层]                                                            │
│    foundations/ ──► linear-algebra / probability / optimization /       │
│                     information-theory                                  │
│                                                                         │
│  [L2 机器学习]                                                          │
│    machine-learning/ ──► supervised / unsupervised / tree-models /      │
│                          feature-engineering / metrics                  │
│                                                                         │
│  [L3 深度学习]                                                          │
│    deep-learning/ ──► MLP / CNN / RNN / backpropagation /               │
│                       optimizers / regularization / training-diagnosis  │
│                                                                         │
│  [L4 Transformer 核心]                                                  │
│    transformers/ ──► attention / positional-encoding /                  │
│                      encoder-decoder / scaling / architecture-evolution │
│                                                                         │
│  [L5 基础模型]                                                          │
│    llm/ ──► tokenizer / architecture / pretraining / post-training      │
│    vlm/ ──► vision-encoder / projector / multimodal-alignment           │
│    multimodal/ ──► fusion / cross-modal / audio / video                 │
│                                                                         │
│  [L6 训练系统]                                                          │
│    training-data/ ──► pipeline / dedup / synthetic / mixture            │
│    pretraining/ ──► objectives / distributed / stability / scaling-law  │
│    post-training/ ──► SFT / RLHF / DPO / tool-use / safety-tuning       │
│    alignment/ ──► helpful / harmless / honest / red-teaming             │
│                                                                         │
│  [L7 推理与部署]                                                        │
│    inference-optimization/ ──► kv-cache / quantization /                │
│                                speculative-decoding / batching          │
│    model-serving/ ──► vLLM / TGI / Triton / GPU / routing               │
│                                                                         │
│  [L8 评估与安全]                                                        │
│    evaluation/ ──► benchmark / llm-as-judge / safety-eval / agent-eval  │
│    ai-safety/ ──► jailbreak / prompt-injection / guardrails / policy    │
│                                                                         │
│  [L9 工程与运营]                                                        │
│    mlops/ ──► experiment / registry / monitoring / drift                │
│                                                                         │
│  [L10 研究与案例]                                                       │
│    research-papers/ ──► transformer / alignment / inference / vlm       │
│    reasoning-agents/ ──► CoT / tool-use / test-time-compute             │
│    case-studies/ ──► coding-assistant / vlm-document / agent-tool-use   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| Foundations | [`foundations/`](./foundations/) | 数学、概率、优化、信息论基础 |
| Machine Learning | [`machine-learning/`](./machine-learning/) | 监督、无监督、树模型、特征工程 |
| Deep Learning | [`deep-learning/`](./deep-learning/) | 神经网络、反向传播、优化器、正则化 |
| Transformers | [`transformers/`](./transformers/) | Attention、Encoder/Decoder、位置编码、Scaling |
| LLM | [`llm/`](./llm/) | Tokenizer、预训练、上下文、能力、局限 |
| VLM | [`vlm/`](./vlm/) | Vision Encoder、Projector、视觉语言对齐 |
| Multimodal | [`multimodal/`](./multimodal/) | 文本、图像、音频、视频、跨模态融合 |
| Training Data | [`training-data/`](./training-data/) | 数据清洗、去重、质量、合成数据、数据配比 |
| Pretraining | [`pretraining/`](./pretraining/) | 目标函数、训练稳定性、Scaling Law、分布式训练 |
| Post-training | [`post-training/`](./post-training/) | SFT、RLHF、DPO、RLAIF、Reward Model、偏好优化 |
| Alignment | [`alignment/`](./alignment/) | helpful、harmless、honest、安全策略和拒答 |
| Reasoning / Agents | [`reasoning-agents/`](./reasoning-agents/) | CoT、ToT、tool use、planning、self-reflection |
| Inference Optimization | [`inference-optimization/`](./inference-optimization/) | KV Cache、batching、quantization、speculative decoding |
| Evaluation | [`evaluation/`](./evaluation/) | Benchmark、LLM-as-judge、arena、任务评估 |
| AI Safety | [`ai-safety/`](./ai-safety/) | jailbreak、prompt injection、red teaming、policy |
| Model Serving | [`model-serving/`](./model-serving/) | vLLM、TGI、Triton、GPU、并行、成本 |
| MLOps | [`mlops/`](./mlops/) | experiment、registry、monitoring、data/model drift |
| Research Papers | [`research-papers/`](./research-papers/) | 论文路线和精读模板 |
| Case Studies | [`case-studies/`](./case-studies/) | 用模型案例串联算法和工程 |

## 推荐路线

```text
ML / DL 基础
  -> Transformer
    -> LLM
      -> Training Data / Pretraining
        -> Post-training / Alignment
          -> VLM / Multimodal
            -> Inference Optimization / Model Serving
              -> Evaluation / Safety
                -> AI Fullstack 应用闭环
```

## 必须能回答的问题

- Transformer 为什么适合大规模序列建模？
- LLM 训练目标是什么，为什么 next token prediction 能产生通用能力？
- Tokenizer 如何影响模型能力和成本？
- SFT、RLHF、DPO 分别解决什么问题？
- Reward Model 怎么训练，有什么偏差？
- VLM 如何把视觉特征和语言空间对齐？
- 多模态模型里的 early fusion、late fusion、cross attention 有什么差异？
- KV Cache 为什么能加速自回归推理？
- 量化、batching、speculative decoding 分别牺牲和换来什么？
- 如何评估一个 LLM / VLM / Agent 系统？
