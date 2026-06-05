# gRPC Deadline and Streaming

## 目标

理解 gRPC 的核心机制：protobuf 编码、四种通信模式、deadline/timeout、流控和错误处理，以及在微服务中的最佳实践。

## 场景

- gRPC 为什么比 JSON over HTTP 快？
- 流式 RPC 什么时候用，有什么陷阱？
- deadline 和 timeout 有什么区别？
- gRPC 的负载均衡和健康检查怎么做？
- HTTP/2 连接问题如何影响 gRPC？

## Protocol Buffers

### 为什么快？

```
JSON vs Protobuf：

消息 { "user_id": 12345, "name": "Alice", "active": true }

JSON（文本）：
  长度：约 50 字节
  解析：逐字符扫描，字符串转类型

Protobuf（二进制）：
  ┌────┬────┬──────────┬────┬──────┬─────┬────┐
  │tag │len │ "user_id"│tag │varint│ tag │bool│
  │0x08│0x05│...       │0x10│0x9039│0x18 │0x01│
  └────┴────┴──────────┴────┴──────┴─────┴────┘
  长度：约 14 字节
  解析：直接内存拷贝，无字符串解析

优势：
  1. 体积小：二进制编码，无字段名冗余
  2. 解析快：直接内存映射，不需要反射/字符串处理
  3. 强类型：编译期检查，IDE 补全
  4. Schema 演进：字段编号保证向后兼容
```

### Schema 演进

```protobuf
message User {
  int32 id = 1;           // 字段编号 = 1
  string name = 2;        // 字段编号 = 2
  string email = 3;       // 字段编号 = 3
  bool vip = 4;           // 新增字段，旧代码忽略
  reserved 5;             // 保留编号，防止复用
}

规则：
  - 不要复用已删除字段的编号
  - 新增字段用 optional 或默认值
  - 不要修改现有字段的类型/编号
```

## 四种通信模式

### 1. Unary（一元）

```protobuf
rpc GetUser(GetUserRequest) returns (User);
```

```
客户端 ──请求──► 服务端
客户端 ◄─响应─── 服务端

一个请求，一个响应，类似 HTTP POST
最常用，最简单
```

### 2. Server Streaming（服务端流）

```protobuf
rpc ListUsers(ListUsersRequest) returns (stream User);
```

```
客户端 ──请求──► 服务端
客户端 ◄─响应1── 服务端
客户端 ◄─响应2── 服务端
客户端 ◄─响应N── 服务端（EOF）

场景：
  - 大列表分页
  - 日志流
  - 实时数据推送
```

### 3. Client Streaming（客户端流）

```protobuf
rpc UploadChunks(stream Chunk) returns (UploadResult);
```

```
客户端 ──数据1──► 服务端
客户端 ──数据2──► 服务端
客户端 ──数据N──► 服务端（半关闭）
客户端 ◄─结果──── 服务端

场景：
  - 大文件上传
  - 批量数据导入
  - 客户端日志上报
```

### 4. Bidirectional Streaming（双向流）

```protobuf
rpc Chat(stream Message) returns (stream Message);
```

```
客户端 ──消息1──► 服务端
客户端 ◄─消息2── 服务端
客户端 ──消息3──► 服务端
客户端 ◄─消息4── 服务端
...

特点：
  - 两个流独立，没有强绑定关系
  - 读写可以并发
  - 顺序由应用层保证

场景：
  - 实时聊天
  - 游戏状态同步
  - 语音/视频通话信令
```

## Deadline / Timeout

### 概念

```
Deadline = 一个绝对时间点，RPC 必须在该时间点前完成
Timeout = 相对时长

gRPC 使用 Deadline（绝对时间），不是 Timeout（相对时长）

原因：
  - 避免级联超时累加
  - 服务端能精确知道剩余时间
  - 网络延迟和排队时间不重复计算
```

### 传播机制

```
Client A (deadline = T+100ms)
  → 调用 Service B
    → Service B (剩余 deadline ≈ 95ms)
      → 调用 Service C
        → Service C (剩余 deadline ≈ 90ms)

如果 Service C 超时：
  - 立即返回 DEADLINE_EXCEEDED
  - Service B 收到后取消自己的处理
  - Client A 收到 DEADLINE_EXCEEDED
```

### 客户端设置

```go
// Go
deadline := time.Now().Add(100 * time.Millisecond)
ctx, cancel := context.WithDeadline(parentCtx, deadline)
defer cancel()

resp, err := client.GetUser(ctx, req)
if err != nil {
    status.Code(err) == codes.DeadlineExceeded
}
```

```python
# Python
try:
    response = stub.GetUser(
        request,
        timeout=0.1  # 秒，内部转成 deadline
    )
except grpc.RpcError as e:
    if e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
        pass
```

### 服务端处理

```go
func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    // 检查是否已取消
    select {
    case <-ctx.Done():
        return nil, ctx.Err()
    default:
    }
    
    // 带超时的子操作
    childCtx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
    defer cancel()
    
    result, err := db.Query(childCtx, req.Id)
    if err != nil {
        return nil, status.Error(codes.DeadlineExceeded, "db timeout")
    }
    return result, nil
}
```

### 最佳实践

```
1. 总是设置 deadline：
   没有 deadline 的请求可能永远挂起，耗尽连接池

2. 不要自己计算超时：
   用 context 传播 deadline，让框架处理

3. 服务端尊重 deadline：
   定期检查 ctx.Done()，及时放弃无效工作

4. 区分 timeout 和 deadline exceeded：
   - 客户端设置太短 → 增加 timeout
   - 服务端处理慢 → 优化性能或降级

5. 幂等性：
   deadline exceeded 后，客户端不知道服务端是否执行成功
   必须保证幂等，才能安全重试
```

## 流控（Flow Control）

### HTTP/2 流控

```
gRPC 基于 HTTP/2，继承其流控机制：

连接级流控（Connection Level）：
  - 整个 HTTP/2 连接的发送窗口
  - 默认 65535 字节

Stream 级流控（Stream Level）：
  - 每个 gRPC Stream 的独立窗口
  - 默认 65535 字节

WINDOW_UPDATE 帧：
  - 接收方通知发送方增加窗口大小
  - 窗口为 0 时，发送方停止发送
```

### 应用层背压

```
服务端流示例：

func (s *server) ListUsers(req *pb.ListUsersRequest, stream pb.UserService_ListUsersServer) error {
    for _, user := range users {
        // 检查流是否还能发送（背压）
        if err := stream.Send(user); err != nil {
            return err  // 客户端窗口满或断开
        }
        
        // 也可以主动控制发送速率
        time.Sleep(10 * time.Millisecond)
    }
    return nil
}
```

## 错误处理

### Status Code

| Code | 含义 | 建议处理 |
|---|---|---|
| OK | 成功 | - |
| CANCELLED | 客户端取消 | 无需处理 |
| UNKNOWN | 未知错误 | 日志记录，人工排查 |
| INVALID_ARGUMENT | 参数错误 | 检查请求 |
| DEADLINE_EXCEEDED | 超时 | 重试或降级 |
| NOT_FOUND | 资源不存在 | 检查 ID |
| ALREADY_EXISTS | 资源已存在 | 幂等处理 |
| PERMISSION_DENIED | 权限不足 | 检查认证授权 |
| RESOURCE_EXHAUSTED | 配额/限流 | 退避重试 |
| FAILED_PRECONDITION | 前置条件失败 | 修正状态后重试 |
| ABORTED | 并发冲突 | 退避重试 |
| UNAVAILABLE | 服务不可用 | 立即重试（幂等） |
| INTERNAL | 服务端内部错误 | 日志记录 |
| UNIMPLEMENTED | 方法未实现 | 检查版本 |
| UNAVAILABLE | 服务不可用 | 退避重试 |

### 错误详情（Rich Error Model）

```protobuf
// google.rpc.Status
message Status {
  int32 code = 1;           // gRPC status code
  string message = 2;       // 可读错误信息
  repeated google.protobuf.Any details = 3;  // 结构化详情
}

// 常见 detail 类型：
// - google.rpc.RetryInfo      → 建议重试间隔
// - google.rpc.DebugInfo      → 调试信息（不暴露给客户端）
// - google.rpc.QuotaFailure   → 配额超限详情
// - google.rpc.BadRequest     → 具体哪个字段错了
```

## 连接管理

### HTTP/2 连接问题

```
gRPC 基于 HTTP/2，一个 TCP 连接上多路复用多个 Stream：

问题 1：L7 负载均衡
  - HTTP/2 连接是长连接
  - L4 负载均衡器（如 iptables）只在连接建立时分配
  - 可能导致后端负载不均
  
  解决：
    - L7 代理（Envoy、Nginx）理解 HTTP/2，可按请求负载均衡
    - 或客户端侧负载均衡（gRPC resolver + picker）

问题 2：连接数过少
  - 默认一个地址只建立一个 HTTP/2 连接
  - 如果服务端是单线程，无法利用多核
  
  解决：
    - 设置 max concurrent streams
    - 或客户端建立多个连接

问题 3：连接中断恢复
  - TCP 连接断开，所有 Stream 同时失败
  - 需要客户端重连和重试
```

### 健康检查

```protobuf
service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}

enum ServingStatus {
  UNKNOWN = 0;
  SERVING = 1;
  NOT_SERVING = 2;
}
```

```
服务端状态：
  SERVING：正常接收请求
  NOT_SERVING：正在启动、关闭或 unhealthy

客户端策略：
  - 只向 SERVING 实例发送业务请求
  - NOT_SERVING 实例用于优雅关闭（draining）
```

## 核心追问

1. **gRPC 流式 RPC 的内存泄漏风险？** 客户端不关闭流，服务端一直持有资源；必须确保正确发送 EOF 或设置超时
2. **为什么 gRPC 用 deadline 而不是 timeout？** deadline 是绝对时间，传播到下游时不因网络延迟累加；timeout 是相对时间，多次转发会叠加
3. **gRPC 的 UNAVAILABLE 什么时候可以重试？** 幂等操作可以立即重试；非幂等操作不能重试，因为服务端可能已经处理
4. **HTTP/2 流控窗口满会怎样？** Send() 阻塞（同步）或返回错误（异步），应用层需要处理背压
5. **protobuf 的 optional 字段和默认值陷阱？** 无法区分"未设置"和"设置为默认值"；proto3 用 `optional` 关键字或 `oneof` 解决

## 状态

| 资产 | 状态 |
|---|---|
| HTTP protocol comparison | done |
| gRPC deadline and streaming | done |
| WebSocket heartbeat design | todo |
| SSE resume protocol | todo |
| QUIC overview | todo |
