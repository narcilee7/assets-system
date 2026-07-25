# `const` 面试题集 — 从基础到专家级

---

## Level 1：概念辨析（3 题）

### 题 1：有类型 vs 无类型常量

```go
const a = 10          // 无类型常量
const b int = 10      // 有类型常量

var f1 float32 = a    // 合法？
var f2 float32 = b    // 合法？
var i1 int8 = a       // 合法？
var i2 int8 = b       // 合法？
```

<details>
<summary>答案与解析</summary>

**答案**：`f1` 合法，`f2` 编译错误，`i1` 合法，`i2` 编译错误。

**解析**：
- **无类型常量** `a` 没有固定类型，使用时根据上下文自动转换（只要值在目标类型范围内）。`10` 可以放入 `float32` 和 `int8`。
- **有类型常量** `b` 是 `int`，赋值给 `float32` 需要显式转换；赋值给 `int8` 需要显式转换（因为 `int` 到 `int8` 是缩窄转换）。
- 无类型常量的"精度"是任意的，编译器用高精度计算，只在赋值时检查范围。

</details>

---

### 题 2：常量表达式的边界

```go
const MaxUint = ^uint(0)
const MaxInt = int(^uint(0) >> 1)

const x = 1 << 100          // 合法？
const y = 1 << 100 >> 90    // 合法？
var z = 1 << 100            // 合法？
```

<details>
<summary>答案与解析</summary>

**答案**：`x` 合法，`y` 合法，`z` 编译错误。

**解析**：
- 无类型整数常量的精度是**无限**的（至少 256 位，实际由编译器实现），`1 << 100` 作为无类型常量可以存在。
- `y = 1 << 100 >> 90` 结果仍是 `1 << 10 = 1024`，在赋值给有类型变量前不会溢出。
- `z` 是变量，需要具体类型，`1 << 100` 无法放入任何标准整数类型（`int` 最大 64 位），编译错误。

**考点**：无类型常量的"无限精度"特性，只在最终赋值时做范围检查。

</details>

---

### 题 3：常量不能取地址

```go
const Pi = 3.14

func main() {
    p := &Pi        // 合法？
    fmt.Println(*p)
}
```

<details>
<summary>答案与解析</summary>

**答案**：编译错误：`cannot take the address of Pi`。

**解析**：
- 常量可能在编译期被直接替换为字面量（类似 C 的 `#define`，但有类型检查），不一定分配内存地址。
- 即使常量有内存地址，Go 语言规范禁止取地址，保证编译优化的自由度。
- 如果需要地址，必须用 `var` 声明变量。

</details>

---

## Level 2：iota 机制（4 题）

### 题 4：iota 基础计数

```go
const (
    a = iota    // 0
    b           // 1
    c = 100     // 100
    d           // 100
    e = iota    // 4
    f           // 5
)

const (
    g = iota    // 0
    h           // 1
)
```

<details>
<summary>答案与解析</summary>

**答案**：`a=0, b=1, c=100, d=100, e=4, f=5, g=0, h=1`

**解析**：
- `iota` 在每个 `const` 块中从 0 开始，按**行**递增。
- 遇到新 `const` 关键字重置为 0。
- 即使某行显式赋值，`iota` 仍在递增（`c` 那行 `iota` 是 2，只是没用）。
- `d` 继承 `c` 的表达式 `100`，但 `iota` 已经是 3。
- `e` 显式恢复 `iota`，此时是 4。

</details>

---

### 题 5：iota 位掩码（面试高频）

```go
const (
    Read = 1 << iota   // 1
    Write              // 2
    Execute            // 4
    // 想加更多权限...
)

const (
    _ = iota
    KB = 1 << (10 * iota)  // 1 << 10 = 1024
    MB                     // 1 << 20
    GB                     // 1 << 30
)
```

**问题**：为什么 `Read = 1 << iota` 可以，但 `KB = 1 << (10 * iota)` 中 `iota` 的值分别是多少？

<details>
<summary>答案与解析</summary>

**答案**：
- `Read` 块：`Read=1(0), Write=2(1), Execute=4(2)`
- `KB` 块：`_` 那行 `iota=0`，`KB` 那行 `iota=1`，`MB` 那行 `iota=2`，`GB` 那行 `iota=3`

**解析**：
- `iota` 是按行计数，不是按使用次数。
- `KB = 1 << (10 * 1) = 1 << 10`
- `MB = 1 << (10 * 2) = 1 << 20`
- `GB = 1 << (10 * 3) = 1 << 30`
- 开头的 `_ = iota` 是为了跳过 0，让 `KB` 从 1 开始。

</details>

---

### 题 6：iota 的隐式继承陷阱

```go
const (
    a, b = iota, iota + 10   // a=0, b=10
    c, d                     // c=?, d=?
    e = iota                 // e=?
)
```

<details>
<summary>答案与解析</summary>

**答案**：`c=1, d=11, e=2`

**解析**：
- 同一行多个常量，`iota` 值相同（都是当前行的 `iota`）。
- 第二行没有显式表达式，继承第一行的表达式模式：
  - `c` 继承 `iota` → `1`
  - `d` 继承 `iota + 10` → `11`
- 第三行 `e` 的 `iota` 是 2。

**陷阱**：很多人以为 `c, d` 会继承 `0, 10` 的值，实际上继承的是**表达式**，`iota` 会更新。

</details>

---

### 题 7：iota 实现枚举 + String 方法（工程题）

**要求**：用 `iota` 实现一个 `Status` 枚举，并支持 `String()` 方法输出中文描述。

```go
type Status int

const (
    Pending Status = iota
    Running
    Success
    Failed
)

// 期望：
fmt.Println(Pending)  // 输出: "待处理"
```

**请写出完整实现，并说明为什么用 `iota` 而不是直接写 `0, 1, 2, 3`。**

<details>
<summary>答案与解析</summary>

```go
type Status int

const (
    Pending Status = iota
    Running
    Success
    Failed
)

func (s Status) String() string {
    switch s {
    case Pending:
        return "待处理"
    case Running:
        return "运行中"
    case Success:
        return "成功"
    case Failed:
        return "失败"
    default:
        return "未知"
    }
}
```

**为什么用 iota**：
1. **防漂移**：中间插入新状态时，手动编号容易忘记改后续值。
2. **自文档**：看到 `iota` 就知道是枚举序列。
3. **编译检查**：如果 `Status` 是 `int` 类型，赋值非法值时不会报错；但如果配合 `String()` 和单元测试，可以覆盖。

**进阶**：可以用 `go generate` + `stringer` 工具自动生成 `String()` 方法：
```bash
go install golang.org/x/tools/cmd/stringer@latest
//go:generate stringer -type=Status
```

</details>

---

## Level 3：常量与类型系统（3 题）

### 题 8：常量与接口

```go
const MaxSize = 1024

type Sizer interface {
    Size() int
}

type File struct{}

func (f File) Size() int { return MaxSize }

func main() {
    var s Sizer = File{}
    fmt.Println(s.Size())  // 输出 1024
    
    // 问：如果 MaxSize 是 var，会影响接口实现吗？
}
```

**问题**：如果 `MaxSize` 改为 `var MaxSize = 1024`，`File` 是否还满足 `Sizer` 接口？

<details>
<summary>答案与解析</summary>

**答案**：仍然满足。接口实现只检查方法签名，不检查方法体内使用的变量是 `const` 还是 `var`。

**但面试追问**：如果题目改为这样：
```go
const MaxSize = 1024

type MyInt int
func (m MyInt) Size() int { return MaxSize }

var s Sizer = MyInt(0)  // 合法？
```

**答案**：合法。`MyInt` 有 `Size() int` 方法，满足 `Sizer` 接口。

**真正考点**：常量类型与接口的关系在于**无类型常量的自动转换**：
```go
const x = 10
var f float64 = x      // 合法，无类型常量自动转
var i interface{} = x  // 合法，x 被赋予默认类型 int
```

</details>

---

### 题 9：常量与泛型（Go 1.18+）

```go
const MaxInt = int(^uint(0) >> 1)

func Max[T comparable](a, b T) T {
    // 能用 MaxInt 做泛型约束吗？
}
```

**问题**：能否用常量定义泛型约束？例如限制泛型参数的最大值？

<details>
<summary>答案与解析</summary>

**答案**：不能。Go 泛型的约束是**类型约束**（`constraints.Ordered`、`~int` 等），不是值约束。

```go
// 不能这样：
func Foo[T int](x T) {
    if x > MaxInt { ... }  // 可以比较，但约束不是常量
}

// 正确做法：泛型约束是类型层面的
func Max[T constraints.Ordered](a, b T) T {
    if a > b {
        return a
    }
    return b
}
```

**考点**：常量是值层面的，泛型约束是类型层面的，两者不互通。但可以在泛型函数体内使用常量。

</details>

---

### 题 10：常量溢出

```go
const A = 1 << 64          // 合法？
const B int = 1 << 64      // 合法？
const C = 1 << 64 >> 63    // 合法？
const D uint64 = 1 << 64   // 合法？
```

<details>
<summary>答案与解析</summary>

**答案**：
- `A`：合法（无类型常量，无限精度）
- `B`：编译错误（`int` 最大 64 位，`1 << 64` 溢出）
- `C`：合法（`1 << 64 >> 63 = 2`，在范围内）
- `D`：编译错误（`1 << 64` 对 `uint64` 溢出，`uint64` 最大 `1 << 64 - 1`）

**解析**：
- 无类型常量：`1 << 64` 可以存在，精度无限。
- 有类型常量：赋值时检查范围。
- `uint64` 的最大值是 `1<<64 - 1`，`1 << 64` 需要 65 位。

**修正**：
```go
const D uint64 = 1 << 63        // 合法：9223372036854775808
const E uint64 = 1<<64 - 1      // 合法：18446744073709551615
```

注意 `1<<64 - 1` 的优先级：`1 << (64 - 1)` 还是 `(1 << 64) - 1`？
- 答案是 `(1 << 64) - 1`，因为 `<<` 和 `-` 优先级：`<<` 低于 `+`/`-`？
- 不，Go 中 `<<` 优先级**低于** `+`/`-`，所以 `1<<64 - 1` = `1 << (64 - 1)` = `1 << 63`！

**正确写法**：
```go
const MaxUint64 = ^uint64(0)    // 最安全
const MaxUint64 = 1<<64 - 1     // 错误！实际等于 1<<63
const MaxUint64 = (1 << 64) - 1 // 编译错误，1<<64 对 uint64 溢出
```

**终极答案**：用 `^uint64(0)` 最安全。

</details>

---

## Level 4：工程实战（3 题）

### 题 11：常量包设计

**场景**：你正在设计一个 `errors` 包，定义业务错误码。

```go
package errors

const (
    ErrNotFound    = 10001
    ErrUnauthorized = 10002
    ErrForbidden    = 10003
)
```

**问题**：用 `const` 定义错误码有什么问题？更好的做法是什么？

<details>
<summary>答案与解析</summary>

**问题**：
1. `const` 是整数，丢失错误信息（没有错误消息）。
2. 错误码容易冲突，没有命名空间。
3. 无法附加堆栈信息。

**更好做法**：
```go
package errors

type Code int

const (
    ErrNotFound     Code = 10001
    ErrUnauthorized Code = 10002
    ErrForbidden    Code = 10003
)

func (c Code) String() string {
    switch c {
    case ErrNotFound:
        return "资源不存在"
    case ErrUnauthorized:
        return "未授权"
    case ErrForbidden:
        return "禁止访问"
    default:
        return "未知错误"
    }
}

// 包装为 error 类型
func (c Code) Error() string {
    return fmt.Sprintf("[%d] %s", c, c.String())
}

// 使用时：
return errors.ErrNotFound  // 直接作为 error 使用（因为实现了 Error()）
```

**进阶**：用 `iota` 管理错误码范围：
```go
const (
    _ Code = iota + 10000*1  // 系统错误 10000+
    ErrNotFound
    ErrUnauthorized
    // ...
)

const (
    _ Code = iota + 10000*2  // 业务错误 20000+
    ErrOrderNotFound
    ErrPaymentFailed
    // ...
)
```

</details>

---

### 题 12：编译期计算优化

**场景**：你需要计算一个复杂的常量（如 CRC32 表、哈希魔数）。

```go
const (
    Magic = 0x9e3779b9
    // 想在编译期计算 GoldenRatio * 2^32
    GoldenRatio32 = uint32((1.0 + math.Sqrt(5)) / 2.0 * (1 << 32))  // 合法？
)
```

**问题**：为什么这段代码编译错误？如何在编译期完成复杂计算？

<details>
<summary>答案与解析</summary>

**答案**：编译错误。`math.Sqrt(5)` 是运行时函数调用，不能用于常量表达式。

**解析**：
- 常量表达式只能包含：
  - 字面量
  - 常量标识符
  - 内置运算符（`+`, `-`, `*`, `/`, `<<`, `&`, 等）
  - 类型转换（目标类型必须是基本类型）
  - `len`, `cap`, `unsafe.Sizeof` 等内置函数（参数必须是常量）
- **不能调用标准库函数**（如 `math.Sqrt`）。

**解决方案**：
1. **预计算**：用程序算好，写死常量值。
2. **`go generate`**：用代码生成工具在编译前生成常量。
3. **`const` + `init`**：如果必须运行时计算，用 `var` + `init()`：
   ```go
   var GoldenRatio32 uint32
   func init() {
       GoldenRatio32 = uint32((1.0 + math.Sqrt(5)) / 2.0 * (1 << 32))
   }
   ```

**考点**：Go 常量表达式是**纯编译期**的，没有 C++ 的 `constexpr` 函数。

</details>

---

### 题 13：跨包常量引用与循环依赖

**场景**：
```go
// package config
const MaxConnections = 100

// package server
import "config"
func init() {
    pool := make(chan struct{}, config.MaxConnections)
}
```

**问题**：如果 `config` 包需要引用 `server` 包中的某个类型，会发生什么？如何避免？

<details>
<summary>答案与解析</summary>

**答案**：如果 `config` 包 `import "server"`，而 `server` 已经 `import "config"`，会产生**循环导入**，编译错误。

**Go 的解决方式**：
1. **提取公共包**：把常量和类型定义放到第三个包（如 `common` 或 `constants`）。
2. **接口隔离**：`server` 定义接口，`config` 不依赖 `server` 的具体实现。
3. **参数化**：`server` 把 `MaxConnections` 作为参数传入，而不是从 `config` 读取。

**推荐结构**：
```
project/
├── constants/
│   └── const.go      // MaxConnections 等纯常量
├── config/
│   └── config.go     // 配置加载逻辑
└── server/
    └── server.go     // 业务逻辑
```

**考点**：常量虽然是编译期值，但包导入关系是编译器严格检查的，循环依赖零容忍。

</details>

---

## 题 14：综合陷阱题（压轴）

```go
package main

import "fmt"

const (
    a = 1
    b
    c = iota
    d
)

const (
    e = iota
    f = iota << 1
    g
    h = iota * iota
)

func main() {
    fmt.Println(a, b, c, d)
    fmt.Println(e, f, g, h)
}
```

**输出是什么？**

<details>
<summary>答案与解析</summary>

**输出**：
```
1 1 2 3
0 2 6 9
```

**逐行解析**：

第一个 `const` 块：
- `a = 1` → `1`（显式赋值）
- `b` → 继承 `a` 的表达式 `1`，`iota` 此时是 1 但没用
- `c = iota` → `iota` 是 2（第三行）
- `d` → 继承 `iota`，此时 `iota` 是 3

第二个 `const` 块：
- `e = iota` → `0`
- `f = iota << 1` → `1 << 1 = 2`
- `g` → 继承 `iota << 1`，此时 `iota` 是 2，所以 `2 << 1 = 4`？**不对！**

等等，重新算：
- `g` 继承的是表达式 `iota << 1`，当前 `iota` 是 2，所以 `2 << 1 = 4`？

但答案是 `6`... 让我重新检查。

哦，我错了。`iota` 是按行计数：
- `e` 那行：`iota = 0`
- `f` 那行：`iota = 1`
- `g` 那行：`iota = 2`
- `h` 那行：`iota = 3`

所以：
- `e = 0`
- `f = 1 << 1 = 2`
- `g = 2 << 1 = 4`？但之前我写的是 6...

等等，我再仔细看。`g` 继承的是 `f` 的表达式 `iota << 1`，`g` 那行的 `iota` 是 2，所以 `2 << 1 = 4`。

但 `h = iota * iota = 3 * 3 = 9`。

所以输出应该是 `0 2 4 9`？

让我再想想... 我之前给的答案是 `0 2 6 9`，`6` 是错的。应该是 `4`。

**修正答案**：
```
1 1 2 3
0 2 4 9
```

**陷阱**：`g` 继承 `f` 的表达式 `iota << 1`，不是 `f` 的值 `2`。`iota` 在 `g` 那行是 2。

</details>

---

## 题 15：终极设计题

**场景**：设计一个**编译期配置系统**，要求：
1. 支持不同环境（dev/staging/prod）的常量配置
2. 编译时确定，零运行时开销
3. 类型安全，不能混用不同环境的配置

**请给出设计方案，并说明为什么用 `const` 而不是 `var` + `init`。**

<details>
<summary>答案与解析</summary>

**方案：利用 Build Tags + 常量文件**

```go
// config_dev.go
//go:build dev
package config

const (
    Env      = "dev"
    LogLevel = "debug"
    DBMaxConn = 10
)
```

```go
// config_prod.go
//go:build prod
package config

const (
    Env      = "prod"
    LogLevel = "warn"
    DBMaxConn = 100
)
```

**使用**：
```bash
go build -tags=dev ./...
go build -tags=prod ./...
```

**为什么用 const 而不是 var + init**：
1. **零运行时开销**：`const` 在编译期替换，不占用内存，不初始化。
2. **编译期检查**：错误的配置在编译时发现（如 `const DBMaxConn = "10"` 类型错误）。
3. **内联优化**：编译器可以将常量直接内联到使用处，减少内存访问。
4. **不可变性**：防止运行时意外修改。

**类型安全增强**：
```go
type EnvType string
const (
    EnvDev  EnvType = "dev"
    EnvProd EnvType = "prod"
)

func IsProd() bool {
    return Env == string(EnvProd)  // 或直接用 const 比较
}
```

**对比 `var` + `init`**：
- `var` 有运行时初始化开销（即使很小）。
- `var` 可被意外修改（除非 `const` 或封装）。
- `init` 增加启动时间，且顺序依赖复杂。

</details>

---

## 面试速查卡

| 考点 | 一句话 | 常见陷阱 |
|------|--------|----------|
| 无类型常量 | 无限精度，赋值时检查范围 | 有类型常量不能隐式缩窄转换 |
| iota | 按行计数，每个 const 重置 | 继承的是表达式，不是值 |
| 常量表达式 | 纯编译期，不能调标准库函数 | `math.Sqrt` 不能用于 const |
| 不能取地址 | 可能被编译器内联 | 需要地址时用 `var` |
| 溢出 | 无类型不溢出，有类型检查 | `1 << 64` 对 `uint64` 溢出 |
| 与泛型 | 常量是值，不能约束类型 | 泛型约束用 `~int`，不是值 |

---

**下一个关键字想深入哪个？** `interface` 的 `itab` 源码？还是 `map` 的扩容机制？