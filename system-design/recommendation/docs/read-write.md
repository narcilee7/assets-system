# Read & Write Path

## 推荐系统核心流程

```
用户请求
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 0: 上下文准备                                     │
│  1. 获取用户基础信息（从 Redis / Feature Store）          │
│  2. 获取用户实时兴趣特征（短期行为序列）                  │
│  3. 获取用户上下文特征（时间、位置、设备）                 │
│  4. 获取推荐场景参数（召回数量、过滤规则）                  │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: 多路召回（Multi-Channel Recall）               │
│  总候选集：10000                                         │
│  ├── [1] 协同过滤召回（CF）→ 2000 个                     │
│  ├── [2] 向量召回（Embedding）→ 3000 个                  │
│  ├── [3] 热度召回 → 2000 个                             │
│  ├── [4] 基于标签召回 → 1000 个                         │
│  ├── [5] 冷启动召回 → 500 个（针对新用户/新内容）          │
│  └── [6] 社交召回 → 500 个（好友互动内容）               │
│  合并去重：约 8000-9000 个候选                            │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 2: 粗排（Coarse Ranking）                         │
│  输入：8000 个候选物品                                   │
│  ├── 轻量级特征提取                                      │
│  ├── 轻量模型排序（GBDT / 简单 DNN）                      │
│  └── 输出：Top 500 个                                    │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: 精排（Fine Ranking）                           │
│  输入：500 个候选物品                                     │
│  ├── 全部特征提取（用户+物品+交叉+上下文）                 │
│  ├── 复杂排序模型（DNN / DeepFM / DIN）                   │
│  └── 输出：Top 100 个 + 分数                             │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 4: 重排（Re-ranking）                            │
│  输入：Top 100 个 + 分数                                 │
│  ├── 过滤已曝光物品（用户看过就过滤）                     │
│  ├── 插入广告 / 扶持内容                                  │
│  ├── DPP 多样性优化                                      │
│  ├── 时间衰减                                            │
│  └── 最终排序：Top 10-20 个                              │
└─────────────────────────────────────────────────────────┘
  │
  ▼
  返回客户端
```

---

## 详细阶段分析

### PHASE 1: 多路召回详解

#### 1. 协同过滤召回（Collaborative Filtering）

```
原理：找到和用户相似的用户，或者找到和用户历史喜欢的物品相似的物品

User-Based CF：
  1. 找到和用户 U 历史行为相似的用户集合 {U1, U2, ...}
  2. 从这些用户的历史喜欢物品中，推荐用户 U 没看过的

Item-Based CF：
  1. 对用户 U 历史喜欢的物品集合 {I1, I2, ...}
  2. 找到和这些物品相似的物品 {I1', I2', ...}
  3. 推荐给用户 U

矩阵分解（MF）：
  - 将用户-物品交互矩阵分解为 User Factors × Item Factors
  - User Factors × Item Factors.T = 预测评分
  - 离线计算 User Factors 和 Item Factors
  - 在线：用户向量 × 物品向量 = 相似度
```

#### 2. 向量召回（Embedding Retrieval）

```
原理：用 Embedding 向量表示用户和物品，计算余弦相似度

物品 Embedding 预计算（离线）：
  1. 用图神经网络（GNN）或 BERT 提取物品特征
  2. 编码为 128-512 维向量
  3. 存入 FAISS 索引

用户 Embedding 在线计算：
  1. 获取用户最近 N 次行为的物品 Embedding
  2. 注意力加权聚合得到用户向量
  3. 用用户向量在 FAISS 中检索最相似的物品

FAISS 索引选择：
  - IndexFlatIP：精确检索，适合候选集 < 10W
  - IndexIVFFlat：倒排索引，加速检索，适合 > 10W
  - IndexHNSW：图索引，高速，适合 > 100W
```

#### 3. 热度召回（Popularity-Based）

```
原理：推荐近期热门内容

热度计算公式：
  popularity = (click_count / exposure_count) × decay_factor

时间衰减（decay_factor）：
  - hour_decay = exp(-hours_since_publish / 24)
  - recent_decay = 1 / (1 + log(1 + hours_since_publish))

分类热度：
  - 全局热度：所有物品的总体热度
  - 分类热度：按 category 分别计算热度
  - 标签热度：按 tag 分别计算热度

过滤条件：
  - 排除低质量物品（quality_score < 0.3）
  - 排除已曝光物品
  - 排除用户明确不喜欢的内容
```

#### 4. 多路召回融合

```go
type RecallResult struct {
    Items     []RecallItem
    Channel   string
}

type RecallItem struct {
    ItemID    string
    Score     float64
    Channel   string
}

func MergeRecallResults(results []RecallResult, weights map[string]float64) []RecallItem {
    // 1. 分数归一化（Min-Max）
    for _, result := range results {
        normalize(result.Items)
    }

    // 2. 加权求和
    merged := make(map[string]float64)
    for _, result := range results {
        weight := weights[result.Channel]
        for _, item := range result.Items {
            merged[item.ItemID] += item.Score * weight
        }
    }

    // 3. 取 Top N
    sort.Slice(merged, func(i, j int) bool {
        return merged[i] > merged[j]
    })

    return topN(merged, 1000)
}
```

---

### PHASE 2: 粗排详解

#### 轻量级模型

```go
type CoarseRanker struct {
    model *LightGBM
}

func (c *CoarseRanker) Predict(candidates []Item, features *Features) []float64 {
    // 1. 提取粗排特征（少量关键特征）
    //    - 用户 ID、类别偏好
    //    - 物品 ID、质量分、热度
    //    - 用户-物品交叉特征

    // 2. 批量预测
    scores := c.model.PredictBatch(features)

    // 3. 排序返回 Top N
    return SortByScore(candidates, scores)[:500]
}
```

**粗排特征（轻量）**：

| 特征 | 类型 | 说明 |
|------|------|------|
| user_id | ID | 用户 ID |
| category_pref | Embedding | 用户对各类别的偏好 |
| item_quality | Numeric | 物品质量分 |
| item_popularity | Numeric | 物品热度 |
| user_item_category_match | Numeric | 品类匹配度 |

---

### PHASE 3: 精排详解

#### 特征完整提取

```go
type FineRanker struct {
    model *DNN
    featureStore *FeatureStore
}

func (f *FineRanker) PredictTopN(candidates []Item, userID string) []RankItem {
    // 1. 获取用户特征
    userFeatures := f.featureStore.GetUserFeatures(userID)

    // 2. 批量获取物品特征
    itemFeatures := f.featureStore.GetItemFeatures(candidates)

    // 3. 构建交叉特征
    crossFeatures := f.BuildCrossFeatures(userFeatures, itemFeatures)

    // 4. 合并所有特征
    allFeatures := Concat(userFeatures, itemFeatures, crossFeatures)

    // 5. 模型预测
    scores := f.model.Predict(allFeatures)

    // 6. 返回 Top N
    return SortByScore(candidates, scores)[:100]
}
```

**精排特征（完整）**：

| 特征类型 | 特征 | 维度 |
|----------|------|------|
| 用户基础 | age, gender, city, is_vip | 4 |
| 用户兴趣 | short_term_interests, long_term_interests | 256 |
| 物品属性 | category, tags, author_id, quality_score | 128 |
| 物品统计 | popularity, ctr, complete_rate | 3 |
| 交叉特征 | user_item_category_match, user_author_affinity | 64 |
| 上下文 | time_of_day, day_of_week, device_type | 3 |
| 序列特征 | last_n_behaviors (attention-weighted) | 128 |

#### DeepFM 模型结构

```go
type DeepFM struct {
    // First Order（线性部分）
    linear *Linear

    // Second Order（FM 部分）
    fm *FactorizationMachine

    // Deep Part（DNN 部分）
    dnn *DeepNeuralNetwork
}

func (m *DeepFM) Forward(features *Features) float64 {
    // 1. 线性部分
    linear_out := m.linear.Forward(features)

    // 2. FM 部分（特征交互）
    fm_out := m.fm.Forward(features)

    // 3. DNN 部分（非线性特征交互）
    dnn_out := m.dnn.Forward(features)

    // 4. 合并
    return sigmoid(linear_out + fm_out + dnn_out)
}
```

---

### PHASE 4: 重排详解

#### DPP 多样性优化

```go
type DPPReRanker struct {
    lambda float64  // 多样性权重
}

func (r *DPPReRanker) Rerank(items []RankItem, userID string) []RankItem {
    // 1. 构建相似度矩阵
    //    L[i,j] = similarity(item_i, item_j)
    //    基于类别、标签、作者计算物品间相似度

    // 2. 初始化选中的物品集合
    selected := []int{}
    remaining := make([]int, len(items))

    // 3. 贪心选择
    for len(selected) < r.targetSize {
        // 计算每个候选物品的边际效用
        // marginal_util[i] = det(L[selected ∪ {i}]) - det(L[selected])
        best := -1
        best_score := -1

        for i := 0; i < len(remaining); i++ {
            score := r.computeMarginalUtility(selected, remaining[i])
            if score > best_score {
                best_score = score
                best = i
            }
        }

        selected = append(selected, remaining[best])
        remaining = append(remaining[:best], remaining[best+1:]...)
    }

    return reorderItems(items, selected)
}
```

#### 多种重排策略

```
策略 1：时间衰减
  - 越新的内容排序越高
  - score = original_score × exp(-hours_since_publish / 48)

策略 2：内容去重
  - 同一作者的内容最多出现 2-3 次
  - 同一标签的内容不能连续出现 3+ 次

策略 3：多样性约束
  - 每 5 个内容必须有 2 个不同类别
  - 同一标签不能超过 30%

策略 4：商业插入
  - 固定位置插入广告
  - 扶持新内容（冷启动）
  - 扶持付费内容（VIP）
```

---

## 在线 / 离线架构

### 推荐系统的计算分层

```
┌─────────────────────────────────────────────────────────┐
│  在线层（Online）                                        │
│  延迟要求：< 100ms                                      │
│  功能：特征获取 → 精排 → 重排 → 返回结果                  │
├─────────────────────────────────────────────────────────┤
│  近线层（Nearline）                                     │
│  延迟要求：< 5min                                       │
│  功能：实时特征更新（用户短期兴趣）                      │
├─────────────────────────────────────────────────────────┤
│  离线层（Offline）                                      │
│  延迟要求：天级/小时级                                  │
│  功能：用户 Embedding、物品 Embedding、模型训练          │
└─────────────────────────────────────────────────────────┘
```

### 实时特征更新流程（Kafka + Flink）

```
用户行为（点击/播放/完播）
  │
  ▼
Kafka Topic: user_behavior
  │
  ▼
Flink 实时计算
  │
  ├── 更新用户短期兴趣（5min 窗口聚合）
  │    Redis: user:interest:{user_id}:realtime
  │
  ├── 更新物品统计量（CTR、完播率）
  │    MySQL: item_statistics
  │
  └── 生成训练样本（正样本/负样本）
       MySQL: training_samples
```

### 离线模型训练流程

```
Step 1: 样本构建
  - 从 MySQL 拉取历史样本
  - 正负样本配比（通常 1:1 到 1:4）
  - 样本加权（高价值行为权重更高）

Step 2: 特征构建
  - 用户特征（天级更新）
  - 物品特征（天级更新）
  - 交叉特征（离线计算）

Step 3: 模型训练
  - 全量数据训练（天级）
  - 增量数据训练（小时级）
  - 模型验证（AUC > 0.7）

Step 4: 模型上线
  - 模型文件上传 OSS
  - 通知在线服务加载新模型
  - 灰度流量验证
```

---

## 特征获取链路

```
请求进入推荐服务
  │
  ▼
获取用户基础特征（Redis GET）
  │ key: user:profile:{user_id}
  │ 延迟: < 1ms
  │ 命中: 99%
  │
  ▼
获取用户实时兴趣（Redis HGETALL）
  │ key: user:interest:{user_id}:realtime
  │ 延迟: < 2ms
  │ 命中: 95%
  │
  ▼
获取候选物品特征（Redis MGET）
  │ key: item:features:{item_id}
  │ 延迟: < 10ms（批量）
  │
  ▼
获取物品 Embedding（本地缓存/OSS）
  │ 延迟: < 5ms
  │
  ▼
特征组装 + 模型推理
  │ 延迟: < 20ms
  │
  ▼
返回推荐结果
    总延迟: < 100ms
```

---

## 缓存策略

### 推荐结果缓存

```
场景：热点用户（高活跃）重复请求相似推荐

策略：
  - 缓存 Key: recommend:{user_id}:{scene}
  - TTL: 30s（短期缓存）
  - 缓存内容：Top 20 物品 ID + metadata

命中条件：
  - 用户 ID 相同
  - Scene 相同
  - 30s 内无新行为

不缓存场景：
  - 用户有强意图搜索
  - 用户刚完成关键行为（刚点击/刚看完）
  - 新用户冷启动
```

### Embedding 缓存

```
物品 Embedding：
  - 离线计算，天级更新
  - 存储在 OSS / Redis
  - 加载到本地内存（20GB+）
  - 分 bucket 懒加载

用户 Embedding：
  - 短期：在线计算，不缓存
  - 长期：离线计算，小时级更新
  - 存储在 Redis
```
