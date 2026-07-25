# `func` 面试题集 — 从基础到专家级

---

## Level 1：声明与调用（3 题）

### 题 1：命名返回值与 defer 的暗战

```go
func doubleSum(a, b int) (result int) {
    defer func() {
        result *= 2
    }()
    result = a + b
    return 100
}
```

**问题**：返回值是多少？如果把 `return 100` 改成 `return`，结果会变吗？

<details>
<summary>答案与解析</summary>

**答案**：都是 `200`。

**解析**：

Go 的 `return` 语句在命名返回值场景下，等价于：
```go
result = 100   // 先给命名返回值赋值
return         // 再执行 defer
```

执行顺序：
1. `result = 100`（`return 100` 的语义）
2. `defer` 执行：`result *= 2` → `200`
3. 真正返回

**改成 `return` 后**：
1. `result` 保持 `a + b`
2. `defer` 执行：`result *= 2`
3. 返回 `(a+b)*2`

**考点**：`return` 对命名返回值是先赋值再执行 `defer`，`defer` 可以修改命名返回值。

</details>

---

### 题 2：变长参数与切片展开

```go
func foo(a int, b ...int) {
    fmt.Printf("%T, %v\n", b, b)
}

func main() {
    s := []int{1, 2, 3}
    foo(0, s...)       // 合法？
    foo(0, s)          // 合法？
    foo(0, []int{1}...) // 合法？
}
```

**问题**：逐行判断。`...` 在定义处和调用处的区别？如果 `s` 是 `nil`，传入后是什么？

<details>
<summary>答案与解析</summary>

**答案**：
- `foo(0, s...)`：✅ 合法，`b` 是 `[]int{1, 2, 3}`
- `foo(0, s)`：❌ 编译错误，类型不匹配（`[]int` vs `...int`）
- `foo(0, []int{1}...)`：✅ 合法

**解析**：

- **定义处** `...int`：收集剩余参数为 `[]int`。
- **调用处** `s...`：将切片展开为参数列表。

**nil 切片展开**：
```go
var s []int
foo(0, s...)  // b 是 nil 切片，不是 panic
```

**陷阱**：变长参数在函数内部是**切片**，如果修改切片元素（不是重新赋值），会影响原始数组：
```go
func modify(b ...int) {
    b[0] = 100  // 影响外部！
}
```

**考点**：`...` 是语法糖，本质是切片传递（引用语义）。

</details>

---

### 题 3：函数值的比较

```go
func a() {}
func b() {}

func main() {
    fmt.Println(a == b)     // 合法？
    fmt.Println(a == nil)   // 合法？
    var c func()
    fmt.Println(c == nil)   // 合法？
    fmt.Println(a == a)     // 合法？
}
```

**问题**：哪些能编译？输出什么？为什么函数值不能比较？

<details>
<summary>答案与解析</summary>

**答案**：
- `a == b`：❌ 编译错误
- `a == nil`：✅ `false`
- `c == nil`：✅ `true`
- `a == a`：❌ 编译错误

**解析**：

Go 规范：**函数值只能与 `nil` 比较**，不能与其他函数值比较。

**原因**：
- 函数值底层是**指针**（指向函数代码 + 闭包环境）。
- 两个不同函数即使签名相同，代码地址不同。
- 同一个函数字面量多次赋值，编译器可能复用也可能不复用，规范不保证唯一性。

**例外**：`reflect.DeepEqual` 也不比较函数值，直接视为不同。

**考点**：函数是**一等公民**（可赋值、传参、返回），但**不可比较**（除 nil）。

</details>

---

## Level 2：方法集与接收者（3 题）

### 题 4：nil 接收者方法调用

```go
type Tree struct {
    root *Node
    size int
}

func (t *Tree) IsEmpty() bool {
    return t == nil || t.root == nil
}

func main() {
    var t *Tree
    fmt.Println(t.IsEmpty())  // 合法？panic？
}
```

**问题**：能编译吗？运行时 panic 吗？输出什么？这与其他语言的 `NullPointerException` 有何不同？

<details>
<summary>答案与解析</summary>

**答案**：编译通过，运行正常，输出 `true`。

**解析**：

Go 的**方法调用**：
```go
t.IsEmpty()  // 编译为：Tree.IsEmpty(t)
```

- 只要**类型匹配**（`*Tree`），就可以调用方法。
- 方法内部 `t` 是 `nil`，但**解引用前检查**不会 panic。
- 如果方法内直接访问 `t.root` 而不检查 `t == nil`，才会 panic。

**与其他语言对比**：
- Java/C++：`t.isEmpty()` 在 `t == null` 时直接 NPE，因为方法调用隐含解引用。
- Go：方法调用只是**语法糖**，`t.IsEmpty()` 等价于 `(*Tree).IsEmpty(t)`，传 `nil` 指针是合法的。

**经典用途**：
```go
type IntSet struct {
    m map[int]struct{}
}

func (s *IntSet) Add(x int) {
    if s == nil {
        return  // 安全！
    }
    if s.m == nil {
        s.m = make(map[int]struct{})
    }
    s.m[x] = struct{}{}
}
```

**考点**：Go 的 `nil` 接收者可以调用方法，这是**防御式编程**的基础。

</details>

---

### 题 5：方法值 vs 方法表达式

```go
type Counter struct{ n int }

func (c *Counter) Inc() { c.n++ }
func (c Counter) Value() int { return c.n }

var c Counter
p := &c

f1 := c.Inc      // 方法值
f2 := Counter.Inc // 方法表达式

f3 := c.Value    // 方法值
f4 := p.Value    // 方法值
```

**问题**：`f1()` 和 `f2(&c)()` 等价吗？`f1()` 会修改 `c` 吗？`f3()` 和 `f4()` 的输出一样吗？

<details>
<summary>答案与解析</summary>

**答案**：
- `f1()` 等价于 `(*Counter).Inc(&c)`，会修改 `c.n`。
- `f2(&c)` 是方法表达式，需要显式传接收者。
- `f3()` 输出 `0`，`f4()` 也输出 `0`，但 `f3` 绑定的是 `c` 的副本（值接收者方法值复制接收者）。

**解析**：

**方法值（Method Value）**：
- `c.Inc`：编译器隐式取地址，绑定 `(&c)` 作为接收者。
- 等价于闭包：`func() { (*Counter).Inc(&c) }`

**方法表达式（Method Expression）**：
- `Counter.Inc`：不绑定接收者，签名是 `func(*Counter)`。
- 必须显式调用：`Counter.Inc(&c)`

**值接收者方法值的陷阱**：
```go
c.n = 10
f3 := c.Value  // f3 绑定的是 c 的副本（值拷贝）
c.n = 20
fmt.Println(f3())  // 输出 10！不是 20
```

**考点**：方法值是**闭包**，值接收者方法值会**复制接收者**。

</details>

---

### 题 6：接口值的方法调用与 nil

```go
type Printer interface {
    Print()
}

type MyPrinter struct{}

func (p *MyPrinter) Print() {}

func main() {
    var p *MyPrinter = nil
    var i Printer = p

    i.Print()  // panic？
}
```

**问题**：`i.Print()` 会 panic 吗？如果 panic，是 `nil pointer dereference` 还是其他？与 `var i Printer = nil` 后调用 `i.Print()` 有何不同？

<details>
<summary>答案与解析</summary>

**答案**：`i.Print()` **panic**：`runtime error: invalid memory address or nil pointer dereference`。

**解析**：

**接口值结构**：
```go
type iface struct {
    tab  *itab      // 类型信息 + 方法表（非 nil，因为 *MyPrinter 实现了 Printer）
    data unsafe.Pointer  // 实际数据指针 = nil（因为 p 是 nil）
}
```

- `i` 不是 nil 接口（`tab != nil`），所以调用方法能找到方法表。
- 但方法调用时，接收者 `p` 是 nil，进入 `Print` 后如果解引用就会 panic。

**对比 `var i Printer = nil`**：
```go
var i Printer = nil
i.Print()  // panic: runtime error: invalid memory address or nil pointer dereference
// 实际上：panic 信息不同，是 "calling method on nil interface"
```

等等，让我纠正：
- `var i Printer = nil`：`i` 是 nil 接口（`tab=nil, data=nil`），调用方法时找不到方法表，panic 信息是 `runtime error: invalid memory address or nil pointer dereference`（在查找 itab 时）。

实际上两种都是 nil pointer，但原因不同：
1. `i = (*MyPrinter)(nil)`：接口非 nil，但 data 指针 nil → 方法内解引用 panic
2. `i = nil`：接口 nil → 调用方法时 panic

**考点**：接口 nil 与 data nil 的双重陷阱。

</details>

---

## Level 3：闭包（4 题）

### 题 7：循环闭包的经典陷阱

```go
func main() {
    var funcs []func()
    for i := 0; i < 3; i++ {
        funcs = append(funcs, func() {
            fmt.Println(i)
        })
    }
    for _, f := range funcs {
        f()
    }
}
```

**问题**：Go 1.22 之前和之后输出什么？为什么？如何修复（不依赖版本）？

<details>
<summary>答案与解析</summary>

**答案**：
- **Go 1.22 之前**：`3 3 3`
- **Go 1.22 之后**：`0 1 2`

**解析**：

**Go 1.22 之前**：
- `for` 循环的 `i` 只分配一次，三个闭包共享同一个 `i`。
- 循环结束后 `i = 3`，所以都输出 `3`。

**Go 1.22 之后**：
- 每次迭代创建新的 `i`，每个闭包捕获各自的 `i`。

**版本无关的修复**：
```go
// 修复 1：传参
funcs = append(funcs, func(i int) func() {
    return func() { fmt.Println(i) }
}(i))

// 修复 2：局部变量
for i := 0; i < 3; i++ {
    v := i  // 每次迭代新变量（Go 1.22 之前也是共享，但配合传参）
    funcs = append(funcs, func() {
        fmt.Println(v)
    })
}
```

**考点**：闭包捕获的是**变量引用**，不是值。必须明确 Go 版本差异。

</details>

---

### 题 8：闭包修改外部变量

```go
func counter() func() int {
    n := 0
    return func() int {
        n++
        return n
    }
}

func main() {
    c1 := counter()
    c2 := counter()

    fmt.Println(c1())  // ?
    fmt.Println(c1())  // ?
    fmt.Println(c2())  // ?
    fmt.Println(c1())  // ?
}
```

**问题**：输出什么？`c1` 和 `c2` 共享 `n` 吗？`n` 分配在栈还是堆？

<details>
<summary>答案与解析</summary>

**答案**：`1, 2, 1, 3`。`c1` 和 `c2` 不共享。`n` 在**堆**上。

**解析**：

- 每次调用 `counter()` 创建新的 `n` 和闭包。
- `c1` 和 `c2` 有各自独立的 `n`。
- `n` 原本在栈上，但**逃逸到堆**（因为闭包返回后仍引用它）。

**逃逸验证**：
```bash
go build -gcflags="-m"
# 输出：moved to heap: n
```

**考点**：闭包 = 函数指针 + 捕获环境指针。每次调用创建新环境。

</details>

---

### 题 9：defer + 闭包 + 参数求值

```go
func main() {
    for i := 0; i < 3; i++ {
        defer func() {
            fmt.Println(i)
        }()
    }
    for i := 0; i < 3; i++ {
        defer func(i int) {
            fmt.Println(i)
        }(i)
    }
}
```

**问题**：两个循环分别输出什么？为什么顺序是逆序的？
</details>

---

## Level 4：defer 与函数生命周期（3 题）

### 题 10：defer 的 LIFO 与资源清理

```go
func main() {
    defer fmt.Println("1")
    defer fmt.Println("2")
    defer func() {
        fmt.Println("3")
        defer fmt.Println("4")
    }()
    fmt.Println("5")
}
```

**问题**：输出顺序？`defer` 中的 `defer` 何时执行？

<details>
<summary>答案与解析</summary>

**答案**：`5, 2, 3, 4, 1`

**解析**：

执行顺序：
1. `fmt.Println("5")` 直接执行
2. 函数返回时，按 LIFO 执行 defer：
   - 最后注册的 `defer func() { ... }()` 先执行，输出 `3`
   - 该函数内又 `defer fmt.Println("4")`，这个 defer 在当前函数返回时执行，所以立刻输出 `4`
   - 然后输出 `2`
   - 最后输出 `1`

**defer 栈规则**：
- 每个函数有自己的 defer 栈。
- 函数 A 的 defer 中调用函数 B，B 的 defer 在 B 返回时执行，不影响 A 的 defer 顺序。

**考点**：defer 是**函数级 LIFO**，嵌套函数有各自独立的 defer 栈。

</details>

---

### 题 11：defer 与返回值修改

```go
func f() (r int) {
    defer func() {
        r += 10
    }()
    return 1
}

func g() int {
    r := 1
    defer func() {
        r += 10
    }()
    return r
}

func h() (r int) {
    t := 1
    defer func() {
        t += 10
    }()
    return t
}
```

**问题**：三个函数分别返回什么？为什么 `h` 的行为特殊？

<details>
<summary>答案与解析</summary>

**答案**：
- `f()`：`11`
- `g()`：`1`
- `h()`：`1`

**解析**：

**f()**：命名返回值 `r`
1. `return 1` → `r = 1`
2. defer 修改 `r` → `r = 11`
3. 返回 `11`

**g()**：非命名返回值
1. `return r` → 将 `r`（1）复制到返回值槽位
2. defer 修改局部变量 `r` → `r = 11`
3. 但返回值槽位已经是 `1`，返回 `1`

**h()**：命名返回值 `r`，但返回 `t`
1. `return t` → `r = t`（即 `r = 1`）
2. defer 修改 `t` → `t = 11`
3. `r` 不受影响，返回 `1`

**考点**：只有**命名返回值**且 defer 直接修改它，才能影响返回值。修改局部变量无效。

</details>

---

### 题 12：panic 与 defer 的恢复

```go
func main() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("recovered:", r)
        }
    }()

    defer func() {
        panic("second panic")
    }()

    panic("first panic")
}
```

**问题**：输出什么？`recover` 能捕获哪个 panic？如果交换两个 defer 的顺序呢？

<details>
<summary>答案与解析</summary>

**答案**：输出 `recovered: second panic`。如果交换顺序，输出 `recovered: first panic`。

**解析**：

**panic 与 defer 的交互**：
1. `panic("first panic")` 触发，开始执行 defer 栈（LIFO）。
2. 先执行第二个 defer（后注册的先执行）：`panic("second panic")`。
3. **panic 可以覆盖**：新的 panic 取代旧的 panic，继续执行 defer 栈。
4. 然后执行第一个 defer：`recover()` 捕获的是 **当前活跃的 panic**（即 "second panic"）。

**交换顺序后**：
1. `panic("first panic")`
2. 先执行 `recover()` 的 defer：捕获 "first panic"
3. 然后执行第二个 defer：`panic("second panic")`，但此时函数已返回，程序崩溃。

**考点**：panic 可以被覆盖；`recover` 只捕获**当前活跃的 panic**。

</details>

---

## Level 5：函数值与高级模式（3 题）

### 题 13：函数类型实现接口

```go
type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}

type HandlerFunc func(http.ResponseWriter, *http.Request)

func (f HandlerFunc) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    f(w, r)
}

func myHandler(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("hello"))
}

func main() {
    var h Handler = HandlerFunc(myHandler)  // 合法？
    h.ServeHTTP(nil, nil)                 // 实际调用？
}
```

**问题**：这是 Go 的什么设计模式？`HandlerFunc` 的作用是什么？与 Java 的匿名类有何不同？

<details>
<summary>答案与解析</summary>

**答案**：**适配器模式（Adapter）**。`HandlerFunc` 让普通函数可以当作 `Handler` 接口使用。

**解析**：

**Go 的惯用法**：
```go
http.Handle("/path", HandlerFunc(myHandler))
```

- `HandlerFunc` 是**函数类型**，但绑定了 `ServeHTTP` 方法。
- 普通函数 `myHandler` 通过 `HandlerFunc(myHandler)` 转换为接口值。
- 这是 Go 标准库（`net/http`）的核心设计。

**与 Java 对比**：
- Java：需要匿名类 `new Handler() { public void serve(...) { ... } }`
- Go：函数本身就是值，类型转换即可，零额外内存分配（只是包装）。

**考点**：Go 的**函数即接口**模式，是 HTTP 框架的基础。

</details>

---

### 题 14：函数选项模式（Functional Options）

```go
type Server struct {
    addr     string
    timeout  time.Duration
    maxConn  int
}

type Option func(*Server)

func WithAddr(addr string) Option {
    return func(s *Server) {
        s.addr = addr
    }
}

func WithTimeout(t time.Duration) Option {
    return func(s *Server) {
        s.timeout = t
    }
}

func NewServer(opts ...Option) *Server {
    s := &Server{
        addr:    ":8080",
        timeout: 30 * time.Second,
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

**问题**：这种模式的优点是什么？与 Builder 模式、配置结构体相比有何优劣？有什么潜在陷阱？

<details>
<summary>答案与解析</summary>

**答案**：

**优点**：
1. **向后兼容**：新增选项不破坏已有 API。
2. **自文档化**：`WithTimeout(10s)` 比 `&Config{Timeout: 10}` 可读。
3. **可组合**：选项顺序无关，可叠加。
4. **零值友好**：未设置的选项保持合理默认值。

**与 Builder 对比**：
- Builder：`server.SetAddr().SetTimeout().Build()`，链式调用，但 `Build()` 是必需的。
- Options：直接 `NewServer(WithAddr(...))`，更简洁。

**与 Config 结构体对比**：
- Config：`NewServer(&Config{Addr: ...})`，但零值问题（`0` 是有效值还是未设置？）。
- Options：明确区分"未设置"和"显式设置零值"。

**潜在陷阱**：
1. **选项冲突**：多个选项修改同一字段，后执行的覆盖先执行的。
2. **必填字段缺失**：如果 `addr` 是必填，Options 模式无法强制。
3. **性能**：每次调用创建闭包，有微小分配开销。

**修复必填字段**：
```go
func NewServer(addr string, opts ...Option) *Server {
    // addr 必填，其余可选
}
```

**考点**：这是 Go 工程中最流行的 API 设计模式（Rob Pike 推广）。

</details>

---

### 题 15：泛型函数与类型推导

```go
func Map[T, U any](s []T, f func(T) U) []U {
    r := make([]U, len(s))
    for i, v := range s {
        r[i] = f(v)
    }
    return r
}

func main() {
    ints := []int{1, 2, 3}
    
    // 下面哪些能编译？
    doubles := Map(ints, func(x int) int { return x * 2 })
    strs := Map(ints, func(x int) string { return strconv.Itoa(x) })
    // doubles2 := Map[int, int](ints, func(x int) int { return x * 2 })  // 显式指定？
}
```

**问题**：Go 泛型函数的类型推导规则？什么情况下必须显式指定类型参数？

<details>
<summary>答案与解析</summary>

**答案**：三个都能编译。Go 泛型支持**函数参数类型推导**。

**解析**：

**类型推导规则**：
1. **从函数参数推导**：`ints` 是 `[]int`，所以 `T = int`；闭包参数 `x int` 确认 `T = int`；返回值推导 `U`。
2. **显式指定**：`Map[int, int](...)` 合法，但通常冗余。

**必须显式指定的情况**：
```go
func Identity[T any](v T) T { return v }

x := Identity(42)        // T = int，推导成功
y := Identity[int](42)   // 冗余但合法

// 无法推导的情况：
z := Identity(nil)       // 编译错误！nil 无类型，无法推导 T
w := Identity[int](nil)  // 必须显式指定
```

**考点**：Go 泛型推导基于**函数参数**，返回值类型不能独立推导。

</details>

---

## Level 6：运行时与性能（2 题）

### 题 16：函数内联与栈帧

```go
func add(a, b int) int {
    return a + b
}

func main() {
    x := add(1, 2)
    _ = x
}
```

**问题**：`add` 会被内联吗？如何判断？内联的边界条件是什么？闭包为什么难以内联？

<details>
<summary>答案与解析</summary>

**答案**：会内联。用 `go build -gcflags="-m"` 查看。

**解析**：

**内联条件**：
- 函数体简单（没有循环、switch、defer、recover、闭包）。
- 没有 `//go:noinline` 注释。
- 编译器优化级别足够（默认开启）。

**查看内联**：
```bash
go build -gcflags="-m" main.go
# 输出：can inline add
```

**闭包难以内联的原因**：
- 闭包需要**捕获环境指针**，调用时需要构建闭包对象。
- 如果闭包逃逸到堆，内联后仍需分配环境，收益有限。

**栈帧**：
- Go 使用**连续栈**，初始 2KB，按需扩容。
- 函数调用开销约 ~5ns（内联后消除）。

**考点**：Go 编译器内联策略保守，defer/recover/闭包会阻止内联。

</details>

---

### 题 17：递归与尾调用

```go
func factorial(n int) int {
    if n <= 1 {
        return 1
    }
    return n * factorial(n-1)
}

func factorialTail(n, acc int) int {
    if n <= 1 {
        return acc
    }
    return factorialTail(n-1, n*acc)
}
```

**问题**：Go 有尾递归优化（TCO）吗？`factorialTail` 会栈溢出吗？递归深度限制是多少？

<details>
<summary>答案与解析</summary>

**答案**：Go **没有**尾递归优化。`factorialTail` 仍会栈溢出（深度过大时）。

**解析**：

**Go 的设计决策**：
- 不实现 TCO，因为 TCO 会**破坏栈追踪**（stack trace），不利于调试 panic。
- 连续栈可以扩容，但递归深度仍受内存限制。

**栈增长**：
- 初始 2KB，最大可达 1GB（64 位）。
- 深度约 10 万级会溢出（取决于栈帧大小）。

**替代方案**：
```go
// 迭代
func factorialIter(n int) int {
    acc := 1
    for ; n > 1; n-- {
        acc *= n
    }
    return acc
}
```

**考点**：Go 明确**不优化尾递归**，面试说"有"直接挂。

</details>

---

## 综合陷阱题（压轴）

### 题 18：defer + 闭包 + 命名返回值 + panic 的终极组合

```go
func f() (result int) {
    defer func() {
        result++
        if r := recover(); r != nil {
            result += 100
        }
    }()
    
    defer func() {
        result *= 10
        panic("inner panic")
    }()
    
    return 5
}
```

**问题**：返回多少？逐行分析执行顺序。

<details>
<summary>答案与解析</summary>

**答案**：`605`

**解析**：

执行顺序：
1. `return 5` → `result = 5`
2. 执行第二个 defer（LIFO，后注册的先执行）：
   - `result *= 10` → `result = 50`
   - `panic("inner panic")` → 触发 panic，覆盖当前返回值状态
3. 执行第一个 defer：
   - `result++` → `result = 51`
   - `recover()` 捕获 "inner panic" → `result += 100` → `result = 151`
4. 函数正常返回（因为 panic 被 recover），返回 `151`？

等等，让我重新算。`return 5` 时 result=5。

第二个 defer：
- result = 5 * 10 = 50
- panic("inner panic")

第一个 defer：
- result++ → 51
- recover 捕获 panic，result += 100 → 151

但函数返回时是 151？我之前说 605 是错的。

等等，我再想想。`return 5` 对命名返回值赋值 result=5。

defer 2: result *= 10 → 50, panic
defer 1: result++ → 51, recover → result += 100 → 151

返回 151。

但让我再检查... 如果 panic 被 recover，函数正常返回，返回 result 的当前值 151。

所以答案是 151，不是 605。我之前写错了。

**修正答案**：`151`

**步骤**：
1. `return 5` → `result = 5`
2. defer#2: `result = 5 * 10 = 50`，`panic("inner panic")`
3. defer#1: `result = 50 + 1 = 51`，`recover` 成功，`result = 51 + 100 = 151`
4. 正常返回 `151`

**考点**：`recover` 后函数正常返回，defer 链继续执行（但这里已经到最外层了）。

</details>

---

### 题 19：设计题 — 实现一个带超时的函数执行器

**要求**：
```go
func RunWithTimeout[T any](fn func() T, timeout time.Duration) (T, error)
```

- 如果 `fn` 在 `timeout` 内完成，返回结果和 `nil` error
- 如果超时，返回零值和 `context.DeadlineExceeded`
- 必须能处理 `fn` 的 panic，不能崩溃调用者
- 不能泄漏 goroutine

**请写出实现，并说明为什么不能用 `context.WithTimeout` 直接传进去。**

<details>
<summary>答案与解析</summary>

```go
func RunWithTimeout[T any](fn func() T, timeout time.Duration) (T, error) {
    var zero T
    result := make(chan T, 1)  // 缓冲 1，防止 goroutine 泄漏
    
    go func() {
        defer func() {
            if r := recover(); r != nil {
                // 可以选择把 panic 包装成 error，这里简化
            }
        }()
        result <- fn()
    }()
    
    select {
    case v := <-result:
        return v, nil
    case <-time.After(timeout):
        return zero, context.DeadlineExceeded
    }
}
```

**问题分析**：

1. **为什么用缓冲 channel `make(chan T, 1)`**：
   - 如果超时后 `fn` 才完成，无缓冲 channel 会导致发送 goroutine 永久阻塞（泄漏）。
   - 缓冲 1 允许发送方立即返回，即使接收方已超时。

2. **为什么不能用 `context.WithTimeout` 直接传**：
   - `fn` 签名是 `func() T`，不接受 `context` 参数。
   - 如果 `fn` 内部不检查 `ctx.Done()`，`context` 无法中断它（如死循环、阻塞 IO）。

3. **panic 处理**：
   - 必须 `recover`，否则 panic 会崩溃整个程序。

4. **改进版（支持取消 goroutine）**：
   ```go
   func RunWithTimeout[T any](fn func() T, timeout time.Duration) (T, error) {
       var zero T
       result := make(chan T, 1)
       done := make(chan struct{})
       
       go func() {
           defer close(done)
           defer func() {
               if r := recover(); r != nil {
                   // log or handle
               }
           }()
           result <- fn()
       }()
       
       select {
       case v := <-result:
           return v, nil
       case <-time.After(timeout):
           return zero, context.DeadlineExceeded
       }
       
       // 等待 goroutine 退出，确保不泄漏（但 fn 可能阻塞）
       <-done
   }
   ```

**考点**：goroutine 泄漏、panic 恢复、channel 缓冲设计、超时控制。

</details>

---

## 面试速查卡

| 考点 | 一句话 | 常见陷阱 |
|------|--------|----------|
| 命名返回值 | `return` 先赋值，再执行 defer | defer 修改局部变量不影响返回值 |
| 函数值比较 | 只能与 `nil` 比较 | 函数值不可比较 |
| nil 接收者 | 可以调用方法，方法内检查 nil | 方法内不解引用就不会 panic |
| 闭包 | 捕获变量引用，不是值 | 循环变量共享（Go 1.22 修复） |
| defer | LIFO，参数注册时求值 | 闭包体延迟执行，循环中注册注意 |
| panic/recover | recover 必须在 defer 中 | panic 可覆盖，recover 后正常返回 |
| 方法值 | 值接收者会复制接收者 | 修改原对象必须用指针接收者 |
| 尾递归 | Go **没有** TCO | 递归用迭代替代 |
| 函数选项 | 向后兼容，自文档化 | 必填字段无法强制，选项冲突 |

---

**下一个？** `map` 的扩容源码（面试最爱问的 hmap）？还是 `chan` 的 `hchan` 结构？