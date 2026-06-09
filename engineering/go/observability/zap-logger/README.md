# Go 高性能日志：Zap

Uber 开源的 Zap 是 Go 生态中性能最出色的结构化日志库。与标准库 `log` 或流行的 `logrus` 相比，Zap 采用零内存分配设计（zero-allocation），在序列化 JSON 日志时性能提升 4-10 倍。Zap 提供两种 API：`SugaredLogger`（类似 `logrus` 的宽松接口）和 `Logger`（强类型、零分配接口），开发者可根据场景灵活选择。

## 核心概念

结构化日志的核心优势在于机器可解析：每条日志都是 JSON 对象，包含统一字段（timestamp、level、caller、message）和业务自定义字段（user_id、trace_id、duration）。Zap 通过反射缓存和对象池技术，在高并发场景下几乎不触发 GC。在生产环境中，日志是排查问题的生命线，而性能开销过大会直接影响服务吞吐量。

Zap 的架构分为四层：Encoder（编码格式，如 JSON/Console）、WriteSyncer（输出目标，如文件/stdout/网络）、Core（核心处理逻辑）和 Logger（对外 API）。通过组合这些组件，可以灵活配置多输出、采样、分级等高级功能。

## 代码实现

```go
// logger.go
package logger

import (
	"os"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var defaultLogger *zap.Logger

// Init 初始化全局日志器
func Init(env string) error {
	config := zap.NewProductionConfig()

	if env == "development" {
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		config.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout("2006-01-02 15:04:05")
	} else {
		config.EncoderConfig.TimeKey = "timestamp"
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
		config.EncoderConfig.CallerKey = "caller"
		config.EncoderConfig.StacktraceKey = "stacktrace"
	}

	// 动态日志级别
	level := zap.NewAtomicLevel()
	if env == "development" {
		level.SetLevel(zapcore.DebugLevel)
	} else {
		level.SetLevel(zapcore.InfoLevel)
	}
	config.Level = level

	// 多输出：stdout + 文件
	fileEncoder := zapcore.NewJSONEncoder(config.EncoderConfig)
	consoleEncoder := zapcore.NewConsoleEncoder(config.EncoderConfig)

	file, err := os.OpenFile("app.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}

	core := zapcore.NewTee(
		zapcore.NewCore(consoleEncoder, zapcore.AddSync(os.Stdout), level), // 控制台输出
		zapcore.NewCore(fileEncoder, zapcore.AddSync(file), level),          // 文件输出
	)

	// 添加调用者信息和堆栈跟踪
	defaultLogger = zap.New(core,
		zap.AddCaller(),
		zap.AddCallerSkip(1),
		zap.AddStacktrace(zapcore.ErrorLevel),
		zap.Fields(zap.String("service", "myapp")),
	)

	return nil
}

func Logger() *zap.Logger {
	if defaultLogger == nil {
		defaultLogger, _ = zap.NewProduction()
	}
	return defaultLogger
}

// Sugar 返回 SugaredLogger，支持 fmt.Sprintf 风格
func Sugar() *zap.SugaredLogger {
	return Logger().Sugar()
}

// 包装方法，方便全局调用
func Info(msg string, fields ...zap.Field)  { Logger().Info(msg, fields...) }
func Debug(msg string, fields ...zap.Field) { Logger().Debug(msg, fields...) }
func Warn(msg string, fields ...zap.Field)  { Logger().Warn(msg, fields...) }
func Error(msg string, fields ...zap.Field) { Logger().Error(msg, fields...) }
func Fatal(msg string, fields ...zap.Field) { Logger().Fatal(msg, fields...) }
```

```go
// middleware.go
package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"myapp/logger"
)

func ZapLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		size := c.Writer.Size()

		fields := []zap.Field{
			zap.Int("status", status),
			zap.Duration("latency", latency),
			zap.String("path", path),
			zap.String("query", query),
			zap.String("method", c.Request.Method),
			zap.String("client_ip", c.ClientIP()),
			zap.Int("body_size", size),
			zap.String("trace_id", c.GetString("trace_id")),
		}

		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("error", c.Errors.String()))
			logger.Error("Request failed", fields...)
		} else if status >= 500 {
			logger.Error("Server error", fields...)
		} else if status >= 400 {
			logger.Warn("Client error", fields...)
		} else {
			logger.Info("Request handled", fields...)
		}
	}
}
```

```go
// usage.go
package main

import (
	"context"
	"go.uber.org/zap"
	"myapp/logger"
)

func main() {
	if err := logger.Init("development"); err != nil {
		panic(err)
	}
	defer logger.Logger().Sync()

	// 强类型零分配 API
	logger.Info("Server starting",
		zap.String("port", "8080"),
		zap.Int("workers", 10),
	)

	// Sugared API，更灵活
	sugar := logger.Sugar()
	sugar.Infow("User login",
		"user_id", "123",
		"ip", "10.0.0.1",
		"duration", 45*time.Millisecond,
	)

	// 带上下文的日志
	ctx := context.WithValue(context.Background(), "trace_id", "abc-123")
	logWithContext(ctx, "Processing order")
}

func logWithContext(ctx context.Context, msg string) {
	traceID, _ := ctx.Value("trace_id").(string)
	logger.Info(msg, zap.String("trace_id", traceID))
}
```

```go
// sampler.go
package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// NewSampledLogger 创建采样日志器，防止日志洪泛
func NewSampledLogger(base *zap.Logger) *zap.Logger {
	// 每秒最多记录 100 条 INFO，之后每 100 条采样 1 条
	core := zapcore.NewSamplerWithOptions(
		base.Core(),
		1*time.Second, // tick
		100,           // first
		100,           // thereafter
	)
	return zap.New(core)
}
```

## 选型对比

| 库 | 性能 | 结构化 | 易用性 | 生态 | 推荐 |
| --- | --- | --- | --- | --- | --- |
| Zap | ⭐⭐⭐ 极高 | ✅ | 中 | 丰富 | **高性能首选** |
| Slog (Go 1.21+) | ⭐⭐⭐ 高 | ✅ | 高 | 标准库 | **Go 1.21+ 新项目** |
| Logrus | ⭐⭐ 中 | ✅ | 高 | 最丰富 | 兼容旧项目 |
| Zerolog | ⭐⭐⭐ 极高 | ✅ | 高 | 增长中 | 偏好链式 API |
| 标准库 log | ⭐ 低 | ❌ | 高 | 内置 | 简单脚本 |

## 最佳实践

- **统一 trace_id**：所有日志携带 `trace_id`，便于跨服务追踪请求链路
- **分级采样**：高频日志（如访问日志）使用 Sampler，避免磁盘 IO 成为瓶颈
- **异步 Sync**：在 main 函数 `defer logger.Sync()`，但注意程序崩溃时可能丢失缓冲日志
- **敏感信息脱敏**：自定义 Encoder 或 `zap.Hook` 过滤密码、Token 等字段
- **日志轮转**：生产环境配合 `lumberjack` 实现按大小/时间自动切割
- **结构化优先**：避免使用 `Sugar` 的 `Infof`，尽量用 `zap.Field` 保持类型安全
