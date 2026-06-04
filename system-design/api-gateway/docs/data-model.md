# Data Model

## 核心设计原则

- **无状态化**：网关本身不存储路由、配置、限流状态，所有状态外置到 Redis / etcd / MySQL
- **读写分离**：路由配置以写为主，读分散到各节点内存；限流计数全在 Redis
- **多租户隔离**：通过 `tenant_id` 字段实现租户数据隔离

---

## 1. 路由配置数据（Config Store）

### MySQL / etcd 存储（配置中心）

```sql
CREATE TABLE gateway_routes (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(256) NOT NULL UNIQUE,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    priority        INT NOT NULL DEFAULT 100,       -- 越小越优先
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,

    -- 匹配规则
    match_method    JSON NOT NULL,                    -- ["GET", "POST"] 或 null 表示全部
    match_path      VARCHAR(1024) NOT NULL,          -- 支持 /**/*/{} 占位符
    match_headers   JSON,                           -- { "X-Tenant-Id": "*" }
    match_query    JSON,                            -- { "env": "prod" }
    match_consumer VARCHAR(64),                     -- 消费者 ID，白名单

    -- 后端配置
    backend_type    ENUM('http', 'grpc', 'websocket') DEFAULT 'http',
    backend_service VARCHAR(256) NOT NULL,          -- 服务名（服务发现用）
    backend_url     VARCHAR(1024),                  -- 固定后端地址（不经过注册中心）
    backend_timeout JSON NOT NULL,                   -- { "connect_ms": 1000, "read_ms": 5000 }
    backend_retry   JSON,                           -- { "attempts": 2, "on_status": [502, 503] }
    backend_loadbalance VARCHAR(32) DEFAULT 'round_robin',

    -- 插件配置
    plugins         JSON,                           -- [{"name": "jwt-auth", "config": {...}}]

    -- 标签和审计
    tags            JSON,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by      VARCHAR(64),

    -- 索引
    INDEX idx_tenant (tenant_id),
    INDEX idx_enabled (enabled),
    INDEX idx_priority (priority),
    INDEX idx_backend_service (backend_service)
);
```

### 路由规则示例

```json
{
  "id": "route-order-001",
  "name": "order-service-create",
  "tenant_id": "tenant-ecommerce",
  "priority": 100,
  "enabled": true,
  "match_method": ["POST"],
  "match_path": "/api/v1/orders",
  "match_headers": {
    "X-Tenant-Id": "*"
  },
  "match_query": null,
  "backend_type": "http",
  "backend_service": "order-service",
  "backend_timeout": {
    "connect_ms": 1000,
    "read_ms": 5000,
    "idle_ms": 30000
  },
  "backend_retry": {
    "attempts": 2,
    "on_status": [502, 503, 504],
    "retry_on_timeout": true
  },
  "backend_loadbalance": "least_conn",
  "plugins": [
    {
      "name": "jwt-auth",
      "config": {
        "jwks_url": "https://auth.internal/.well-known/jwks.json",
        "issuer": "https://auth.internal",
        "required_claims": ["user_id", "tenant_id"]
      }
    },
    {
      "name": "rate-limiter",
      "config": {
        "limit": 1000,
        "window": "1m",
        "dimension": "user_id",
        "algorithm": "token_bucket"
      }
    }
  ],
  "tags": ["prod", "order", "v2"]
}
```

---

## 2. 服务注册数据（Service Registry）

### 静态服务配置

```sql
CREATE TABLE gateway_services (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(256) NOT NULL,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    description     VARCHAR(1024),

    -- 健康检查
    health_check_type   ENUM('http', 'tcp', 'udp', 'grpc') DEFAULT 'http',
    health_check_path   VARCHAR(256),
    health_check_port   INT,
    health_check_interval_ms INT DEFAULT 5000,
    health_check_timeout_ms INT DEFAULT 1000,
    health_check_unhealthy_threshold INT DEFAULT 3,
    health_check_healthy_threshold  INT DEFAULT 2,

    -- 服务发现
    discovery_type  ENUM('static', 'consul', 'etcd', 'nacos', 'kubernetes') DEFAULT 'static',
    discovery_config JSON,                          -- { "addr": "consul.internal:8500", "dc": "dc1" }

    -- 元数据
    metadata        JSON,                           -- { "version": "v2", "owner": "order-team" }
    tags            JSON,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 实例数据（从注册中心同步）

```sql
CREATE TABLE gateway_instances (
    id              VARCHAR(64) PRIMARY KEY,
    service_id      VARCHAR(64) NOT NULL,

    -- 实例信息
    host            VARCHAR(256) NOT NULL,
    port            INT NOT NULL,
    weight          INT DEFAULT 100,
    status          ENUM('healthy', 'unhealthy', 'unknown') DEFAULT 'unknown',

    -- 健康信息
    latency_p99_ms  INT DEFAULT 0,
    error_rate      DECIMAL(5,4) DEFAULT 0,

    -- 版本信息
    version         VARCHAR(64),
    metadata        JSON,

    last_heartbeat  TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_service (service_id),
    INDEX idx_status (status)
);
```

---

## 3. 后端实例（运行时）

网关通过注册中心观察者模式维护本地实例快照：

```
┌─────────────────────────────────────────┐
│         Gateway Node (per instance)      │
│                                          │
│  ┌─────────────┐    ┌─────────────────┐  │
│  │ Route Table │    │ Instance Index  │  │
│  │ (Readmostly │    │ (by Service ID) │  │
│  │  - HashMap   │    │  - HashMap      │  │
│  │  - RadixTree │    │  - Health Score │  │
│  │  - Regex     │    │    Ranking      │  │
│  └─────────────┘    └─────────────────┘  │
│         ▲                   ▲            │
│         │                   │            │
│  ┌──────┴───────────────────┴──────────┐ │
│  │       Configuration Watcher         │ │
│  │  (来自 etcd/consul/nacos 的变更推送) │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 4. 限流计数数据（Rate Limit State）

### Redis 存储

所有限流状态存储于 Redis，支持分布式协同限流：

```
# 令牌桶（Token Bucket）
ratelimit:bucket:{resource}:{dimension}
  tokens:          float  # 当前令牌数
  last_refill:     int64  # 最后 refill 时间戳（纳秒）
  # EXPIRE: capacity * 2（最大超时窗口）

# 滑动窗口（Sliding Window）
ratelimit:sliding:{resource}:{dimension}:{window_id}
  ZSET: score=timestamp, value=unique_request_id
  # window_id = floor(timestamp / window_size) * window_size
  # EXPIRE: window_size * 2

# 固定窗口（Fixed Window）
ratelimit:fixed:{resource}:{dimension}:{window_id}
  counter: int
  # EXPIRE: window_size + 1s
```

### 维度 Key 生成

```
dimension_key = sha256(resource + sorted_join(dim_kv_pairs))[:16]
# 例如: resource="order-service", user_id=u123, ip=1.2.3.4
# dimension_key = sha256("order-serviceuser_id=u123ip=1.2.3.4")[:16] = "a3f2b8c1d..."
```

---

## 5. 熔断器状态数据（Circuit Breaker State）

### 熔断器状态机

```
CLOSED（正常）
  │  错误率/延迟超过阈值
  ▼
OPEN（熔断）
  │  半开计时器到期
  ▼
HALF_OPEN（探测）
  │  探测成功
  ▼
CLOSED
  │  探测失败
  ▼
OPEN
```

### Redis 存储熔断状态（多节点协同）

```sql
-- 熔断器全局状态（用于半开恢复时的跨节点协调）
circuit_breaker:{service_id}
  state:          "closed" | "open" | "half_open"
  last_change:    int64      # timestamp
  failure_count:  int        # 连续失败次数
  success_count:  int        # 半开探测成功次数
  # EXPIRE: 5min（兜底清理）
```

### 本地熔断器（快速判断）

```go
type CircuitBreaker struct {
    ServiceID  string
    State      atomic.Value  // CircuitState

    // 配置
    ErrorThreshold    float64   // 错误率阈值（默认 50%）
    LatencyThreshold  int64     // P99 延迟阈值（ms）
    WindowSize        int64     // 统计窗口（秒）

    // 统计
    RequestCount      atomic.Int64
    ErrorCount        atomic.Int64
    LatencyHistogram  *分布统计（环形缓冲区）

    // 半开恢复
    HalfOpenProbeAt   int64
    MaxHalfOpenProbes int = 3
}
```

---

## 6. 插件数据（Plugin System）

### 插件注册表

```sql
CREATE TABLE gateway_plugins (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(256) NOT NULL UNIQUE,
    type            ENUM('builtin', 'lua', 'wasm', 'rpc') NOT NULL,
    version         VARCHAR(32),
    description     VARCHAR(1024),

    -- 插件位置
    artifact        VARCHAR(1024),     -- wasm 文件路径或 lua 脚本路径
    entrypoint      VARCHAR(256),      -- 入口函数名

    -- 资源配置
    schema          JSON,               -- 配置的 JSON Schema（用于校验）
    default_config  JSON,

    -- 生命周期
    supported_phases JSON,              -- ["rewrite", "auth", "rate_limit", "proxy"]

    enabled         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 插件执行上下文

```go
type PluginContext struct {
    RequestID     string
    RouteID       string
    TenantID      string
    ConsumerID    string
    UserID        string

    // 请求级别数据（插件间透传）
    Attributes    map[string]interface{}  // 插件可在 Attributes 中存放数据供后续插件使用

    // 请求/响应对象（插件可读写）
    Req           *fasthttp.RequestCtx
    Res           *fasthttp.Response

    // 插件链控制
    Index         int        // 当前执行到的插件位置
    Aborted       bool       // 是否中断请求（短路）
}
```

---

## 7. 路由匹配数据结构

### 路由索引分层

```
┌────────────────────────────────────────────┐
│              Route Index (per node)          │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ L1: 精确匹配索引                      │   │
│  │   Map< "GET:/api/v1/orders", Route>  │   │
│  │   Map< "POST:/api/v1/payments", ..>  │   │
│  └──────────────────────────────────────┘   │
│                   │                          │
│  ┌──────────────────────────────────────┐   │
│  │ L2: 前缀匹配索引（Radix Trie）        │   │
│  │   /api/v1/orders/**                  │   │
│  │   /api/v1/products/*                 │   │
│  └──────────────────────────────────────┘   │
│                   │                          │
│  ┌──────────────────────────────────────┐   │
│  │ L3: 正则匹配索引（RE2 自动机）         │   │
│  │   ^/api/v2/users/[0-9]+/.*$          │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  L1 → L2 → L3 顺序匹配，任意层命中即停止    │
└─────────────────────────────────────────────┘
```

### Radix Trie 节点

```go
type RadixNode struct {
    children   map[string]*RadixNode
    route      *Route        // 非叶子节点无值
    priority   int           // 优先级（决定同深度节点的匹配顺序）
    wildcard   bool          // 是否包含 ** 或 *
    isLeaf     bool
}
```

---

## 8. 会话和身份数据

### JWT Claim 提取后的身份上下文

```go
type Identity struct {
    UserID      string
    TenantID    string
    Roles       []string
    Permissions []string
    Scopes      []string
    ExpiresAt   int64

    // 额外属性
    Attributes map[string]string  // 来自 Token Claim 的额外信息
}
```

### 黑名单 Token（用于 Token 撤销）

```
jwt:blacklist:{jti}
  revoked_at: int64
  reason:     string
  # EXPIRE: Token 原始过期时间
```

当 Token 被撤销（退出登录、修改密码）时，将 `jti` 加入黑名单，验证时检查黑名单。

---

## 9. 日志与追踪数据模型

### 请求日志（访问日志）

```go
type AccessLog struct {
    RequestID      string    `json:"request_id"`
    TraceID        string    `json:"trace_id"`
    SpanID         string    `json:"span_id"`

    // 请求信息
    Method         string    `json:"method"`
    Path           string    `json:"path"`
    PathTemplate   string    `json:"path_template"`  // 路由模板（/orders/{id}）
    Query          string    `json:"query"`
    RequestSize    int64     `json:"request_size"`
    UserAgent      string    `json:"user_agent"`
    RemoteIP       string    `json:"remote_ip"`
    XForwardedFor  string    `json:"x_forwarded_for"`

    // 身份信息
    UserID         string    `json:"user_id"`
    TenantID        string    `json:"tenant_id"`
    ConsumerID      string    `json:"consumer_id"`

    // 后端信息
    BackendService string    `json:"backend_service"`
    BackendAddr    string    `json:"backend_addr"`
    BackendLatency int64     `json:"backend_latency_ms"`

    // 响应信息
    StatusCode     int       `json:"status_code"`
    ResponseSize   int64     `json:"response_size"`
    TotalLatency   int64     `json:"total_latency_ms"`

    // 网关内部信息
    GatewayNode    string    `json:"gateway_node"`
    RouteName      string    `json:"route_name"`
    PluginsExecuted []string  `json:"plugins_executed"`
    ErrorMsg       string    `json:"error_msg,omitempty"`

    // 时间戳
    RequestAt      int64     `json:"request_at"`   // Unix ms
    ResponseAt     int64     `json:"response_at"`
}
```

### 指标时序数据（Metric）

网关暴露 Prometheus 格式指标：

```
# 请求计数器
gateway_requests_total{route="$route", method="$method", status="$status", gateway="$node"} 12345

# 请求延迟
gateway_request_latency_seconds{route="$route", quantile="0.99"} 0.0045

# 后端延迟
gateway_backend_latency_seconds{service="$service", quantile="0.99"} 0.045

# 限流触发
gateway_ratelimit_triggered_total{route="$route", dimension="$dim"} 123

# 熔断事件
gateway_circuit_breaker_events{service="$service", event="open|close"} 5

# 连接池状态
gateway_backend_connections_pool{service="$service", state="active|idle"} 45
```
