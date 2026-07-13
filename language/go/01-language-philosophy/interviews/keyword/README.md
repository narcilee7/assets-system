# Go 关键字面试 — 基础层总纲

按 **7 个模块** 逐个过，每个关键字从 **面试四维度** 拆解：
- **语法层**：怎么用、有什么坑
- **运行时层**：编译后变成什么、内存怎么排
- **对比层**：和别的关键字/别的语言的差异
- **场景层**：面试官爱问的设计题

---

## 模块一：数据声明（var / const / type / nil）

### 1. `var`

**语法层**
```go
var a int           // 零值初始化
var b = 10          // 类型推断
var c int = 10      // 显式
d := 10             // 短变量声明，只能在函数内
```

**运行时层**
- `var` 声明的变量编译期为 **零值初始化**（不是未定义！）
- 包级 `var` 在 `init` 之前执行，按声明顺序 + 依赖拓扑排序
- 短声明 `:=` 的**重声明规则**：至少一个新变量才能编译通过

**面试陷阱**
```go
// 陷阱 1：短声明作用域遮蔽
if x, err := foo(); err != nil {  // 这里的 x, err 是局部作用域
    // ...
}
// 外部 x 未被赋值！必须用 var x 提前声明

// 陷阱 2：多重赋值顺序
var a, b = 1, 2
a, b = b, a  // 并行赋值，无需临时变量
```

**对比**
- `var` vs `const`：var 是运行时变量，const 是编译期常量（只能是基本类型）
- `var` vs `:=`：`:=` 不能用于包级，不能给结构体字段用，不能单独声明（必须至少一个新变量）

---

### 2. `const`

**语法层**
```go
const Pi = 3.14              // 无类型常量（untyped）
const MaxInt = int(^uint(0) >> 1)  // 常量表达式，编译期求值
const (
    a = iota   // 0
    b          // 1
    c = 100    // 100
    d          // 100（继承上一个表达式）
    e = iota   // 4（恢复计数）
)
```

**运行时层**
- **无类型常量**：`const Pi = 3.14` 没有具体类型，使用时根据上下文隐式转换
  ```go
  var f float32 = Pi   // 合法，编译器自动转 float32
  var f2 float64 = Pi  // 合法
  ```
- **iota 机制**：每遇到一个 `const` 关键字重置为 0，按行递增
- **常量表达式**：必须在编译期可求值，不能调用运行时函数

**面试高频**
```go
// 经典 iota 面试题：实现位掩码
const (
    Read = 1 << iota   // 1
    Write              // 2
    Execute            // 4
)
```

**对比**
- `const` vs C 的 `#define`：Go 的 const 有类型检查（虽然无类型），有作用域，不是文本替换
- `const` vs `var`：const 不能取地址（`&Pi` 非法），因为可能没有内存地址

---

### 3. `type`

**语法层**
```go
type MyInt int           // 定义新类型（不是别名）
type IntAlias = int      // 类型别名（Go 1.9+）

type Person struct { ... }
type Reader interface { ... }

type StringSlice []string  // 底层类型相同，但方法集独立
func (s StringSlice) Len() int { return len(s) }
```

**运行时层**
- **新类型 vs 别名**：`MyInt` 和 `int` 是不同类型，需要显式转换；`IntAlias` 和 `int` 完全等价
- **底层类型（Underlying Type）**：`MyInt` 的底层类型是 `int`，所以 `MyInt` 可以比较
- **方法集**：新类型可以绑定方法，别名不能（别名只是语法糖）

**面试陷阱**
```go
// 坑：类型转换不是隐式的
var a int = 10
var b MyInt = a      // 编译错误！必须显式转换
var c MyInt = MyInt(a)  // 合法
```

**对比**
- `type` 定义 vs `type` 别名：面试常问 "什么时候用别名？" —— 大型重构时兼容旧代码（如 `context.CancelFunc` 曾是别名）
- `type` 与 C `typedef`：Go 的 type 是强类型，不是简单替换

---

### 4. `nil`

**语法层**
`nil` 不是关键字，是预定义标识符（predeclared identifier），但面试必考。

**运行时层**
- `nil` 没有默认类型，它的类型取决于上下文
- **不同 nil 不相等**：
  ```go
  var p *int = nil
  var i interface{} = p
  fmt.Println(i == nil)  // false！i 是 (type=*int, value=nil)，不是 untyped nil
  ```

**面试高频**
```go
// 经典面试题：为什么返回 error 时 nil 判断失效？
func foo() error {
    var p *MyError = nil
    return p  // 返回的是 (type=*MyError, value=nil) 的 interface，不是 nil interface
}
err := foo()
fmt.Println(err == nil)  // false！
```

**正确做法**
```go
func foo() error {
    if ok {
        return nil  // 直接返回 untyped nil
    }
    return &MyError{}
}
```

**对比**
- `nil` vs `null`：Go 的 nil 没有统一类型，指针/切片/映射/通道/接口/函数的 nil 内部表示不同
- 接口 nil 是 `(type=nil, value=nil)`，而具体类型指针 nil 是 `0x0`

---

## 模块一 小结 & 面试速查表

| 关键字 | 一句话考点 | 必会陷阱 |
|--------|-----------|----------|
| `var` | 零值初始化、短声明作用域遮蔽 | `:=` 在 if/for 中创建局部变量 |
| `const` | 无类型常量、iota 位掩码 | 常量不能取地址，iota 按行计数 |
| `type` | 新类型 vs 别名、方法集 | 隐式转换不存在，必须显式 |
| `nil` | 接口 nil 陷阱 | `interface{}` 装指针 nil 不等于 nil |

---

## 模块二：复合类型（struct / interface / map / chan / func）

### 5. `struct`

**语法层**
```go
type User struct {
    Name string
    age  int      // 小写 = 包私有
}

// 嵌入字段（匿名嵌入）
type Admin struct {
    User          // 嵌入，不是继承！
    Level int
}
```

**运行时层**
- **内存布局**：字段按声明顺序排列，编译器自动填充（padding）做内存对齐
  ```go
  type Bad struct {
      a bool     // 1 byte + 7 padding
      b int64    // 8 byte
      c bool     // 1 byte + 7 padding
  }  // 24 byte
  
  type Good struct {
      b int64    // 8 byte
      a bool     // 1 byte
      c bool     // 1 byte + 6 padding
  }  // 16 byte
  ```
- **嵌入字段的方法提升**：`Admin` 可以调用 `User` 的方法，但方法集不包含提升的方法（接口实现时需注意）

**面试高频**
```go
// 嵌入 vs 继承的区别
admin := Admin{User: User{Name: "Tom"}}
admin.Name        // 合法，字段提升
admin.User.Name   // 也合法

// 方法集陷阱
type Reader interface { Read() }
type MyStruct struct {}
func (MyStruct) Read() {}
var _ Reader = MyStruct{}      // 合法
var _ Reader = &MyStruct{}     // 也合法（方法集包含值接收者方法）

// 但反过来
func (*MyStruct) Write() {}
type Writer interface { Write() }
var _ Writer = MyStruct{}      // 非法！值类型不包含指针接收者方法
```

---

### 6. `interface`

**语法层**
```go
type Stringer interface {
    String() string
}

// 空接口
var i interface{} = 42
```

**运行时层**
- **iface（带方法接口）**：`(tab *itab, data unsafe.Pointer)`
  - `itab` 缓存了接口类型、具体类型、方法地址表
  - 首次类型断言时生成 `itab`，后续复用
- **eface（空接口）**：`(type *_type, data unsafe.Pointer)`
  - 少了 `itab`，只有类型元数据

**面试高频**
```go
// 类型断言 vs 类型切换
v, ok := i.(int)        // 断言
switch v := i.(type) {  // 切换
case int:
    // v 是 int
case string:
    // v 是 string
}

// 接口比较：只有动态类型和值都可比较时才能比较
var a interface{} = []int{1, 2}
var b interface{} = []int{1, 2}
fmt.Println(a == b)  // panic！slice 不可比较
```

**对比**
- 值接收者 vs 指针接收者：值接收者方法集同时属于值和指针；指针接收者方法集只属于指针
- 接口是**隐式实现**：不像 Java 需要 `implements`，这是 Go 的鸭子类型

---

### 7. `map`

**语法层**
```go
m := make(map[string]int, 100)  // 预分配 hint
m["key"] = 1
v, ok := m["key"]               //  comma ok 惯用法
delete(m, "key")
```

**运行时层**
- **底层结构**：`hmap` -> `buckets`（数组）-> `bmap`（桶，8 个键值对）
- **扩容**：负载因子 > 6.5 时翻倍扩容；大量删除后可能等量收缩（Go 1.8+）
- **并发不安全**：读写冲突会 panic，不是覆盖错误值
- **遍历顺序随机**：每次遍历随机种子，防止依赖顺序

**面试高频**
```go
// 坑 1：map 不是并发安全的
var m = map[string]int{}
go func() { m["a"] = 1 }()  // 可能 panic
go func() { m["b"] = 2 }()  // 可能 panic

// 坑 2：map 的 value 不可寻址
m := map[string]int{"a": 1}
p := &m["a"]  // 编译错误！map 可能扩容导致地址变化

// 坑 3：map 的零值行为
var m map[string]int  // nil map
m["a"] = 1            // panic！nil map 不能写入
v := m["a"]           // 合法，返回零值
len(m)                // 合法，返回 0
```

**对比**
- `map` vs `sync.Map`：`sync.Map` 适合读多写少、键值类型不固定的场景；普通 map + RWMutex 性能更好
- `make(map)` vs `new(map)`：`new` 返回 `*map`，几乎不用

---

### 8. `chan`

**语法层**
```go
ch := make(chan int, 10)    // 有缓冲
ch2 := make(chan int)       // 无缓冲
ch3 := make(<-chan int)     // 只读
ch4 := make(chan<- int)     // 只写

close(ch)
v, ok := <-ch               // ok 判断 channel 是否关闭且已读完
```

**运行时层**
- **底层结构**：`hchan`（循环队列 + 发送/接收等待队列 + 锁）
- **无缓冲**：发送和接收必须同时 ready，直接交换数据（不经过队列）
- **有缓冲**：数据先进队列，队列满时发送者阻塞
- **关闭语义**：
  - 关闭后仍可读（读到零值，`ok=false`）
  - 关闭后写 panic
  - 重复关闭 panic
  - 关闭 nil channel panic

**面试高频**
```go
// 坑 1：从关闭的 channel 读
ch := make(chan int, 1)
ch <- 1
close(ch)
v, ok := <-ch  // v=1, ok=true
v2, ok2 := <-ch // v2=0, ok2=false

// 坑 2：select 中 nil channel 永远阻塞
var ch chan int  // nil
select {
case <-ch:      // 永远不会执行
case <-time.After(1 * time.Second):
}

// 坑 3：channel 作为信号量
sem := make(chan struct{}, 10)  // 并发控制 10
```

**对比**
- `chan` vs `mutex`：channel 适合数据流转 + 协程协调；mutex 适合保护共享状态
- `close(ch)` 的广播：关闭 channel 所有等待的接收者都能被唤醒，常用作退出信号

---

### 9. `func`

**语法层**
```go
// 值传递 vs 引用传递
func modify(a int, s []int, m map[string]int) {
    a = 10          // 不影响外部
    s[0] = 10       // 影响外部（slice 是引用类型）
    m["a"] = 10     // 影响外部（map 是引用类型）
}

// 闭包
func counter() func() int {
    i := 0
    return func() int {
        i++
        return i
    }
}
```

**运行时层**
- **函数是一等公民**：可赋值给变量、作为参数、作为返回值
- **闭包实现**：捕获变量通过指针，闭包内部修改会影响外部
- **defer 栈**：LIFO 顺序

**面试高频**
```go
// 经典陷阱：循环变量闭包
for i := 0; i < 3; i++ {
    defer func() {
        fmt.Println(i)  // 全部输出 3！
    }()
}
// 修复：传参
for i := 0; i < 3; i++ {
    defer func(i int) {
        fmt.Println(i)  // 2, 1, 0
    }(i)
}

// 方法值 vs 方法表达式
v := User{Name: "Tom"}
f1 := v.String       // 方法值，绑定接收者
f2 := User.String    // 方法表达式，需显式传接收者
f1()                 // "Tom"
f2(v)                // "Tom"
```

---

## 模块二 小结

| 关键字 | 一句话考点 | 必会陷阱 |
|--------|-----------|----------|
| `struct` | 内存对齐、嵌入字段方法提升 | 嵌入不是继承，内存对齐优化 |
| `interface` | itab/eface、隐式实现 | 接口装指针 nil 不等于 nil |
| `map` | hmap/bmap、扩容、并发不安全 | nil map 可读不可写、value 不可寻址 |
| `chan` | hchan、无缓冲同步、关闭语义 | 关闭后写 panic、nil channel 永远阻塞 |
| `func` | 闭包、方法值/表达式、defer 栈 | 循环变量闭包陷阱 |

---

## 模块三：控制流（if / else / switch / case / for / range / break / continue / goto / fallthrough / default）

### 10. `if` / `else`

**语法层**
```go
if err := foo(); err != nil {
    // err 作用域仅限 if 块
    return err
}
// err 不可见
```

**运行时层**
- 带初始化的 `if` 是 Go 的惯用法，减少变量作用域污染
- `else` 必须和 `if` 的 `}` 同行（Go 的自动分号插入规则）

**面试陷阱**
```go
// 坑：else 的缩进陷阱
if x > 0 {
    return x
} 
else {  // 编译错误！else 不能换行
    return -x
}
```

---

### 11. `switch` / `case` / `fallthrough` / `default`

**语法层**
```go
// 表达式 switch
switch x := 1; x {
case 1:
    fmt.Println("one")
    fallthrough  // 继续执行下一个 case（不判断条件）
case 2:
    fmt.Println("two")  // 会输出
default:
    fmt.Println("other")
}

// 类型 switch
var i interface{} = 42
switch v := i.(type) {
case int:
    fmt.Println("int", v)
case string:
    fmt.Println("string", v)
default:
    fmt.Println("unknown")
}
```

**运行时层**
- Go 的 `switch` 默认 `break`，不需要写 `break`（与 C 相反）
- `fallthrough` 必须放在 case 最后，且不能是最后一个 case
- **类型 switch** 编译期生成 `type switch` 跳转表，比多次 `if-else` 高效

**面试高频**
```go
// 类型 switch 的编译优化
// 编译器会生成 itab 比较序列，常用类型优先

// 坑：fallthrough 穿透
switch 1 {
case 1:
    fmt.Println(1)
    fallthrough
case 2:
    fmt.Println(2)
    fallthrough
case 3:
    fmt.Println(3)  // 1 2 3 都会输出
}
```

---

### 12. `for` / `range`

**语法层**
```go
// 三种形式
for i := 0; i < 10; i++ {}     // C 风格
for condition {}               // while 风格
for {}                         // 死循环

// range
for k, v := range m {}         // map
for i, v := range s {}         // slice/array
for k := range m {}            // 只取 key
for _, v := range s {}         // 只取 value
```

**运行时层**
- **range 的副本陷阱**：`for _, v := range s` 中 `v` 是副本，不是元素本身
  ```go
  s := []int{1, 2, 3}
  for _, v := range s {
      v *= 2  // 不影响 s！
  }
  // 修复：用索引
  for i := range s {
      s[i] *= 2
  }
  ```

- **range map 的随机顺序**：每次运行顺序不同，不能依赖

- **range string 的 rune 遍历**：
  ```go
  for i, r := range "你好" {
      // i 是字节索引，r 是 rune（Unicode 码点）
      // i: 0, 3（不是 0, 1！因为 UTF-8 编码）
  }
  ```

**面试高频**
```go
// 经典面试题：range 的指针陷阱
type Item struct{ Val int }
items := []Item{{1}, {2}, {3}}
for _, item := range items {
    item.Val *= 10  // 不影响 items！item 是副本
}
// 修复：
for i := range items {
    items[i].Val *= 10
}

// 更隐蔽的坑：range + goroutine
for _, v := range []int{1, 2, 3} {
    go func() {
        fmt.Println(v)  // 可能全输出 3！
    }()
}
// 修复：传参
for _, v := range []int{1, 2, 3} {
    go func(v int) {
        fmt.Println(v)
    }(v)
}
```

---

### 13. `break` / `continue`

**语法层**
```go
// 带标签的 break/continue
OuterLoop:
for i := 0; i < 3; i++ {
    for j := 0; j < 3; j++ {
        if j == 1 {
            break OuterLoop  // 跳出外层循环
        }
    }
}
```

**运行时层**
- 标签 `break` 可以跳出任意层循环，这是 Go 没有 `while` 和 `do-while` 的补偿
- `continue` 同理

---

### 14. `goto`

**语法层**
```go
func foo() {
    i := 0
Loop:
    fmt.Println(i)
    i++
    if i < 3 {
        goto Loop  // 可以跳转到标签
    }
}
```

**限制**
- 不能跳过变量声明
- 不能跳入其他代码块
- 不能跳出函数
- 实际使用极少，面试了解即可

---

## 模块三 小结

| 关键字 | 一句话考点 | 必会陷阱 |
|--------|-----------|----------|
| `if` | 短变量声明、作用域控制 | else 不能换行 |
| `switch` | 默认 break、fallthrough、类型 switch | fallthrough 穿透条件 |
| `for/range` | 三种形式、range 副本 | range 中 v 是副本、goroutine 闭包 |
| `break/continue` | 标签跳转 | 标签作用域 |
| `goto` | 了解限制 | 几乎不用 |

---

## 模块四：并发核心（go / select / defer）

### 15. `go`

**语法层**
```go
go func() {
    // 新 goroutine
}()
```

**运行时层**
- **GMP 模型**：G（Goroutine，2KB 初始栈）→ M（OS Thread）→ P（Processor，逻辑处理器）
- **栈增长**：分段栈（Go 1.2-1.3）→ 连续栈（Go 1.4+），按需要 2x 扩容，1/2 收缩
- **调度**：work stealing（本地队列空时偷其他 P）、handoff（阻塞时释放 P）
- **抢占**：Go 1.14+ 基于信号的协作式抢占（sysmon 监控，10ms 强制切换）

**面试高频**
```go
// 坑：goroutine 泄漏
func leak() {
    ch := make(chan int)
    go func() {
        ch <- 1  // 无人接收，永久阻塞
    }()
    // 函数返回，goroutine 泄漏
}

// 坑：主 goroutine 退出
func main() {
    go func() {
        fmt.Println("hello")  // 可能不输出！
    }()
    // main 退出，所有 goroutine 强制结束
}
```

**对比**
- `go` vs `pthread`：Goroutine 是用户态线程，切换成本 ~200ns，比线程（~1μs）轻量
- `go` vs `async/await`：Go 是 CSP 模型（通信顺序进程），不是 Callback/Promise 模型

---

### 16. `select`

**语法层**
```go
select {
case v := <-ch1:
    // 从 ch1 读取
case ch2 <- v:
    // 向 ch2 写入
case <-time.After(1 * time.Second):
    // 超时
default:
    // 非阻塞
}
```

**运行时层**
- **随机公平性**：多个 case 同时 ready 时，随机选择一个（避免饥饿）
- **编译期转换**：`select` 被编译器转换为 `runtime.selectgo` 调用
- **default**：让 select 变为非阻塞
- **nil channel**：case 中的 nil channel 永远不会 ready

**面试高频**
```go
// 经典模式：超时控制
select {
case res := <-ch:
    // 处理结果
case <-time.After(500 * time.Millisecond):
    // 超时
}

// 经典模式：退出信号
for {
    select {
    case job := <-jobs:
        process(job)
    case <-done:
        return
    }
}

// 坑：select 中的 break 只跳出 select，不是外层循环
for {
    select {
    case <-ch:
        break  // 只跳出 select，不是 for！
    }
}
// 修复：带标签
Loop:
for {
    select {
    case <-ch:
        break Loop
    }
}
```

---

### 17. `defer`

**语法层**
```go
defer fmt.Println("world")  // LIFO 顺序
defer fmt.Println("hello")  // 先输出 hello，再 world
```

**运行时层**
- **LIFO 栈**：多个 defer 按逆序执行
- **参数求值**：defer 语句的参数在注册时求值，不是执行时
  ```go
  i := 0
  defer fmt.Println(i)  // 输出 0，不是 1
  i++
  ```
- **性能**：defer 有运行时开销（Go 1.13 优化后 ~1ns，之前 ~50ns）
- **panic 时**：defer 仍会执行，可用于资源清理

**面试高频**
```go
// 经典陷阱：defer 在循环中
for i := 0; i < 3; i++ {
    defer fmt.Println(i)  // 输出 2, 1, 0（LIFO）
}

// 坑：defer 闭包
for i := 0; i < 3; i++ {
    defer func() {
        fmt.Println(i)  // 全输出 3！
    }()
}
// 修复：传参
for i := 0; i < 3; i++ {
    defer func(i int) {
        fmt.Println(i)
    }(i)
}

// 经典模式：资源管理
func readFile(path string) error {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer f.Close()  // 确保关闭，即使 panic
    
    // 处理文件...
    return nil
}
```

**对比**
- `defer` vs `finally`：Go 没有 `finally`，`defer` 更灵活（可在任意位置注册）
- `defer` vs C++ RAII：Go 是显式 defer，C++ 是析构函数自动调用

---

## 模块四 小结

| 关键字 | 一句话考点 | 必会陷阱 |
|--------|-----------|----------|
| `go` | GMP、栈增长、抢占、泄漏 | main 退出子 goroutine 被强制结束 |
| `select` | 随机公平、编译期转换、nil channel | break 只跳出 select，不是外层循环 |
| `defer` | LIFO、参数求值时机、panic 仍执行 | 循环中的 defer 闭包陷阱 |

---

## 模块五：包管理（package / import）

### 18. `package`

**语法层**
```go
package main    // 可执行程序入口
package foo     // 库包

// 包名规范：小写、简短、有意义
```

**运行时层**
- `main` 包必须有 `func main()`，是程序入口
- 包级变量按声明顺序 + 依赖拓扑初始化
- `init()` 函数：无参无返回值，自动执行，按依赖顺序

**面试高频**
```go
// init 执行顺序
// 1. 导入包的 init（递归）
// 2. 包级变量初始化
// 3. 当前包的 init（按文件名字母顺序）

// 坑：init 的副作用
var config = loadConfig()  // 包级变量初始化时调用

func init() {
    // 可能 panic，导致程序无法启动
}
```

---

### 19. `import`

**语法层**
```go
import "fmt"
import (
    "fmt"
    f "fmt"          // 别名
    _ "fmt"          // 只执行 init，不使用包
    . "fmt"          // 导入到当前命名空间（不推荐）
)
```

**运行时层**
- `_` 导入：常用于数据库驱动注册（`import _ "github.com/lib/pq"`）
- 循环导入：编译错误，Go 不允许包循环依赖

**对比**
- Go 的 import vs Python 的 import：Go 是编译期确定，没有运行时动态导入

---

## 模块五 小结

| 关键字 | 一句话考点 | 必会陷阱 |
|--------|-----------|----------|
| `package` | init 顺序、main 入口 | init 副作用导致启动失败 |
| `import` | 别名、空白导入、循环依赖 | 循环导入编译错误 |

---

## 模块六：错误处理（return / panic / recover）

### 20. `return`

**语法层**
```go
// 命名返回值
func split(sum int) (x, y int) {
    x = sum * 4 / 9
    y = sum - x
    return  // 裸 return，返回命名变量当前值
}
```

**运行时层**
- 命名返回值在函数入口处就声明，作用域覆盖整个函数
- `defer` 可以修改命名返回值（因为 defer 在 return 之后执行）

**面试高频**
```go
// 经典陷阱：defer 修改命名返回值
func foo() (result int) {
    defer func() {
        result++  // return 后执行，result 变成 1
    }()
    return 0  // 实际返回 1
}
```

---

### 21. `panic` / `recover`

**语法层**
```go
func safeCall() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("Recovered:", r)
        }
    }()
    panic("something went wrong")
}
```

**运行时层**
- **panic 传播**：沿调用栈向上，直到被 `recover` 或程序崩溃
- **recover 限制**：必须在 `defer` 中调用，直接调用无效
- **panic 时 defer 仍执行**：利用这一点做资源清理

**面试高频**
```go
// 坑：recover 不在 defer 中
func wrong() {
    if r := recover(); r != nil {  // 无效！
        fmt.Println("recovered")
    }
    panic("oops")
}

// 坑：goroutine 内的 panic 不能被外层 recover
func main() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("recovered")  // 不会执行！
        }
    }()
    go func() {
        panic("goroutine panic")  // 直接崩溃整个程序
    }()
    time.Sleep(1 * time.Second)
}

// 正确做法：每个 goroutine 内 recover
go func() {
    defer func() {
        if r := recover(); r != nil {
            log.Println("recovered in goroutine")
        }
    }()
    // 业务代码...
}()
```

**对比**
- `panic/recover` vs `try/catch`：Go 不推荐用 panic 做常规错误处理，只用于不可恢复的错误
- `error` vs `panic`：可预期的错误用 `error` 返回值，程序 bug 用 `panic`

---

## 模块六 小结

| 关键字 | 一句话考点 | 必会陷阱 |
|--------|-----------|----------|
| `return` | 命名返回值、裸 return | defer 可修改命名返回值 |
| `panic` | 调用栈展开、defer 仍执行 | goroutine 内 panic 无法被外层 recover |
| `recover` | 必须在 defer 中 | 直接调用 recover 无效 |

---

## 总复习：面试速查表

| 模块 | 核心关键字 | 最高频考点 |
|------|-----------|-----------|
| 数据声明 | var, const, type, nil | 接口 nil 陷阱、iota、无类型常量 |
| 复合类型 | struct, interface, map, chan, func | 内存对齐、itab/eface、map 并发、channel 关闭语义、闭包 |
| 控制流 | if, switch, for, range, break, continue | range 副本陷阱、switch 默认 break、标签 break |
| 并发核心 | go, select, defer | GMP 调度、select 随机性、defer LIFO + 参数求值 |
| 包管理 | package, import | init 顺序、循环依赖 |
| 错误处理 | return, panic, recover | 命名返回值 + defer、recover 必须在 defer 中 |

---

**下一步**：你可以挑一个模块深入，比如：
- "给我出 10 道 `interface` 面试题"
- "详细讲一下 `map` 的扩容源码"
- "GMP 调度器的 work stealing 机制"

或者直接进入 **模块二：复合类型** 的源码级讲解？