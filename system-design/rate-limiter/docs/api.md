# API

## 限流判断（核心路径）

### 1. 同步限流检查

```http
POST /v1/ratelimit/check
Content-Type: application/json

{
  "resource": "api:order:create",
  "dimensions": {
    "user_id": "u12345",
    "ip": "1.2.3.4"
  },
  "priority": "normal"
}
```

响应：

```json
{
  "allowed": true,
  "remaining": 42,
  "reset_at": 1717500000,
  "limit": 100,
  "window": "1m"
}
```

### 2. 批量限流检查

```http
POST /v1/ratelimit/check/batch
Content-Type: application/json

{
  "requests": [
    {"resource": "api:order:create", "dimensions": {"user_id": "u12345"}},
    {"resource": "api:pay:submit", "dimensions": {"user_id": "u12345"}}
  ]
}
```

## 规则管理（管理面）

### 3. 创建/更新规则

```http
PUT /v1/ratelimit/rules/{rule_id}
Content-Type: application/json

{
  "resource": "api:order:create",
  "dimension_keys": ["user_id"],
  "algorithm": "token_bucket",
  "config": {
    "capacity": 100,
    "refill_rate": 10,
    "refill_interval": "1s"
  },
  "priority": 100,
  "enabled": true
}
```

### 4. 查询规则

```http
GET /v1/ratelimit/rules?resource=api:order:create
```

### 5. 删除规则

```http
DELETE /v1/ratelimit/rules/{rule_id}
```

## 状态查询（观测面）

### 6. 实时配额查询

```http
GET /v1/ratelimit/quota?resource=api:order:create&user_id=u12345
```

响应：

```json
{
  "resource": "api:order:create",
  "dimension": "user_id=u12345",
  "used": 58,
  "limit": 100,
  "window_remaining_ms": 23000
}
```

## Event

| Event | 触发时机 | 消费者 |
|-------|---------|--------|
| `ratelimit.triggered` | 限流拒绝时 | 告警、审计日志 |
| `ratelimit.rule.changed` | 规则增删改时 | 各节点本地缓存刷新 |
