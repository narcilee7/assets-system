# Observability

## 三大支柱

分布式 ID 生成器的可观测性重点关注 **ID 唯一性**、**发号性能**、**时钟健康**、**号段消耗** 四个维度。

---

## 1. 指标（Metrics）

### 1.1 核心指标列表

| 指标 | 类型 | 说明 | 报警阈值 |
|------|------|------|----------|
| `idgen_qps_total` | Counter | 累计发号数 | - |
| `idgen_qps_rate` | Gauge | 每秒发号数 | > 容量 80% 告警 |
| `idgen_latency_p50` | Histogram | 发号 P50 延迟 | > 1ms 告警 |
| `idgen_latency_p99` | Histogram | 发号 P99 延迟 | > 5ms 告警 |
| `idgen_latency_p999` | Histogram | 发号 P999 延迟 | > 20ms 告警 |
| `idgen_sequence_used` | Gauge | 当前毫秒 sequence 最大使用值 | > 2048（50%）告警 |
| `idgen_clock_back_count` | Counter | 时钟回拨累计次数 | > 0 立即告警 |
| `idgen_clock_back_ms_max` | Gauge | 最大回拨毫秒数 | > 100ms 严重告警 |
| `idgen_worker_active` | Gauge | 活跃 worker 数 | < 预期 80% 告警 |
| `idgen_segment_remaining` | Gauge（按 biz_tag） | 当前号段剩余 ID 数 | < 20% 告警 |
| `idgen_segment_load_total` | Counter（按 biz_tag） | 号段加载次数 | - |
| `idgen_segment_load_failed` | Counter（按 biz_tag） | 号段加载失败次数 | > 0 告警 |
| `idgen_db_update_latency` | Histogram | DB UPDATE 延迟 | > 100ms 告警 |
| `idgen_duplicate_detected` | Counter | ID 重复检测数 | > 0 严重告警 |

### 1.2 指标采集实现

```go
// Prometheus 指标定义
var (
    idgenQPSTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "idgen_qps_total",
            Help: "Total IDs generated",
        },
        []string{"biz_tag", "mode"},  // mode: snowflake/segment
    )

    idgenLatency = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "idgen_latency_seconds",
            Help:    "ID generation latency",
            Buckets: []float64{0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5},
        },
        []string{"biz_tag", "mode"},
    )

    idgenSequenceUsed = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "idgen_sequence_used",
            Help: "Max sequence used in current millisecond",
        },
        []string{"worker_id"},
    )

    idgenClockBack = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "idgen_clock_back_count",
            Help: "Number of clock backwards detected",
        },
    )

    idgenSegmentRemaining = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "idgen_segment_remaining",
            Help: "Remaining IDs in current segment",
        },
        []string{"biz_tag"},
    )
)
```

### 1.3 业务指标 vs 技术指标

```
业务指标（监控大盘）：
  - 各业务发号 QPS（订单、支付、消息、用户）
  - 各业务日累计发号量
  - 各业务 ID 增长趋势（用于容量预测）

技术指标（运维大盘）：
  - 服务整体 QPS / 延迟 / 错误率
  - Worker 数量 / Worker 健康状态
  - 时钟回拨 / Sequence 溢出次数
  - DB 加载延迟 / Redis 命中率
```

---

## 2. 日志（Logging）

### 2.1 日志级别

| 级别 | 场景 | 示例 |
|------|------|------|
| ERROR | 时钟回拨超限、DB 加载失败、ID 重复 | `ClockBackError: backMs=2000` |
| WARN | 时钟小幅回拨、Sequence 接近溢出、Worker 心跳延迟 | `ClockBackWarn: backMs=50` |
| INFO | Worker 注册/下线、号段加载、配置变更 | `Worker registered: id=5` |
| DEBUG | 单次发号、缓存命中（生产关闭） | `GenID: biz_tag=order, id=1704067201000123456` |

### 2.2 结构化日志格式

```json
{
  "timestamp": "2024-01-01T00:00:01.000Z",
  "level": "WARN",
  "service": "idgen",
  "trace_id": "abc123",
  "worker_id": 5,
  "biz_tag": "order",
  "event": "clock_back",
  "back_ms": 50,
  "last_timestamp": 1704067201000,
  "current_timestamp": 1704067200950,
  "strategy": "wait",
  "message": "Clock moved backwards by 50ms, will wait"
}
```

### 2.3 关键事件日志

```go
// 1. Worker 注册
log.Info("worker_registered",
    "worker_id", workerID,
    "host", host,
    "datacenter_id", datacenterID,
    "instance_id", instanceID,
)

// 2. 号段加载
log.Info("segment_loaded",
    "biz_tag", bizTag,
    "start", seg.Start,
    "end", seg.End,
    "load_latency_ms", loadLatency,
)

// 3. 时钟回拨
log.Warn("clock_back_detected",
    "back_ms", backMs,
    "strategy", "wait",
)

// 4. 号段加载失败
log.Error("segment_load_failed",
    "biz_tag", bizTag,
    "retry_count", retryCount,
    "err", err.Error(),
)

// 5. Sequence 溢出
log.Warn("sequence_overflow",
    "timestamp", timestamp,
    "sequence", sequence,
)
```

### 2.4 日志采样

```
高 QPS 场景（5W QPS）：
  - 每次发号都打 DEBUG 日志 → 5W 行/s → 不可接受
  - 采样：1000 个发号打 1 条（采样率 0.1%）
  - 异常路径（错误）100% 记录

ERROR 日志：永远全量
INFO 日志：关键事件全量
DEBUG 日志：采样（按比例）
```

---

## 3. 链路追踪（Tracing）

### 3.1 Trace 关键 span

```
请求：用户下单 → 生成订单 ID → MySQL 插入

Trace 结构：
  [Trace]
    ├─ [Span] HTTP POST /order/create
    │   ├─ [Span] idgen.gen(biz_tag=order)
    │   │   ├─ tag: biz_tag=order
    │   │   ├─ tag: mode=snowflake
    │   │   ├─ tag: worker_id=5
    │   │   └─ tag: latency_us=85
    │   └─ [Span] mysql.insert(orders)
    │       └─ tag: latency_ms=5
    └─ tag: trace_id=abc123
```

### 3.2 关键 tag

```go
span.SetTag("biz_tag", "order")
span.SetTag("mode", "snowflake")
span.SetTag("worker_id", 5)
span.SetTag("id", 1704067201000123456)  // 用于反查
span.SetTag("sequence_used", 123)
span.SetTag("from_cache", false)
span.SetTag("db_updated", false)
```

### 3.3 慢发号追踪

```
P99 > 5ms 的发号请求：
  - 标记为 slow
  - 单独采样追踪
  - 关联到 DB 慢查询、网络延迟等

慢发号原因：
  - mutex 竞争（雪花算法）
  - DB 加载（号段模式首次）
  - 网络 IO（RPC 模式）
  - GC 停顿
```

---

## 4. 告警规则

### 4.1 紧急告警（P0）

```
[ALERT] idgen_clock_back_ms > 100
  含义：时钟回拨超过容忍阈值
  处理：自动切号段模式 + 通知运维
  接收人：核心运维 + oncall

[ALERT] idgen_duplicate_detected > 0
  含义：检测到 ID 重复
  处理：立即停止该 worker + 排查
  接收人：核心运维 + 业务负责人

[ALERT] idgen_service_down
  含义：整个服务不可用
  处理：检查所有 worker + DB
  接收人：所有 oncall

[ALERT] idgen_segment_load_failed > 10 / 分钟
  含义：号段加载失败率高
  处理：检查 DB + Redis + 降级
  接收人：核心运维
```

### 4.2 重要告警（P1）

```
[ALERT] idgen_latency_p99 > 10ms 持续 5 分钟
  含义：发号延迟过高
  处理：检查 mutex 竞争 / DB 性能

[ALERT] idgen_qps > 容量 80% 持续 10 分钟
  含义：容量接近上限
  处理：扩容 worker

[ALERT] idgen_worker_active < 预期 80%
  含义：部分 worker 离线
  处理：排查掉线 worker

[ALERT] idgen_clock_back_count > 0
  含义：发生时钟回拨（即使在容忍范围）
  处理：排查 NTP / 运维操作
```

### 4.3 一般告警（P2）

```
[ALERT] idgen_segment_remaining < 20%
  含义：当前号段快用尽
  处理：检查异步预加载是否正常

[ALERT] idgen_sequence_used > 2048
  含义：单毫秒发号超 50% 容量
  处理：扩容或限流

[ALERT] idgen_db_update_latency_p99 > 100ms
  含义：DB 写入慢
  处理：检查 DB 性能
```

---

## 5. 监控大盘

### 5.1 运维大盘

```
┌─────────────────────────────────────────────┐
│  IDGen Service Overview                     │
├─────────────────────────────────────────────┤
│  QPS:        5W  (↑10%)                    │
│  P99:        3.5ms                          │
│  Error Rate: 0.001%                         │
│  Workers:    8/8 active                     │
│  Clock Back: 0 (24h)                        │
│  Sequence:   max=850 (21%)                  │
└─────────────────────────────────────────────┘

┌──────────────────┬──────────────────┐
│ QPS by Biz Tag   │ Latency by Biz   │
├──────────────────┼──────────────────┤
│ order: 3W        │ order: 2.5ms     │
│ payment: 1W      │ payment: 4ms     │
│ message: 1W      │ message: 1ms     │
└──────────────────┴──────────────────┘

┌─────────────────────────────────────────────┐
│  Segment Status                             │
├─────────────────────────────────────────────┤
│  order:    [████████░░] 80% (next loaded)  │
│  payment:  [██████░░░░] 60%                │
│  message:  [██░░░░░░░░] 20%                │
└─────────────────────────────────────────────┘
```

### 5.2 业务大盘

```
各业务 ID 增长趋势（最近 7 天）：
  - 订单 ID：1704060000000 → 1705000000000（+940W）
  - 支付 ID：1704060000000 → 1704500000000（+440W）
  - 消息 ID：1704060000000 → 1704900000000（+840W）

各业务 ID 增长率：
  - 用于预测未来 30 天容量
  - 提前 7 天预警扩容
```

### 5.3 健康检查

```http
GET /healthz

HTTP/1.1 200 OK
{
  "status": "ok",
  "mode": "snowflake",
  "worker_id": 5,
  "datacenter_id": 1,
  "last_id": 1704067201000123456,
  "last_heartbeat": 1704067201000,
  "checks": {
    "db_reachable": true,
    "redis_reachable": true,
    "clock_drift_ms": 5
  }
}

# K8s liveness probe 用
GET /livez → 200 OK（进程还活着）
GET /readyz → 200 OK（worker 已注册、DB 已连接）
```

---

## 6. 故障定位手册

### 6.1 业务反馈"订单 ID 重复"

```
1. 查日志：grep "duplicate" /var/log/idgen/*.log
2. 查 DB：SELECT * FROM orders WHERE id = ? ORDER BY created_at
3. 查监控：idgen.worker.active（是否有 worker 异常）
4. 查时钟：idgen.clock_back_count（是否有回拨）
5. 反解 ID：调用 /id/v1/parse 查时间戳和 worker_id
6. 排查该 worker 在该时间段的全部 ID
7. 对比 DB 中已存在的 ID，找出冲突源
```

### 6.2 业务反馈"发号慢"

```
1. 看 P99 延迟大盘
2. 看 idgen_latency 按 biz_tag 拆分（哪个业务慢）
3. 看 mutex 竞争（pprof / mutex profile）
4. 看 DB 慢查询（idgen_db_update_latency）
5. 看 GC 停顿（go_gc_pause_seconds）
6. 看网络（RPC 模式：业务到 IDGen 的 RTT）
```

### 6.3 业务反馈"ID 跳号"

```
1. 确认：号段模式本来就跳号（每次加载 step=1000）
2. 解释：业务方需要用 created_at 排序，不用 ID
3. 极端跳号：检查是否有 Worker 故障下线（导致号段浪费）
4. 检查：idgen_worker_active 和 idgen_segment_waste 指标
```

---

## 7. 审计与合规

### 7.1 操作审计

```sql
-- 关键操作记录
CREATE TABLE idgen_audit (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator    VARCHAR(64)  NOT NULL,     -- 操作人
    action      VARCHAR(32)  NOT NULL,     -- register / deregister / update_biztag / manual_reset
    target      VARCHAR(64)  NOT NULL,     -- worker_id 或 biz_tag
    before_value JSON        DEFAULT NULL,
    after_value  JSON        DEFAULT NULL,
    created_at   DATETIME    NOT NULL,
    KEY idx_time (created_at)
);
```

### 7.2 合规要求

```
金融场景：
  - 所有 ID 生成操作要可追溯
  - 关键操作（手动改 max_id）必须审批
  - 保留审计日志 5 年以上

医疗场景：
  - 患者 ID 不能被重用
  - 注销患者的 ID 必须标记"已废弃"但不释放

游戏场景：
  - 道具 ID 不能跨账号重用（防复制）
  - 道具流转记录永久保留
```

---

## 8. 容量预测

### 8.1 历史数据分析

```
每日统计：
  - 各业务当日发号量
  - 各业务 QPS 峰值
  - 各业务 ID 增长率

趋势分析：
  - 30 天线性回归
  - 预测未来 30/60/90 天容量
```

### 8.2 自动扩容

```
K8s HPA 配置：

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: idgen-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: idgen
  minReplicas: 4
  maxReplicas: 32
  metrics:
  - type: Pods
    pods:
      metric:
        name: idgen_qps_rate
      target:
        type: AverageValue
        averageValue: "5000"  # 单 Pod 5000 QPS 触发扩容
```

---

## 9. 上线 Checklist

```
- [ ] 指标已埋点（Prometheus）
- [ ] 日志结构化（JSON 格式）
- [ ] Trace 接入（OpenTelemetry）
- [ ] 告警规则配置（PagerDuty / 钉钉）
- [ ] 监控大盘配置（Grafana）
- [ ] 健康检查接口（/healthz, /readyz）
- [ ] 故障演练（时钟回拨、DB 抖动）
- [ ] 容量评估（单 worker 极限）
- [ ] 扩容脚本（HPA / 手动）
- [ ] 审计日志（关键操作）
```
