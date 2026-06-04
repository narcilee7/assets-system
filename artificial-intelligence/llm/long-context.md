# 长上下文技术

上下文长度是 LLM 的核心竞争力之一。从 2K 到 128K+，长上下文技术让模型能处理整本书、长代码库、多轮对话历史。

## 挑战

### 计算复杂度

```
标准 Attention: O(n²) 时间和空间

n = 4K:  n² = 16M   → 可行
n = 32K: n² = 1B    → 显存压力大
n = 128K: n² = 16B  → 需要专门优化
n = 1M:  n² = 1T    → 当前极限
```

### 位置编码外推

```
训练时最多看到 8K 位置
推理时给 100K 位置 → 位置编码未见过 → 性能崩溃
```

### 注意力稀释

```
Lost in the Middle 现象：
- 信息在开头和结尾表现好
- 中间部分的信息容易被"淹没"
- 原因：softmax 归一化使远距离权重稀释
```

## 解决方案

### 1. 位置编码外推

| 方法 | 原理 | 训练需求 |
|------|------|---------|
| Position Interpolation | 线性压缩位置 | 短微调 |
| NTK-aware | 调整 RoPE base | 可无需微调 |
| YaRN | 插值 + 温度因子 | 短微调 |
| Dynamic NTK | 推理时动态调整 | 无需微调 |

**YaRN 核心**：
```
缩放因子 s = 目标长度 / 训练长度
调整 attention temperature: 1/√d → 1/(√d · t(s))
```

### 2. 高效 Attention

| 方法 | 复杂度 | 核心思想 |
|------|--------|---------|
| FlashAttention | O(n²/d) HBM 读写 | 分块计算，减少内存搬移 |
| FlashAttention-2 | 同上 | 更好的 warp 调度 |
| Ring Attention | O(n) 每设备 | 设备间环形传递 KV |
| Sparse Attention | O(n·log n) | 只计算重要位置的 attention |
| Linear Attention | O(n·d²) | 核技巧近似 softmax |

### 3. 上下文压缩

| 方法 | 原理 | 场景 |
|------|------|------|
| Hierarchical | 先摘要块，再全局 attention | 文档理解 |
| MemCache | 将历史压缩为固定大小的记忆向量 | 多轮对话 |
| Landmark Attention | 选择关键 token 作为"地标" | 长文档 |
| Retrieval-Augmented | 只加载相关片段 | 知识密集型任务 |

### 4. 架构改进

| 方法 | 原理 | 代表 |
|------|------|------|
| SWA | 局部窗口 + 全局层 | Mistral |
| Dilated Attention | 多尺度 dilated pattern | LongNet |
| Mamba / SSM | 线性复杂度的状态空间模型 | Mamba |

## 长上下文评估

| 测试 | 内容 | 难度 |
|------|------|------|
| Passkey Retrieval | 在长文本中找随机插入的密码 | 基础 |
| Needle in Haystack | 在无关文本中找关键信息 | 中等 |
| Long Document QA | 整本书/论文的问答 | 困难 |
| Multi-hop Reasoning | 跨多个片段的推理 | 困难 |
| Code Repository | 跨文件理解和修改 | 困难 |

**关键发现**：
- 大多数模型在 >32K 时性能显著下降
- 专用长上下文训练（如 128K）是必要的
- "有效上下文"通常远小于"标称上下文"

## 工程实践

```python
# 长上下文推理的显存估算
# 每 token KV Cache ≈ 2 × num_layers × num_kv_heads × head_dim × bytes

# LLaMA-2-70B, 4K context:
# ≈ 2 × 80 × 8 × 128 × 2B = 327KB per token
# 4K tokens: ~1.3GB
# 128K tokens: ~42GB（仅 KV Cache！）
```

| 优化 | 效果 |
|------|------|
| GQA/MQA | KV Cache 减少 4-8× |
| KV Cache Quantization (INT8) | 再减少 2× |
| PagedAttention | 减少内存碎片和浪费 |
| 序列并行 | 多卡分摊长序列 |

## 常见误区

| 误区 | 正解 |
|------|------|
| 支持 128K = 能有效用 128K | ❌ 通常中间部分信息丢失严重 |
| 长上下文只需改位置编码 | ❌ 还需要训练数据包含长序列 |
| FlashAttention 降低计算量 | ❌ 降低的是 HBM 读写，计算量不变 |
| SSM 会取代 Transformer | ⚠️ 有潜力但尚未在大规模上验证 |

## 快速检查清单

- [ ] 理解 attention 的 O(n²) 瓶颈
- [ ] 知道 Lost in the Middle 现象
- [ ] 理解 Position Interpolation 和 YaRN 的区别
- [ ] 能估算 KV Cache 的显存占用
