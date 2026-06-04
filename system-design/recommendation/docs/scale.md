# Scale

## 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 推荐延迟 P99 | < 100ms | 从请求到返回结果 |
| 推荐服务吞吐 | > 10W QPS | 单节点 |
| 推荐候选集 | 召回万级 → 精排百级 → 返回十级 | 漏斗逐层递减 |
| 推荐准确率（CTR）| 提升 5-10% | AB 测试验证 |
| 覆盖率 | > 60% | 长尾内容曝光比例 |
| 模型更新频率 | 小时级增量，天级全量 | 保证实时性 |

---

## 性能瓶颈分析

### 瓶颈 1：特征获取延迟

#### 问题

推荐请求需要获取用户特征（实时 + 离线）、物品特征（批量），特征获取延迟占总延迟的 50-70%。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **并行拉取** | 用户特征和物品特征并行请求 | 延迟降低 40% |
| **本地缓存** | 热点特征缓存在进程内存 | 延迟降低 30% |
| **特征预取** | 推荐结果返回后预取下批特征 | 下次请求更快 |
| **特征降级** | 超时用默认值，不阻塞 | 延迟稳定 |

#### 特征获取优化实现

```go
func (f *FeatureStore) GetFeaturesParallel(userID string, itemIDs []string) (*Features, error) {
    var wg sync.WaitGroup
    errChan := make(chan error, 3)

    var userFeatures *UserFeatures
    var itemFeatures []*ItemFeatures
    var crossFeatures CrossFeatures

    // 并行拉取 3 类特征
    wg.Add(3)
    go func() {
        defer wg.Done()
        userFeatures, errChan <- f.GetUserFeatures(userID)
    }()
    go func() {
        defer wg.Done()
        itemFeatures, errChan <- f.GetItemFeatures(itemIDs)
    }()
    go func() {
        defer wg.Done()
        crossFeatures, errChan <- f.GetCrossFeatures(userID, itemIDs)
    }()
    wg.Wait()

    // 检查错误，任一失败则降级
    select {
    case err := <-errChan:
        return f.GetDefaultFeatures(), err
    default:
        return mergeFeatures(userFeatures, itemFeatures, crossFeatures), nil
    }
}
```

---

### 瓶颈 2：模型推理延迟

#### 问题

精排模型（DNN / DeepFM）参数量大，单次推理耗时 20-50ms，在高 QPS 下成为瓶颈。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **模型蒸馏** | 大模型→小模型（精度损失 < 5%）| 速度提升 5x |
| **模型量化** | float32→int8 | 速度提升 2-3x，内存降 4x |
| **模型剪枝** | 删除不重要的神经元 | 速度提升 30-50% |
| **GPU 加速** | TensorRT/CUDA | 速度提升 10x |
| **Batch 优化** | 批量请求合并推理 | 吞吐量提升 |

#### 模型优化对比

```
DeepFM 模型大小和速度对比：

原始模型（FP32）：
  - 参数量：100M
  - 推理延迟：30ms
  - 内存占用：400MB

量化模型（INT8）：
  - 参数量：25M
  - 推理延迟：10ms
  - 内存占用：100MB
  - 精度损失：< 3%

蒸馏模型（DeepFM-S）：
  - 参数量：10M
  - 推理延迟：5ms
  - 内存占用：40MB
  - 精度损失：< 5%
```

---

### 瓶颈 3：向量检索延迟（Embedding Retrieval）

#### 问题

向量召回需要用用户 Embedding 在 FAISS 索引中检索最相似的物品，候选集 1000-10000，延迟 10-50ms。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **IndexHNSW** | 图索引，O(log N) 检索 | 高速，内存大 |
| **分层索引** | 热内容 Flat，冷内容 HNSW | 平衡精度和速度 |
| **量化索引** | Product Quantization（PQ）| 内存降低 10x |
| **多核并行** | SIMD 并行计算 | 速度提升 2x |

#### FAISS 索引选择

```
候选集 < 10W：
  - IndexFlatIP（精确检索）
  - 优点：精确
  - 缺点：慢

候选集 10W-100W：
  - IndexIVFFlat（倒排 + Flat）
  - nprobe=50（检索 50 个聚类）
  - 优点：快，精度高
  - 缺点：需要训练

候选集 > 100W：
  - IndexHNSW（分层导航图）
  - M=32（每层 32 个邻居）
  - 优点：极速（O(log N)）
  - 缺点：内存大 2-3x
```

---

### 瓶颈 4：召回层计算量

#### 问题

多路召回，每路 1000-5000 个候选，总候选集 10000-30000，后续排序计算量大。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **召回量控制** | 每路召回限定数量 | 总候选减少 |
| **轻量粗排前置** | 召回后先粗排再精排 | 精排候选减少 |
| **异步召回** | 提前异步触发召回 | 延迟降低 |
| **缓存召回结果** | 热点用户缓存召回结果 | 重复请求加速 |

#### 分层召回策略

```
传统：
  召回 10000 → 精排 100 → 返回 10

优化：
  召回 3000 → 粗排 500 → 精排 100 → 返回 10
  （提前过滤，降低计算量）
```

---

### 瓶颈 5：热点用户的并发压力

#### 问题

热点用户（高活跃用户）请求频繁，同一用户的推荐结果可能被缓存，但新行为产生后需要及时更新。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **热点用户缓存** | 高活跃用户推荐结果缓存 30s | QPS 降低 50% |
| **写入时更新缓存** | 用户行为产生后更新缓存 | 实时性保证 |
| **缓存失效策略** | LRU + TTL 双保险 | 内存效率高 |

#### 缓存策略实现

```go
type RecommendationCache struct {
    local  *caffeine.Cache[string, []RankItem]  // 本地缓存
    redis  *redis.Client
}

func (c *RecommendationCache) Get(userID string) ([]RankItem, bool) {
    // 1. 先查本地缓存
    if items, ok := c.local.Get(userID); ok {
        return items, true
    }

    // 2. 查 Redis
    items, err := c.redis.Get(c.key(userID))
    if err == nil {
        c.local.Set(userID, items)  // 回填本地
        return items, true
    }

    return nil, false
}

func (c *RecommendationCache) Invalidate(userID string) {
    // 用户有新行为时失效缓存
    c.local.Delete(userID)
    c.redis.Del(c.key(userID))
}
```

---

## 扩展方案

### 扩展维度 1：召回层水平扩展

```
问题：单节点召回计算能力有限

解决：
  - 召回通道分片
  - 每通道独立计算，结果合并
  - 按 user_id hash 分配计算节点

架构：
  ┌────────────────────────────────────┐
  │          Recall Router              │
  │    （按 user_id hash 分发）         │
  └────────────────────────────────────┘
        │           │           │
   ┌────┴───┐   ┌────┴───┐   ┌────┴───┐
   │ CF 节点 │   │Emb 节点│   │Hot 节点│
   │         │   │        │   │        │
   └─────────┘   └────────┘   └────────┘
```

### 扩展维度 2：特征存储扩展

```
问题：用户特征 + 物品特征存储量大，单 Redis 扛不住

解决：
  - 冷热分离
  - 热数据在 Redis，热数据在 MySQL/HBase
  - 异步预热

架构：
  Redis（热数据）←→ 预热 Worker ←→ HBase（冷数据）
```

### 扩展维度 3：模型服务化

```
问题：模型文件大，内存占用高

解决：
  - 模型服务化（TensorFlow Serving / Triton）
  - 模型版本管理
  - A/B 测试支持

架构：
  ┌─────────────────────────────────┐
  │     Model Serving Cluster        │
  │   （TF Serving / Triton）        │
  │   - 模型热加载                  │
  │   - 自动扩缩容                  │
  │   - 支持 GPU                    │
  └─────────────────────────────────┘
         ↑ HTTP/gRPC
  ┌─────────────────────────────────┐
  │     推荐服务                    │
  │   - 请求模型预测                │
  │   - 批量请求优化                │
  └─────────────────────────────────┘
```

---

## 容量规划

### QPS 容量估算

```
目标 QPS = 10W

单节点推荐服务 QPS = 1000（CPU 密集型推理）
所需节点数 = 10W / 1000 = 100 节点

考虑冗余（2 个故障节点容灾）：
  实际配置 = 100 + 20 = 120 节点

节点配置：
  - CPU：32 核
  - 内存：64GB（特征缓存 + 模型）
  - GPU：NVIDIA T4（加速推理）
```

### 特征存储容量估算

```
用户特征：
  - 用户数：1 亿
  - 每用户特征大小：2KB
  - 总大小：1亿 × 2KB = 200GB

物品特征：
  - 物品数：1 亿
  - 每物品特征大小：1KB
  - 总大小：1亿 × 1KB = 100GB

Embedding：
  - 物品 Embedding：1亿 × 512 × 4B = 200GB
  - 用户 Embedding：1亿 × 128 × 4B = 50GB

总存储：
  - Redis：300GB（热数据）
  - HBase：350GB（冷数据）
```

### 计算资源估算

```
精排模型推理：
  - 模型大小：100MB
  - 单次推理：30ms（CPU）/ 3ms（GPU）
  - QPS：10W
  - GPU 利用率目标：70%

所需 GPU 资源：
  - 单 GPU（T4）吞吐量：300 QPS
  - 所需 GPU 数：10W / 300 = 333 张
  - 考虑冗余：400 张 T4
```

---

## 监控指标

### 核心指标

```prometheus
# 延迟
recommendation_latency_seconds{quantile="0.99"} 0.098
recommendation_latency_seconds{quantile="0.95"} 0.065
recommendation_latency_seconds{quantile="0.50"} 0.032

# 吞吐
recommendation_requests_total 952345
recommendation_requests_rate 9523.5

# 各阶段延迟
recall_latency_seconds{quantile="0.99"} 0.015
coarse_rank_latency_seconds{quantile="0.99"} 0.010
fine_rank_latency_seconds{quantile="0.99"} 0.025
rerank_latency_seconds{quantile="0.99"} 0.005

# 召回质量
recall_size{channel="cf"} 2000
recall_size{channel="embedding"} 3000
recall_size{channel="popularity"} 2000
recall_size_total 7000

# 排序质量
ranking_score_top1{metric="ctr_pred"} 0.0823
ranking_score_top10{metric="ctr_pred"} 0.0545

# 多样性
diversity_ild 0.72
diversity_coverage 0.68
diversity_novelty 0.35

# 模型指标
model_auc{version="v3.2.1"} 0.7823
model_ctr_pred_avg{version="v3.2.1"} 0.0432
```

### 告警阈值

| 指标 | 警告 | 严重 |
|------|------|------|
| 推荐延迟 P99 | > 100ms | > 200ms |
| 推荐成功率 | < 99.5% | < 99% |
| 召回覆盖率 | < 60% | < 50% |
| 推荐多样性 ILD | < 0.6 | < 0.4 |
| 模型 AUC | < 0.70 | < 0.65 |
| 特征新鲜度延迟 | > 30min | > 1h |
| 缓存命中率 | < 80% | < 60% |
| 模型更新延迟 | > 2h | > 4h |
