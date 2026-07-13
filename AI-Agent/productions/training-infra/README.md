# LLM/Agent Training Infra 骨架设计

> 面向 LLM/Agent 时代的 Pretrain / Post-train / SFT / RLHF 训练基础设施骨架  
> 以 Wandb 实验追踪与 Weave 评估为核心观测层  
> 版本：2026.07

---

## 设计目标与边界

### 目标

本骨架面向以下场景：

- **Pretrain**：大规模语料的 next-token prediction，关注 throughput、checkpoint 稳定性、分布式效率。
- **SFT**：指令遵循与对话数据微调，关注数据质量、eval metrics、LoRA/QLoRA 效率。
- **DPO / RLHF**：偏好对齐，关注 pair-wise 数据、reward model、PPO/DPO 训练稳定性。
- **Post-train**：领域适配、tool-use、multi-turn、Agent 能力注入。

### 边界

- 这是一个**工程骨架**，不是可直接复现 SOTA 的训练脚本库。
- 聚焦**基础设施层**：配置管理、数据流、训练循环、实验追踪、评估、checkpoint、分布式启动。
- 模型实现层使用伪代码或轻量封装，重点展示如何与 Wandb/Weave 集成。

### 环境说明

- **Python**：支持 3.10–3.13；`pyproject.toml` 已限定 `<3.14`，避免 resolver 检查未来 Python 版本。
- **Torch**：Python 3.13 需要 `torch>=2.5.0`。
- **Megatron-LM**：不在 PyPI 上，如需使用请从源码安装：
  ```bash
  pip install git+https://github.com/NVIDIA/Megatron-LM.git
  ```
- **Flash Attention / DeepSpeed**：在 macOS/Apple Silicon 上通常没有预编译 wheel，建议在 Linux + CUDA 环境使用；本地骨架开发时可只安装基础依赖：
  ```bash
  make install-dev
  ```

---

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户 / CI / Scheduler                          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                    launch_single.sh / launch_distributed.sh
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         llm_trainer.main.py                              │
│   stage = pretrain | sft | dpo | posttrain                               │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
   │   Config    │        │    Data     │        │   Model     │
   │  (OmegaConf │        │  DataModule │        │  + LoRA/    │
   │  + Pydantic)│        │  JSONL/Parquet/HF│   │  QLoRA)     │
   └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Trainer (BaseTrainer)                           │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│   │PretrainTrainer│  │  SFTTrainer  │  │  DPOTrainer  │  │PosttrainTrainer│
│   └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
       ▼                          ▼                          ▼
┌─────────────┐          ┌─────────────┐          ┌─────────────────────┐
│ WandbTracker│          │CheckpointMgr│          │   WeaveEvaluator    │
│ · metrics   │          │ · local     │          │ · offline eval      │
│ · config    │          │ · artifact  │          │ · LLM-as-judge      │
│ · system    │          │ · resume    │          │ · trace tool calls  │
│ · artifact  │          │ · async upload│        │ · human feedback    │
└─────────────┘          └─────────────┘          └─────────────────────┘
```

### 横切关注点

- **Wandb**：贯穿训练全生命周期的实验追踪、Artifact 版本化、超参搜索。
- **Weave**：训练后的离线评估、推理链路 tracing、Agent 行为可观测。
- **Checkpoint Manager**：本地保存 + 异步上传 Wandb Artifact / 对象存储。
- **Distributed Backend**：DDP / FSDP / DeepSpeed / Megatron-LM 的统一抽象。

---

## 训练阶段定义

### Pretrain

- **任务**：自回归 next-token prediction。
- **数据**：大规模未标注文本，通常经过质量过滤、去重、tokenization。
- **优化**：AdamW / AdamW-8bit，cosine lr schedule，warmup-stable-decay。
- **并行**：FSDP / DeepSpeed ZeRO-3 / TP+PP（大模型）。
- **关键指标**：loss、perplexity、tokens/sec/GPU、MFU。

### SFT（Supervised Fine-Tuning）

- **任务**：指令遵循、对话、单轮/多轮问答。
- **数据**：`(instruction, input, output)` 或对话列表格式。
- **优化**：LoRA / QLoRA / Full fine-tune，较小的 learning rate。
- **关键指标**：train/val loss、eval ROUGE/LLM-as-judge、response length。

### DPO（Direct Preference Optimization）

- **任务**：基于偏好数据直接优化策略模型，无需显式 reward model。
- **数据**：`(prompt, chosen, rejected)` 三元组。
- **关键指标**：DPO loss、chosen/rejected reward margin、win-rate。

### RLHF（PPO）

- **任务**：训练 reward model 后，用 PPO 对齐人类偏好。
- **组件**：Policy model、Reference model、Reward model、Value model。
- **关键指标**：KL divergence、reward score、PPO objective、response safety。

### Post-train / Agent Training

- **任务**：领域适配、tool-use、function calling、multi-turn Agent、reasoning。
- **数据**：工具调用轨迹、Agent rollout、人类标注的 trajectory。
- **关键指标**：tool accuracy、task success rate、turn efficiency、Weave trace 质量。

---

## Wandb 集成设计

### 命名规范

```yaml
wandb:
  project: "llm-agent-train"
  entity: "my-org"
  group: "sft-llama3-8b-v1"      # 同一组实验
  run_name: "sft-lora-r64-a16"   # 单次运行
  tags: ["sft", "lora", "llama3"]
```

### 自动记录内容

| 类型 | 内容 | 频率 |
|---|---|---|
| Metrics | loss、lr、grad_norm、tokens/sec、MFU | 每 step |
| System | GPU 利用率、显存、温度、功耗 | 每 30s |
| Config | 完整训练配置（yaml + args） | 初始化 |
| Artifact | dataset、tokenizer、checkpoint、config | 按需/定时 |
| Tables | 训练样本示例、eval 输出对比 | 每 epoch |

### Artifact 版本化

```python
# 数据集 artifact
wandb_tracker.log_artifact(
    name="sft-dataset-v1",
    type="dataset",
    path="data/sft/train.jsonl",
    metadata={"num_samples": 100000, "avg_len": 512}
)

# Checkpoint artifact
wandb_tracker.log_artifact(
    name="checkpoint-step-1000",
    type="model",
    path="outputs/checkpoints/step_1000/",
    aliases=["latest", "best-so-far"]
)
```

### Sweeps 超参搜索

```yaml
# configs/sweep_sft.yaml
method: bayes
metric:
  name: eval/loss
  goal: minimize
parameters:
  learning_rate:
    distribution: log_uniform_values
    min: 1e-5
    max: 1e-3
  lora_r:
    values: [8, 16, 32, 64]
```

---

## Weave 集成设计

### 评估流程

```
Train Model → Export Checkpoint → Weave Evaluation Dataset
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Weave Scorer │
                              │ · perplexity  │
                              │ · ROUGE       │
                              │ · LLM-as-judge│
                              │ · tool accuracy│
                              └───────┬───────┘
                                      │
                                      ▼
                              Weave Dashboard
```

### Tracing Agent 行为

```python
import weave

@weave.op()
def agent_step(prompt: str, tools: list) -> str:
    # 调用策略模型选择 tool
    # 执行 tool
    # 返回 observation
    return observation

with weave.trace_context():
    final_answer = run_agent_episode(prompt, tools)
```

### 与 Wandb 数据打通

- Weave 项目与 Wandb Project 绑定，评估结果可在 Wandb Run Page 直接查看。
- Eval metrics 写回 Wandb，形成"训练 → 评估 → 再训练"闭环。

---

## 数据流设计

### 统一 DataModule

```python
class DataModule:
    def __init__(self, config):
        self.dataset_path = config.data.path
        self.format = config.data.format       # jsonl | parquet | huggingface
        self.stage = config.stage              # pretrain | sft | dpo

    def get_dataloader(self, split: str) -> DataLoader:
        dataset = load_dataset(self.dataset_path, split)
        dataset = self.apply_stage_format(dataset)
        return DataLoader(dataset, ...)
```

### 分阶段数据格式示例

**Pretrain**：
```json
{"text": "..."}
```

**SFT**：
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**DPO**：
```json
{
  "prompt": "...",
  "chosen": "...",
  "rejected": "..."
}
```

**Agent Post-train**：
```json
{
  "trajectory": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "tool_calls": [...]},
    {"role": "tool", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

---

## Checkpointing & Artifact 管理

### 保存策略

| 策略 | 触发条件 | 用途 |
|---|---|---|
| step | 每 N step | 容错恢复 |
| epoch | 每 epoch 结束 | 阶段交付 |
| best | eval metric 最优 | 最终模型 |
| final | 训练结束 | 最终交付 |

### 恢复流程

```python
checkpoint_manager = CheckpointManager(config)

# 自动检测最新 checkpoint
resume_from = checkpoint_manager.find_latest_checkpoint()

# 恢复模型、优化器、scheduler、step
trainer.load_checkpoint(resume_from)
```

### 异步上传

```python
# 本地保存后立即返回，上传在后台线程/进程执行
checkpoint_manager.save(step, model, optimizer, scheduler)
checkpoint_manager.upload_async_to_wandb(step)
```

---

## 分布式训练模式

### 选型矩阵

| 模式 | 适用规模 | 显存节省 | 通信特点 | 推荐框架 |
|---|---|---|---|---|
| DDP | 模型可放入单卡 | 无 | All-Reduce 梯度 | PyTorch DDP |
| FSDP | 70B 以下 | 分片参数/梯度/优化器 | All-Gather + Reduce-Scatter | PyTorch FSDP |
| DeepSpeed ZeRO-3 | 70B–400B | 极致分片 + Offload | 参数收集开销大 | DeepSpeed |
| Megatron-LM | 400B+ | TP+PP+DP 组合 | 高带宽集群 | Megatron-LM |

### 典型配置

**单机 8×A100 80GB**：
- SFT 8B model：FSDP + LoRA，batch size 128，sequence length 4096
- Pretrain 7B model：FSDP full fine-tune，TP/PP 可选

**多机 64×H100**：
- Pretrain 70B+：FSDP / DeepSpeed ZeRO-3 + TP=8 + PP=4
- 网络：InfiniBand / NVLink，NCCL 调优

### 通信优化

- **Gradient Checkpointing**：用计算换显存。
- **Mixed Precision**：BF16 / FP16 + gradient scaling。
- **Flash Attention**：减少 attention 显存与计算。
- **序列打包**：提高 packing 效率，减少 padding。

---

## 可观测性与成本

### 关键指标

- **MFU（Model FLOPs Utilization）**：实际吞吐量 / 理论峰值 FLOPs。
- **Tokens/sec/GPU**：单卡每秒处理 token 数。
- **GPU 利用率**：SM 利用率、显存占用、NVLink 带宽。
- **Loss 健康度**：loss spike、grad nan、learning rate 同步。

### 成本估算

| 阶段 | 模型规模 | 数据量 | GPU-hours | 成本（$4/GPU-hr） |
|---|---|---|---|---|
| Pretrain | 7B | 2T tokens | ~8,000 | ~$32K |
| SFT | 7B | 100K samples | ~100 | ~$400 |
| DPO | 7B | 50K pairs | ~50 | ~$200 |
| Post-train Agent | 70B | 10K trajectories | ~500 | ~$2K |

### 告警规则

- loss > 3× 上一轮 median loss 持续 50 steps
- grad_norm nan / inf
- GPU 温度 > 85°C
- checkpoint 保存失败
- Wandb 上传断连 > 5min

---

## 代码骨架说明

```
skeleton/
├── pyproject.toml                  # 依赖：torch, transformers, peft, wandb, weave, omegaconf
├── Makefile                        # 常用命令：install/format/test/launch
├── configs/
│   ├── pretrain.yaml               # Pretrain 配置
│   ├── sft.yaml                    # SFT 配置
│   └── dpo.yaml                    # DPO 配置
├── scripts/
│   ├── launch_single.sh            # 单机单卡/多卡启动
│   └── launch_distributed.sh       # 多机分布式启动
└── src/llm_trainer/
    ├── __init__.py
    ├── main.py                     # 统一入口
    ├── config.py                   # OmegaConf + Pydantic 配置
    ├── data.py                     # DataModule
    ├── models.py                   # 模型 + LoRA 构建
    ├── trainer.py                  # BaseTrainer + 派生 Trainer
    ├── tracking.py                 # WandbTracker
    ├── evaluation.py               # WeaveEvaluator
    ├── checkpoint.py               # CheckpointManager
    └── distributed.py              # DistributedBackend
```

### 最小运行示例

```bash
# 安装依赖
cd skeleton
make install

# SFT 单机 8 卡
make sft

# Pretrain 多机
make pretrain-multi

# 查看 Wandb 面板
# https://wandb.ai/my-org/llm-agent-train
```

---

## 与现有文档的关系

- 仓库已有 `artificial-intelligence/pretraining/distributed-training.md` 介绍并行策略。
- 本文档不重复并行策略细节，而是聚焦于**训练基础设施的工程化骨架**：配置、追踪、评估、checkpoint、启动、Wandb/Weave 集成。
- 建议两文档结合阅读：先看并行策略，再看本骨架如何落地。

---

*本文档为工程骨架设计，模型训练细节需根据具体模型与集群调整。*
