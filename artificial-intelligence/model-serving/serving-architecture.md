# 模型服务架构

模型服务是将训练好的模型部署到生产环境、对外提供 API 的过程。架构设计直接影响延迟、吞吐和成本。

## 服务架构层次

```
┌─────────────────────────────────────────┐
│  Load Balancer / API Gateway            │
│  (路由、限流、认证)                       │
├─────────────────────────────────────────┤
│  Application Server                     │
│  (请求解析、session 管理、业务逻辑)        │
├─────────────────────────────────────────┤
│  Inference Engine                       │
│  (vLLM / TGI / Triton)                  │
├─────────────────────────────────────────┤
│  Model Worker (GPU)                     │
│  (推理计算)                              │
├─────────────────────────────────────────┤
│  Storage / Cache                        │
│  (模型权重、KV Cache、前缀缓存)            │
└─────────────────────────────────────────┘
```

## 推理引擎对比

| 引擎 | 特点 | 适用场景 |
|------|------|---------|
| vLLM | PagedAttention、continuous batching、高吞吐 | 生产环境首选 |
| TGI | Hugging Face 出品、简单易用 | 快速部署、原型 |
| Triton + TensorRT-LLM | NVIDIA 生态、极致性能 | NVIDIA GPU 生产环境 |
| llama.cpp | CPU/边缘、量化友好 | 本地、移动设备 |
| SGLang | 结构化生成优化 | 复杂输出格式 |
| LMDeploy | 国产、TurboMind 推理 | 国内部署 |

## 请求生命周期

```
1. Prefill (Prompt Processing)
   输入：完整 prompt
   计算：所有 token 的 KV Cache
   特点：计算密集，可并行
   输出：第一个生成 token

2. Decode (Token Generation)
   输入：上一个生成的 token
   计算：新 token 的 attention（用 KV Cache）
   特点：内存密集，串行
   输出：下一个 token
   重复直到 EOS
```

**关键洞察**：
- Prefill 延迟 = TTFT (Time To First Token)
- Decode 延迟 = 每 token 时间 × 输出长度 = TPOT (Time Per Output Token)
- 优化重点不同：Prefill 看算力，Decode 看内存带宽

## Batching 策略

### Static Batching

```
等所有请求到齐一起处理
问题：短请求等长请求，GPU 利用率低
```

### Continuous Batching (In-flight Batching)

```
新请求随时加入当前 batch：

Time 0: [Req A(prefill), Req B(prefill)]
Time 1: [Req A(decode), Req B(decode), Req C(prefill)]
Time 2: [Req A(decode), Req B(decode), Req C(decode), Req D(prefill)]

效果：GPU 利用率显著提升
代表：vLLM、TensorRT-LLM
```

### 对比

| 策略 | 吞吐 | 延迟 | 公平性 |
|------|------|------|--------|
| Static | 低 | 差 | 差 |
| Continuous | 高 | 好 | 需调度策略 |

## 路由与调度

### 请求路由

| 策略 | 说明 |
|------|------|
| Round Robin | 轮询，简单 |
| Least Loaded | 负载最少，更均衡 |
| Affinity | 同 session 路由到同实例（前缀缓存） |
| Priority | 高优先级优先 |

### 调度策略

| 策略 | 目标 |
|------|------|
| FCFS | 公平，简单 |
| Shortest Job First | 降低平均延迟 |
| Preemption | 长请求让路给短请求 |
| Chunked Prefill | 大 prefill 分块，避免饿死 decode |

## 多租户隔离

```
挑战：多个用户/应用共享 GPU 集群

隔离维度：
- QPS 限流：防止单一用户占满资源
- 配额：按用户分配最大并发数
- 优先级：确保关键业务
- 成本分摊：按 token 数计费

实现：
- API Gateway 层限流
- Inference Engine 层排队和调度
```

## 降级与容错

| 策略 | 场景 | 实现 |
|------|------|------|
| 模型降级 | 主模型过载 | 切换到更小/更快模型 |
| 缓存命中 | 重复请求 | 返回缓存结果 |
| 超时截断 | 生成长度过长 | 提前返回部分结果 |
| 错误重试 | 偶发失败 | 自动重试或切换实例 |
| 排队限流 | 突发流量 | 排队或拒绝 |

## 常见误区

| 误区 | 正解 |
|------|------|
| 吞吐 = 1/延迟 | ❌ 吞吐看 batching 效率，延迟看单个请求 |
| 大 batch 总是更好 | ❌ 太大增加延迟，需权衡 |
| GPU 利用率 100% = 最优 | ⚠️ 可能是 batch 太大导致延迟过高 |
| 所有请求同等重要 | ❌ 需要优先级和 SLA 分级 |

## 快速检查清单

- [ ] 理解 prefill 和 decode 的区别
- [ ] 知道 continuous batching 的优势
- [ ] 理解 TTFT 和 TPOT 的含义
- [ ] 知道多租户隔离的关键维度
