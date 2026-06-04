# Rate Limiter — 最小可运行原型

Go 实现的限流系统最小原型，支持单机（内存）和分布式（Redis）两种模式。

## 功能

- **令牌桶**（Token Bucket）：允许突发，平滑限流
- **滑动窗口**（Sliding Window）：避免窗口边界突发
- **单机模式**：纯内存，无外部依赖，亚毫秒级延迟
- **Redis 模式**：Lua 脚本保证原子性，支持分布式限流
- **规则管理**：运行时动态添加/删除限流规则
- **降级策略**：Redis 故障时自动降级到单机限流

## 目录结构

```
.
├── main.go              # HTTP server 入口
├── limiter.go           # 规则存储、公共类型
├── local/
│   ├── bucket.go        # 单机令牌桶
│   ├── window.go        # 单机滑动窗口
│   └── bucket_test.go   # 单元测试 + 基准测试
└── redis/
    └── bucket.go        # Redis 分布式令牌桶 + 滑动窗口（Lua）
```

## 快速开始

### 1. 单机模式（零依赖）

```bash
cd system-design/rate-limiter/implementation
go mod tidy
go run .
```

服务启动在 `:8080`。

### 2. Redis 模式

```bash
# 启动 Redis（如未安装）
docker run -d -p 6379:6379 redis:7-alpine

# 运行服务
go run . -redis 127.0.0.1:6379
```

### 3. 测试限流

**检查是否被限流：**

```bash
curl -X POST http://localhost:8080/check \
  -H "Content-Type: application/json" \
  -d '{"resource":"api:order:create","dimensions":{"user_id":"u001"}}'
```

响应：

```json
{
  "allowed": true,
  "remaining": 9,
  "reset_at": 1717500000,
  "limit": 10,
  "window": "1m"
}
```

连续请求超过配额后：

```json
{
  "allowed": false,
  "remaining": 0,
  "reset_at": 1717500000,
  "limit": 10,
  "window": "1m"
}
```

HTTP 状态码变为 `429 Too Many Requests`。

**添加规则：**

```bash
curl -X POST http://localhost:8080/rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rule_api_login",
    "resource": "api:login",
    "dimension_keys": ["ip"],
    "algorithm": "token_bucket",
    "config": {"capacity": 5, "refill_rate": 1},
    "enabled": true
  }'
```

**查看规则：**

```bash
curl "http://localhost:8080/rules?resource=api:order:create"
```

**查看服务状态：**

```bash
curl http://localhost:8080/status
```

### 4. 运行测试

```bash
go test ./local/ -v
go test ./local/ -bench=. -benchmem
```

## 预置规则

| 资源 | 算法 | 配额 | 维度 |
|------|------|------|------|
| `api:order:create` | 令牌桶 | 容量 10，每秒 2 个 | `user_id` |
| `api:pay:submit` | 滑动窗口 | 1 分钟 5 个 | `user_id` |

## 设计取舍

| 取舍点 | 选择 | 原因 |
|--------|------|------|
| 单机计数 | `atomic` 无锁 CAS | 性能优先，避免 Mutex 竞争 |
| Redis 分布式 | Lua 脚本原子执行 | 避免 race condition |
| 规则匹配 | 内存 map，精确匹配 | 最小原型，暂不支持通配 |
| 时间精度 | 纳秒级（令牌桶）/ 毫秒级（滑动窗口） | 够用且开销低 |
| Redis 故障 | 自动降级到单机 | fail-open 策略，不影响主链路 |

## 生产化方向

1. **规则引擎**：支持通配、正则、优先级排序
2. **批量预取**：本地缓存批量从 Redis 预取配额
3. **多租户**：规则按 namespace 隔离
4. **观测接入**：Prometheus metrics + OpenTelemetry trace
5. **配置中心**：接入 etcd/Consul 实现规则热更新推送
