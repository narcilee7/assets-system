# Scale

## 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 网关自身 P99 延迟 | < 5ms | 不计算后端延迟 |
| 单机吞吐量 | 10W+ QPS | 纯网关逻辑（无插件开销） |
| 路由匹配延迟 | P99 < 100μs | 万级路由规则下 |
| 最大路由规则数 | 10W+ | 多租户、多业务线 |
| 最大插件数 | 50 个/节点 | 内置+自定义 |
| 规则热更新延迟 | < 1s | 配置中心推送 + 本地兜底 |
| 同时活跃连接数 | 10W+ | HTTP/2、WebSocket 长连接 |

---

## 性能瓶颈分析

### 瓶颈 1：路由匹配（最高优先级优化）

#### 问题

万级路由规则，每次请求必须找到匹配的路由。简单遍历 O(n) 不可接受。

#### 分层匹配策略

```
每秒 10W 请求 × 路由匹配 = 必须 < 1s 总开销

分层策略：
  - 精确匹配（HashMap）：99% 请求在 L1 命中，O(1)
  - 前缀匹配（Radix Trie）：< 1% 请求到 L2，O(k) k=路径长度
  - 正则匹配：< 0.1% 请求到 L3，O(n) 但规则数少

实际性能：
  - L1 命中：50μs（0.05ms）
  - L2 命中：100μs（0.1ms）
  - L3 命中：500μs（0.5ms）
```

#### 路由表预热

网关启动时，从配置中心批量加载路由表到内存，避免第一次请求时加载的延迟毛刺：

```go
func (g *Gateway) PreloadRoutes(ctx context.Context) error {
    routes, err := g.configStore.ListAll(ctx)
    if err != nil {
        return fmt.Errorf("preload routes: %w", err)
    }

    // 批量构建索引
    for _, route := range routes {
        g.routeIndex.Insert(route)
    }

    g.logger.Info("preloaded routes",
        zap.Int("total", len(routes)),
        zap.Time("loaded_at", time.Now()))
    return nil
}
```

---

### 瓶颈 2：JWT 验证（CPU 密集型）

#### 问题

JWT RS256 签名验证涉及大量数学运算（RSA key^e mod n），每个请求都要验证。

#### 优化方案

| 方案 | 实现 | 效果 |
|------|------|------|
| **本地缓存验证结果** | JWT payload + 过期时间缓存，60s TTL | 减少 90% CPU 开销 |
| **共享 JWKS 缓存** | 所有节点共享同一个 JWKS 缓存（Redis） | 减少 JWKS 网络请求 |
| **硬件加速** | 使用 AES-NI / AVX 指令集 | CPU 效率提升 30% |
| **简化算法** | RS256 → HS256（共享密钥，验签快 10x） | 仅限内部服务，慎用 |

#### JWT 缓存实现

```go
type JWTValidator struct {
    cache  *lru.Cache  // JWKS 缓存，maxEntries=1000
    secret []byte      // HS256 密钥（内部服务）
}

func (v *JWTValidator) Validate(token string) (*Claims, error) {
    // 1. 先检查缓存（payload 的 hash 为 key）
    payloadHash := sha256(token[:min(len(token), 200)])
    if cached := v.cache.Get(payloadHash); cached != nil {
        claims := cached.(*Claims)
        if claims.Exp > time.Now().Unix() {
            return claims, nil  // 命中缓存，直接返回
        }
    }

    // 2. 验证签名（未命中缓存时）
    claims, err := v.verify(token)
    if err != nil {
        return nil, err
    }

    // 3. 缓存验证结果
    v.cache.Add(payloadHash, claims)
    return claims, nil
}
```

---

### 瓶颈 3：限流 Redis 访问（网络 I/O 密集）

#### 问题

分布式限流每次请求都要访问 Redis，高 QPS 下 Redis 成为瓶颈。

#### 优化方案

```
方案 1：本地限流 + Redis 异步同步
  - 本地令牌桶直接判断（无网络开销）
  - 每 100ms 异步同步计数到 Redis
  - 问题：精度降低，允许 ±5% 误差

方案 2：多级缓存
  - L1：本地内存（TTL 100ms）
  - L2：Redis（TTL 1s）
  - L3：降级到本地

方案 3：Redis Pipeline / Lua 原子脚本
  - 将限流判断和计数打包成单个 Lua 脚本
  - 减少网络往返（1 RTT 而非 2+ RTT）

方案 4：Redis Cluster 垂直扩展
  - 使用更大的 Redis 实例（64核 256GB）
  - 分片键用 resource + dimension，减少热点 Key
```

#### 热点 Key 优化

```
问题：全局限流 key（如 "/api/v1/orders"）被 10W QPS 访问
      Redis 单节点 CPU 打满

解决：
  - 路由维度拆分："/api/v1/orders:user_id=u123"
  - 使用 Redis Cluster 分片（不同 key 路由到不同节点）
  - 本地缓存高频用户配额，减少 Redis 访问
```

---

### 瓶颈 4：连接池复用（HTTP/1.1 Keep-Alive）

#### 问题

后端 HTTP 连接建立成本高（TCP 握手 + TLS 握手），需要复用连接。

#### 连接池实现

```go
type BackendConnPool struct {
    maxConns    int
    maxIdleConns int
    idleTimeout time.Duration

    // 每个 backend addr 一个连接池
    pools sync.Map  // map[string]*connPool

    // 连接建立器
    dialer *net.Dialer
    tlsConfig *tls.Config
}

type connPool struct {
    mu      sync.Mutex
    conns   []*Conn  // active + idle
    waiters []chan *Conn  // 等待连接的请求
}

func (p *connPool) Get(timeout time.Duration) (*Conn, error) {
    p.mu.Lock()
    if len(p.conns) > 0 {
        conn := p.conns[len(p.conns)-1]
        p.conns = p.conns[:len(p.conns)-1]
        p.mu.Unlock()
        return conn, nil
    }
    // 无可用连接，加入等待队列...
}
```

**关键配置**：
- `maxIdleConns`：每个后端服务 100-500 个空闲连接
- `maxConns`：每个后端服务总连接数（防止后端被压垮）
- `idleTimeout`：空闲连接 60s 后关闭（释放资源）

---

### 瓶颈 5：插件链开销（链式调用延迟）

#### 问题

每个插件都是一次函数调用，50 个插件 × 10W QPS = 函数调用开销不可忽视。

#### 优化方案

| 方案 | 说明 |
|------|------|
| **插件短路** | 如果前置插件（如 IP 黑名单）已拒绝请求，后续插件不再执行 |
| **批量检查** | 同类型检查（如多个 Header 检查）合并为一次遍历 |
| **异步插件** | 日志、监控等后置插件异步执行，不阻塞响应 |
| **预编译插件链** | 插件链在启动时预编译为函数指针数组，避免运行时反射 |
| **WASM 热路径优化** | WASM 插件使用预编译的 native code stub |

---

## 扩展方案

### 扩展维度 1：水平扩展（多节点）

```
                    ┌──────────────────────┐
                    │   Load Balancer       │
                    │  (Tengine / AWS ALB)  │
                    └──────────┬───────────┘
                               │ VIP / DNS Round Robin
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  ┌───────────┐          ┌───────────┐          ┌───────────┐
  │  GW Node  │          │  GW Node  │          │  GW Node  │
  │  (10W QPS)│          │  (10W QPS)│          │  (10W QPS)│
  └───────────┘          └───────────┘          └───────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │   Redis Cluster       │
                    │  (限流状态)          │
                    └──────────────────────┘
```

**最大节点数**：受 Load Balancer 健康检查能力和配置中心推送能力限制，通常 50-100 节点。

### 扩展维度 2：分片限流

```
问题：10W QPS 限流，所有请求打到一个 Redis 集群

解决：按路由分片
  - Shard Key = hash(route_id) % num_shards
  - 每个分片独立限流计数
  - 聚合查询时跨分片汇总
```

### 扩展维度 3：多地域部署

```
Region CN （北京）
  └── GW Cluster → 北京后端服务

Region SG （新加坡）
  └── GW Cluster → 新加坡后端服务 + 跨境路由到 CN

跨地域流量路由：
  - 用户请求 → 就近 GW 节点
  - 如果数据在 CN，用户需要跨境访问 CN 后端
  - GW 做协议转换和请求聚合
```

---

## 容量规划

### 估算公式

```
所需网关节点数 = 峰值 QPS / 单机 QPS × 冗余系数

假设：
  - 峰值 QPS = 50W
  - 单机 QPS = 10W
  - 冗余系数 = 1.5（应对突发流量和故障转移）

所需节点数 = 50W / 10W × 1.5 = 7.5 → 8 节点

预留：
  - 正常运行时 4-6 节点
  - 2-3 节点作为故障转移冗余
```

### Redis 容量估算

```
限流 key 数量 = 路由数 × 平均维度组合数

假设：
  - 1W 路由规则
  - 每路由平均 3 种维度（user_id、IP、服务级别）
  - 每维度平均 100 种组合（top 100 用户）

总 key 数 = 1W × 3 × 100 = 300W key

每个 key 大小：
  - 令牌桶：约 200 bytes（tokens + last_refill + key 前缀）
  - 滑动窗口：约 50 bytes × 时间窗口内的请求数

总 Redis 内存 ≈ 300W × 200 bytes = 600MB（令牌桶）
                     加上 Lua 脚本开销 ≈ 1-2GB
```

---

## 监控指标

### 核心指标

```
gateway.requests.total                    # 总请求数（按 method/status/route 分维度）
gateway.request.duration.p99_ms          # 请求端到端延迟 P99
gateway.backend.duration.p99_ms           # 后端响应延迟 P99
gateway.route.match.duration.us           # 路由匹配耗时
gateway.jwt.validation.duration.us        # JWT 验证耗时
gateway.ratelimit.check.duration.us       # 限流判断耗时
gateway.backend.pool.connections.active   # 后端连接池活跃连接数
gateway.backend.pool.connections.idle    # 后端连接池空闲连接数
gateway.circuit_breaker.state             # 熔断器状态（0=closed,1=open,2=half_open）
```

### 告警阈值

| 指标 | 警告 | 严重 |
|------|------|------|
| 网关 P99 延迟 | > 10ms | > 50ms |
| 后端 P99 延迟 | > 2s | > 5s |
| 限流触发率 | > 1% | > 5% |
| 502/504 错误率 | > 0.5% | > 2% |
| 熔断器打开数量 | > 0 | > 3 |
| 后端连接池使用率 | > 70% | > 90% |
| 网关节点不健康数 | > 0 | > 总节点数/2 |
