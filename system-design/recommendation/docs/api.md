# API

## 推荐服务 API

### 1. 推荐请求（核心推荐接口）

#### 获取推荐结果

```http
POST /v1/recommend
Content-Type: application/json
X-Request-ID: {request_id}
X-User-ID: {user_id}
X-Auth-Token: {jwt}

{
  "scene": "home_feed",
  "position": "首屏",
  "count": 10,
  "context": {
    "device": "mobile",
    "location": {
      "latitude": 39.9042,
      "longitude": 116.4074,
      "city": "北京"
    },
    "time": "2024-06-01T10:00:00Z",
    "network": "wifi"
  },
  "filters": {
    "exclude_item_ids": ["i123", "i456"],
    "category_filter": ["成人内容"],
    "min_duration_seconds": 30,
    "max_duration_seconds": 600
  }
}
```

响应：

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "scene": "home_feed",
  "items": [
    {
      "item_id": "i789",
      "score": 0.9523,
      "reason": [
        {"type": "collaborative_filter", "score": 0.8},
        {"type": "embedding_match", "score": 0.9},
        {"type": "popularity", "score": 0.7}
      ],
      "metadata": {
        "title": "如何学习 Golang",
        "thumbnail": "https://...",
        "author": "编程教室",
        "duration_seconds": 420,
        "category": "技术",
        "tags": ["Golang", "编程"]
      }
    },
    {
      "item_id": "i012",
      "score": 0.8745,
      "reason": [...],
      "metadata": {...}
    }
  ],
  "ab_test": {
    "experiment_id": "exp-rec-v3",
    "variant": "treatment",
    "user_segment": "active_user"
  },
  "latency_ms": 85
}
```

---

### 2. 反馈接口（用户行为上报）

#### 上报用户行为

```http
POST /v1/feedback
Content-Type: application/json
X-Request-ID: {request_id}
X-User-ID: {user_id}

{
  "event_type": "click",
  "item_id": "i789",
  "scene": "home_feed",
  "position": 1,
  "timestamp": "2024-06-01T10:00:05Z",
  "session_id": "sess-abc123",
  "device_info": {
    "device_id": "device-001",
    "os": "iOS 17",
    "app_version": "3.2.1"
  },
  "context": {
    "network": "wifi",
    "recommendation_id": "req-01HV3WWZP..."
  }
}
```

#### 支持的事件类型

| event_type | 说明 | 用于 |
|------------|------|------|
| `exposure` | 曝光 | 计算 CTR、分母 |
| `click` | 点击 | 计算 CTR、分子 |
| `play` | 播放开始 | 用户兴趣信号 |
| `complete` | 播放完成 | 质量信号 |
| `share` | 分享 | 强正反馈 |
| `unlike` | 不喜欢 | 负反馈 |
| `save` | 收藏 | 正反馈 |
| `comment` | 评论 | 强正反馈 |

---

### 3. 行为序列接口

#### 获取用户行为序列（用于特征）

```http
GET /v1/user/{user_id}/behavior_sequence?type=click&window=7d&limit=50
```

响应：

```json
{
  "user_id": "u12345",
  "behaviors": [
    {
      "item_id": "i789",
      "event_type": "click",
      "timestamp": "2024-06-01T09:55:00Z",
      "item_features": {
        "category": "技术",
        "tags": ["Golang"],
        "author": "编程教室"
      }
    },
    {
      "item_id": "i456",
      "event_type": "complete",
      "timestamp": "2024-06-01T09:30:00Z",
      "item_features": {...}
    }
  ],
  "total": 127
}
```

---

### 4. 物品信息接口

#### 批量获取物品信息

```http
POST /v1/items/batch
Content-Type: application/json

{
  "item_ids": ["i789", "i456", "i012"],
  "fields": ["title", "thumbnail", "category", "tags", "author", "duration"]
}
```

响应：

```json
{
  "items": [
    {
      "item_id": "i789",
      "title": "如何学习 Golang",
      "thumbnail": "https://...",
      "category": "技术",
      "tags": ["Golang", "编程"],
      "author": "编程教室",
      "duration_seconds": 420,
      "quality_score": 0.85,
      "popularity_score": 0.72
    }
  ]
}
```

---

### 5. 特征接口（供推荐系统内部使用）

#### 获取用户实时特征

```http
GET /v1/features/user/{user_id}
X-Internal-Token: {internal_token}
```

响应：

```json
{
  "user_id": "u12345",
  "features": {
    "age": 28,
    "gender": "male",
    "city": "北京",
    "interest_tags": ["技术", "编程", "产品"],
    "short_term_interests": {
      "技术": 0.85,
      "产品": 0.62,
      "运营": 0.31
    },
    "device_type": "mobile",
    "is_vip": true,
    "last_active_at": "2024-06-01T09:55:00Z",
    "activity_level": "high"
  },
  "computed_at": "2024-06-01T10:00:00Z"
}
```

#### 获取物品实时特征

```http
GET /v1/features/item/{item_id}
X-Internal-Token: {internal_token}
```

响应：

```json
{
  "item_id": "i789",
  "features": {
    "category": "技术",
    "tags": ["Golang", "编程"],
    "author": "编程教室",
    "author_quality_score": 0.92,
    "quality_score": 0.85,
    "popularity_score": 0.72,
    "freshness_score": 0.95,
    "ctr_historical": 0.045,
    "play_complete_rate": 0.78
  },
  "computed_at": "2024-06-01T10:00:00Z"
}
```

---

### 6. 召回通道控制

#### 调整召回通道权重

```http
PUT /v1/recall/config
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "scene": "home_feed",
  "channels": [
    {"name": "collaborative_filter", "enabled": true, "weight": 0.3},
    {"name": "embedding_match", "enabled": true, "weight": 0.4},
    {"name": "popularity", "enabled": true, "weight": 0.2},
    {"name": "cold_start", "enabled": true, "weight": 0.1}
  ],
  "recruit_size": 1000
}
```

---

### 7. 模型管理 API

#### 获取当前模型版本

```http
GET /v1/model/current
X-Internal-Token: {internal_token}
```

响应：

```json
{
  "model_name": "recommendation_ranking_v3",
  "model_version": "v3.2.1",
  "trained_at": "2024-06-01T08:00:00Z",
  "training_type": "incremental_hourly",
  "online_since": "2024-06-01T09:00:00Z",
  "metrics": {
    "auc": 0.7823,
    "ctr_pred_avg": 0.0432,
    "coverage": 0.68
  }
}
```

#### 模型切换（AB 测试用）

```http
POST /v1/model/switch
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "model_version": "v3.2.2",
  "target_traffic_percentage": 10,
  "gradual": true,
  "duration_minutes": 60
}
```

---

### 8. AB 实验配置

#### 创建 AB 实验

```http
POST /v1/ab/experiment
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "experiment_id": "exp-rec-diversity-v1",
  "name": "推荐多样性优化实验",
  "description": "测试 DPP 多样性优化对用户留存的影响",

  "layers": [
    {
      "layer_id": "recommendation_model",
      "traffic": [
        {"variant": "control", "percentage": 50},
        {"variant": "treatment", "percentage": 50}
      ]
    }
  ],

  "metrics": [
    {"name": "ctr", "type": "ratio", "goal": "increase"},
    {"name": "diversity_score", "type": "gauge", "goal": "increase"},
    {"name": "coverage", "type": "gauge", "goal": "increase"},
    {"name": "user_stay_duration", "type": "gauge", "goal": "increase"}
  ],

  "target_users": {
    "segment": "active_user_7d",
    "min_count": 10000
  },

  "start_time": "2024-06-01T00:00:00Z",
  "duration_days": 14,
  "confidence_level": 0.95,
  "min_detectable_effect": 0.02
}
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `recommendation.request` | 收到推荐请求 | 统计、特征计算 |
| `recommendation.returned` | 返回推荐结果 | 统计、排序模型 |
| `feedback.click` | 用户点击 | 特征更新、训练样本 |
| `feedback.exposure` | 物品曝光 | 统计、指标计算 |
| `feedback.complete` | 用户播放完成 | 质量评估 |
| `model.switched` | 模型切换 | 监控、指标对比 |
| `ab_experiment.started` | AB 实验开始 | 实验平台 |
| `ab_experiment.concluded` | AB 实验结束 | 实验平台、分析 |
| `cold_item.exposed` | 冷启动物品曝光 | 冷启动评估 |
