# Observability

## 三大支柱

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    日志      │    │    指标      │    │    链路      │
│  (Logs)      │    │  (Metrics)   │    │  (Traces)    │
├──────────────┤    ├──────────────┤    ├──────────────┤
│ 推荐请求     │    │ 延迟/吞吐    │    │ 请求路径     │
│ 行为反馈     │    │ CTR/覆盖率   │    │ 召回→粗排→精排│
│ 异常错误     │    │ 多样性指标   │    │ 瓶颈识别     │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 1. 日志（Logs）

### 推荐请求日志

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "event": "recommendation.request",
  "user_id": "u12345",
  "scene": "home_feed",
  "request_context": {
    "device": "mobile",
    "network": "wifi",
    "location": "北京"
  },
  "recall_config": {
    "recruit_size": 10000,
    "channels": ["cf", "embedding", "popularity", "tag"]
  },
  "timestamp": "2024-06-01T10:00:00.000Z"
}
```

```json
{
  "request_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "event": "recommendation.returned",
  "user_id": "u12345",
  "returned_items": [
    {"item_id": "i789", "position": 1, "score": 0.9523},
    {"item_id": "i456", "position": 2, "score": 0.8745}
  ],
  "latency_ms": 85,
  "latency_breakdown": {
    "recall": 15,
    "coarse_rank": 10,
    "fine_rank": 25,
    "rerank": 5,
    "features": 30
  }
}
```

### 行为反馈日志

```json
{
  "event": "feedback.click",
  "user_id": "u12345",
  "item_id": "i789",
  "scene": "home_feed",
  "position": 1,
  "timestamp": "2024-06-01T10:00:05.000Z",
  "session_id": "sess-abc123",
  "recommendation_id": "req-01HV3WWZP1A3B5C6D7E8F9G0H",
  "context": {
    "device": "mobile",
    "network": "wifi"
  }
}
```

### AB 实验日志

```json
{
  "event": "ab_experiment.started",
  "experiment_id": "exp-rec-diversity-v1",
  "experiment_name": "推荐多样性优化实验",
  "variants": ["control", "treatment"],
  "traffic_allocation": {
    "control": 50,
    "treatment": 50
  },
  "start_time": "2024-06-01T00:00:00.000Z",
  "duration_days": 14,
  "target_users": {
    "segment": "active_user_7d",
    "count": 15000
  }
}
```

---

## 2. 指标（Metrics）

### 推荐系统核心指标

```prometheus
# 请求和延迟
recommendation_requests_total{scene="home_feed"} 12345678
recommendation_requests_rate{scene="home_feed"} 142345.5
recommendation_latency_seconds{scene="home_feed", quantile="0.5"} 0.032
recommendation_latency_seconds{scene="home_feed", quantile="0.9"} 0.065
recommendation_latency_seconds{scene="home_feed", quantile="0.99"} 0.098

# 各阶段延迟
recommendation_latency_seconds{stage="recall", quantile="0.99"} 0.015
recommendation_latency_seconds{stage="coarse_rank", quantile="0.99"} 0.010
recommendation_latency_seconds{stage="fine_rank", quantile="0.99"} 0.025
recommendation_latency_seconds{stage="rerank", quantile="0.99"} 0.005
recommendation_latency_seconds{stage="feature_fetch", quantile="0.99"} 0.030
```

### 推荐效果指标

```prometheus
# CTR（点击率）
recommendation_ctr{scene="home_feed"} 0.0452
recommendation_ctr{scene="search"} 0.1234

# 曝光点击转化率
recommendation_exposure_total 123456789
recommendation_click_total 5678901
recommendation_ctr 0.0452

# 完播率
recommendation_play_total{scene="home_feed"} 2345678
recommendation_complete_total{scene="home_feed"} 1876542
recommendation_complete_rate 0.80

# 覆盖率
recommendation_coverage{scene="home_feed"} 0.68
recommendation_exposed_items_daily 1234567
recommendation_total_items 10000000
recommendation_coverage 0.1234567

# 多样性
recommendation_diversity_ild{scene="home_feed"} 0.72
recommendation_diversity_novelty{scene="home_feed"} 0.35
```

### 召回质量指标

```prometheus
# 各召回通道
recall_requests_total{channel="cf"} 12345678
recall_requests_total{channel="embedding"} 12345678
recall_requests_total{channel="popularity"} 12345678
recall_requests_total{channel="cold_start"} 12345678

recall_size{channel="cf"} 2000
recall_size{channel="embedding"} 3000
recall_size{channel="popularity"} 2000
recall_size_total 7000

recall_latency_seconds{channel="cf", quantile="0.99"} 0.005
recall_latency_seconds{channel="embedding", quantile="0.99"} 0.012
```

### 模型指标

```prometheus
# 模型性能
model_auc{version="v3.2.1"} 0.7823
model_auc{version="v3.2.0"} 0.7856

model_ctr_pred_avg{version="v3.2.1"} 0.0432
model_ctr_pred_avg{version="v3.2.0"} 0.0428

# 模型更新
model_last_trained_at{version="v3.2.1"} 1717200000
model_time_since_last_trained_minutes 240

# 特征新鲜度
feature_freshness_seconds{type="user_interest_short"} 180
feature_freshness_seconds{type="user_interest_long"} 3600
feature_freshness_seconds{type="item_stats"} 600
```

### AB 实验指标

```prometheus
# 实验流量
ab_experiment_active{experiment_id="exp-rec-diversity-v1"} 1
ab_traffic{experiment_id="exp-rec-diversity-v1", variant="control"} 0.50
ab_traffic{experiment_id="exp-rec-diversity-v1", variant="treatment"} 0.50

# 实验效果
ab_ctr{experiment_id="exp-rec-diversity-v1", variant="control"} 0.0452
ab_ctr{experiment_id="exp-rec-diversity-v1", variant="treatment"} 0.0489
ab_diversity{experiment_id="exp-rec-diversity-v1", variant="control"} 0.65
ab_diversity{experiment_id="exp-rec-diversity-v1", variant="treatment"} 0.78
```

---

## 3. 链路追踪（Distributed Tracing）

### 推荐请求 Trace

```
Trace: trace-01HV3WWZP

Root Span: recommendation.request
  │
  ├── Span: feature_fetch (user features)
  │     latency: 12ms
  │
  ├── Span: feature_fetch (item features)
  │     latency: 18ms
  │
  ├── Span: recall.cf
  │     latency: 5ms
  │
  ├── Span: recall.embedding
  │     latency: 12ms
  │
  ├── Span: recall.merge
  │     latency: 2ms
  │
  ├── Span: coarse_rank
  │     latency: 10ms
  │     └── output: top 500
  │
  ├── Span: fine_rank
  │     latency: 25ms
  │     └── output: top 100
  │
  ├── Span: rerank
  │     latency: 5ms
  │     └── output: top 20
  │
  └── Span: recommendation.returned
        latency: 85ms
        output: top 10
```

### 行为反馈 Trace

```
Trace: trace-feedback-01HV3WWZP

Span: feedback.click
  │
  ├── Span: validate_event
  │     latency: 1ms
  │
  ├── Span: update_realtime_features
  │     latency: 5ms
  │
  ├── Span: record_feedback
  │     latency: 10ms
  │
  └── Span: generate_training_sample
        latency: 8ms
```

---

## 4. 告警规则

### 核心告警

| 告警名称 | 条件 | 严重程度 | 说明 |
|----------|------|----------|------|
| **HighLatency** | P99 > 100ms，持续 5min | P2 | 推荐延迟过高 |
| **CriticalLatency** | P99 > 200ms，持续 1min | P1 | 推荐延迟严重 |
| **LowCoverage** | 覆盖率 < 60% | P2 | 长尾曝光不足 |
| **LowDiversity** | ILD < 0.6 | P2 | 推荐集中度过高 |
| **ModelDegraded** | AUC < 0.70 | P1 | 模型效果下降 |
| **FeatureStale** | 特征延迟 > 30min | P2 | 特征过时 |
| **RecallChannelDown** | 某召回通道 QPS=0 | P1 | 召回通道故障 |
| **ModelUpdateDelayed** | 模型更新延迟 > 2h | P2 | 模型过期 |
| **ABExperimentSignificant** | p-value < 0.05 | P3 | AB 实验有显著效果 |

### 告警配置示例

```yaml
groups:
  - name: recommendation_alerts
    rules:
      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            rate(recommendation_latency_seconds_bucket[5m])
          ) > 0.100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "推荐延迟过高"
          description: "P99 延迟 {{ $value }}s，超过 100ms 阈值"

      - alert: LowCoverage
        expr: recommendation_coverage < 0.60
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "推荐覆盖率过低"
          description: "覆盖率 {{ $value }}，低于 60% 阈值，长尾内容曝光不足"

      - alert: LowDiversity
        expr: recommendation_diversity_ild < 0.60
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "推荐多样性不足"
          description: "ILD 多样性 {{ $value }}，低于 0.6 阈值，可能出现信息茧房"

      - alert: ModelDegraded
        expr: model_auc < 0.70
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "推荐模型效果下降"
          description: "模型 AUC {{ $value }}，低于 0.70 阈值，需要重新训练"
```

---

## 5. 仪表盘（Grafana）

### 推荐系统概览仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  Recommendation Overview           Region: CN-North-1          │
├─────────────────────────────────────────────────────────────────┤
│  Requests/sec    CTR        Coverage       Diversity ILD       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  52,345    │ │   4.52%    │ │   68.0%    │ │   0.72     │ │
│  │  +5.2%     │ │  +0.3%     │ │  +2.1%     │ │  +0.05     │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                              │
│  [请求量趋势]       [CTR趋势]        [延迟分布]               │
│  ████████████      ▁▂▃▄▅▆▇█▇▅      ▁▁▁▂▂▃▄▅▆               │
├─────────────────────────────────────────────────────────────────┤
│  Latency Breakdown (P99)            Recall Channels            │
│  ┌────────────────────────────┐      ┌────────────────────────┐  │
│  │ Feature Fetch:  30ms ████ │      │ CF:      2,000 items  │  │
│  │ Fine Rank:      25ms ███  │      │ Embed:   3,000 items  │  │
│  │ Coarse Rank:    10ms ██   │      │ Pop:     2,000 items  │  │
│  │ Recall:         15ms ██  │      │ Tag:     1,000 items  │  │
│  └────────────────────────────┘      └────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Model Performance                  Diversity Metrics          │
│  ┌────────────────────────────┐      ┌────────────────────────┐  │
│  │ AUC:  0.7823               │      │ ILD:      0.72        │  │
│  │ CTR Pred: 0.0432          │      │ Novelty:  0.35        │  │
│  │ Version: v3.2.1           │      │ Coverage: 0.68        │  │
│  └────────────────────────────┘      └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### AB 实验仪表盘

```
┌─────────────────────────────────────────────────────────────────┐
│  AB Experiment: exp-rec-diversity-v1                            │
├─────────────────────────────────────────────────────────────────┤
│  Status: Running        Traffic: 15,000 users  Days: 5/14      │
├─────────────────────────────────────────────────────────────────┤
│  Variant       Users    CTR      Diversity   Play Rate          │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Control   │ 7,500 │ 4.52% │   0.65   │   78%          │    │
│  │ Treatment │ 7,500 │ 4.89% │   0.78   │   82%          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                              │
│  Lift: +8.2% CTR (p=0.023) ✦ Significant                      │
│  Lift: +20% Diversity (p=0.001) ✦ Significant                │
├─────────────────────────────────────────────────────────────────┤
│  [CTR 对比趋势]          [Diversity 对比趋势]                  │
│  ░░░░░████████████      ░░░░░░████████████                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 日志聚合与查询

### 日志存储架构

```
推荐服务节点
  │
  ├── 结构化日志（JSON Lines）
  │    - request_id, user_id, scene, latency, items
  │
  ▼
Fluent Bit / OTel Collector
  │
  ▼
Kafka（缓冲）
  │ Topic: recommendation-logs
  │ Partition: by scene（保证同一场景日志有序）
  │
  ▼
Elasticsearch / ClickHouse
  │ 存储：推荐请求、行为反馈、异常日志
  │ 保留：30 天
  │
  ▼
Grafana / Kibana
  可视化查询
```

### 关键日志查询

```
# 查询某用户的完整推荐轨迹
{recommendation_logs}
  | user_id = "u12345"
  | request_id = "req-01HV3WWZP..."
  | time_range = "last 1h"

# 查询推荐延迟异常高的请求
{recommendation_logs}
  | latency_ms > 200
  | time_range = "last 30m"
  | group_by(scene, user_id)

# 查询某召回通道的召回效率
{recall_logs}
  | channel = "cf"
  | group_by(recruit_size, avg_score)
  | time_range = "last 1h"

# 查询 AB 实验效果
{ab_logs}
  | experiment_id = "exp-rec-diversity-v1"
  | variant = "treatment"
  | aggregate(ctr, diversity_ild)
  | time_range = "last 7d"
```

---

## 7. SLO / SLA 监控

### SLO 定义

| SLO | 目标 | 测量窗口 |
|-----|------|----------|
| 推荐延迟 P99 | < 100ms | 30d 滚动 |
| 推荐成功率 | > 99.5% | 30d 滚动 |
| 推荐覆盖率 | > 60% | 30d 滚动 |
| 多样性 ILD | > 0.7 | 30d 滚动 |
| 模型更新时间 | < 2h | 每小时检查 |

### 错误预算监控

```
Error Budget = (1 - SLO Target) × Total Requests

例如：30 天总请求 = 10^10 次
SLO: P99 < 100ms（允许 1% 慢请求）
Error Budget = 1% × 10^10 = 10^8 次慢请求

消耗速率监控：
  - 过去 1h 慢请求数 = 5 × 10^5
  - 预计 30d 消耗 = 5 × 10^5 × 24 × 30 = 3.6 × 10^8
  - 消耗率 = 3.6 × 10^8 / 10^8 = 360%（严重超支）

如果消耗率 > 50%，触发 SLO 告警
```
