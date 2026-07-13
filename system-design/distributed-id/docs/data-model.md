# Data Model

## 核心设计原则

- **唯一性优先**：所有模型的第一目标都是保证 ID 全局唯一
- **Worker 状态外置**：Worker 注册信息存 DB，便于故障恢复和扩缩容
- **号段与业务解耦**：号段通过 `biz_tag` 隔离，不同业务互不影响
- **心跳检测**：Worker 状态通过心跳维护，下线后号段可被回收

---

## 1. Worker 注册表（worker_node）

记录每个发号节点的注册信息，用于 worker_id 分配和健康检查。

```sql
CREATE TABLE worker_node (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    host            VARCHAR(64)  NOT NULL,
    port            INT          NOT NULL,
    instance_id     VARCHAR(64)  NOT NULL,
    datacenter_id   TINYINT      NOT NULL DEFAULT 0,   -- 数据中心 ID（雪花算法用）
    worker_type     VARCHAR(16)  NOT NULL DEFAULT 'snowflake',  -- snowflake | segment
    status          TINYINT      NOT NULL DEFAULT 1,    -- 1=active, 0=inactive
    registered_at   DATETIME     NOT NULL,
    last_heartbeat  DATETIME     NOT NULL,
    token           VARCHAR(64)  NOT NULL,              -- 心跳 token
    meta            JSON         DEFAULT NULL,          -- 扩展字段（QPS、负载等）
    UNIQUE KEY uk_host_port (host, port),
    UNIQUE KEY uk_instance (instance_id),
    KEY idx_heartbeat (last_heartbeat, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT | worker_id（雪花算法直接使用） |
| `host:port` | - | 节点唯一标识，避免重复注册 |
| `datacenter_id` | TINYINT | 多机房场景区分机房 |
| `worker_type` | VARCHAR | snowflake / segment，对应不同分配策略 |
| `status` | TINYINT | 心跳超时自动置为 0 |
| `last_heartbeat` | DATETIME | 调度器定期扫描，超时下线 |
| `token` | VARCHAR | 心跳鉴权 token |

### Worker 分配流程

```
1. 节点启动 → INSERT INTO worker_node (host, port, ...)
2. 获取自增 id 作为 worker_id
3. 定期（5s）UPDATE last_heartbeat = NOW()
4. 调度器每秒扫描：last_heartbeat < NOW() - 30s → UPDATE status = 0
5. 节点主动下线 → UPDATE status = 0, token = ''
```

---

## 2. 号段表（id_segment）

号段模式专用，记录每个业务标签的当前号段分配状态。

```sql
CREATE TABLE id_segment (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    biz_tag         VARCHAR(64)  NOT NULL,
    current_max_id  BIGINT       NOT NULL DEFAULT 0,    -- 当前号段已用到的最大值
    step            INT          NOT NULL DEFAULT 1000, -- 号段步长
    description     VARCHAR(255) DEFAULT NULL,
    version         BIGINT       NOT NULL DEFAULT 0,    -- 乐观锁版本号
    created_at      DATETIME     NOT NULL,
    updated_at      DATETIME     NOT NULL,
    UNIQUE KEY uk_biz_tag (biz_tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `biz_tag` | VARCHAR | 业务标签（唯一） |
| `current_max_id` | BIGINT | 已发放的最大 ID，下一次从这个值 + 1 开始 |
| `step` | INT | 每次预加载的号段大小 |
| `version` | BIGINT | 乐观锁，防止号段并发分配冲突 |

### 初始化示例

```sql
-- 注册订单业务，初始 max_id=0，步长 1000
INSERT INTO id_segment (biz_tag, current_max_id, step, description)
VALUES ('order', 0, 1000, '订单 ID');

-- 第一次发号：分配 [1, 1000] 给 WorkerA
-- 第二次发号：分配 [1001, 2000] 给 WorkerA（或 WorkerB）
```

---

## 3. 号段缓冲模型（双 buffer）

为避免"取号段阻塞发号"，采用双 buffer 异步预加载。

### 内存模型

```go
// 号段缓冲
type SegmentBuffer struct {
    BizTag       string
    
    // 当前正在使用的号段
    Current      *Segment  // {Start, End, Value, NextReady}
    
    // 预加载的下一号段（异步加载）
    Next         *Segment
    
    // 状态机
    InitOK       bool      // 首次加载完成
    LoadingNext  bool      // 正在加载下一号段
    NextReady    bool      // 下一号段加载完成
    Lock         sync.Mutex
}

type Segment struct {
    Start    int64
    End      int64     // 不包含 End（[Start, End) 半开区间）
    Value    int64     // 当前发放到 Value，下一个发 Value+1
}
```

### 状态转换图

```
          ┌─────────────┐
          │   Init      │ 初始化（首次加载 Current）
          └──────┬──────┘
                 │ Load Current from DB
                 ▼
          ┌─────────────┐
          │ CurrentUsing│ 当前号段可用
          └──────┬──────┘
                 │ Current.Value ≥ Current.End * 0.8
                 ▼
          ┌─────────────┐
          │ LoadingNext │ 触发异步加载 Next
          └──────┬──────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐    ┌──────────────┐
│ Next Loaded  │    │ Next Failed  │ ← 重试 3 次
└──────┬───────┘    └──────┬───────┘
       │                   │
       │  Current 用尽     │ 重试失败，降级
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ Switch Next  │    │ Block 发号   │ 报警，人工介入
└──────────────┘    └──────────────┘
```

---

## 4. 雪花算法位分配模型

### Twitter 经典 64-bit

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0|          timestamp (41)          |  datacenter | worker | seq|
| |                                    (5)        (5)      (12)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

- 1 bit  : 符号位（固定 0）
- 41 bit : 毫秒时间戳（2^41 = 69.7 年）
- 5 bit  : datacenter_id（32 个机房）
- 5 bit  : worker_id（每个机房 32 个节点）
- 12 bit : sequence（同毫秒内 4096 个 ID）
```

### 美团 Leaf 变种

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0|          timestamp (41)          |  datacenter | worker | seq|
| |                                    (6)        (6)      (12)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

- 6 bit datacenter（64 个机房）
- 6 bit worker（每机房 64 个节点）
- 12 bit sequence
- 同一毫秒理论 4096 ID/节点
```

### 业务扩展位（自定义）

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0|biz(2)|     timestamp (40)    |  datacenter | worker | seq  |
| |      |                        (5)        (5)      (13)     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

- 2 bit 业务区分（00=order, 01=payment, 10=msg, 11=user）
- 40 bit 时间戳（约 34 年）
- 13 bit sequence（同毫秒 8192 个 ID）
- 牺牲一点时间长度换业务区分能力
```

---

## 5. Redis 缓存模型（性能加速）

号段模式可用 Redis 缓存 `current_max_id`，减少 DB 压力。

```
# Redis 结构
idgen:segment:{biz_tag}:current   → 当前内存号段（String）
  value: "9500000"
  TTL: 10s（10s 内不查 DB）

idgen:segment:{biz_tag}:loading   → 加载锁（防止并发加载）
  value: "1"
  TTL: 5s
  SETNX 成功才加载，失败则等待

idgen:worker:{worker_id}          → Worker 状态
  value: {"status":"active","qps":5000}
  TTL: 60s（心跳续命）
```

### 缓存一致性策略

```
读路径：
  1. 查 Redis current_max_id
  2. 存在且剩余充足 → 直接返回
  3. 不存在 / 剩余不足 → 查 DB 加载号段

写路径（双写）：
  1. UPDATE DB current_max_id
  2. DEL Redis cache
  3. 让下一次读取重新加载

防雪崩：
  - Redis 缓存 TTL 加随机抖动（10s + rand(0..5s)）
  - 避免大量 key 同时过期
```

---

## 6. 时钟回拨状态表（clock_back_record）

记录时钟回拨事件，用于追溯和告警。

```sql
CREATE TABLE clock_back_record (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    worker_id       BIGINT       NOT NULL,
    back_ms         INT          NOT NULL,         -- 回拨毫秒数
    detected_at     DATETIME     NOT NULL,
    strategy        VARCHAR(32)  NOT NULL,         -- wait | extend_seq | throw
    resolved_at     DATETIME     DEFAULT NULL,
    description     VARCHAR(255) DEFAULT NULL,
    KEY idx_worker_time (worker_id, detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 7. 反解模型

雪花算法 ID 反解为结构化信息：

```go
type SnowflakeInfo struct {
    TimestampMs  int64     // 时间戳
    DatacenterID int       // 数据中心
    WorkerID     int       // Worker ID
    Sequence     int       // 序列号
    Datetime     time.Time // 可读时间
}

func Parse(id int64) SnowflakeInfo {
    return SnowflakeInfo{
        TimestampMs:  (id >> 22) + epoch,
        DatacenterID: int((id >> 17) & 0x1F),
        WorkerID:     int((id >> 12) & 0x1F),
        Sequence:     int(id & 0xFFF),
        Datetime:     time.UnixMilli((id >> 22) + epoch),
    }
}
```

---

## 8. 数据生命周期

| 数据 | 保留时长 | 清理策略 |
|------|----------|----------|
| worker_node | 永久 | 不清理，下线后 status=0 即可 |
| id_segment | 永久 | 永久保留（业务 ID 永久有效） |
| clock_back_record | 90 天 | 定时清理过期数据 |
| Redis 缓存 | 10-60s | 自动过期 |

---

## 9. 数据规模估算

```
假设：
  - 订单业务 QPS = 5W（双 11 峰值）
  - 号段步长 step = 1000
  - 号段加载 QPS = 5W / 1000 = 50 QPS（每 1000 个号只需加载 1 次）

worker_node 表：
  - 最大节点数 ≈ 100（10 个机房 × 10 个 worker）
  - 总行数 < 1000，几乎无压力

id_segment 表：
  - 总 biz_tag 数 ≈ 50（订单、支付、消息、用户、商品...）
  - 总行数 < 100，几乎无压力

clock_back_record 表：
  - 每天最多几十次回拨
  - 90 天保留 → 总行数 < 10000

结论：所有表都是"小表"，查询 QPS 极低，重点是写入原子性和故障恢复
```
