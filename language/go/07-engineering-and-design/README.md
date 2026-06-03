# Go 工程实践与设计模式

这一层讲「如何用 Go 写出可维护、可测试、高性能的生产代码」。不是照搬 Java 的设计模式，而是 Go 风格的工程化。

---

## 1. 项目结构

### 1.1 标准布局（Standard Go Project Layout）

```
cmd/
  myapp/           # 可执行文件入口
    main.go
internal/          # 私有代码（Go 1.4+ 保护）
  service/
  repository/
pkg/               # 公共库（可被外部导入）
    api/           # API 定义
api/               # OpenAPI/Protobuf 定义
configs/           # 配置文件模板
scripts/           # 构建脚本
web/               # 前端资源
```

### 1.2 小项目的简化

```
main.go
service.go
service_test.go
```

没有标准规定，保持一致最重要。

## 2. 包设计原则

### 2.1 命名

- 包名简短、小写、无下划线
- 包名是导入路径的最后一段
- 包内名不要重复包名：`http.Client` 不是 `http.HTTPClient`

### 2.2 接口位置

- **接口定义在消费者侧**：依赖方定义自己需要什么
- 不要预定义大量接口「以防万一」

```go
// consumer.go
package consumer

type Storer interface {
    Store(key string, value []byte) error
}

func New(s Storer) *Consumer { ... }

// producer.go
package producer

type DB struct{}
func (d *DB) Store(key string, value []byte) error { ... }
```

### 2.3 `internal` 包

```go
import "myproject/internal/auth"
```

- 只有 `myproject` 及其子目录可以导入
- 强制模块边界，防止意外耦合

## 3. 错误处理最佳实践

### 3.1 错误包装

```go
if err != nil {
    return fmt.Errorf("query user %q: %w", userID, err)
}
```

- 使用 `%w` 包装错误，保留原始错误链
- 使用 `errors.Is` 和 `errors.As` 检查

### 3.2 Sentinel Error

```go
var ErrNotFound = errors.New("not found")

if errors.Is(err, ErrNotFound) { ... }
```

### 3.3 错误类型

```go
type NotFoundError struct {
    Resource string
    ID       string
}

func (e *NotFoundError) Error() string { ... }

var nfe *NotFoundError
if errors.As(err, &nfe) { ... }
```

### 3.4 错误处理原则

- 只处理一次：要么记录，要么返回，不要都做
- 不要吞掉错误：`if err != nil { return nil }` ❌
- 不要过度包装：每层加一层上下文即可
- panic 只用于不可恢复的错误（编程错误）

## 4. 测试方法论

### 4.1 测试金字塔

```
        /
       /  E2E Tests（少量）
      /────
     /      Integration Tests（中量）
    /────────
   /          Unit Tests（大量）
  /────────────
```

### 4.2 Table-Driven Tests

```go
func TestAdd(t *testing.T) {
    cases := []struct {
        a, b, want int
    }{
        {1, 2, 3},
        {-1, 1, 0},
    }
    for _, tc := range cases {
        t.Run(fmt.Sprintf("%d+%d", tc.a, tc.b), func(t *testing.T) {
            got := Add(tc.a, tc.b)
            if got != tc.want {
                t.Errorf("Add(%d, %d) = %d, want %d", tc.a, tc.b, got, tc.want)
            }
        })
    }
}
```

### 4.3 Mock 与依赖注入

- 接口是 mock 的边界
- 使用 `httptest` 替代真实 HTTP server
- 使用 `sqlmock` 或内存实现替代真实数据库

### 4.4 测试工具

```bash
go test -v              # 详细输出
go test -run TestFoo    # 只运行匹配测试
go test -count=1        # 禁用缓存
go test -shuffle=on     # 随机测试顺序（Go 1.17+）
go test -race           # 竞态检测
go test -cover          # 覆盖率
go test -bench=. -benchmem  # 基准测试 + 内存分配
```

## 5. 日志与可观测性

### 5.1 日志原则

- 结构化日志：`slog`、`zap`、`zerolog`
- 日志级别：Debug、Info、Warn、Error
- 在错误发生处记录完整上下文
- 不要记录敏感信息（密码、token）

### 5.2 Metrics

- Prometheus：`promhttp.Handler()` 暴露 `/metrics`
- 四个黄金指标：Latency、Traffic、Errors、Saturation

### 5.3 Tracing

- OpenTelemetry / Jaeger
- 在 context 中传播 trace ID

## 6. 配置管理

### 6.1 12-Factor 原则

- 配置存储在环境变量中
- 代码与配置分离

### 6.2 配置加载策略

```go
// 优先级：flag > env > config file > default
type Config struct {
    Port    int    `env:"PORT" default:"8080"`
    LogLevel string `env:"LOG_LEVEL" default:"info"`
}
```

## 7. Go 风格的设计模式

### 7.1 函数选项模式（Functional Options）

```go
type Server struct {
    addr string
    timeout time.Duration
}

type Option func(*Server)

func WithAddr(addr string) Option {
    return func(s *Server) { s.addr = addr }
}

func NewServer(opts ...Option) *Server {
    s := &Server{addr: ":8080", timeout: 30 * time.Second}
    for _, opt := range opts {
        opt(s)
    }
    return s
}/yo

// 使用
srv := NewServer(WithAddr(":9090"))
```

### 7.2 Middleware / 洋葱模型

```go
type Middleware func(http.Handler) http.Handler

func Logging(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %v", r.Method, r.URL, time.Since(start))
    })
}
```

### 7.3 Repository 模式

```go
type UserRepository interface {
    Get(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, u *User) error
}
```

- 抽象数据访问层
- 便于测试和切换存储实现

### 7.4 Worker Pool

已在并发章节分析。工程上注意：优雅关闭、错误处理、背压。

## 8. API 设计

### 8.1 RESTful 风格

- 资源命名：`/users/{id}` 不是 `/getUser`
- HTTP 方法语义：GET、POST、PUT、DELETE、PATCH
- 状态码正确使用：200、201、204、400、401、403、404、409、429、500

### 8.2 错误响应格式

```json
{
    "error": "invalid_request",
    "message": "email is required",
    "details": [...]
}
```

### 8.3 分页

```
GET /users?cursor=abc123&limit=20   # cursor 分页，推荐
GET /users?page=3&size=20           # offset 分页，简单但深页性能差
```

## 9. Graceful Shutdown

```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()

srv := &http.Server{Addr: ":8080", Handler: handler}

go func() {
    if err := srv.ListenAndServe(); err != http.ErrServerClosed {
        log.Fatalf("listen: %v", err)
    }
}()

<-ctx.Done()

shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
if err := srv.Shutdown(shutdownCtx); err != nil {
    log.Printf("shutdown error: %v", err)
}
```

## 10. 安全要点

- 输入校验：永远不要信任用户输入
- SQL 注入：使用参数化查询
- XSS：转义 HTML 输出
- CSRF：使用 token 验证
- 敏感数据：加密存储，不在日志中打印
- 依赖安全：`govulncheck` 扫描漏洞

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```
