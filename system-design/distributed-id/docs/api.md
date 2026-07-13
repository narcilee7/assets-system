# API

## 接口总览

分布式 ID 生成器对外提供三类接口：
1. **发号接口**（核心）：同步 / 异步 / 批量生成 ID
2. **管理接口**：查询发号器状态、worker 注册、心跳
3. **反解接口**：从 ID 提取时间戳、worker 信息

---

## 1. 发号接口

### 1.1 同步发号（最常用）

#### HTTP API

```http
POST /id/v1/gen
Host: idgen.example.com
Content-Type: application/json
X-Biz-Tag: order      # 业务标签，用于号段隔离
X-Auth-Token: {jwt}

{
  "count": 1           # 生成数量，1 表示单个
}

HTTP/1.1 200 OK
Content-Type: application/json

{
  "ids": ["1704067201000123456"],
  "biz_tag": "order",
  "worker_id": 3,
  "timestamp": 1704067201000,
  "request_id": "req-abc123"
}
```

#### gRPC API

```protobuf
syntax = "proto3";

package idgen.v1;

service IdGen {
  // 同步发号
  rpc Gen(GenRequest) returns (GenResponse);

  // 批量发号
  rpc GenBatch(GenBatchRequest) returns (GenBatchResponse);

  // 反解 ID
  rpc ParseId(ParseIdRequest) returns (ParseIdResponse);
}

message GenRequest {
  string biz_tag = 1;        // 业务标签
  uint32 count = 2;          // 生成数量
}

message GenResponse {
  repeated uint64 ids = 1;
  string biz_tag = 2;
  uint32 worker_id = 3;
  int64 timestamp = 4;
}

message GenBatchRequest {
  string biz_tag = 1;
  uint32 count = 2;          // 一次最多 1000
}

message GenBatchResponse {
  repeated uint64 ids = 1;
}

message ParseIdRequest {
  uint64 id = 1;
}

message ParseIdResponse {
  int64 timestamp_ms = 1;
  uint32 worker_id = 2;
  uint32 sequence = 3;
  string biz_tag = 4;       // 仅号段模式能反解
}
```

#### Java SDK 用法

```java
// 1. 初始化（Spring Boot 自动装配）
@Autowired
private IdGenService idGenService;

// 2. 生成单个 ID
long id = idGenService.gen("order");
System.out.println("Order ID: " + id);  // 1704067201000123456

// 3. 批量生成
List<Long> ids = idGenService.genBatch("message", 100);

// 4. 反解 ID
IdInfo info = idGenService.parseId(id);
System.out.println("Timestamp: " + info.getTimestampMs());
System.out.println("Worker: " + info.getWorkerId());
```

#### Go SDK 用法

```go
// 1. 初始化
client, _ := idgen.NewClient(idgen.Config{
    ServerAddr: "idgen.example.com:9000",
    AuthToken:  "xxx",
})

// 2. 单个发号
id, _ := client.Gen(ctx, "order")
// id = 1704067201000123456

// 3. 批量发号（推荐，单次 RPC 比循环调用性能高 10 倍）
ids, _ := client.GenBatch(ctx, "message", 100)

// 4. 反解（本地反解，无需远程调用）
info, _ := client.ParseID(id)
fmt.Println(info.TimestampMs, info.WorkerID, info.Sequence)
```

### 1.2 异步发号（高吞吐场景）

```http
POST /id/v1/gen/async
Content-Type: application/json

{
  "count": 10000
}

HTTP/1.1 202 Accepted
Location: /id/v1/task/task-abc123

# 异步任务，通过回调或轮询获取结果
```

#### 适用场景

- 大批量预生成（如活动预热，提前生成 1000W ID 缓存到本地）
- 不阻塞业务主流程（业务发起请求后立即返回，ID 后台生成）

#### 轮询查询

```http
GET /id/v1/task/task-abc123

HTTP/1.1 200 OK
{
  "task_id": "task-abc123",
  "status": "completed",
  "ids": ["1704067201000000001", ..., "1704067201000010000"]
}
```

### 1.3 客户端本地发号（Leaf 模式）

```java
// 不走 RPC，业务进程内嵌 Leaf-snowflake SDK，直接本地发号
// 适合"本地计算"场景，省一次网络 IO

@Autowired
private SnowflakeIDGen snowflakeGen;  // 单例 Bean

long id = snowflakeGen.gen("order");
// 延迟 < 0.1ms（纯内存计算）
```

**适用场景**：
- 极高并发（10W+ QPS）
- 业务对延迟敏感（如支付链路）
- 可接受 SDK 部署（每业务线集成客户端）

**缺点**：
- 每个业务进程需要配置 worker_id
- worker_id 不能冲突（用 DB / ZK 协调）
- 业务进程重启需要重新分配 worker_id

---

## 2. 管理接口

### 2.1 Worker 注册

```http
POST /id/v1/worker/register
Content-Type: application/json

{
  "host": "10.0.1.23",
  "port": 9000,
  "instance_id": "idgen-001"
}

HTTP/1.1 200 OK
{
  "worker_id": 5,
  "datacenter_id": 1,
  "token": "wk-token-xxx",       // 注册后获得，用于后续心跳
  "expires_at": 1704067800
}
```

### 2.2 Worker 心跳

```http
POST /id/v1/worker/heartbeat
Authorization: Bearer wk-token-xxx

{
  "load": {
    "qps": 5000,
    "in_use_segments": 3
  }
}

HTTP/1.1 200 OK
{
  "worker_id": 5,
  "next_heartbeat_seconds": 5,
  "should_reload": false         # true 表示号段模式需要重新加载
}
```

### 2.3 Worker 下线

```http
POST /id/v1/worker/deregister
Authorization: Bearer wk-token-xxx

HTTP/1.1 204 No Content
```

### 2.4 状态查询

```http
GET /id/v1/status

HTTP/1.1 200 OK
{
  "service": "idgen",
  "version": "1.2.3",
  "mode": "snowflake",            # snowflake | segment | mixed
  "total_workers": 8,
  "active_workers": 7,
  "current_qps": 32000,
  "id_pool_remaining": 9500000000,
  "clock_back_count_24h": 0,
  "uptime_seconds": 86400
}
```

---

## 3. 反解接口

### 3.1 HTTP 反解

```http
POST /id/v1/parse
Content-Type: application/json

{
  "ids": ["1704067201000123456", "1704067201000123457"]
}

HTTP/1.1 200 OK
{
  "results": [
    {
      "id": "1704067201000123456",
      "timestamp_ms": 1704067201000,
      "datetime": "2024-01-01T00:00:01.000Z",
      "worker_id": 3,
      "sequence": 123456
    },
    ...
  ]
}
```

### 3.2 本地反解（无网络）

```go
// Go SDK 内置反解，不需要远程调用
func ParseSnowflakeID(id int64) SnowflakeInfo {
    timestamp := (id >> 22) + epoch       // 41-bit timestamp
    workerID := (id >> 12) & 0x3FF       // 10-bit worker
    sequence := id & 0xFFF                // 12-bit sequence

    return SnowflakeInfo{
        TimestampMs: timestamp,
        WorkerID:    workerID,
        Sequence:    sequence,
        Datetime:    time.UnixMilli(timestamp),
    }
}
```

---

## 4. 错误码

| 错误码 | HTTP | 含义 | 处理建议 |
|--------|------|------|---------|
| `UNAUTHORIZED` | 401 | 鉴权失败 | 检查 token |
| `RATE_LIMITED` | 429 | 超过 QPS 限制 | 降级或扩容 |
| `INVALID_BIZ_TAG` | 400 | 业务标签未注册 | 先注册业务标签 |
| `WORKER_NOT_FOUND` | 503 | Worker 已下线 | 重启 worker |
| `CLOCK_BACK` | 503 | 时钟回拨超限 | 等待时钟追上 |
| `SEGMENT_EXHAUSTED` | 503 | 号段用尽 | 异步加载下一号段失败，重试 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 看日志，重试 |

### 错误响应格式

```json
{
  "error": "CLOCK_BACK",
  "error_description": "Clock moved backwards by 500ms (max: 100ms)",
  "retry_after_ms": 500
}
```

---

## 5. 业务标签（biz_tag）管理

### 5.1 注册业务标签

```http
POST /id/v1/biz_tag
Content-Type: application/json

{
  "biz_tag": "order",
  "max_id": 1,                       # 起始号段
  "step": 1000,                      # 号段步长
  "description": "订单 ID"
}
```

### 5.2 查询业务标签

```http
GET /id/v1/biz_tag/order

HTTP/1.1 200 OK
{
  "biz_tag": "order",
  "current_max_id": 9500000,
  "step": 1000,
  "remaining_in_segment": 800,
  "next_segment_loaded": true,
  "updated_at": 1704067200
}
```

### 5.3 biz_tag 的设计原则

```
1. 一个业务一个 biz_tag
   - 订单 order、支付 payment、消息 message、用户 user

2. biz_tag 隔离号段空间
   - 不同业务的 ID 永远不冲突
   - 不同业务可以独立配置 step（订单 step=1000，消息 step=10000）

3. biz_tag 不可删除
   - 一旦注册永久保留
   - 防止 ID 被重新分配

4. biz_tag 的 max_id 可手动调整
   - 用于"重置号段"或"跳号"等特殊场景
```

---

## 6. 调用示例（完整链路）

### 场景：下单时生成订单 ID

```java
// 业务代码
@Service
public class OrderService {

    @Autowired
    private IdGenService idGenService;

    @Transactional
    public Order createOrder(CreateOrderRequest req) {
        // 1. 生成订单 ID（雪花算法，趋势递增）
        long orderId = idGenService.gen("order");

        // 2. 写入订单表
        Order order = new Order();
        order.setId(orderId);
        order.setUserId(req.getUserId());
        order.setAmount(req.getAmount());
        order.setStatus(OrderStatus.PENDING);

        orderRepository.save(order);

        // 3. 返回订单
        return order;
    }
}
```

```bash
# 测试：连续下单 100 次，ID 应该是趋势递增的
for i in {1..100}; do
  curl -X POST http://idgen:9000/id/v1/gen \
    -H "X-Biz-Tag: order" \
    -H "Content-Type: application/json" \
    -d '{"count":1}'
  echo ""
done

# 输出：
# {"ids":["1704067201000000001"],...}
# {"ids":["1704067201000000002"],...}
# {"ids":["1704067201000000003"],...}
# （毫秒内：seq 自增；跨毫秒：timestamp 变化）
```
