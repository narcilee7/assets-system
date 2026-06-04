# Pretraining

预训练主线关注基础模型能力如何从大规模数据和计算中产生。

## 核心主题

| 主题 | 关键点 |
| --- | --- |
| Objective | next token prediction、masked modeling |
| Scaling Law | data、params、compute |
| Optimization | AdamW、lr schedule、warmup、gradient clipping |
| Stability | loss spike、nan、norm、initialization |
| Distributed Training | data parallel、tensor parallel、pipeline parallel、ZeRO |
| Checkpoint | save、resume、sharding |

## 资产

| 资产 | 状态 |
| --- | --- |
| [预训练目标函数](./objectives.md) | ✅ |
| [分布式训练](./distributed-training.md) | ✅ |
