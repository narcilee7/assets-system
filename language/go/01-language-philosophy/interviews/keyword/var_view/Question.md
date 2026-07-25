# `var` 面试题集 — 从基础到专家级

---

## Level 1：声明与初始化（3 题）

### 题 1：var 与短声明的边界

```go
package main

var a = 10

func main() {
    a := 20        // 合法？
    fmt.Println(a) // 输出 10 还是 20？
    fmt.Println(a) // 这里的 a 是哪个？
}
```

**问题**：编译是否通过？如果通过，输出什么？如果删除 `var a = 10`，结果会变吗？

<details>
<summary>答案与解析</summary>

**答案**：编译通过，输出 `20`（两次都是 20）。删除 `var a = 10` 也编译通过，输出 `20`。

**解析**：
- `var a = 10` 是**包级变量**。
- `a := 20` 在 `main` 函数内声明了一个**新的局部变量 `a`**，遮蔽了包级变量。
- 短声明 `:=` 在函数内优先声明新变量，而不是赋值给外层同名变量。
- 从 Go 1.13 起，`:=` 允许至少一个新变量即可重声明，但这里 `a` 是完全新声明，不涉及重声明规则。

**如何修改包级变量**：
```go
func main() {
    a = 20  // 用 = 而不是 :=，直接赋值给包级变量
    fmt.Println(a) // 20
}
```

**考点**：短声明的**作用域遮蔽（Shadowing）**是面试高频陷阱。

</details>

---

### 题 2：多重声明与类型推断

```go
var a, b, c = 1, "hello", 3.14
var x, y = 1, 2.0
var m, n int = 1, 2.0
```

**问题**：哪行编译错误？为什么？

<details>
<summary>答案与解析</summary>

**答案**：第三行 `var m, n int = 1, 2.0` 编译错误。

**解析**：
- 第一行：`a` 推断为 `int`，`b` 推断为 `string`，`c` 推断为 `float64`。多重声明允许每个变量类型不同。
- 第二行：`x` 推断为 `int`（无类型整数常量），`y` 推断为 `float64`。`1` 和 `2.0` 类型不同，但 `var` 不带类型时各自推断。
- 第三行：显式声明 `int` 类型，要求所有变量都是 `int`。`2.0` 是无类型浮点常量，但显式类型要求下不能隐式缩窄转换（`2.0` 虽然值是 2，但类型不匹配）。

**修正**：
```go
var m, n int = 1, 2     // 合法
var m, n = 1, 2.0       // 合法，m=int, n=float64
```

**考点**：`var` 带类型时，所有变量必须是该类型；不带类型时各自推断。

</details>

---

### 题 3：零值语义

```go
var a int
var b string
var c []int
var d map[string]int
var e *int
var f func()
var g interface{}
var h struct{ X int }

fmt.Println(a == 0)       // ?
fmt.Println(b == "")      // ?
fmt.Println(c == nil)     // ?
fmt.Println(d == nil)     // ?
fmt.Println(e == nil)     // ?
fmt.Println(f == nil)     // ?
fmt.Println(g == nil)     // ?
fmt.Println(h == struct{ X int }{}) // ?
```

**问题**：哪些能编译？输出什么？`var` 的零值规则是什么？

<details>
<summary>答案与解析</summary>

**答案**：全部编译通过，输出全为 `true`。

**解析**：
- `var` 声明的变量**总是零值初始化**，不会存在未初始化状态。
- 各类型零值：
  - 数值：`0`
  - 字符串：`""`
  - 指针：`nil`
  - 函数：`nil`
  - 接口：`nil`（`(type=nil, value=nil)`）
  - 切片：`nil`（`len=0, cap=0, ptr=nil`）
  - 映射：`nil`（可读，写会 panic）
  - 结构体：各字段零值
  - 通道：`nil`（读写都会阻塞）

**对比 C/C++**：Go 没有"未初始化变量"的未定义行为，这是内存安全的基础。

**考点**：`var` 的零值保证 + 各类型零值的具体含义。

</details>

---

## Level 2：作用域与生命周期（4 题）

### 题 4：包级变量初始化顺序

```go
package main

var a = b + 1  // 1
var b = c + 1  // 2
var c = 1      // 3

func main() {
    fmt.Println(a, b, c)
}
```

**问题**：输出什么？如果交换三行声明顺序，结果会变吗？

<details>
<summary>答案与解析</summary>

**答案**：输出 `3 2 1`。交换顺序后结果不变。

**解析**：
- Go 包级变量初始化按**依赖拓扑排序**，不是按声明顺序。
- `a` 依赖 `b`，`b` 依赖 `c`，所以初始化顺序是 `c → b → a`。
- 如果有循环依赖（如 `a` 依赖 `b`，`b` 依赖 `a`），编译错误。

**考点**：包级变量初始化是**依赖驱动**，不是顺序驱动。

</details>

---
****
### 题 5：if/for 中的短声明作用域

```go
var err error
x, err := foo()      // 1
if y, err := bar(); err != nil {  // 2
    // ...
}
fmt.Println(err)     // 3
```

**问题**：第 1 行的 `err` 和第 2 行的 `err` 是同一个变量吗？第 3 行输出什么？

<details>
<summary>答案与解析</summary>

**答案**：不是同一个。第 1 行重用了包级/外层 `err`，第 2 行创建了一个新的局部 `err`。第 3 行输出第 1 行 `foo()` 的 `err`。

**解析**：
- 第 1 行 `x, err := foo()`：因为 `x` 是新变量，`:=` 允许重声明，此时 `err` 是**外层 `err`**（不是新声明）。
- 第 2 行 `if y, err := bar()`：`if` 块内创建了新作用域，`y` 和 `err` 都是**局部变量**，遮蔽了外层 `err`。
- 第 3 行在 `if` 块外，访问的是外层 `err`（即 `foo()` 返回的）。

**修复**（如果意图是让 `if` 中的 `err` 影响外层）：
```go
var err error
x, err := foo()
y, err := bar()  // 去掉 if 的短声明，但这样 y 的作用域变大了
if err != nil {
    // ...
}
```

**考点**：`:=` 在 `if`/`for`/`switch` 中创建新作用域，是错误处理中最容易踩的坑。

</details>

---

### 题 6：for 循环中的 var 陷阱

```go
func main() {
    for i := 0; i < 3; i++ {
        var v = i
        go func() {
            fmt.Println(v)
        }()
    }
    time.Sleep(time.Second)
}
```

**问题**：输出什么？如果把 `var v = i` 改成 `v := i`，结果会变吗？

<details>
<summary>答案与解析</summary>

**答案**：输出 `0 1 2`（顺序不定）。改成 `v := i` 结果一样。

**解析**：
- `var v = i` 和 `v := i` 在 `for` 循环中**每次迭代都创建新变量**（Go 1.22 之前是共享变量，Go 1.22+ 每次迭代独立）。
- 每个 goroutine 捕获的是**当前迭代**的 `v`，所以输出 0、1、2。
- **Go 1.21 及之前**：`v` 在循环中只分配一次，三个 goroutine 共享同一个 `v`，最后都输出 `2`（或乱序的 2）！

**考点**：Go 1.22 的 "loopvar" 修复是重大变化，面试必须明确版本差异。

**Go 1.21 及之前的修复**：
```go
for i := 0; i < 3; i++ {
    v := i  // 每次迭代新分配（虽然实际上 Go 1.21 之前也是共享，但传参可以修复）
    go func(v int) {
        fmt.Println(v)
    }(v)
}
```

</details>

---

### 题 7：匿名变量 `_` 的副作用

```go
var _ = initPackage()  // 1

func initPackage() int {
    fmt.Println("initPackage called")
    return 42
}

func main() {
    fmt.Println("main")
}
```

**问题**：`initPackage` 会被调用吗？`_` 作为匿名变量，有什么特殊行为？

<details>
<summary>答案与解析</summary>

**答案**：会调用，输出 `initPackage called` 然后 `main`。

**解析**：
- `_` 是**匿名变量**，可以接收任何值，但**不能读取**。
- 但匿名变量**仍然是变量**，赋值给 `_` 会执行右侧表达式（包括函数调用）。
- 所以 `initPackage()` 会被调用，副作用发生。
- 包级 `var _ = initPackage()` 是合法的初始化方式。

**对比**：
```go
_ = foo()  // 合法，执行 foo()
_ := foo() // 编译错误！:= 要求至少一个非匿名变量
```

**考点**：`_` 不是"丢弃"，只是"不命名"，副作用仍然执行。

</details>

---

## Level 3：内存与逃逸（4 题）

### 题 8：var 的栈 vs 堆分配

```go
func foo() *int {
    var x = 10
    return &x
}

func bar() int {
    var y = 20
    return y
}

func baz() {
    var z = 30
    fmt.Println(z)
}
```

**问题**：`x`、`y`、`z` 分别分配在栈还是堆？如何判断？

<details>
<summary>答案与解析</summary>

**答案**：
- `x`：逃逸到**堆**（返回了指针，编译器无法确定生命周期）。
- `y`：**栈**（返回值拷贝，不涉及指针逃逸）。
- `z`：**栈**（局部变量，无逃逸）。

**解析**：
- Go 编译器做**逃逸分析（Escape Analysis）**，决定变量分配位置。
- 如果变量地址被返回、被闭包捕获、被传入接口/反射等，可能逃逸到堆。
- 用 `go build -gcflags="-m"` 查看逃逸分析结果。

**验证**：
```bash
go build -gcflags="-m" main.go
# 输出：moved to heap: x
```

**考点**：`var` 不是"一定在栈上"，逃逸分析决定最终位置。面试常问"Go 有栈分配吗？"

</details>

---

### 题 9：new 与 var 的等价性

```go
var a *int = new(int)
var b *int
var c = &int{}

fmt.Println(a == nil) // ?
fmt.Println(b == nil) // ?
fmt.Println(c)        // ?
```

**问题**：`a`、`b`、`c` 分别是什么？`new` 和 `var` 在指针场景的区别？

<details>
<summary>答案与解析</summary>

**答案**：
- `a`：指向 `0` 的指针（`new(int)` 分配内存并零值初始化）。
- `b`：`nil` 指针（声明了指针变量，但未初始化）。
- `c`：编译错误（`&int{}` 不合法，不能取字面量的地址）。

**解析**：
- `new(T)`：分配 `T` 的零值内存，返回 `*T`。等价于 `var t T; return &t`（但 `new` 可以内联优化）。
- `var b *int`：声明指针变量，零值是 `nil`。
- `&int{}` 错误：不能取基本类型字面量的地址。但 `&struct{}{}` 可以。

**等价写法**：
```go
var a *int = new(int)      // 堆分配
var x int; a = &x           // 等价，但 x 可能栈分配（如果未逃逸）

// 更常见的：
p := new(int)               // 短声明 + new
```

**考点**：`new` 是函数（可替换），`var` 是声明语法。`new` 保证返回非 nil 指针。

</details>

---

### 题 10：闭包捕获 var 变量

```go
func makeFuncs() []func() {
    var funcs []func()
    for i := 0; i < 3; i++ {
        var v = i * 10
        funcs = append(funcs, func() {
            fmt.Println(v)
        })
    }
    return funcs
}

func main() {
    for _, f := range makeFuncs() {
        f()
    }
}
```

**问题**：Go 1.22 之前和之后输出什么？为什么？

<details>
<summary>答案与解析</summary>

**答案**：
- **Go 1.22 之前**：输出 `20 20 20`（三个都是 20）。
- **Go 1.22 之后**：输出 `0 10 20`。

**解析**：
- **Go 1.22 之前**：`for` 循环中的 `v` 只分配一次，三个闭包共享同一个 `v`。循环结束后 `v` 的值是 `20`（最后一次迭代）。
- **Go 1.22 之后**：每次迭代 `v` 都是新变量，每个闭包捕获各自的 `v`。

**Go 1.22 之前的修复**（传参）：
```go
for i := 0; i < 3; i++ {
    v := i * 10
    funcs = append(funcs, func(v int) func() {
        return func() { fmt.Println(v) }
    }(v))
}
```

**考点**：闭包 + 循环变量是 Go 最著名的陷阱之一，必须明确版本差异。

</details>

---

## Level 4：并发与同步（3 题）

### 题 11：var 与并发安全

```go
var counter int

func inc() {
    for i := 0; i < 1000; i++ {
        counter++
    }
}

func main() {
    var wg sync.WaitGroup
    for i := 0; i < 100; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            inc()
        }()
    }
    wg.Wait()
    fmt.Println(counter)
}
```

**问题**：输出一定是 `100000` 吗？为什么？如何修复？

<details>
<summary>答案与解析</summary>

**答案**：不是。输出不确定（小于 100000），因为 `counter++` 不是原子操作。

**解析**：
- `counter++` 在汇编层面是 **读-改-写** 三步：
  1. `LOAD counter` 到寄存器
  2. `INC` 寄存器
  3. `STORE` 回内存
- 多个 goroutine 并发执行时，可能读到相同的值，导致丢失更新。

**修复方案**：
```go
// 方案 1：Mutex
var mu sync.Mutex
mu.Lock()
counter++
mu.Unlock()

// 方案 2：atomic
atomic.AddInt64(&counter, 1)

// 方案 3：channel（CSP 风格）
var ch = make(chan int, 100)
go func() {
    for v := range ch {
        counter += v
    }
}()
```

**考点**：`var` 声明的变量没有并发保护，必须显式同步。

</details>

---

### 题 12：var 声明的 channel 零值

```go
var ch chan int

func main() {
    go func() {
        ch <- 1
    }()
    time.Sleep(time.Second)
    fmt.Println("done")
}
```

**问题**：程序输出什么？会 panic 吗？会死锁吗？

<details>
<summary>答案与解析</summary>

**答案**：程序**永远阻塞**，不会 panic，不会死锁（不会触发 `fatal error: all goroutines are asleep`）。

**解析**：
- `var ch chan int` 声明的 `ch` 是 `nil`。
- 向 `nil` channel **发送**会**永久阻塞**。
- 从 `nil` channel **接收**会**永久阻塞**。
- 关闭 `nil` channel 会 **panic**。
- `select` 中的 `nil` channel case 永远不会被选中。

**为什么不是死锁**：因为 `main` goroutine 还在 `Sleep`，不是"全部 asleep"。如果去掉 `Sleep`，`main` 结束，程序退出。

**修复**：
```go
ch := make(chan int)  // 必须 make
```

**考点**：`var` 的零值语义在 channel 上的特殊行为——阻塞而非 panic。

</details>

---

### 题 13：var 与 sync.Once

```go
var config map[string]string
var once sync.Once

func loadConfig() {
    config = map[string]string{
        "key": "value",
    }
}

func getConfig() map[string]string {
    once.Do(loadConfig)
    return config
}
```

**问题**：这段代码有什么问题？`var` 声明的 `config` 在并发场景下安全吗？

<details>
<summary>答案与解析</summary>

**答案**：`sync.Once` 保证 `loadConfig` 只执行一次，但 `var config` 的**可见性**有问题。

**解析**：
- `sync.Once` 保证 `loadConfig` 的**原子执行**，但 `config` 的赋值和读取之间没有 **happens-before** 保证。
- 在弱内存序架构（ARM）上，一个 goroutine 可能看到 `config != nil` 但内部 map 未初始化完成。
- 另外，`config` 是 `map` 类型，并发读写需要额外保护。

**修复**：
```go
var config atomic.Value  // 或 var config *atomic.Pointer[map[string]string]

func loadConfig() {
    m := map[string]string{"key": "value"}
    config.Store(m)  // 原子存储，保证 happens-before
}

func getConfig() map[string]string {
    once.Do(loadConfig)
    return config.Load().(map[string]string)
}
```

**考点**：`var` + `sync.Once` 是常见模式，但需要注意**内存可见性**（happens-before），不是"执行一次"就万事大吉。

</details>

---

## Level 5：工程与设计（3 题）

### 题 14：var 与接口实现的隐式检查

```go
var _ io.Reader = (*MyReader)(nil)
var _ io.Writer = MyWriter{}
```

**问题**：这两行代码的作用是什么？为什么用 `var _ = ...` 而不是直接 `func init()` 检查？

<details>
<summary>答案与解析</summary>

**答案**：**编译期接口实现检查**。如果 `MyReader` 没有实现 `io.Reader`，编译报错。

**解析**：
- `var _ io.Reader = (*MyReader)(nil)`：检查 `*MyReader` 是否实现 `io.Reader`。用 `nil` 指针是因为不需要实例值。
- `var _ io.Writer = MyWriter{}`：检查 `MyWriter`（值类型）是否实现 `io.Writer`。必须构造零值实例。
- 放在包级，**编译时**就检查，不占用运行时资源。
- 用 `_` 匿名变量避免"声明未使用"的编译错误。

**为什么不用 `init()`**：
- `init()` 是运行时检查，延迟发现问题。
- `var` 检查更简洁，零开销。

**考点**：这是 Go 的**惯用法（idiom）**，面试看到要立刻反应出是接口检查。

</details>

---

### 题 15：var 的 init 副作用与循环依赖

```go
// package a
var A = b.B + 1

// package b
var B = a.A + 1
```

**问题**：编译结果是什么？如何解决？

<details>
<summary>答案与解析</summary>

**答案**：编译错误：初始化循环依赖。

**解析**：
- Go 包级变量初始化不允许循环依赖，即使跨包。
- 这与 `import` 循环依赖不同，这是**变量初始化**的循环依赖。

**解决**：
1. **延迟初始化**：用 `sync.Once` 或 `init()` 函数：
   ```go
   // package a
   var A int
   func init() {
       A = b.B + 1
   }
   
   // package b
   var B int
   func init() {
       B = 1  // 或从配置文件读取
   }
   ```
2. **合并包**：如果逻辑上紧密耦合，合并到一个包。
3. **重构依赖**：消除循环依赖，引入第三个包存放共享常量。

**考点**：`var` 的初始化顺序是编译器强约束的，不能运行时动态解决。

</details>

---

### 题 16：var 与依赖注入

```go
var DB *sql.DB

func InitDB(connStr string) error {
    var err error
    DB, err = sql.Open("postgres", connStr)
    return err
}

func GetUser(id int) (*User, error) {
    row := DB.QueryRow("SELECT ...", id)
    // ...
}
```

**问题**：这种全局 `var DB` 的设计有什么问题？如何改进？

<details>
<summary>答案与解析</summary>

**答案**：全局可变状态，测试困难、并发初始化不安全、隐式依赖。

**解析**：
- **测试困难**：单元测试需要替换 `DB`，但全局变量可能被其他测试修改。
- **并发问题**：`InitDB` 可能被多次调用，产生竞态。
- **隐式依赖**：`GetUser` 依赖全局状态，不易追踪。

**改进方案**：

**方案 1：结构体注入**
```go
type Store struct {
    db *sql.DB
}

func NewStore(db *sql.DB) *Store {
    return &Store{db: db}
}

func (s *Store) GetUser(id int) (*User, error) {
    row := s.db.QueryRow("SELECT ...", id)
    // ...
}
```

**方案 2：接口抽象**
```go
type Querier interface {
    QueryRow(query string, args ...interface{}) *sql.Row
}

type Store struct {
    querier Querier
}
```

**方案 3：如果必须用全局变量，用 `sync.Once` + 原子指针**
```go
var (
    db   atomic.Pointer[sql.DB]
    once sync.Once
)

func DB() *sql.DB {
    once.Do(func() {
        d, _ := sql.Open("postgres", connStr)
        db.Store(d)
    })
    return db.Load()
}
```

**考点**：`var` 全局变量是 Go 的便捷特性，但工程上需要权衡。面试常问"什么时候该用全局变量？"

</details>

---

## 综合陷阱题（压轴）

### 题 17：终极作用域谜题

```go
var x = 100

func main() {
    fmt.Println(x)        // 1
    x := 200              // 2
    fmt.Println(x)        // 3
    {
        fmt.Println(x)    // 4
        x := 300          // 5
        fmt.Println(x)    // 6
    }
    fmt.Println(x)        // 7
    x, y := 400, 500      // 8
    fmt.Println(x, y)   // 9
}
```

**问题**：逐行输出什么？第 8 行为什么能编译？

<details>
<summary>答案与解析</summary>

**逐行输出**：
1. `100`（包级 `x`）
2. 声明局部 `x = 200`
3. `200`（局部 `x`）
4. `200`（内层块访问外层局部 `x`）
5. 声明块级局部 `x = 300`
6. `300`（块级 `x`）
7. `200`（回到外层局部 `x`，块级 `x` 已销毁）
8. `x, y := 400, 500`：因为 `y` 是新变量，`:=` 允许重声明，`x` 被重新赋值为 400
9. `400 500`

**第 8 行解析**：
- `x, y := 400, 500` 中 `y` 是新变量，所以 `:=` 合法。
- `x` 不是新声明，而是**赋值**给已有的局部 `x`。
- 这是 Go 1.4 引入的"短声明重声明"规则：至少一个变量是新变量即可。

**考点**：Go 的作用域是**词法作用域（Lexical Scoping）**，短声明的重声明规则是面试最爱考的边界。

</details>

---

## 面试速查卡

| 考点 | 一句话 | 常见陷阱 |
|------|--------|----------|
| 短声明 `:=` | 函数内优先，至少一个新变量 | 遮蔽外层变量、if/for 中创建局部变量 |
| 零值初始化 | 所有 `var` 都有零值，不会未定义 | nil map 可读不可写、nil channel 阻塞 |
| 作用域遮蔽 | 内层变量遮蔽外层同名变量 | 误以为 `:=` 是赋值 |
| 逃逸分析 | 编译器决定栈/堆，不是语法决定 | 返回指针不一定在堆（内联优化） |
| 包级初始化 | 依赖拓扑排序，不是声明顺序 | 循环依赖编译错误 |
| 并发安全 | `var` 本身无保护 | 需要 atomic/mutex/channel |
| 匿名变量 `_` | 不命名但副作用执行 | 不能用于 `:=` 的唯一变量 |
| 接口检查 | `var _ Interface = Type{}` | 编译期检查惯用法 |

---