# 分布式训练

大模型训练需要分布式计算。理解并行策略是训练效率的关键。

## 并行策略概览

```
数据并行 (DP):    每个 GPU 有完整模型，处理不同数据
模型并行 (MP):    每个 GPU 有模型的一部分
流水线并行 (PP):  模型按层切分到不同 GPU
张量并行 (TP):    每层内部矩阵切分到不同 GPU
序列并行 (SP):    序列维度切分
专家并行 (EP):    MoE 中不同专家在不同 GPU
```

## 数据并行 (Data Parallelism)

### DDP (DistributedDataParallel)

```
每个 GPU:
  1. 前向传播（独立）
  2. 反向传播（独立，积累本地梯度）
  3. All-Reduce 同步梯度（平均）
  4. 各自更新参数（相同梯度 → 相同参数）

通信量：2 × 模型参数量 / 迭代
限制：模型必须能放入单个 GPU
```

### ZeRO (Zero Redundancy Optimizer)

```
ZeRO 将优化器状态、梯度、参数分片到不同 GPU：

ZeRO-1: 分片优化器状态（显存 4× 节省）
ZeRO-2: + 分片梯度（显存 8× 节省）
ZeRO-3: + 分片参数（显存 与 GPU 数成正比）

Offload: 将状态卸载到 CPU/NVMe（进一步节省）
```

| 阶段 | 显存节省 | 通信开销 |
|------|---------|---------|
| ZeRO-1 | 4× | 与 DDP 相同 |
| ZeRO-2 | 8× | 与 DDP 相同 |
| ZeRO-3 | N× (GPU 数) | 增加参数收集开销 |

## 张量并行 (Tensor Parallelism)

```
将矩阵按行或列切分：

线性层 Y = X × W

列切分: W = [W1 | W2]  →  Y = [XW1 | XW2]  → All-Gather
行切分: W = [W1]       →  Y = X1W1 + X2W2  → All-Reduce
        [W2]
```

**应用**：Megatron-LM 的核心
- 切分 attention 和 FFN 的大矩阵
- 通常 TP size = 8（一个 NVLink 域内的 GPU）

## 流水线并行 (Pipeline Parallelism)

```
将模型按层分组：

GPU 0: Layers 0-3
GPU 1: Layers 4-7
GPU 2: Layers 8-11
...

前向：GPU 0 → GPU 1 → GPU 2 → ...
反向：GPU N → ... → GPU 2 → GPU 1 → GPU 0
```

### 气泡问题

```
无 Pipeline 并行：
[F0][F1][F2]...[B2][B1][B0]

Pipeline 并行（ naive ）：
GPU0: [F0][F1][F2]...[  ][  ]  等待
GPU1: [  ][F0][F1]...[B2][  ]  等待
GPU2: [  ][  ][F0]...[B1][B2]  等待

气泡 = GPU 空闲等待时间
```

### GPipe / PipeDream

| 方法 | 解决 | 代价 |
|------|------|------|
| GPipe | 微批次 + 梯度累积 | 内存增加 |
| PipeDream | 异步权重更新 | 权重陈旧 |
| 1F1B (One-Forward-One-Backward) | 交替执行 | 内存最优，主流选择 |

## 3D 并行

```
现代大模型训练通常组合使用：

DP × TP × PP

示例：GPT-3 175B
- TP = 8（一台 DGX 内部）
- PP = 12（层分组）
- DP = 16（数据分片）
- 总 GPU = 8 × 12 × 16 = 1536
```

## 通信操作

| 操作 | 功能 | 集合通信 |
|------|------|---------|
| All-Reduce | 所有 GPU 求和并广播结果 | Ring/Mesh |
| All-Gather | 收集所有分片，拼接完整 | - |
| Reduce-Scatter | 先 reduce 再 scatter | ZeRO-3 |
| Broadcast | 一个广播到所有 | 初始化 |
| Point-to-Point | 相邻 GPU 通信 | Pipeline |

## FSDP (Fully Sharded Data Parallel)

```
PyTorch 原生实现，类似 ZeRO-3：
- 自动分片参数、梯度、优化器状态
- 可与 TP/PP 组合
- 更易用的 API
```

## 常见误区

| 误区 | 正解 |
|------|------|
| 更多 GPU 总是更快 | ❌ 通信开销和流水线气泡会抵消收益 |
| TP 和 PP 可以互换 | ❌ TP 适合层内通信密集，PP 适合层间 |
| ZeRO-3 比 ZeRO-1 总是更好 | ⚠️ 通信开销更大，需权衡 |
| 混合精度不影响并行 | ❌ BF16 通信量减半，影响带宽需求 |

## 快速检查清单

- [ ] 理解 DP、TP、PP 的切分维度
- [ ] 知道 ZeRO 三个阶段的区别
- [ ] 理解 Pipeline 并行的气泡问题
- [ ] 能估算 3D 并行的 GPU 数量需求
