# API

## 管理面 API（Control Plane）

### 1. 路由规则管理

#### 创建路由规则

```http
POST /admin/v1/routes
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "name": "order-service-prod",
  "match": {
    "path": "/api/v1/orders/**",
    "methods": ["GET", "POST"],
    "headers": {
      "X-Tenant-Id": "*"
    }
  },
  "backend": {
    "service_id": "order-service",
    "loadbalance": {
      "strategy": "round_robin",
      "healthy_only": true
    },
    "timeout": {
      "connect_ms": 1000,
      "read_ms": 5000,
      "idle_ms": 30000
    },
    "retry": {
      "attempts": 2,
      "on_status": [502, 503, 504]
    }
  },
  "plugins": [
    {"name": "jwt-auth", "config": {"jwks_url": "https://auth.internal/.well-known/jwks.json"}},
    {"name": "rate-limiter", "config": {"limit": 1000, "window": "1m", "dimension": "user_id"}}
  ],
  "priority": 100,
  "enabled": true,
  "tags": ["prod", "order"]
}
```

#### 查询路由规则

```http
GET /admin/v1/routes?name=order-service&tag=prod&page=1&page_size=20
```

```json
{
  "data": [
    {
      "id": "route-abc123",
      "name": "order-service-prod",
      "match": {"/api/v1/orders/**": {}},
      "backend": { "service_id": "order-service" },
      "enabled": true,
      "updated_at": "2024-06-01T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

#### 更新路由规则（热更新）

```http
PUT /admin/v1/routes/{route_id}
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "config": {
    "backend": {
      "timeout": {
        "read_ms": 3000
      }
    }
  }
}
```

**热更新机制**：变更后通过配置中心推送 + 本地定时拉取兜底，< 1s 内在所有网关节点生效。

#### 删除路由规则

```http
DELETE /admin/v1/routes/{route_id}
X-Admin-Token: {admin_token}
```

---

### 2. 服务管理

#### 注册服务

```http
POST /admin/v1/services
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "id": "order-service",
  "name": "订单服务",
  "健康检查": {
    "type": "http",
    "path": "/health",
    "interval_ms": 5000,
    "timeout_ms": 1000,
    "unhealthy_threshold": 3,
    "healthy_threshold": 2
  },
  "注册中心": {
    "type": "consul",
    "addr": "http://consul.internal:8500",
    "dc": "dc1",
    "service_name": "order-service"
  },
  "metadata": {
    "version": "v2",
    "owner": "order-team"
  }
}
```

#### 查询服务健康状态

```http
GET /admin/v1/services/{service_id}/health
```

```json
{
  "service_id": "order-service",
  "status": "healthy",
  "instances": [
    {
      "id": "ins-001",
      "addr": "10.0.1.1:8080",
      "status": "healthy",
      "weight": 100,
      "version": "v2.1.0",
      "latency_p99_ms": 45
    },
    {
      "id": "ins-002",
      "addr": "10.0.1.2:8080",
      "status": "unhealthy",
      "weight": 0,
      "version": "v2.1.0",
      "latency_p99_ms": 5000
    }
  ],
  "updated_at": "2024-06-01T10:00:05Z"
}
```

---

### 3. 插件管理

#### 启用插件

```http
POST /admin/v1/plugins
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "name": "rate-limiter",
  "type": "builtin",
  "config": {
    "algorithm": "token_bucket",
    "capacity": 10000,
    "refill_rate": 100,
    "refill_interval": "1s",
    "dimension": "user_id",
    "storage": "redis",
    "redis": {
      "addr": "redis.internal:6379",
      "pool_size": 100
    }
  },
  "scope": {
    "routes": ["route-abc123"],
    "global": false
  },
  "enabled": true
}
```

#### 插件列表

```http
GET /admin/v1/plugins?type=wasm&page=1&page_size=50
```

---

### 4. 限流规则管理

#### 创建限流规则

```http
PUT /admin/v1/ratelimit/rules/{rule_id}
Content-Type: application/json
X-Admin-Token: {admin_token}

{
  "resource": "/api/v1/orders",
  "dimension_keys": ["user_id", "ip"],
  "algorithm": "sliding_window",
  "config": {
    "limit": 1000,
    "window": "1m",
    "precision_ms": 100
  },
  "priority": 50,
  "enabled": true
}
```

---

## 数据面 API（Data Plane）

### 5. 认证 Token 验证

#### JWT 验证（通过认证插件自动处理）

请求时，网关自动在请求链路上完成：

```
Request
  │
  ▼
[1] 提取 Token
  ├── Header: Authorization: Bearer <jwt>
  ├── Query: access_token=<jwt>
  └── Cookie: token=<jwt>
  │
  ▼
[2] JWT 验证（HS256 / RS256）
  ├── 签名验证
  ├── 过期时间检查（exp）
  ├── 生效时间检查（nbf）
  ├── 发行者验证（iss）
  └── Claim 提取（user_id, roles, tenant_id）
  │
  ▼
[3] RBAC 权限检查
  ├── 从 Claims 提取 roles
  ├── 匹配路由规则要求的权限
  └── 有权限 → 转发；无权限 → 403
```

#### 错误响应

```json
// 401 Unauthorized
{
  "error": "unauthorized",
  "error_description": "Token expired",
  "WWW-Authenticate": "Bearer realm=\"api\""
}

// 403 Forbidden
{
  "error": "forbidden",
  "error_description": "Insufficient permissions for /api/v1/orders (requires: orders:read)"
}

// 429 Too Many Requests
{
  "error": "rate_limited",
  "error_description": "Rate limit exceeded",
  "limit": 1000,
  "remaining": 0,
  "reset_at": 1717500060,
  "retry_after_ms": 23400
}
```

---

### 6. 路由匹配（内部处理）

网关内部维护路由表，匹配算法：

```
请求进来
  │
  ▼
[1] 提取 Key = {method}:{path}
  │
  ▼
[2] 精确匹配（HashMap）
  │  命中 → 直接路由
  │  未命中
  ▼
[3] 前缀匹配（Radix Tree）
  │  命中 → 返回匹配结果
  │  未命中
  ▼
[4] 正则匹配（RE2 自动机）
  │  命中 → 返回结果
  │  未命中
  ▼
[5] 默认路由 / 404
```

---

### 7. 熔断事件

当熔断器状态变化时，网关对外发出事件：

```json
{
  "event": "circuit_breaker.state_change",
  "service_id": "order-service",
  "from_state": "closed",
  "to_state": "open",
  "reason": "error_rate_threshold_exceeded",
  "error_rate": 0.52,
  "threshold": 0.50,
  "window": "10s",
  "at": "2024-06-01T10:00:05Z"
}
```

---

## Event Contract

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `gateway.route.created` | 路由规则创建 | 配置同步、各节点缓存刷新 |
| `gateway.route.updated` | 路由规则变更（热更新） | 同上 |
| `gateway.circuit.open` | 熔断器打开 | 告警系统、运维 dashboard |
| `gateway.circuit.close` | 熔断器恢复 | 运维 dashboard |
| `gateway.ratelimit.triggered` | 限流触发 | 告警、统计、IP 信誉库 |
| `gateway.auth.failed` | 认证失败 | 安全审计、WAF |
| `gateway.backend.timeout` | 后端超时 | 熔断决策、负载均衡调整 |
| `gateway.plugin.error` | 插件执行异常 | 插件监控、开发者告警 |

---

## Protocol Translation API

### 8. gRPC 代理

#### gRPC → HTTP/JSON（外拨）

```http
POST /grpc/v1.OrderService/CreateOrder
Content-Type: application/json
X-Grpc-Service: order-service
X-Grpc-Method: CreateOrder

{
  "user_id": "u12345",
  "items": [
    {"product_id": "p001", "quantity": 2}
  ]
}
```

网关自动完成：
1. 将 JSON body 转换为 Protobuf（通过 gRPC-JSON-encoder）
2. 将请求通过 gRPC 协议转发到后端 order-service
3. 将 gRPC 响应（Protobuf）转回 JSON 返回客户端

#### gRPC-Web 浏览器代理

浏览器发送 gRPC-Web 请求：

```http
POST /grpc-web/v1.OrderService/CreateOrder
Content-Type: application/grpc-web
X-Grpc-Web: 1
X-Grpc-Web-Message-Type: 0
X-Grpc-Web-Encoding: gzip

<binary protobuf body>
```

网关处理：
1. 从请求 Header 提取目标服务和方法
2. 将 gRPC-Web 格式转换为标准 gRPC 格式
3. 转发到后端 gRPC 服务
4. 将响应转换回 gRPC-Web 格式

---

### 9. WebSocket 升级

```http
GET /ws/chat/rooms/{room_id}
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
X-User-Id: u12345
X-Auth-Token: {jwt}
```

网关处理：
1. 验证 JWT（认证）
2. 检查用户是否有权限加入该房间（鉴权）
3. 将请求升级为 WebSocket 连接
4. 维护长连接状态（连接表、房间订阅关系）
5. 在用户和后端消息服务之间透传消息
