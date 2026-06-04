# Read & Write Path

## 请求处理主流程

```
外部请求
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 0: 入口处理                                        │
│  1. 接收请求（TCP 连接复用 / HTTP/2 Multiplexing）         │
│  2. 解析协议（HTTP/1.1、HTTP/2、WebSocket、gRPC-Web）      │
│  3. 生成 Request ID（UUIDv7 / Snowflake）                  │
│  4. 记录请求开始时间                                       │
│  5. 解压（如 gzip/br 压缩）                                │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: 路由匹配                                        │
│  1. 提取 Method + Path                                    │
│  2. 精确匹配 → 命中则路由                                  │
│  3. 前缀匹配（Radix Trie）→ 命中则路由                      │
│  4. 正则匹配（RE2）→ 命中则路由                             │
│  5. 均未命中 → 返回 404 Not Found                          │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 2: 插件链执行（Plugin Chain）                        │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │ [0] Rate Limit（前置限流）                        │     │
│  │     快速失败，避免无效请求消耗后端资源              │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [1] IP Blacklist / Whitelist                    │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [2] CORS（跨域处理）                              │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [3] Auth（认证）                                  │     │
│  │     JWT / API Key / Basic Auth 验证               │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [4] RBAC（鉴权）                                  │     │
│  │     检查用户权限是否覆盖路由要求的权限              │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [5] Tenant Isolation（租户隔离）                  │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [6] Request Transformer                          │     │
│  │     Header 注入（X-Request-ID, X-User-ID 等）      │     │
│  │     Query 参数标准化                              │     │
│  │     Body 脱敏/转换                                │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [7] Custom Plugins（用户自定义插件）               │     │
│  ├─────────────────────────────────────────────────┤     │
│  │ [8] Circuit Breaker（熔断预检）                   │     │
│  │     检查后端熔断状态，快速失败                     │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  插件链短路（Aborted）→ 返回错误响应，不继续               │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: 负载均衡选择后端实例                             │
│                                                          │
│  1. 从 Instance Index 获取服务实例列表                      │
│  2. 过滤 unhealthy 实例                                    │
│  3. 按负载均衡策略选择：                                   │
│     - round_robin：轮询                                   │
│     - weighted_round_robin：加权轮询                      │
│     - least_conn：最小连接数                              │
│     - latency_aware：延迟感知（根据 P99 动态调整权重）      │
│     - consistent_hash：一致性哈希（会话保持）              │
│  4. 健康检查守护：如果全部实例不健康，降级返回 503          │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 4: 后端代理转发                                     │
│  1. 构建代理请求（Header 透传、协议转换）                   │
│  2. 执行重试（如配置且初始失败）                            │
│  3. 记录后端响应延迟                                       │
│  4. 执行响应转换（如 gRPC→JSON、Header 清理）              │
│  5. 熔断器统计（成功/失败/延迟）                            │
└─────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 5: 响应处理                                        │
│  1. 记录响应状态码                                         │
│  2. 压缩（如客户端支持 gzip）                              │
│  3. 写入访问日志（异步，不阻塞响应）                        │
│  4. 指标上报（Prometheus Push Gateway / Pull）             │
└─────────────────────────────────────────────────────────┘
  │
  ▼
  返回客户端
```

---

## 详细阶段分析

### PHASE 1: 路由匹配算法

#### L1 精确匹配

使用 `sync.Map` 存储 `method:path → Route`，O(1) 查找：

```go
type RouteExactIndex struct {
    index map[string]*Route  // key: "GET:/api/v1/orders"
    mu    sync.RWMutex
}

func (idx *RouteExactIndex) Match(method, path string) *Route {
    key := method + ":" + path
    idx.mu.RLock()
    defer idx.mu.RUnlock()
    return idx.index[key]
}
```

#### L2 前缀匹配（Radix Trie）

```go
// Radix Trie 插入
func (n *RadixNode) Insert(path string, route *Route) {
    for i := 0; i < len(path); {
        seg, tail := nextSegment(path[i:])
        if seg == "*" {  // 通配符段
            n.wildcards = append(n.wildcards, &RadixNode{route: route})
            break
        }
        if seg == "**" {  // 双星号（捕获剩余全部路径）
            n.catchAll = route
            break
        }
        // 继续深入...
    }
}

// Radix Trie 查找
func (n *RadixNode) Match(path string) *Route {
    if n.route != nil && n.isLeaf {
        return n.route
    }
    seg, tail := nextSegment(path)
    if child, ok := n.children[seg]; ok {
        return child.Match(tail)
    }
    // 匹配通配符
    for _, wc := range n.wildcards {
        if wc.Match(tail).route != nil {
            return wc.route
        }
    }
    return n.catchAll  // 双星号兜底
}
```

#### L3 正则匹配

对于复杂路径模式（如 `/api/v2/users/[0-9]+/profile`），使用 RE2 自动机：

```go
type RegexIndex struct {
    patterns []*regexpPattern  // 按优先级排序
}

type regexpPattern struct {
    regex   *regexp.Regexp
    route   *Route
    priority int
}

// 匹配时遍历所有正则，找到第一个匹配者
func (idx *RegexIndex) Match(path string) *Route {
    for _, p := range idx.patterns {
        if p.regex.MatchString(path) {
            return p.route
        }
    }
    return nil
}
```

**性能优化**：正则匹配放在 L3 是因为它最慢；万级路由中正则规则通常少于 100 条，用前缀匹配能覆盖 99% 的场景。

---

### PHASE 2: 认证流程详解

#### JWT 验证流程

```go
func (p *JWTAuthPlugin) Authenticate(ctx *PluginContext) error {
    // 1. 提取 Token
    token := extractToken(ctx.Req)
    if token == "" {
        return ErrMissingToken
    }

    // 2. 解析 Header（获取算法和 JWK）
    header, err := parseTokenHeader(token)
    if err != nil {
        return ErrInvalidTokenHeader
    }

    // 3. 从 JWKS 获取公钥（带缓存）
    jwk, err := p.jwksCache.Get(header.Kid)
    if err != nil {
        return ErrKeyNotFound  // 可能 Kid 不存在，触发 JWKS 刷新
    }

    // 4. 验证签名
    claims, err := jwt.Verify(token, jwk, header.Alg)
    if err != nil {
        return ErrInvalidSignature
    }

    // 5. 验证 Claim
    if err := validateClaims(claims, p.config.RequiredClaims); err != nil {
        return err
    }

    // 6. 检查 Token 是否在黑名单
    if p.blacklist != nil && p.blacklist.IsRevoked(claims.JTI) {
        return ErrTokenRevoked
    }

    // 7. 注入身份到上下文
    ctx.Identity = &Identity{
        UserID:      claims.UserID,
        TenantID:    claims.TenantID,
        Roles:       claims.Roles,
        Permissions: claims.Permissions,
        ExpiresAt:   claims.Exp,
    }

    return nil
}
```

#### JWKS 缓存策略

```
1. 首次请求时，从 {jwks_url}/.well-known/jwks.json 加载 JWKS
2. 缓存到内存，过期时间 = min(jwks["kid"] 列表中最小 exp, 1h)
3. 当收到 Kid 不存在的错误时，立即异步刷新 JWKS（避免阻塞当前请求）
4. 刷新后用一个新缓存版本，新请求使用新版本，旧版本等其自然过期
```

---

### PHASE 2: 限流流程详解

#### 多粒度限流判断

```go
func (p *RateLimitPlugin) Check(ctx *PluginContext) error {
    // 1. 匹配限流规则
    rule := p.matchRule(ctx.Route)
    if rule == nil {
        return nil  // 无匹配规则，放行
    }

    // 2. 构建维度 key
    dimKey := p.buildDimensionKey(rule, ctx)

    // 3. 检查白名单（如 VIP 用户独立配额）
    if p.isVIP(ctx) {
        rule = p.getVIPRule(rule)
    }

    // 4. 执行限流算法
    allowed, remaining, resetAt, err := p.executeRateLimit(ctx, rule, dimKey)
    if err != nil {
        // Redis 不可用时的降级策略
        if p.config.FailOpen {
            return nil  // fail-open，放行
        }
        return err
    }

    // 5. 设置响应 Header
    ctx.Req.Response.Header.Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
    ctx.Req.Response.Header.Set("X-RateLimit-Reset", strconv.FormatInt(resetAt, 10))

    if !allowed {
        ctx.Aborted = true
        return ErrRateLimitExceeded
    }

    return nil
}
```

#### 令牌桶算法（分布式 Redis 实现）

```lua
-- token_bucket.lua
local key = KEYS[1]                  -- ratelimit:bucket:order-service:user_id=u123
local capacity = tonumber(ARGV[1])  -- 桶容量
local refill_rate = tonumber(ARGV[2]) -- 每秒补充令牌数
local now = tonumber(ARGV[3])        -- 当前时间戳（纳秒转秒）
local requested = tonumber(ARGV[4])  -- 请求消耗令牌（通常为 1）

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- 计算应该补充的令牌
local elapsed = now - last_refill
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

-- 检查是否允许
local allowed = new_tokens >= requested
if allowed then
    new_tokens = new_tokens - requested
end

-- 更新桶状态
redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
redis.call('EXPIRE', key, 60)  -- 1 分钟过期

return {allowed and 1 or 0, math.floor(new_tokens)}
```

---

### PHASE 3: 负载均衡算法

#### 延迟感知负载均衡（Latency-Aware）

```go
type LatencyAwarePicker struct {
    instances []*Instance
    // 动态权重 = baseWeight * (ideal_p99 / actual_p99)
    // P99 延迟越低的实例权重越高
}

func (p *LatencyAwarePicker) Pick() *Instance {
    var best *Instance
    var bestScore float64 = -1

    for _, ins := range p.instances {
        if ins.Status != healthy {
            continue
        }
        score := float64(ins.Weight) * (float64(ins.IdealP99) / float64(ins.CurrentP99+1))
        if score > bestScore {
            bestScore = score
            best = ins
        }
    }
    return best
}
```

#### 一致性哈希（Consistent Hash）

用于会话保持（同一个用户的请求路由到同一个后端实例）：

```
hash(用户ID) → 环上某个节点 → 选择该节点对应的实例

当实例变更时，只有该实例附近的数据需要迁移，而不是全部重新映射

增强：虚拟节点（每个物理节点 100 个虚拟节点），使负载分布更均匀
```

---

### PHASE 4: 熔断器流程

#### 熔断器核心逻辑

```go
func (cb *CircuitBreaker) Allow() bool {
    state := cb.State.Load().(CircuitState)

    switch state {
    case StateClosed:
        return cb.allowInClosed()
    case StateOpen:
        return cb.allowInOpen()
    case StateHalfOpen:
        return cb.allowInHalfOpen()
    }
}

func (cb *CircuitBreaker) allowInClosed() bool {
    // 统计窗口内计算错误率和延迟
    stats := cb.Stats.Collect(cb.WindowSize)

    if stats.ErrorRate > cb.ErrorThreshold {
        cb.open()
        return false
    }

    if stats.P99Latency > cb.LatencyThreshold {
        cb.open()
        return false
    }

    return true
}

func (cb *CircuitBreaker) allowInOpen() bool {
    if time.Now().UnixMilli() < cb.OpenedAt + cb.RecoveryTimeout {
        return false  // 还在熔断窗口内
    }

    // 触发半开状态，开始放行探测请求
    cb.toHalfOpen()
    return true
}
```

---

## 管理面读写路径

### 路由规则热更新流程

```
管理员发布路由变更
    │
    ▼
配置中心（etcd/consul）收到写入
    │
    ▼
etcd watch 触发通知 → 各网关节点本地缓存更新
    │
    ▼
路由表版本号更新（每个路由规则带 sequence）
    │
    ▼
读写请求使用新版本路由表（无锁切换）
```

**注意**：不使用读锁，而是用**原子值替换**（`atomic.Value`），实现真正的无锁热更新。

### 服务发现同步

```
注册中心（Consul/etcd）
  │
  ▼ Watch 变更事件
Gateway 节点
  │
  ▼ 增量更新本地 Instance Index
  - 新实例加入：添加到 index
  - 实例下线：从 index 移除
  - 实例健康状态变化：更新权重/状态
```

---

## 插件链执行模型

### 同步插件链（非阻塞代理）

```go
func (g *Gateway) handleRequest(ctx *fasthttp.RequestCtx) {
    pctx := &PluginContext{
        RequestID: generateRequestID(),
        Req:       ctx,
    }

    // 执行前置插件链
    for i, plugin := range g.Plugins.Pre {
        if err := plugin.Execute(pctx); err != nil {
            handlePluginError(ctx, err)
            return
        }
        if pctx.Aborted {
            writeAbortedResponse(ctx, pctx.AbortStatus, pctx.AbortMsg)
            return
        }
    }

    // 代理到后端...

    // 执行后置插件链
    for i := len(g.Plugins.Post) - 1; i >= 0; i-- {
        g.Plugins.Post[i].Execute(pctx)
    }
}
```

### 插件执行顺序

```
请求方向：客户端 → 网关 → 后端
  Pre-1 → Pre-2 → Pre-3 → [后端] → Post-3 → Post-2 → Post-1

例如：日志插件（Pre）→ 认证插件（Pre）→ 限流插件（Pre）→ [后端] → 响应转换插件（Post）
```

**重要**：后置插件按逆序执行，确保嵌套关系的清理顺序正确（如先执行内层资源清理，再执行外层）。
