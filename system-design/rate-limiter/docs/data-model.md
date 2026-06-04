# Data Model

## 规则配置（Rule Store）

存储于配置中心 / 关系数据库，加载到各节点内存。

```sql
CREATE TABLE ratelimit_rules (
    id              VARCHAR(64) PRIMARY KEY,
    resource        VARCHAR(256) NOT NULL,        -- 资源标识，如 api:order:create
    dimension_keys  JSON NOT NULL,                -- ["user_id", "ip"]
    algorithm       VARCHAR(32) NOT NULL,         -- token_bucket / sliding_window / fixed_window / leaky_bucket
    config          JSON NOT NULL,                -- 算法参数
    priority        INT DEFAULT 100,              -- 优先级，数值越小越优先
    enabled         BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_resource ON ratelimit_rules(resource);
CREATE INDEX idx_enabled ON ratelimit_rules(enabled);
```

### 配置示例

```json
{
  "token_bucket": {
    "capacity": 100,
    "refill_rate": 10,
    "refill_interval": "1s"
  },
  "sliding_window": {
    "limit": 1000,
    "window": "1m"
  },
  "fixed_window": {
    "limit": 100,
    "window": "1s"
  },
  "leaky_bucket": {
    "capacity": 100,
    "leak_rate": 10,
    "leak_interval": "1s"
  }
}
```

## 运行时计数（Runtime Counter）

### 单机内存（Local Counter）

```go
type LocalCounter struct {
    Resource    string
    Dimension   string           // 组合维度值，如 "user_id=u12345"
    Algorithm   string
    State       atomic.Value     // 算法状态（桶容量、窗口计数等）
    LastUpdate  int64            // 最后更新时间戳（纳秒）
}
```

### Redis 分布式计数（Distributed Counter）

Key 设计：

```
ratelimit:{resource}:{dimension}:{window_start}
```

示例：

```
ratelimit:api:order:create:user_id=u12345:1717500000
```

| 算法 | Redis 数据结构 | Key 模式 |
|------|---------------|---------|
| 固定窗口 | String + INCR | `ratelimit:{r}:{d}:{ts}` |
| 滑动窗口 | String + INCR + 多窗口汇总 | `ratelimit:{r}:{d}:{ts}`（每个子窗口） |
| 令牌桶 | Hash | `ratelimit:bucket:{r}:{d}`（tokens, last_refill） |
| 漏桶 | Sorted Set / List | `ratelimit:leaky:{r}:{d}`（请求队列） |

### 组合维度 Key 生成

```
dimension = sha256(resource + sorted_join(dimensions))[:16]
```

避免 key 过长，同时保证唯一性。
