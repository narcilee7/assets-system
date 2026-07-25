# `type` 面试题集 — 从基础到专家级

---

## Level 1：定义与别名（3 题）

### 题 1：定义新类型 vs 类型别名

```go
type MyInt int        // 定义新类型
type IntAlias = int   // 类型别名

var a int = 10
var b MyInt = a      // 合法？
var c IntAlias = a   // 合法？

var d MyInt = 20
var e int = d        // 合法？
```

**问题**：哪些编译错误？`MyInt` 和 `IntAlias` 的本质区别是什么？运行时层面有何不同？

<details>
<summary>答案与解析</summary>

**答案**：`b = a` 编译错误，`e = d` 编译错误。其余合法。

**解析**：

| 特性 | `type MyInt int` | `type IntAlias = int` |
|------|------------------|----------------------|
| 本质 | **新类型** | **别名** |
| 与 `int` 关系 | 不同类型，需显式转换 | 完全等价，同一类型 |
| 方法集 | 可绑定方法 | 不可绑定方法 |
| 类型断言 | `.(MyInt)` 独立分支 | `.(IntAlias)` 等同于 `.(int)` |
| 反射 `Kind()` | `Int` | `Int` |

**运行时层面**：
- `MyInt` 和 `int` 在底层表示完全相同（内存布局、二进制大小一致），但编译器视为不同类型。
- 类型别名在编译后完全消失，不产生任何运行时开销。

**常见用途**：
- **新类型**：为已有类型增加语义和方法（如 `type UserID int`）。
- **别名**：大型重构时兼容旧代码（如 `context.CancelFunc` 曾用别名过渡）。

</details>

---

### 题 2：底层类型与可比较性

```go
type MyInt int
type MyMyInt MyInt

var a MyInt = 10
var b MyMyInt = 20

var c int = a        // 合法？
var d MyInt = b      // 合法？
fmt.Println(a == b)  // 合法？
```

**问题**：`MyMyInt` 的底层类型是什么？不同类型之间能否比较？

<details>
<summary>答案与解析</summary>

**答案**：`c = a` 编译错误，`d = b` 编译错误，`a == b` 编译错误。

**解析**：

- **底层类型（Underlying Type）**：`MyMyInt` 的底层类型是 `int`（递归追溯）。
- **类型转换规则**：不同类型之间必须显式转换，即使底层类型相同。
  ```go
  var c int = int(a)        // 合法
  var d MyInt = MyInt(b)    // 合法
  ```

- **可比较性**：Go 中不同类型**不能直接比较**，即使底层类型相同。
  ```go
  fmt.Println(a == MyInt(b))  // 合法：先转换再比较
  ```

**例外**：接口值之间可以比较，但要求动态类型和动态值都可比较。

**考点**：底层类型决定**可比较性基础**，但**类型转换**必须显式。

</details>

---

### 题 3：类型别名的方法集

```go
type MyInt int

func (m MyInt) String() string {
    return fmt.Sprintf("MyInt(%d)", m)
}

type IntAlias = int

func (i IntAlias) String() string {  // 合法？
    return fmt.Sprintf("IntAlias(%d)", i)
}
```

**问题**：为什么 `IntAlias` 不能绑定方法？如果需要在 `int` 上加方法，正确做法是什么？

<details>
<summary>答案与解析</summary>

**答案**：`func (i IntAlias) String()` 编译错误。类型别名不能绑定方法。

**解析**：

- **方法集绑定规则**：方法只能定义在**当前包内声明的命名类型**上。
- 类型别名 `IntAlias = int` 不是新声明的类型，只是 `int` 的别名。而 `int` 是预声明类型，不能绑定方法。
- 即使 `type MyInt = MyInt`（自己别名自己），也不能绑定方法。

**正确做法**：
```go
type MyInt int  // 定义新类型，不是别名

func (m MyInt) String() string {
    return fmt.Sprintf("MyInt(%d)", m)
}
```

**进阶**：如果想给**其他包的类型**加方法？
- Go 不允许。只能定义新类型包装它：
  ```go
  type MyReader struct {
      io.Reader
  }
  func (m MyReader) Read(p []byte) (n int, err error) {
      // 扩展功能
      return m.Reader.Read(p)
  }
  ```

**考点**：方法集是**类型定义**的特权，别名和预声明类型无法拥有。

</details>

---

## Level 2：方法集与接口（4 题）

### 题 4：值接收者 vs 指针接收者

```go
type T struct{}

func (T) ValueMethod() {}
func (*T) PtrMethod() {}

var t T
var p = &t

var _ interface{ ValueMethod() } = t   // 合法？
var _ interface{ ValueMethod() } = p     // 合法？
var _ interface{ PtrMethod() } = t      // 合法？
var _ interface{ PtrMethod() } = p       // 合法？
```

**问题**：逐行判断是否合法，并总结方法集规则。

<details>
<summary>答案与解析</summary>

**答案**：
- `t` 赋值给 `ValueMethod` 接口：✅ 合法
- `p` 赋值给 `ValueMethod` 接口：✅ 合法
- `t` 赋值给 `PtrMethod` 接口：❌ 编译错误
- `p` 赋值给 `PtrMethod` 接口：✅ 合法

**解析**：

| 接收者类型 | 值类型的方法集 | 指针类型的方法集 |
|-----------|--------------|----------------|
| `func (T)` | ✅ 包含 | ✅ 包含（自动解引用） |
| `func (*T)` | ❌ 不包含 | ✅ 包含 |

**核心规则**：
- **值类型**的方法集 = 所有**值接收者**方法。
- **指针类型**的方法集 = 所有**值接收者**方法 + 所有**指针接收者**方法。

**为什么指针类型包含值接收者方法？**
- 编译器自动插入解引用：`p.ValueMethod()` 等价于 `(*p).ValueMethod()`。

**为什么值类型不包含指针接收者方法？**
- 值类型地址可能不可寻址（如字面量 `T{}`），无法自动取地址调用指针方法。

**考点**：这是接口实现的**核心规则**，面试必考。

</details>

---

### 题 5：不可寻址值的方法调用

```go
type T struct{ X int }

func (t *T) SetX(x int) {
    t.X = x
}

func main() {
    T{}.SetX(10)        // 合法？
    T{X: 1}.SetX(10)    // 合法？
    var t T
    t.SetX(10)          // 合法？
}
```

**问题**：哪些能编译？为什么？`T{}` 和 `var t T` 在方法调用上有何区别？

<details>
<summary>答案与解析</summary>

**答案**：`T{}.SetX(10)` 编译错误，`T{X: 1}.SetX(10)` 编译错误，`t.SetX(10)` 合法。

**解析**：

- **可寻址性（Addressable）**：方法调用 `t.SetX(10)` 时，如果 `SetX` 是指针接收者，编译器需要取 `t` 的地址。
- `var t T` 声明的变量**可寻址**，编译器可以自动 `&t`。
- `T{}` 和 `T{X: 1}` 是**字面量**，不可寻址，不能自动取地址。

**修复**：
```go
(&T{}).SetX(10)        // 显式取地址，合法
(&T{X: 1}).SetX(10)     // 显式取地址，合法
```

**例外**：`map` 的值不可寻址，所以 `m["key"].SetX(10)` 永远不行。

**考点**：自动取地址的边界——只有**可寻址值**才能调用指针接收者方法。

</details>

---

### 题 6：接口嵌入与类型定义

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type ReadCloser interface {
    Reader
    Close() error
}

type MyReader struct{}

func (MyReader) Read(p []byte) (n int, err error) { return 0, nil }

var _ ReadCloser = MyReader{}  // 合法？
```

**问题**：`MyReader` 是否实现了 `ReadCloser`？嵌入接口和嵌入结构体有何区别？

<details>
<summary>答案与解析</summary>

**答案**：编译错误。`MyReader` 没有 `Close` 方法。

**解析**：

- **接口嵌入**：`ReadCloser` 要求实现**所有嵌入接口的方法 + 自身方法**。`MyReader` 只有 `Read`，缺少 `Close`。
- **结构体嵌入**（下一题）：结构体嵌入会**提升字段和方法**，但接口嵌入只是**方法集合并**。

**对比**：

| 嵌入类型 | 语法 | 效果 |
|---------|------|------|
| 接口嵌入接口 | `type A interface { B }` | A 的方法集 = B 的方法集 + 新增 |
| 结构体嵌入结构体 | `type A struct { B }` | A 可以调用 B 的方法（提升），但方法集不包含 |
| 结构体嵌入接口 | `type A struct { io.Reader }` | A 可以调用 Reader 方法，但 A 本身的方法集为空 |

**考点**：接口嵌入是**方法集声明**，不是实现继承。

</details>

---

### 题 7：结构体嵌入与方法集

```go
type Inner struct{}

func (Inner) Method() {}
func (*Inner) PtrMethod() {}

type Outer struct {
    Inner
}

var o Outer
var p = &o

var _ interface{ Method() } = o     // 合法？
var _ interface{ Method() } = p     // 合法？
var _ interface{ PtrMethod() } = o   // 合法？
var _ interface{ PtrMethod() } = p  // 合法？
```

**问题**：逐行判断。嵌入字段的方法提升规则是什么？`Outer` 的方法集包含什么？

<details>
<summary>答案与解析</summary>

**答案**：
- `o` 赋值给 `Method`：✅ 合法
- `p` 赋值给 `Method`：✅ 合法
- `o` 赋值给 `PtrMethod`：❌ 编译错误
- `p` 赋值给 `PtrMethod`：✅ 合法

**解析**：

**方法提升规则**：
- `Outer` 嵌入 `Inner`，`Inner` 的方法被**提升到** `Outer`。
- 但方法集规则不变：
  - `Outer` 值的方法集 = `Inner` 值的方法集（只有 `Method`）
  - `*Outer` 指针的方法集 = `Inner` 值的方法集 + `Inner` 指针的方法集（`Method` + `PtrMethod`）

**关键陷阱**：
- `Outer` 没有直接实现 `PtrMethod`，但 `*Outer` 有（因为 `*Outer` 可以访问 `Inner` 的指针方法）。
- 然而 `o`（值）不能实现 `PtrMethod`，因为 `Outer` 值的方法集不包含指针接收者方法。

**内存布局**：
```go
// Outer 的内存：
// [Inner 字段...] [Outer 自己的字段...]
// 方法提升只是编译器语法糖，不是真正的继承。
```

**考点**：嵌入 ≠ 继承。方法提升不改变方法集规则。

</details>

---

## Level 3：类型转换与断言（3 题）

### 题 8：显式转换的边界

```go
type MyInt int
type MyFloat float64

var a int = 10
var b MyInt = MyInt(a)     // 合法？

var c float64 = 3.14
var d MyInt = MyInt(c)     // 合法？

var e MyFloat = 3.14
var f MyInt = MyInt(e)     // 合法？
```

**问题**：哪些能编译？不同类型之间的转换规则是什么？

<details>
<summary>答案与解析</summary>

**答案**：`b = MyInt(a)` 合法，`d = MyInt(c)` 编译错误，`f = MyInt(e)` 编译错误。

**解析**：

**Go 类型转换规则**：

1. **相同底层类型**：可以显式转换。
   ```go
   MyInt(int)      // ✅ 底层都是 int
   int(MyInt)      // ✅
   ```

2. **数值类型之间**：底层类型不同也可以转换，但要求**双方都是数值类型**。
   ```go
   int(float64)    // ✅
   MyInt(float64)  // ✅ MyInt 底层是 int，float64 是数值类型
   float64(MyInt)  // ✅
   ```

3. **指针/通道/函数/切片/映射**：底层类型相同才能转换。
   ```go
   type MySlice []int
   MySlice([]int{1,2})  // ✅ 底层相同
   ```

4. **接口**：只要实现接口就能隐式赋值，不需要转换。

**本题陷阱**：
- `MyInt(c)`：`c` 是 `float64`，`MyInt` 底层是 `int`，`float64` → `int` 是合法转换！等等，让我重新检查...

实际上 `MyInt(c)` 是**合法**的！因为 `float64` 可以转换为 `int`（截断小数），`MyInt` 底层是 `int`。

重新判断：
- `d = MyInt(c)`：`float64` → `int` 允许，所以 `MyInt(c)` ✅ 合法
- `f = MyInt(e)`：`MyFloat` 底层是 `float64`，`MyFloat` → `MyInt` 不合法，因为不是直接数值类型转换，需要 `MyInt(float64(e))`

**修正答案**：
- `d = MyInt(c)`：✅ 合法（`float64` → `int` 截断转换）
- `f = MyInt(e)`：❌ 编译错误（`MyFloat` 和 `MyInt` 都是自定义类型，不能直接转换）

**考点**：转换规则看**直接类型**，不是递归看底层。

</details>

---

### 题 9：类型断言与 nil 接口

```go
var p *int = nil
var i interface{} = p

v, ok := i.(*int)
fmt.Println(v == nil)  // ?
fmt.Println(ok)        // ?
fmt.Println(i == nil)  // ?
```

**问题**：三个输出分别是什么？为什么 `i` 不是 `nil`？

<details>
<summary>答案与解析</summary>

**答案**：
- `v == nil`：`true`
- `ok`：`true`
- `i == nil`：`false`

**解析**：

**接口的内部结构**：
```go
type iface struct {
    tab  *itab        // 类型信息 + 方法表
    data unsafe.Pointer  // 实际数据指针
}
```

- `i = p` 后，`i` 的 `tab` 指向 `*int` 的类型信息，`data` 是 `nil`（因为 `p` 是 `nil`）。
- 所以 `i` 是**非 nil 接口**（tab 不为 nil），只是**值为 nil**。

**类型断言**：
- `i.(*int)` 成功，`v` 是 `nil` 指针（`ok=true`）。
- `v == nil` 为 `true`，因为 `v` 是 `*int` 类型的 nil。

**接口比较**：
- `i == nil` 要求 `tab == nil && data == nil`，所以是 `false`。

**正确判空**：
```go
if p == nil {
    i = nil  // 显式赋 nil 接口
}
```

**考点**：这是 Go 最著名的陷阱——**接口装 nil 指针不等于 nil 接口**。

</details>

---

### 题 10：类型开关与编译优化

```go
var i interface{} = 42

switch v := i.(type) {
case int:
    fmt.Printf("int: %d\n", v)
case string:
    fmt.Printf("string: %s\n", v)
case []int:
    fmt.Printf("slice: %v\n", v)
default:
    fmt.Printf("unknown: %T\n", v)
}
```

**问题**：`v` 在各 case 中的类型是什么？类型开关的编译器优化是什么？

<details>
<summary>答案与解析</summary>

**答案**：
- `int` case：`v` 是 `int`（已断言）
- `string` case：`v` 是 `string`
- `[]int` case：`v` 是 `[]int`
- `default`：`v` 是 `interface{}`（原始类型）

**解析**：

**类型开关（Type Switch）**：
- `v := i.(type)` 中 `v` 在 `default` 分支是原始接口类型。
- 在各 case 中，`v` 已被断言为具体类型，可以直接使用。

**编译器优化**：
- 类型开关编译为**跳转表（jump table）**或**二分查找**，不是线性 `if-else`。
- 常见类型优先匹配，时间复杂度 O(1) 或 O(log n)。
- 如果接口值是**具体类型**（非接口），编译器可能直接内联类型判断。

**与反射对比**：
```go
// 类型开关（编译期优化，高效）
switch v := i.(type) { case int: ... }

// 反射（运行时开销大）
t := reflect.TypeOf(i)
if t.Kind() == reflect.Int { ... }
```

**考点**：类型开关是 Go 的**零成本抽象**之一，比反射快一个数量级。

</details>

---

## Level 4：内存布局与对齐（3 题）

### 题 11：结构体内存对齐

```go
type Bad struct {
    A bool     // 1 byte
    B int64    // 8 bytes
    C bool     // 1 byte
}

type Good struct {
    B int64    // 8 bytes
    A bool     // 1 byte
    C bool     // 1 byte
}

fmt.Println(unsafe.Sizeof(Bad{}))   // ?
fmt.Println(unsafe.Sizeof(Good{}))  // ?
```

**问题**：输出多少？为什么？如何计算内存对齐？

<details>
<summary>答案与解析</summary>

**答案**：
- `unsafe.Sizeof(Bad{})`：`24`
- `unsafe.Sizeof(Good{})`：`16`

**解析**：

**对齐规则**：
1. 结构体的对齐值 = 最大字段的对齐值（这里是 `int64` 的 8）。
2. 每个字段的偏移量必须是该字段对齐值的倍数。
3. 结构体总大小必须是其对齐值的倍数。

**Bad 布局**：
```
| A(1) | pad(7) | B(8) | C(1) | pad(7) |
  1      7        8      1      7        = 24
```

**Good 布局**：
```
| B(8) | A(1) | C(1) | pad(6) |
  8      1      1      6        = 16
```

**优化技巧**：
- 按字段大小**从大到小**排列，减少填充。
- 使用 `unsafe.Alignof` 查看对齐值：
  ```go
  fmt.Println(unsafe.Alignof(int64(0)))  // 8
  fmt.Println(unsafe.Alignof(bool(false))) // 1
  ```

**考点**：内存对齐是性能优化基础，面试常问"如何优化结构体内存"。

</details>

---

### 题 12：空结构体的内存占用

```go
type Empty struct{}

var e Empty
fmt.Println(unsafe.Sizeof(e))          // ?

type WithEmpty struct {
    A int
    B Empty
    C int
}

fmt.Println(unsafe.Sizeof(WithEmpty{})) // ?
```

**问题**：空结构体多大？嵌入空结构体是否增加内存？

<details>
<summary>答案与解析</summary>

**答案**：
- `unsafe.Sizeof(e)`：`0`
- `unsafe.Sizeof(WithEmpty{})`：`16`（在 64 位系统上）

**解析**：

- **空结构体** `struct{}` 大小为 **0**，不占用内存。
- 但嵌入空结构体时，如果它是**最后一个字段**，可能不需要填充；但如果中间有字段，对齐规则可能导致填充。

**WithEmpty 布局**：
```
| A(8) | B(0) | C(8) |
  8      0      8      = 16
```

**特殊用途**：
```go
// 1. 信号 channel（不传输数据，只同步）
ch := make(chan struct{})

// 2. Set 实现
type Set map[string]struct{}
set["key"] = struct{}{}

// 3. 互斥锁占位
type Mutex struct {
    _ [0]int  // 防止零值初始化被优化掉（某些场景）
}
```

**考点**：空结构体是 Go 的**零成本信号**机制。

</details>

---

### 题 13：接口值的内存大小

```go
var i interface{} = int64(42)
fmt.Println(unsafe.Sizeof(i))  // ?
```

**问题**：输出多少？接口值内部结构是什么？`data` 指针指向哪里？

<details>
<summary>答案与解析</summary>

**答案**：`16`（64 位系统）。

**解析**：

**接口值结构**：
```go
// 空接口（eface）
type eface struct {
    _type *_type      // 8 bytes（类型元数据指针）
    data  unsafe.Pointer // 8 bytes（数据指针）
}

// 非空接口（iface）
type iface struct {
    tab  *itab       // 8 bytes
    data unsafe.Pointer // 8 bytes
}
```

- 总大小 = 16 bytes（两个指针）。
- `data` 指向实际数据：
  - 如果数据 ≤ 指针大小（如 `int64`），直接**内联存储**在接口值中？不，Go 1.8+ 后小值可能直接存，但通常 `data` 指向堆或栈上的变量。
  - 对于 `int64(42)`，`42` 被**装箱（box）**到内存，`data` 指向该地址。

**考点**：接口值总是**指针 + 类型信息**，赋值接口时有**装箱开销**。

</details>

---

## Level 5：工程与设计（3 题）

### 题 14：类型安全包装器

**场景**：你需要一个用户 ID 类型，防止与订单 ID 混淆。

```go
type UserID int64
type OrderID int64

func GetUser(id UserID) (*User, error)
func GetOrder(id OrderID) (*Order, error)
```

**问题**：这种设计的好处是什么？有什么代价？与 Java/C# 的强类型包装器相比有何不同？

<details>
<summary>答案与解析</summary>

**好处**：
1. **编译期防错**：不能 accidentally 把 `OrderID` 传给 `GetUser`。
2. **语义清晰**：`UserID(42)` 比 `42` 自文档化。
3. **可扩展**：未来可以给 `UserID` 加方法（如 `String()`、`Validate()`）。

**代价**：
1. **转换开销**：每次需要显式转换 `UserID(id)`。
2. **JSON 序列化**：默认序列化为数字，如果需要字符串格式，需要自定义：
   ```go
   func (id UserID) MarshalJSON() ([]byte, error) {
       return json.Marshal(strconv.FormatInt(int64(id), 10))
   }
   ```
3. **数据库扫描**：需要实现 `sql.Scanner` 和 `driver.Valuer`。

**与 Java/C# 对比**：
- Java 的 `record UserID(long value)` 有运行时对象开销。
- Go 的 `type UserID int64` 是**零成本抽象**，运行时就是 `int64`。

**最佳实践**：
```go
type UserID int64

func (id UserID) Int64() int64 { return int64(id) }
func (id UserID) String() string { return strconv.FormatInt(int64(id), 10) }
func (id UserID) IsValid() bool { return id > 0 }
```

**考点**：Go 的类型定义是**零成本抽象**，适合强类型领域建模。

</details>

---

### 题 15：函数类型与策略模式

```go
type Handler func(ctx context.Context, req Request) (Response, error)

func LoggingHandler(h Handler) Handler {
    return func(ctx context.Context, req Request) (Response, error) {
        log.Println("before")
        resp, err := h(ctx, req)
        log.Println("after")
        return resp, err
    }
}

func AuthHandler(h Handler) Handler {
    return func(ctx context.Context, req Request) (Response, error) {
        if !checkAuth(req) {
            return Response{}, errors.New("unauthorized")
        }
        return h(ctx, req)
    }
}
```

**问题**：这是哪种设计模式？与接口实现相比有何优劣？`type Handler func` 与 `interface{}` 的适用场景？

<details>
<summary>答案与解析</summary>

**答案**：**装饰器模式（Decorator）** / **中间件模式（Middleware）**。

**解析**：

**函数类型 vs 接口**：

| 特性 | `type Handler func` | `interface Handler` |
|------|---------------------|-------------------|
| 实现方式 | 直接赋值函数 | 需实现方法集 |
| 扩展性 | 只能扩展函数签名 | 可扩展任意方法 |
| 组合性 | 天然支持（函数嵌套） | 需显式包装 |
| 状态存储 | 闭包捕获 | 结构体字段 |
| 测试 | 直接传匿名函数 | 需 mock 结构体 |

**适用场景**：
- **函数类型**：HTTP 中间件、回调函数、简单策略。
- **接口**：复杂生命周期、多方法依赖、需要状态。

**Go 的惯用法**：
```go
// 函数类型 + 方法（混合模式）
type Handler func(w http.ResponseWriter, r *http.Request)

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    h(w, r)
}

// 这样 Handler 既可以直接用，也实现了 http.Handler 接口
```

**考点**：Go 中**函数是一等公民**，函数类型可以绑定方法，实现接口。

</details>

---

### 题 16：泛型类型约束

```go
type Number interface {
    ~int | ~int64 | ~float64
}

type MyInt int

func Add[T Number](a, b T) T {
    return a + b
}

func main() {
    fmt.Println(Add(1, 2))           // 合法？
    fmt.Println(Add(MyInt(1), MyInt(2))) // 合法？
    fmt.Println(Add(1.5, 2.5))       // 合法？
}
```

**问题**：`~` 的作用是什么？为什么 `Number` 需要 `~int` 而不是 `int`？

<details>
<summary>答案与解析</summary>

**答案**：全部合法。`~` 表示**底层类型**。

**解析**：

**类型约束语法**：
- `int`：只匹配 `int` 类型本身。
- `~int`：匹配**底层类型是 `int`** 的所有类型（包括 `MyInt`、`YourInt` 等）。

**为什么需要 `~`**：
```go
type MyInt int

// 如果没有 ~：
func Add[T int | int64](a, b T) T { ... }
Add(MyInt(1), MyInt(2))  // 编译错误！MyInt 不是 int

// 有 ~：
func Add[T ~int | ~int64](a, b T) T { ... }
Add(MyInt(1), MyInt(2))  // 合法
```

**运算约束**：
- `Number` 约束中的类型必须支持 `+` 运算符。
- Go 泛型不支持自定义运算符重载，只能用预定义类型集合。

**考点**：`~` 是泛型类型约束的**核心符号**，区分"精确类型"和"底层类型"。

</details>

---

## 综合陷阱题（压轴）

### 题 17：类型嵌入的接口实现陷阱

```go
type Inner struct{}

func (*Inner) Method() {}

type Outer struct {
    Inner
}

func (o *Outer) Method() {
    fmt.Println("Outer.Method")
}

var _ interface{ Method() } = &Outer{}  // 合法？

type Outer2 struct {
    *Inner
}

var _ interface{ Method() } = Outer2{}   // 合法？
var _ interface{ Method() } = &Outer2{}  // 合法？
```

**问题**：逐行判断。嵌入指针与嵌入值在方法集上有何差异？

<details>
<summary>答案与解析</summary>

**答案**：
- `&Outer{}` 赋值给接口：✅ 合法（`Outer` 自己的 `Method`）
- `Outer2{}` 赋值给接口：❌ 编译错误
- `&Outer2{}` 赋值给接口：✅ 合法

**解析**：

**嵌入值（`Inner`）**：
- `Outer` 的方法集包含 `Inner` 的方法（提升）。
- 但 `Outer` 自己定义了 `Method`，**遮蔽**了 `Inner.Method`。
- 所以 `&Outer` 的方法集是 `Outer.Method`。

**嵌入指针（`*Inner`）**：
- `Outer2` 嵌入 `*Inner`，但 `Outer2{}` 的方法集**不包含** `*Inner.Method`！
- 因为 `Outer2{}` 的 `Inner` 字段是 `nil` 指针，不可寻址，无法调用指针方法。
- `&Outer2{}` 可以调用 `Inner` 的方法（因为可以取 `Inner` 字段的地址）。

**关键区别**：
```go
type Outer2 struct {
    *Inner  // 零值时 Inner 是 nil
}

o := Outer2{}
o.Method()  // panic！Inner 是 nil，调用 nil 指针方法
```

**考点**：嵌入指针类型时，**零值初始化**会导致方法调用 panic。

</details>

---

## 面试速查卡

| 考点 | 一句话 | 常见陷阱 |
|------|--------|----------|
| 新类型 vs 别名 | 新类型需显式转换，别名完全等价 | 别名不能绑定方法 |
| 方法集 | 值类型只有值方法，指针类型都有 | 不可寻址值不能调用指针方法 |
| 嵌入结构体 | 方法提升，但方法集规则不变 | 嵌入指针零值时 panic |
| 接口 nil | 装 nil 指针的接口不是 nil | 判空要先判接口再断言 |
| 类型转换 | 底层类型相同可转，数值类型互转 | 自定义类型之间不能直接转 |
| 类型开关 | 编译优化为跳转表，case 中已断言 | default 中仍是接口类型 |
| 内存对齐 | 按字段大小从大到小排列 | 空结构体不占内存但影响对齐 |
| 泛型约束 | `~` 匹配底层类型 | `int` 不匹配 `MyInt` |

---

**下一个关键字？** `interface` 的 `itab` 源码级分析？还是 `map` 的扩容机制？