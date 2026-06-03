# Go 编译器与工具链

这一层理解「Go 代码如何变成机器码」，以及工具链如何支撑工程实践。

---

## 1. 编译流程

```
源代码 (.go)
    ↓
词法分析 + 语法分析 → AST（抽象语法树）
    ↓
类型检查（Type Check）
    ↓
中间代码生成（SSA, Static Single Assignment）
    ↓
SSA 优化（dead code elimination, inlining, escape analysis...）
    ↓
机器码生成（Plan9 assembly / 目标平台汇编）
    ↓
链接（Linker）→ 可执行文件
```

## 2. 编译器前端

### 2.1 语法分析

- Go 语法是 LL(1) 的，解析器简单高效
- 没有头文件、没有前向声明、没有宏
- `go/ast`、`go/parser`、`go/token`：标准库提供的 AST 操作工具

### 2.2 类型检查

- 编译期完成所有类型检查
- 接口满足性检查：编译器生成 `itab`
- 泛型：类型推导在编译期完成

## 3. SSA 中间表示与优化

### 3.1 SSA 形式

每个变量只赋值一次，便于数据流分析和优化。

### 3.2 关键优化

| 优化 | 说明 |
|------|------|
| **内联（Inlining）** | 小函数直接展开，消除调用开销 |
| **逃逸分析** | 决定栈/堆分配 |
| **死代码消除** | 删除不可达代码 |
| **边界检查消除（BCE）** | 证明安全的索引访问，移除运行时检查 |
| **循环优化** | 循环展开、强度削减 |

### 3.3 查看 SSA

```bash
GOSSAFUNC=main go build      # 生成 ssa.html，可视化编译过程
go build -gcflags="-d=ssa/check_bce/debug=1"  # 查看边界检查
```

## 4. 内联（Inlining）

### 4.1 内联条件

- 函数足够简单（没有循环、没有 defer/recover、没有闭包...）
- 没有 `//go:noinline` 标记
- 编译预算限制

### 4.2 内联的代价与收益

- 收益：消除调用开销、允许更多跨函数优化
- 代价：代码体积增大、编译时间增加

## 5. 边界检查消除（Bounds Check Elimination）

```go
s := make([]int, 10)
for i := 0; i < len(s); i++ {
    s[i] = i  // 编译器可证明 i < len(s)，消除边界检查
}
```

无法消除的情况：
```go
s[i] = 0  // i 来源不明，必须检查
```

## 6. 链接器（Linker）

### 6.1 链接过程

- 内部链接（internal linking）：不依赖外部链接器，默认
- 外部链接（external linking）：使用系统链接器，CGO 时必须

### 6.2 减少二进制体积

```bash
go build -ldflags="-s -w"   # 去掉符号表和 DWARF 调试信息
go build -tags=netgo        # 纯 Go net 包，减少 CGO 依赖
upx <binary>                # 压缩（慎用，可能被杀毒软件误报）
```

## 7. Go Modules

### 7.1 核心概念

- `go.mod`：模块定义、依赖版本、go 版本、exclude/replace
- `go.sum`：依赖内容的加密哈希，保证可复现构建
- Semantic Import Versioning：v2+ 必须改变模块路径

### 7.2 关键命令

```bash
go mod init <module-path>
go mod tidy          # 清理未使用依赖，添加缺失依赖
go mod vendor        # 创建 vendor 目录
go mod download      # 预下载依赖
go mod why <pkg>     # 分析为什么依赖某个包
go mod graph         # 打印模块依赖图
```

### 7.3 版本选择算法（MVS）

- **Minimal Version Selection**：选择满足所有约束的**最小**版本
- 不是 npm 那种最新版本优先
- 优点：可复现、可预测、升级是显式的

### 7.4 Private 模块

```bash
GOPRIVATE=*.corp.example.com
gonoproxy=*.corp.example.com
gonosumdb=*.corp.example.com
```

## 8. Build Tags 与条件编译

```go
//go:build linux && amd64
// +build linux amd64

package main
```

- `go:build`（Go 1.17+）取代旧的 `+build`
- 支持逻辑运算：`&&`、`||`、`!`
- 用途：平台特定代码、测试标记、特性开关

## 9. 代码生成工具

| 工具 | 用途 |
|------|------|
| `go generate` | 触发代码生成器 |
| `stringer` | 为常量生成 String() 方法 |
| `mockgen` | 生成 mock 实现 |
| `protoc-gen-go` | Protocol Buffers 代码生成 |
| `protoc-gen-go-grpc` | gRPC 代码生成 |

## 10. 调试与分析工具

### 10.1 Delve（dlv）

```bash
dlv debug             # 调试当前包
dlv test              # 调试测试
dlv attach <pid>      # 附加到运行进程
dlv core <binary> <core>  # 分析 core dump
```

### 10.2 Pprof

```bash
go test -cpuprofile=cpu.prof -bench=.
go tool pprof -http=:8080 cpu.prof

go test -memprofile=mem.prof -bench=.
go tool pprof -http=:8080 mem.prof
```

### 10.3 Trace

```bash
go test -trace=trace.out -bench=.
go tool trace trace.out   # 浏览器打开，可视化调度
```

### 10.4 Cover

```bash
go test -coverprofile=cover.out ./...
go tool cover -html=cover.out
```

## 11. 交叉编译

```bash
GOOS=linux GOARCH=amd64 go build    # Linux 可执行文件
GOOS=windows GOARCH=amd64 go build  # Windows exe
GOOS=darwin GOARCH=arm64 go build   # macOS Apple Silicon
```

CGO_ENABLED=0 禁用 CGO，实现完全静态链接。

## 12. 编译缓存

- Go 1.10+ 引入构建缓存（`$GOCACHE`）
- 基于输入文件哈希和内容寻址存储
- `go clean -cache` 清理缓存
