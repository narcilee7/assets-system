# Go 高级主题

这一层覆盖 Go 的「硬骨头」：CGO、反射、unsafe、插件系统、以及与其他语言的互操作。这些不是日常必用，但在特定场景下是关键的破局能力。

---

## 1. CGO — 与 C 代码互操作

### 1.1 基本用法

```go
// #include <stdio.h>
// void hello() { printf("Hello from C\n"); }
import "C"

func main() {
    C.hello()
}
```

### 1.2 类型映射

| C 类型 | Go 类型 |
|--------|---------|
| `char` | `C.char` |
| `int` | `C.int` |
| `void*` | `unsafe.Pointer` |
| `char*` | `*C.char`（需手动管理内存） |
| `struct` | `C.struct_xxx` |

### 1.3 字符串与切片传递

```go
// Go string → C string
s := "hello"
cs := C.CString(s)
defer C.free(unsafe.Pointer(cs))

// C 数组 → Go slice
var cArray [10]C.int
slice := (*[10]C.int)(unsafe.Pointer(&cArray))[:10:10]
```

### 1.4 CGO 的代价

- 跨越 Go/C 边界有调用开销（约 100ns+）
- CGO 禁用部分运行时优化
- 内存管理复杂化：Go GC 不管理 C 内存
- 交叉编译困难（需要目标平台的 C 工具链）
- 调试困难：堆栈跨越两个世界

### 1.5 实践建议

- 尽量减少 CGO 调用频率（批量处理）
- 使用 `C.malloc`/`C.free` 管理 C 内存，不要混用
- 考虑纯 Go 替代方案（如纯 Go 的 SQLite：`modernc.org/sqlite`）

## 2. `unsafe` 包深度使用

### 2.1 合法操作

```go
// 1. 获取大小和对齐
unsafe.Sizeof(x)
unsafe.Alignof(x)
unsafe.Offsetof(x.f)

// 2. 任意类型转 Pointer（不能转 uintptr 做算术后再转回，除非非常小心）
unsafe.Pointer(&x)

// 3. 字符串 ↔ []byte 零拷贝（Go 1.20+）
unsafe.StringData(s)
unsafe.SliceData(b)
```

### 2.2 `uintptr` 陷阱

```go
// ❌ 危险：GC 可能在中间运行，移动堆对象
p := unsafe.Pointer(uintptr(unsafe.Pointer(&x)) + offset)

// ✅ 安全：在一个表达式内完成
p := unsafe.Pointer(uintptr(unsafe.Pointer(&x)) + offset)
```

`uintptr` 是整数类型，GC 不把它当指针追踪。

### 2.3 实际应用场景

- 高性能序列化库（绕过反射）
- 系统编程（直接操作内存布局）
- 与 C 库交互
- `syscall` 和 `syscall/js`

## 3. `reflect` 深度使用

### 3.1 核心 API

```go
t := reflect.TypeOf(v)     // 反射类型
val := reflect.ValueOf(v)  // 反射值

val.Kind()                 // 基础种类：Struct, Slice, Ptr...
val.Field(i)               // 访问结构体字段
val.SetString("x")         // 修改值（要求可设置）
```

### 3.2 可设置性（Settability）

```go
x := 1
v := reflect.ValueOf(x)
v.SetInt(2) // panic: 不可设置

v = reflect.ValueOf(&x).Elem()
v.SetInt(2) // ✅ x 现在是 2
```

### 3.3 结构体标签解析

```go
type User struct {
    Name string `json:"name" db:"user_name"`
}

t := reflect.TypeOf(User{})
for i := 0; i < t.NumField(); i++ {
    field := t.Field(i)
    jsonTag := field.Tag.Get("json")
}
```

### 3.4 性能优化替代方案

| 场景 | 反射 | 替代方案 |
|------|------|---------|
| 序列化 | `reflect` | 代码生成（protobuf、easyjson） |
| 依赖注入 | `reflect` | 手动注册、代码生成 |
| 类型断言 | `reflect.Type` | 类型开关 `switch v.(type)` |
| Deep Equal | `reflect.DeepEqual` | `cmp.Diff`（Go 1.21+） |

## 4. 插件系统（plugin）

```go
// 构建插件
go build -buildmode=plugin -o myplugin.so myplugin.go

// 加载插件
p, err := plugin.Open("myplugin.so")
sym, err := p.Lookup("MyVar")
```

### 4.1 限制

- 只支持 Linux、macOS、FreeBSD（不支持 Windows）
- 插件和主程序必须用**完全相同**的 Go 版本和依赖版本编译
- 不卸载：一旦加载，生命周期与程序相同
- 符号解析是运行时操作，无类型安全

### 4.2 替代方案

- RPC / gRPC 微服务
- WASM（WebAssembly）插件
- Lua / JavaScript 嵌入（`go-lua`、`goja`）
- 进程外通信

## 5. WASM（WebAssembly）

### 5.1 Go → WASM

```bash
GOOS=js GOARCH=wasm go build -o main.wasm
```

- 编译为浏览器可执行的 WASM 模块
- 使用 `syscall/js` 与 JavaScript 交互
- 文件体积较大（包含 Go 运行时），可用 TinyGo 优化

### 5.2 TinyGo

- 专为嵌入式和 WASM 优化的 Go 编译器
- 不支持全部 Go 特性（无反射、无 CGO）
- WASM 输出体积极小（KB 级 vs MB 级）

## 6. 汇编（Assembly）

### 6.1 Plan 9 汇编语法

Go 使用 Plan 9 风格的汇编，不是 GNU 汇编。

```asm
TEXT ·Add(SB), NOSPLIT, $0
    MOVQ x+0(FP), AX
    MOVQ y+8(FP), BX
    ADDQ AX, BX
    MOVQ BX, ret+16(FP)
    RET
```

### 6.2 使用场景

- 标准库中的密码学加速（AES、SHA）
- 原子操作的底层实现
- SIMD 优化

### 6.3 注意事项

- 汇编代码不可移植（x86 vs ARM）
- Go 1.17+ 引入寄存器 ABI，汇编语法有变化
- 优先用 Go 内联函数，汇编是最后手段

## 7. 运行时扩展与 Hack

### 7.1 `runtime` 包中的隐藏能力

```go
runtime.GOMAXPROCS(n)        // 控制 P 数量
runtime.SetGCPercent(100)    // GC 触发阈值
runtime.ReadMemStats(&m)     // 读取内存统计
runtime.NumGoroutine()       // 当前 goroutine 数量
runtime.Stack(buf, true)     // 获取堆栈跟踪
runtime.KeepAlive(x)         // 防止 GC 过早回收
```

### 7.2 使用 `//go:` 编译指令

```go
//go:noinline              // 禁止内联
//go:nosplit               // 禁止栈分裂（慎用）
//go:nowritebarrier        // 禁止写屏障（GC 相关）
//go:linkname local remote // 链接到另一个符号
```

## 8. 与其他语言对比的高级特性

| 特性 | Go | Rust | Java |
|------|-----|------|------|
| 泛型实现 | GC shape + dictionary | 单态化 | 类型擦除 |
| 并发安全 | 提倡 channel，允许 mutex | 编译期保证（所有权） | 传统锁 |
| 错误处理 | 多返回值 error | Result<T, E> | 异常 |
| 元编程 | 代码生成、反射 | 宏 | 注解 + 反射 |
| 运行时大小 | ~2MB | 极小（无运行时） | ~100MB+（JRE） |
| 部署 | 单二进制 | 单二进制 | 需要 JVM |

## 9. 推荐阅读

- *Go 语言高级编程* — 柴树杉
- Go 运行时源码：`src/runtime/`、`src/reflect/`、`src/sync/`
- CGO 官方文档：https://go.dev/blog/cgo
- Go 内存模型：https://go.dev/ref/mem
