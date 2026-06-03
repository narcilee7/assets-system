# Post-training

Post-training 是把基础模型变成可用助手、工具调用模型、对齐模型的关键阶段。

## 方法地图

| 方法 | 目标 | 关键点 |
| --- | --- | --- |
| SFT | 学会指令和格式 | instruction data、loss mask、format |
| Reward Model | 学习偏好 | pairwise preference、rank loss |
| RLHF | 用奖励优化策略 | PPO、KL penalty、reward hacking |
| RLAIF | AI feedback 替代人工反馈 | judge quality、bias |
| DPO | 直接偏好优化 | chosen/rejected、reference model |
| IPO / KTO | 偏好优化变体 | objective 差异 |
| Tool-use Tuning | 学会调用工具 | schema、trajectory、error recovery |
| Safety Tuning | 安全拒答和边界 | policy、red team data |

## 资产

| 资产 | 状态 |
| --- | --- |
| Post-training playbook | todo |
| SFT data format notes | todo |
| RLHF pipeline map | todo |
| DPO objective walkthrough | todo |
| reward hacking examples | todo |
| tool-use post-training | todo |

## 追问

- SFT 和 RLHF 解决的问题有什么不同？
- DPO 为什么可以绕过显式 RL？
- Reward Model 为什么会被 hack？
- Post-training 会不会损伤基础能力？
- 工具调用数据应该如何构造？

