# Go 标准库深度剖析

这一层不罗列 API，而是剖析标准库核心包的**设计决策、内部实现、使用边界和性能特征**。标准库是 Go 工程能力的直接体现。

---

## 1. `io` — 抽象的艺术

### 1.1 核心接口

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}
```

### 1.2 设计原则

- **小接口**：`Reader` 只有一个方法，任何能读的东西都可以是 `Reader`
- **装饰器模式**：`io.TeeReader`、`io.LimitReader`、`io.MultiReader` 层层包装
- **阻塞语义**：`Read` 返回 `(0, nil)` 不是 EOF，只是暂时没数据；EOF 必须是 `(0, io.EOF)`

### 1.3 常用组合

```go
io.Copy(dst, src)           // 零拷贝（sendfile/splice）
io.ReadAll(r)               // 谨慎使用，可能 OOM
io.Pipe()                   // 内存管道，连接 Reader 和 Writer
```

## 2. `bytes` / `strings` — 不可变与可变

| 特性 | `string` | `[]byte` |
|------|----------|----------|
| 可变性 | 不可变 | 可变 |
| 零值 | `""` | `nil` |
| 转换 | `[]byte(s)` 拷贝 | `string(b)` 拷贝 |
| 内部 | 只读 byte 数组 | 可读写 slice header |

- `strings.Builder`：高效拼接字符串，避免重复拷贝
- `bytes.Buffer`：通用的 byte slice 缓冲
- `strings.Replacer`：预编译的批量替换

## 3. `encoding/json` — 序列化的权衡

### 3.1 编码器选择

| 方式 | 场景 | 性能 |
|------|------|------|
| `json.Marshal` | 简单序列化 | 通用 |
| `json.Encoder` | 流式写入（大对象、HTTP response） | 减少内存峰值 |
| `json.NewEncoder` + `SetEscapeHTML(false)` | API 返回 JSON | 减少转义开销 |

### 3.2 标签与定制

```go
type User struct {
    Name  string `json:"name,omitempty"`
    Email string `json:"-"`        // 忽略
}
```

### 3.3 性能优化

- 使用 `json.RawMessage` 延迟解析
- 自定义 `MarshalJSON` / `UnmarshalJSON`
- 第三方：`json-iterator`、`easyjson`、`sonic`（特定场景）

## 4. `net/http` — 服务端核心

### 4.1 Server 架构

```
http.ListenAndServe
├── tcpListener.Accept
├── 每个连接一个 goroutine
├── http.Server.ServeConn
│   └── 读取 Request → 路由到 Handler → 写入 Response
```

### 4.2 Handler 接口与链式调用

```go
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}
```

- `http.HandlerFunc`：函数适配器
- Middleware：包装 `Handler`，实现横切关注点（日志、认证、恢复）

### 4.3 ResponseWriter 陷阱

- `WriteHeader` 只能调用一次，第二次无效
- `Write` 会在第一次调用时隐式写入 200
- `http.Hijacker`：接管底层连接（WebSocket）
- `http.Flusher`：强制刷新缓冲区（SSE）

### 4.4 Client 超时控制

```go
client := &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        DialTimeout:           5 * time.Second,
        TLSHandshakeTimeout:   5 * time.Second,
        ResponseHeaderTimeout: 10 * time.Second,
        IdleConnTimeout:       90 * time.Second,
        MaxIdleConns:          100,
        MaxIdleConnsPerHost:   10,
    },
}
```

## 5. `context` — 取消传播

已在「并发深度」中详细分析。标准库视角的要点：

- `http.Request.WithContext`：每个请求都有 context
- `sql.DB.QueryContext`：数据库操作支持 context 取消
- `net.Dialer.DialContext`：连接超时控制

## 6. `time` — 时间精度与陷阱

### 6.1 Timer vs Ticker

| 类型 | 行为 | 停止 |
|------|------|------|
| `time.Timer` | 单次触发 | `Stop()` + 检查 `C` 通道 |
| `time.Ticker` | 周期触发 | `Stop()`，不会回收已发送的值 |

### 6.2 时间比较

```go
// ✅ 使用 Equal 比较，考虑单跳秒和精度
if t1.Equal(t2) { ... }

// ❌ 直接用 == 可能在某些场景不可靠
t1 == t2
```

### 6.3 `time.After` 泄漏

已在并发章节分析。核心：每次 `time.After` 创建新 timer，循环中需复用 `time.NewTimer`。

## 7. `os` / `path` / `path/filepath`

- `os.Open` / `os.Create`：文件操作
- `path/filepath.Walk` / `WalkDir`（Go 1.16+，更快，不调用 `os.Lstat`）
- `os/exec`：执行外部命令，注意 `CommandContext` 支持取消

## 8. `sync` / `sync/atomic`

已在「并发深度」和「内存模型」中分析。

## 9. `reflect` — 运行时类型系统

### 9.1 核心类型

```go
reflect.TypeOf(v)    // 获取类型信息
reflect.ValueOf(v)   // 获取值信息
```

### 9.2 使用场景

- 序列化/反序列化库
- ORM、配置解析
- 测试框架（deep equal）

### 9.3 性能代价

- 绕过编译期优化
- 大量堆分配
- 比直接调用慢 10-100 倍

## 10. 少为人知但强大的包

| 包 | 能力 |
|----|------|
| `runtime/pprof` | CPU、内存、阻塞、goroutine 分析 |
| `runtime/trace` | 执行追踪，可视化调度事件 |
| `net/http/pprof` | HTTP 接口暴露 pprof 数据 |
| `expvar` | 暴露程序内部变量（计数器、gauge） |
| `httptest` | HTTP 测试辅助（Recorder、Server） |
| `io/ioutil`（已弃用） | Go 1.16 起功能迁移到 `io` / `os` |
| `embed`（Go 1.16+） | 编译时嵌入静态文件 |
| `slog`（Go 1.21+） | 结构化日志 |
