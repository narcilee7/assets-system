# Data Model

## 核心设计原则

- **特征实时性**：用户短期兴趣需要实时更新，物品统计量需要分钟级更新
- **Embedding 统一**：用户和物品用同一空间 Embedding，支持向量检索
- **样本标签清晰**：正负样本定义明确，用于模型训练

---

## 1. 用户数据模型

### 用户基础属性

```sql
CREATE TABLE users (
    id              VARCHAR(64) PRIMARY KEY,
    username        VARCHAR(128),

    -- 人口属性
    age             INT,
    gender          ENUM('male', 'female', 'unknown'),
    city            VARCHAR(64),
    country         VARCHAR(32),
    language        VARCHAR(16),

    -- 账户属性
    is_vip          BOOLEAN DEFAULT FALSE,
    registration_at TIMESTAMP,
    last_active_at  TIMESTAMP,

    -- 状态
    status          ENUM('active', 'inactive', 'banned') DEFAULT 'active',

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 用户兴趣标签

```sql
CREATE TABLE user_interest_tags (
    user_id         VARCHAR(64),
    tag             VARCHAR(64),
    weight          DECIMAL(5,4),  -- 0.0000-1.0000
    source          ENUM('explicit', 'implicit', 'collaborative'),  -- 显式/隐式/协同
    computed_at     TIMESTAMP,

    PRIMARY KEY (user_id, tag),
    INDEX idx_tag_weight (tag, weight DESC)
);
```

### 用户行为序列（实时特征）

```
Redis Hash:
  user:behavior:{user_id}:short_term  # 最近 7 天行为
    field: item_id
    value: {event_type}:{timestamp}:{item_features_hash}

  user:interest:{user_id}:realtime     # 实时兴趣
    field: tag
    value: weight (0-1)

  user:profile:{user_id}:snapshot      # 用户特征快照（用于批特征）
    JSON: 全量用户特征
```

---

## 2. 物品数据模型

### 物品基础信息

```sql
CREATE TABLE items (
    id              VARCHAR(64) PRIMARY KEY,
    title           VARCHAR(256),
    description     TEXT,

    -- 分类属性
    category        VARCHAR(64),
    sub_category    VARCHAR(64),
    tags            JSON,              -- ["技术", "编程", "Golang"]
    author_id       VARCHAR(64),

    -- 内容属性
    content_type    ENUM('video', 'article', 'audio', 'product'),
    duration_seconds INT,
    thumbnail_url   VARCHAR(512),

    -- 质量属性
    quality_score   DECIMAL(3,2),    -- 0.00-1.00，质量分
    mature_rating   BOOLEAN DEFAULT FALSE,  -- 是否成人内容

    -- 状态
    status          ENUM('pending', 'online', 'offline', 'deleted') DEFAULT 'pending',
    published_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_category (category),
    INDEX idx_author (author_id),
    INDEX idx_published (published_at DESC)
);
```

### 物品统计量（实时更新）

```sql
CREATE TABLE item_statistics (
    item_id         VARCHAR(64) PRIMARY KEY,

    -- 曝光量（累计）
    exposure_count  BIGINT DEFAULT 0,
    click_count     BIGINT DEFAULT 0,
    play_count      BIGINT DEFAULT 0,
    complete_count  BIGINT DEFAULT 0,
    share_count     BIGINT DEFAULT 0,
    unlike_count    BIGINT DEFAULT 0,

    -- 转化率（计算得出）
    ctr             DECIMAL(5,4),    -- click/exposure
    play_rate       DECIMAL(5,4),    -- play/exposure
    complete_rate   DECIMAL(5,4),    -- complete/play

    -- 时效性
    popularity_score DECIMAL(5,4),   -- 综合热度分
    freshness_score  DECIMAL(5,4),    -- 内容新鲜度

    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 3. Embedding 数据模型

### 物品 Embedding（离线计算，FAISS 索引）

```
物品 Embedding 存储：
  item_embeddings table
    item_id: VARCHAR(64)
    embedding_vector: BLOB(512)       -- 512 维 float32
    model_version: VARCHAR(32)
    computed_at: TIMESTAMP

FAISS Index（向量索引）：
  - IndexFlatIP: 余弦相似度（内积）
  - IndexIVFFlat: 倒排索引，加速检索
  - IndexHNSW: 图索引，高速但内存大

索引分区：
  - 按 category 分索引（加速过滤）
  - 或者按时间分索引（冷内容分离）
```

### 用户 Embedding（在线计算）

```
用户短期兴趣 Embedding：
  - 基于最近 N 次行为（实时行为序列）
  - 实时更新，不存盘

用户长期兴趣 Embedding：
  - 基于历史行为（离线计算，天级更新）
  - 存储在 Redis，小时级刷新
```

### Embedding 计算

```go
type EmbeddingModel struct {
    // 图神经网络（GNN）或 BERT
    encoder *Encoder

    // 物品 Embedding 预计算（离线）
    itemEmbeddings map[string][]float32
}

func (m *EmbeddingModel) ComputeUserEmbedding(behaviorSeq []*Item) []float32 {
    // 1. 获取行为物品的 Embedding 列表
    itemEmbeddings := make([][]float32, len(behaviorSeq))
    for i, item := range behaviorSeq {
        itemEmbeddings[i] = m.itemEmbeddings[item.ID]
    }

    // 2. 注意力加权聚合
    attentionWeights := m.ComputeAttention(behaviorSeq)

    // 3. 加权求和得到用户 Embedding
    userEmbedding := WeightedSum(itemEmbeddings, attentionWeights)

    return userEmbedding
}

func (m *EmbeddingModel) ComputeAttention(behaviorSeq []*Item) []float32 {
    // DIN 风格的注意力机制
    // 根据候选物品和历史物品的相关性计算注意力权重
}
```

---

## 4. 特征数据模型

### 用户特征（离线 + 在线）

```go
type UserFeatures struct {
    // 基础属性（静态，天级更新）
    UserID     string
    Age        int
    Gender     string
    City       string
    IsVIP      bool

    // 长期兴趣（离线计算）
    LongTermInterests map[string]float64  // tag → weight

    // 短期兴趣（实时计算）
    ShortTermInterests map[string]float64  // tag → weight

    // 行为统计（实时计算）
    ActivityLevel    string  // high/medium/low
    LastActiveAt      int64
    AvgWatchDuration  float64

    // 上下文特征（请求时传入）
    DeviceType       string
    NetworkType      string
    TimeOfDay        int  // 0-23
    DayOfWeek        int  // 0-6
}
```

### 物品特征

```go
type ItemFeatures struct {
    ItemID           string

    // 内容属性
    Category         string
    Tags             []string
    AuthorID         string
    AuthorQuality    float64

    // 统计特征（实时更新）
    QualityScore     float64
    PopularityScore   float64
    FreshnessScore   float64

    // 历史效果（离线计算）
    HistoricalCTR    float64
    CompleteRate     float64

    // 上下文
    ItemCreateAt     int64
    ContentDuration  int
}
```

### 交叉特征（用户×物品）

```go
type CrossFeatures struct {
    // 交互特征
    UserItemMatch map[string]float64  // 如：category_match, tag_overlap

    // 用户对物品所在类别的历史偏好
    UserCategoryAffinity map[string]float64  // category → affinity

    // 用户对物品作者的历史偏好
    UserAuthorAffinity map[string]float64  // author_id → affinity
}
```

---

## 5. 训练样本数据模型

### 样本表（用于模型训练）

```sql
CREATE TABLE training_samples (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- 样本标识
    user_id         VARCHAR(64) NOT NULL,
    item_id         VARCHAR(64) NOT NULL,

    -- 特征
    features        JSON NOT NULL,     -- 全部特征（字典形式）

    -- 标签
    label           TINYINT NOT NULL,  -- 0=负样本，1=正样本
    label_type      ENUM('click', 'play', 'complete', 'share'),

    -- 上下文
    scene           VARCHAR(64),
    position        INT,
    timestamp       TIMESTAMP,

    -- 元信息
    sample_weight   DECIMAL(3,2) DEFAULT 1.0,  -- 样本权重
    model_version   VARCHAR(32),

    INDEX idx_user (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_label (label)
);
```

### 正负样本定义

```
正样本（label=1）：
  - 用户点击物品（click=1）
  - 用户播放超过 30 秒（play_time > 30s）
  - 用户完整播放（complete=1）

负样本（label=0）：
  - 曝光但未点击（click=0）
  - 曝光但未播放（play=0）
  - 简单负样本：随机采样的未曝光物品

负样本采样策略：
  - 曝光未点击负样本：直接使用
  - 随机负采样（Random Negatives）：随机采样未曝光物品
  - 难负样本挖掘（Hard Negatives）：采样曝光但低分的物品
```

---

## 6. 召回通道数据

### 协同过滤数据

```go
type CollaborativeFiltering struct {
    // 用户-物品交互矩阵（稀疏矩阵）
    // 存储：user_id → [item_id: score]

    // Item-Item 相似度矩阵
    // 存储：item_id → [(similar_item_id, similarity_score)]

    // 矩阵分解模型
    UserFactors  map[string][]float32  // user_id → latent factors
    ItemFactors  map[string][]float32  // item_id → latent factors
}
```

### 热度榜数据

```
Redis ZSET:
  item:popularity:{category}:{time_window}
    score: popularity_score
    member: item_id

时间窗口：
  - 1小时热度：item:popularity:all:1h
  - 24小时热度：item:popularity:all:24h
  - 7天热度：item:popularity:all:7d

更新策略：
  - 实时更新（每分钟）
  - 使用滑动窗口计算
```

---

## 7. 排序模型数据

### 模型配置

```sql
CREATE TABLE model_versions (
    id              VARCHAR(64) PRIMARY KEY,
    model_name      VARCHAR(128) NOT NULL,
    version         VARCHAR(32) NOT NULL,

    -- 模型文件
    model_path      VARCHAR(512),  -- 模型文件路径（OSS）
    feature_config  JSON,          -- 特征配置
    model_config    JSON,          -- 模型超参数

    -- 训练信息
    trained_at      TIMESTAMP,
    training_type    ENUM('full', 'incremental'),

    -- 在线配置
    online_at       TIMESTAMP,
    online_status   ENUM('offline', 'candidate', 'online', 'archived'),

    -- 评估指标
    metrics         JSON,          -- {"auc": 0.78, "ctr_pred_avg": 0.04}
```

### 特征配置

```json
{
  "feature_columns": [
    {"name": "user_age", "type": "numeric", "dim": 1},
    {"name": "user_gender", "type": "categorical", "vocab_size": 3},
    {"name": "user_interest_embedding", "type": "embedding", "dim": 128},
    {"name": "item_quality_score", "type": "numeric", "dim": 1},
    {"name": "user_item_cross", "type": "cross", "dim": 64}
  ],
  "feature_groups": {
    "user": ["user_age", "user_gender", "user_interest_embedding"],
    "item": ["item_quality_score", "category_embedding"],
    "cross": ["user_item_cross"]
  }
}
```

---

## 8. AB 实验数据

### 实验配置

```sql
CREATE TABLE ab_experiments (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(256),
    description     TEXT,

    -- 实验层
    layer_id        VARCHAR(64),

    -- 流量配置
    traffic_config  JSON,  -- {"control": 50, "treatment": 50}

    -- 用户分桶
    hash_bucket     INT,   -- 分桶数量（如 10000）

    -- 指标配置
    metrics         JSON,

    -- 目标用户
    target_segment  VARCHAR(256),

    -- 时间
    start_time      TIMESTAMP,
    end_time        TIMESTAMP,

    -- 状态
    status          ENUM('draft', 'running', 'paused', 'concluded'),

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ab_experiment_metrics (
    experiment_id    VARCHAR(64),
    variant         VARCHAR(32),
    metric_name     VARCHAR(64),

    -- 统计量
    sample_count    BIGINT,
    mean_value      DECIMAL(10,6),
    variance        DECIMAL(10,6),

    -- 置信区间
    ci_lower        DECIMAL(10,6),
    ci_upper        DECIMAL(10,6),

    -- p-value
    p_value         DECIMAL(6,4),

    computed_at     TIMESTAMP,

    PRIMARY KEY (experiment_id, variant, metric_name)
);
```

---

## 9. 推荐结果缓存

### 推荐结果缓存（热点用户）

```
Redis Key:
  recommend:result:{user_id}:{scene}
    TTL: 5-60s（短期缓存）
    Value: JSON [{item_id, score, metadata}]

缓存策略：
  - 热点用户（高活跃）：缓存 30s-1min
  - 普通用户：缓存 5-10s
  - 新用户：缓存 1-5s
  - 不缓存：搜索场景、实时兴趣变化大的用户
```

---

## 10. 多样性指标数据

### 推荐结果多样性

```go
type DiversityMetrics struct {
    // Intra-List Diversity（列表内多样性）
    ILD float64  // 基于类别/标签的分散度

    // 覆盖率
    Coverage float64  // 推荐物品占长尾物品的比例

    // 新颖性
    Novelty float64  // 推荐物品中用户未见过物品的比例

    // MRR（Mean Reciprocal Rank）
    MRR float64  // 第一个正确答案的平均倒数排名
}
```

### DPP 重新排序参数

```go
type DPPConfig struct {
    // 多样性权重
    lambda_dpp float64

    // 候选集大小（用于 DPP 计算）
    candidate_size int  // 通常取 50-100

    // 质量分数下限
    min_quality_score float64
}
```
