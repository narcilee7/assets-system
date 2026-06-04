# GPU 显存估算与优化

显存是推理部署的硬约束。准确估算和优化显存使用是模型服务工程的核心。

## 显存构成

```
总显存 = 模型权重 + KV Cache + 激活值 + 开销

模型权重：模型参数 × 精度
KV Cache：2 × layers × kv_heads × seq_len × head_dim × 精度
激活值：取决于 batch_size 和序列长度
开销：CUDA context、临时 buffer、碎片
```

## 模型权重显存

| 模型 | 参数量 | FP16 | INT8 | INT4 (GPTQ) |
|------|--------|------|------|------------|
| 7B | 7B | 14GB | 7GB | 3.5GB |
| 13B | 13B | 26GB | 13GB | 6.5GB |
| 70B | 70B | 140GB | 70GB | 35GB |
| 405B | 405B | 810GB | 405GB | 203GB |

## KV Cache 显存

```
公式：
2 × num_layers × num_kv_heads × max_seq_len × head_dim × bytes_per_value

LLaMA-2-7B (MHA):
= 2 × 32 × 32 × 4096 × 128 × 2
= 2.1GB per sequence

LLaMA-2-70B (GQA, 8 groups):
= 2 × 80 × 8 × 4096 × 128 × 2
= 1.3GB per sequence

注意：
- 是 per sequence，不是 per batch
- batch_size = N 时，KV Cache × N
- GQA 减少 4× (32→8 heads)
```

## 完整显存估算

```
场景：LLaMA-2-7B, FP16, batch=4, max_seq_len=4096

模型权重:     14GB
KV Cache:     4 × 2.1GB = 8.4GB
激活值:       ~2GB (取决于实现)
CUDA 开销:    ~1GB
总计:         ~25.4GB

单卡 A100-40GB 可以部署，A100-80GB 更充裕
```

## 显存优化技术

### 量化

| 技术 | 权重显存 | KV Cache 显存 | 精度影响 |
|------|---------|--------------|---------|
| FP16 | 1× | 1× | 基准 |
| W8A16 | 0.5× | 1× | 极小 |
| W4A16 (GPTQ/AWQ) | 0.25× | 1× | 中小 |
| KV INT8 | 1× | 0.5× | 小 |
| KV 4-bit | 1× | 0.25× | 中 |

### 分页与共享

```
PagedAttention:
- 非连续分配 KV Cache
- 减少内部碎片
- 支持共享（多采样、前缀缓存）

效果：显存利用率提升 20-50%
```

### CPU Offloading

```
将不活跃的 KV Cache 卸载到 CPU/主存：
- 长上下文场景
- 多会话场景

代价：延迟增加（PCIe 传输）
```

### 多卡加载

```
模型并行加载到多 GPU：
- TP=2: 每张卡 50% 模型
- TP=4: 每张卡 25% 模型

注意：
- KV Cache 也在各卡上
- 通信开销增加
- 适合单请求大模型，不适合高并发
```

## 显存计算公式速查

```python
def estimate_memory(
    params_b: float,      # 参数量 (B)
    precision_bits: int,  # 精度位数 (16, 8, 4)
    batch_size: int,
    seq_len: int,
    num_layers: int,
    num_kv_heads: int,
    head_dim: int,
    gqa_groups: int = 1,
):
    bytes_per_param = precision_bits / 8
    
    # 模型权重
    model_gb = params_b * 1e9 * bytes_per_param / 1e9
    
    # KV Cache
    kv_gb = (batch_size * seq_len * num_layers * num_kv_heads * head_dim 
             * 2 * 2 / 1e9)  # 2 for K+V, 2 bytes for FP16
    
    # 激活值 (粗略估计)
    activation_gb = batch_size * seq_len * params_b * 0.02 / 1e9
    
    # 开销 (~20%)
    total = (model_gb + kv_gb + activation_gb) * 1.2
    
    return total
```

## 常见误区

| 误区 | 正解 |
|------|------|
| 模型参数量 = 显存需求 | ❌ 还有 KV Cache、激活、开销 |
| INT4 模型显存就是 1/4 | ⚠️ 运行时通常反量化为 FP16 计算 |
| 多卡就是显存翻倍 | ❌ 每张卡仍有 overhead，非线性增长 |
| KV Cache 可以忽略 | ❌ 长上下文 + 大 batch 时 KV Cache 是主要消耗 |

## 快速检查清单

- [ ] 能手算一个模型的显存需求
- [ ] 知道 GQA 对 KV Cache 的影响
- [ ] 理解量化对显存和计算的不同影响
- [ ] 知道 PagedAttention 为什么能节省显存
