# Go 语言特性全景

这是一份系统的 Go 语言特性文档，覆盖从语法到语义的所有核心机制。每个特性按「是什么 → 怎么用 → 底层原理 → 常见陷阱 → 工程建议」的结构展开。

---

## 目录

1. [程序结构](#1-程序结构)
2. [变量与常量](#2-变量与常量)
3. [基本类型与零值](#3-基本类型与零值)
4. [控制流](#4-控制流)
5. [函数](#5-函数)
6. [指针](#6-指针)
7. [数组与切片](#7-数组与切片)
8. [Map](#8-map)
9. [Struct 与 Embedding](#9-struct-与-embedding)
10. [方法与方法集](#10-方法与方法集)
11. [Interface](#11-interface)
12. [类型断言与类型转换](#12-类型断言与类型转换)
13. [泛型](#13-泛型)
14. [Goroutine 与 Channel](#14-goroutine-与-channel)
15. [Select](#15-select)
16. [错误处理](#16-错误处理)
17. [Panic 与 Recover](#17-panic-与-recover)
18. [Defer](#18-defer)
19. [内置函数](#19-内置函数)
20. [Nil 的完整语义](#20-nil-的完整语义)

---

## 1. 程序结构

### 1.1 包声明

```go
package main              // 可执行程序入口包
package utils             // 库包
```

- 包名应该简短、小写、无下划线
- 包名与目录名无关，但通常一致
- `main` 包是特殊的：必须包含 `func main()`，编译为可执行文件

### 1.2 导入

```go
import "fmt"
import (
    "fmt"
    "os"
    
    "github.com/example/lib"  // 第三方包
)

// 别名导入
import f "fmt"
import . "fmt"              // 直接导入到当前命名空间（不推荐）
import _ "image/png"       // 只执行包的 init()，不使用包名
```

- 未使用的导入会导致编译错误
- `_` 导入用于注册 side effect（如数据库驱动注册、图像格式注册）

### 1.3 可见性

```go
package mypkg

var PublicVar int      // 首字母大写 = 包外可见（exported）
var privateVar int     // 首字母小写 = 包内私有

type ExportedType struct{}
type unexportedType struct{}
```

- Go 没有 `public`/`private` 关键字，只靠首字母大小写
- 这是「显式优于隐式」的极简体现

### 1.4 `init` 函数

```go
func init() {
    // 包初始化时自动执行，无参数无返回值
}
```

- 一个包可以有多个 `init` 函数（甚至一个文件多个）
- 执行顺序：按文件名字母顺序，文件内按声明顺序
- 用于包级状态初始化，但避免复杂逻辑

---

## 2. 变量与常量

### 2.1 变量声明

```go
// 完整声明
var x int = 10

// 类型推导
var x = 10              // 编译器推导为 int
var s = "hello"         // 推导为 string

// 零值初始化
var x int               // x == 0
var s string            // s == ""
var p *int              // p == nil

// 多变量
var x, y int = 1, 2
var x, y = 1, "hello"   // 混合类型

// 组声明
var (
    name = "Go"
    version = 1.21
)
```

### 2.2 短变量声明

```go
x := 10                 // 只能在函数内使用
x, y := 1, 2            // 多变量
```

**重声明规则**：短变量声明中，至少有一个变量是新声明的，其他变量可以是已存在的（赋值）。

```go
x := 1
x, y := 2, 3            // ✅ x 被重新赋值，y 是新声明的
x, z := 4, 5            // ✅
```

### 2.3 常量

```go
const Pi = 3.14159      // 无类型常量
const MaxSize = 100     // 无类型整数常量

const (
    Sunday = iota       // 0
    Monday              // 1
    Tuesday             // 2
)

const (
    _ = iota            // 跳过 0
    KB = 1 << (10 * iota)  // 1 << 10 = 1024
    MB = 1 << (10 * iota)  // 1 << 20 = 1048576
    GB = 1 << (10 * iota)  // 1 << 30
)
```

**无类型常量**：

```go
const Big = 1 << 100    // 可以存储任意精度
var x int64 = Big       // 赋值时才检查是否能放入 int64
```

### 2.4 类型定义与别名

```go
type Age int            // 定义新类型，与 int 不兼容
type Age = int          // 类型别名，完全等价

var a Age = 20
var i int = a           // ❌ 类型不匹配
var j int = int(a)      // ✅ 显式转换
```

---

## 3. 基本类型与零值

### 3.1 类型体系

```
基本类型
├── 布尔：bool
├── 整数：int, int8, int16, int32, int64
│         uint, uint8, uint16, uint32, uint64, uintptr
├── 浮点：float32, float64
├── 复数：complex64, complex128
├── 字符串：string（不可变 UTF-8 序列）
└── 字节：byte（uint8 别名）, rune（int32 别名，Unicode 码点）

复合类型
├── array：[N]T
├── slice：[]T
├── map：map[K]V
├── struct：struct{ ... }
├── pointer：*T
├── function：func(...)
├── channel：chan T
└── interface：interface{ ... }
```

### 3.2 零值

| 类型 | 零值 |
|------|------|
| bool | false |
| 数字 | 0 |
| string | "" |
| 指针 | nil |
| slice | nil |
| map | nil |
| channel | nil |
| function | nil |
| interface | nil |
| struct | 各字段零值 |

**零值设计原则**：Go 保证所有变量初始化时都有确定的零值，不会留下未定义状态。

### 3.3 String

```go
s := "Hello, 世界"

// 字符串是不可变的
s[0] = 'h'              // ❌ 编译错误

// 遍历
for i := 0; i < len(s); i++ {
    // s[i] 是 byte（uint8）
}

for i, r := range s {
    // i = 字节索引，r = rune（Unicode 码点）
}

// 转换
b := []byte(s)          // 拷贝
r := []rune(s)          // 解码为 rune 切片
```

- `string` 底层是只读的 byte 数组
- `len(s)` 返回字节数，不是字符数
- `string` ↔ `[]byte` 转换会复制数据

---

## 4. 控制流

### 4.1 `if`

```go
if x > 0 {
    // ...
} else if x < 0 {
    // ...
} else {
    // ...
}

// 短声明：err 作用域只在 if-else 块内
if err := doSomething(); err != nil {
    return err
}
```

### 4.2 `for` — 唯一循环关键字

```go
// C 风格
for i := 0; i < 10; i++ {
    fmt.Println(i)
}

// 条件循环（while 风格）
for condition {
    // ...
}

// 无限循环
for {
    // ...
}

// range 循环
for i, v := range slice {      // i=索引, v=副本（注意是复用变量）
    // ...
}

for k, v := range map {        // 遍历顺序随机
    // ...
}

for i, r := range string {     // i=字节索引, r=rune
    // ...
}

for i := range slice {         // 只取索引
    // ...
}

for range slice {              // 只遍历，不关心值
    // ...
}
```

**Range 的陷阱**：go 1.21以及之前

```go
items := []string{"a", "b", "c"}
for _, item := range items {
    go func() {
        fmt.Println(item)      // ❌ 全是 "c"
    }()
}

// 修正
for _, item := range items {
    item := item               // 创建局部副本
    go func() {
        fmt.Println(item)
    }()
}
```

Go 1.21 及之前：item 在整个循环中只有一个实例，每次迭代只是复用同一个变量重新赋值。三个 goroutine 都指向同一个 item，等它们执行时循环已结束，item 的值是 "c"。所以大概率输出 c c c（顺序不定）。
Go 1.22+：循环变量改为 per-iteration 语义，每次迭代都会创建一个新的 item 实例。三个 goroutine 各自捕获自己那一轮迭代的变量，输出就是 a b c（顺序不定）。

### 4.3 `switch`

```go
// 表达式 switch
switch x {
case 1, 2, 3:                  // 多值匹配
    fmt.Println("small")
case 4, 5:
    fmt.Println("medium")
default:
    fmt.Println("large")
}

// 类型 switch
switch v := x.(type) {
case int:
    fmt.Printf("int: %d\n", v)
case string:
    fmt.Printf("string: %s\n", v)
case nil:
    fmt.Println("nil")
default:
    fmt.Printf("unknown: %T\n", v)
}

// 无条件 switch（更清晰的 if-else）
switch {
case x < 0:
    fmt.Println("negative")
case x > 0:
    fmt.Println("positive")
default:
    fmt.Println("zero")
}
```

**注意**：Go 的 switch 默认不穿透。需要穿透时用 `fallthrough`。

### 4.4 `goto`、`break`、`continue`

```go
// goto：跳转到同一函数内的标签
for i := 0; i < 10; i++ {
    for j := 0; j < 10; j++ {
        if found(i, j) {
            goto FOUND
        }
    }
}
return
FOUND:
    fmt.Println("found!")

// break 标签：跳出多层循环
OUTER:
for i := 0; i < 10; i++ {
    for j := 0; j < 10; j++ {
        if done(i, j) {
            break OUTER
        }
    }
}
```

---

## 5. 函数

### 5.1 函数声明

```go
// 基本函数
func add(a, b int) int {
    return a + b
}

// 多返回值（Go 的标志性特性）
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

// 命名返回值
func split(sum int) (x, y int) {
    x = sum * 4 / 9
    y = sum - x
    return          // 裸 return，返回命名变量当前值
}

// 变参
func sum(nums ...int) int {
    total := 0
    for _, n := range nums {
        total += n
    }
    return total
}
sum(1, 2, 3)
sum(slice...)    // 展开 slice
```

### 5.2 函数是一等公民

```go
// 函数作为参数
func apply(a, b int, f func(int, int) int) int {
    return f(a, b)
}

// 函数作为返回值
func makeMultiplier(factor int) func(int) int {
    return func(x int) int {
        return x * factor
    }
}

// 函数值比较
var f func(int) int
fmt.Println(f == nil)   // true，函数零值是 nil
// 非 nil 的函数值只能用 == nil 比较，不能互相比较
```

### 5.3 闭包

```go
func makeCounter() func() int {
    count := 0
    return func() int {
        count++
        return count
    }
}

c1 := makeCounter()
c2 := makeCounter()
fmt.Println(c1())  // 1
fmt.Println(c1())  // 2
fmt.Println(c2())  // 1（独立的闭包）
```

**闭包捕获的是引用，不是值拷贝**。

### 5.4 递归

```go
func factorial(n int) int {
    if n <= 1 {
        return 1
    }
    return n * factorial(n-1)
}
```

Go 编译器支持尾递归优化（有限）。

### 5.5 方法表达式与方法值

```go
type Point struct{ X, Y float64 }
func (p Point) Distance(q Point) float64 { ... }

// 方法值：绑定接收者
p := Point{1, 2}
f := p.Distance            // func(Point) float64

// 方法表达式：不绑定接收者
g := Point.Distance        // func(Point, Point) float64
```

---

## 6. 指针

详见 [`pointers.md`](pointers.md)。核心要点：

- Go 有指针，但没有指针算术
- `&` 取地址，`*` 解引用
- 指针的零值是 `nil`，解引用 `nil` 指针 panic
- 选择值传递还是指针传递取决于：大小、是否需要修改、并发安全
- `new(T)` 分配零值内存并返回 `*T`

---

## 7. 数组与切片

### 7.1 数组

```go
var a [5]int              // [0 0 0 0 0]
b := [5]int{1, 2, 3}      // [1 2 3 0 0]
c := [...]int{1, 2, 3}    // 编译器数长度：[3]int
```

- 数组是值类型：赋值和传参会复制整个数组
- 数组长度是类型的一部分：`[3]int` 和 `[5]int` 是不同类型

### 7.2 切片

```go
s := []int{1, 2, 3}       // 字面量创建
s := make([]int, 5)       // len=5, cap=5, 全零值
s := make([]int, 3, 10)   // len=3, cap=10

// 从数组创建切片
arr := [5]int{1, 2, 3, 4, 5}
s := arr[1:3]             // [2, 3]，底层共享 arr
```

**内部结构**：

```go
type sliceHeader struct {
    Data unsafe.Pointer   // 指向底层数组
    Len  int              // 长度
    Cap  int              // 容量
}
```

### 7.3 `append`

```go
s := []int{1, 2}
s = append(s, 3)          // [1, 2, 3]
s = append(s, 4, 5)       // [1, 2, 3, 4, 5]
s = append(s, other...)   // 展开 slice
```

**扩容策略**：
- 原容量 < 1024：新容量 ≈ 原容量 × 2
- 原容量 ≥ 1024：新容量 ≈ 原容量 × 1.25
- 具体策略由运行时决定，不是语言规范

**陷阱**：append 可能导致底层数组重新分配，使旧的 slice 引用失效。

### 7.4 `copy`

```go
dst := make([]int, 3)
src := []int{1, 2, 3, 4, 5}
n := copy(dst, src)       // n = 3，复制 min(len(dst), len(src)) 个元素
```

### 7.5 `nil` slice vs `empty` slice

```go
var s1 []int              // nil slice：ptr=nil, len=0, cap=0
s2 := []int{}             // empty slice：ptr!=nil, len=0, cap=0
s3 := make([]int, 0)      // empty slice

// 行为差异
fmt.Println(s1 == nil)    // true
fmt.Println(s2 == nil)    // false

// 但 JSON 序列化时可能不同
json.Marshal(s1)          // null
json.Marshal(s2)          // []
```

---

## 8. Map

### 8.1 基本用法

```go
m := make(map[string]int)
m["key"] = 1

v := m["key"]             // 取值，key 不存在返回零值
v, ok := m["key"]         // 取值 + 存在性检查

delete(m, "key")          // 删除

len(m)                    // 键值对数量
```

### 8.2 核心特性

- map 是引用类型（描述符），零值是 `nil`
- `nil` map 可以读，不能写：

```go
var m map[string]int
fmt.Println(m["key"])     // ✅ 返回 0
m["key"] = 1              // ❌ panic: assignment to entry in nil map
```

- map 的遍历顺序是随机的（故意设计，防止依赖特定顺序）
- key 必须是可比较类型（支持 `==`）

### 8.3 并发安全

```go
// ❌ map 不是并发安全的，同时读写会 panic
var m = make(map[int]int)
go func() { m[1] = 1 }()
go func() { _ = m[1] }()
```

解决方案：
- `sync.RWMutex` + map
- `sync.Map`（特定场景）

### 8.4 底层实现要点

- 哈希表 + 桶（bucket）结构
- 每个桶 8 个键值对
- 渐进式扩容（不是一次性复制）
- `map[k]` 不能取地址：因为 rehash 会改变存储位置

---

## 9. Struct 与 Embedding

### 9.1 基本语法

```go
type Point struct {
    X, Y float64
}

// 字面量
p := Point{X: 1, Y: 2}    // 命名字段
p := Point{1, 2}          // 按位置（不推荐，易出错）
p := Point{Y: 2}          // 部分字段，其他为零值

// 指针
pp := &Point{X: 1, Y: 2}  // 可以直接取地址
```

### 9.2 嵌入（Embedding）

```go
type Animal struct {
    Name string
}
func (a Animal) Speak() string { return "..." }

type Dog struct {
    Animal              // 嵌入，不是继承
    Breed string
}

// Dog 自动获得 Name 字段和 Speak 方法
d := Dog{Animal: Animal{Name: "Buddy"}, Breed: "Golden"}
fmt.Println(d.Name)       // "Buddy"（提升字段）
fmt.Println(d.Speak())    // "..."（提升方法）
```

**嵌入 vs 继承**：
- 嵌入只是语法糖：字段和方法提升到外层
- 没有 "is-a" 关系：`Dog` 不是 `Animal` 的子类
- 内层字段仍然可以通过 `d.Animal.Name` 访问

### 9.3 嵌入接口

```go
type ReadWriter struct {
    io.Reader       // 嵌入接口
    io.Writer       // 嵌入接口
}

// ReadWriter 自动满足 io.ReadWriter
var _ io.ReadWriter = (*ReadWriter)(nil)
```

---

## 10. 方法与方法集

详见 [`methods.md`](methods.md)。核心要点：

- 方法 = 绑定到类型的函数
- 值接收者：操作副本，不修改原值
- 指针接收者：操作原值，可修改
- 方法集决定接口满足性
- 嵌入类型的方法自动提升

---

## 11. Interface

详见 [`interfaces.md`](interfaces.md)。核心要点：

- 接口是方法集的约束
- 隐式实现：不需要声明 `implements`
- 接口值 = 动态类型 + 动态值
- nil interface 陷阱
- 类型断言与类型开关
- 小接口优先

---

## 12. 类型断言与类型转换

### 12.1 显式类型转换

```go
var i int = 10
var f float64 = float64(i)    // 必须显式转换

// 规则
// 同族数字类型可以互相转换
// 字符串和 []byte/[]rune 可以转换（有拷贝）
// 指针类型可以转换为 unsafe.Pointer
```

### 12.2 类型断言

```go
var i interface{} = "hello"

// 安全断言
s, ok := i.(string)           // s="hello", ok=true
n, ok := i.(int)              // n=0, ok=false

// 不安全断言
s := i.(string)               // ✅
n := i.(int)                  // ❌ panic
```

### 12.3 类型开关

```go
switch v := x.(type) {
case int:
    fmt.Printf("int: %d\n", v)
case string:
    fmt.Printf("string: %s\n", v)
case []byte:
    fmt.Printf("bytes: %v\n", v)
default:
    fmt.Printf("unknown: %T\n", v)
}
```

### 12.4 类型别名

```go
type MyInt = int              // 别名，完全等价
type YourInt int              // 新类型

var i int = 1
var m MyInt = i               // ✅ 别名完全等价
var y YourInt = i             // ❌ 需要显式转换
```

---

## 13. 泛型

### 13.1 基本语法（Go 1.18+）

```go
// 泛型函数
func Min[T constraints.Ordered](a, b T) T {
    if a < b {
        return a
    }
    return b
}

// 泛型类型
type Stack[T any] struct {
    items []T
}

func (s *Stack[T]) Push(item T) {
    s.items = append(s.items, item)
}

func (s *Stack[T]) Pop() T {
    var zero T
    if len(s.items) == 0 {
        return zero
    }
    item := s.items[len(s.items)-1]
    s.items = s.items[:len(s.items)-1]
    return item
}

// 使用
s := Stack[int]{}
s.Push(1)
```

### 13.2 类型约束

```go
// 内置约束
[T any]                      // 任意类型
[T comparable]               // 支持 == 和 !=
[T constraints.Ordered]      // 支持 < > <= >=（数字、字符串）

// 自定义约束
type Number interface {
    constraints.Integer | constraints.Float
}

func Sum[T Number](values []T) T {
    var sum T
    for _, v := range values {
        sum += v
    }
    return sum
}

// ~ 表示底层类型
[T ~int]                     // 接受底层类型为 int 的所有类型（如 type MyInt int）
```

### 13.3 限制

- 不能用于方法（只能用泛型函数或泛型类型）
- 不能将类型参数用于类型断言
- 结构体字段不能用类型参数
- 没有特化（specialization）：不能为特定类型提供不同实现

### 13.4 实现机制

- GC shape stenciling + dictionaries
- 不是 C++ 模板的文本替换
- 编译器根据 GC shape（指针 vs 值）生成代码，减少代码膨胀

---

## 14. Goroutine 与 Channel

### 14.1 Goroutine

```go
go func() {
    fmt.Println("running in goroutine")
}()
```

- 轻量级线程：初始栈 2KB，动态增长
- `go` 语句立即返回，不等待 goroutine 完成
- `go` 之前的操作 happens-before goroutine 内的操作

### 14.2 Channel

```go
// 创建
ch := make(chan int)          // 无缓冲（同步）
ch := make(chan int, 10)      // 有缓冲（异步）

// 发送与接收
ch <- value                   // 发送
value := <-ch                 // 接收
value, ok := <-ch             // 接收 + 检测通道是否关闭

// 关闭
close(ch)
```

**方向约束**：

```go
func send(ch chan<- int) { ch <- 1 }     // 只发送
func recv(ch <-chan int) int { return <-ch }  // 只接收
```

**Channel 语义**：

| 操作 | 未关闭 | 已关闭 | nil |
|------|--------|--------|-----|
| 发送 | 阻塞/写入 | panic | 永久阻塞 |
| 接收 | 阻塞/读取 | 读零值+false | 永久阻塞 |
| 关闭 | 关闭成功 | panic | panic |

### 14.3 缓冲 channel 用于信号量

```go
// 限制并发度为 3
sem := make(chan struct{}, 3)
for _, task := range tasks {
    sem <- struct{}{}         // 获取信号量
    go func(t Task) {
        defer func() { <-sem }()  // 释放信号量
        process(t)
    }(task)
}
// 等待所有完成
for i := 0; i < cap(sem); i++ {
    sem <- struct{}{}
}
```

---

## 15. Select

```go
select {
case v := <-ch1:
    // 从 ch1 接收
    fmt.Println("ch1:", v)
case ch2 <- value:
    // 向 ch2 发送
    fmt.Println("sent to ch2")
case <-time.After(5 * time.Second):
    // 超时
    fmt.Println("timeout")
default:
    // 非阻塞
    fmt.Println("no channel ready")
}
```

- 多个 case 就绪时**随机**选择（防止饥饿）
- `default` 使 select 变为非阻塞
- `nil channel` 的 case 永远不会被选中（可用于动态开关）
- `time.After` 在循环中的泄漏问题：每次迭代创建新 timer

---

## 16. 错误处理

### 16.1 基本模式

```go
f, err := os.Open("file.txt")
if err != nil {
    return fmt.Errorf("open file: %w", err)
}
defer f.Close()
```

### 16.2 错误链（Go 1.13+）

```go
if err != nil {
    return fmt.Errorf("operation failed: %w", err)
}

// 检查
if errors.Is(err, os.ErrNotExist) { ... }      // 检查错误链中是否有特定错误
var pathErr *os.PathError
if errors.As(err, &pathErr) { ... }             // 提取特定错误类型
```

### 16.3 Sentinel Error

```go
var ErrNotFound = errors.New("not found")
```

### 16.4 自定义错误类型

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

// 使用
var ve *ValidationError
if errors.As(err, &ve) {
    fmt.Println(ve.Field)
}
```

---

## 17. Panic 与 Recover

### 17.1 Panic

```go
panic("something went wrong")          // 引发 panic
panic(err)                             // 也可以 panic 一个 error
```

- panic 会停止当前 goroutine 的正常执行
- 展开调用栈，执行 defer 函数
- 如果没有 recover，程序崩溃

### 17.2 Recover

```go
func safeCall() {
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("recovered:", r)
        }
    }()
    mightPanic()
}
```

**重要限制**：
- `recover` 必须在 `defer` 函数中调用
- 只能恢复当前 goroutine 的 panic
- 恢复后继续执行，不是重新执行 panic 点

### 17.3 使用原则

| 场景 | 处理方式 |
|------|---------|
| 可预期的错误（文件不存在、网络超时） | 返回 `error` |
| 编程错误（数组越界、nil 指针解引用） | `panic`（由运行时自动触发） |
| 不可恢复的状态（初始化失败） | 可以 `panic`，但通常用 `log.Fatal` |
| HTTP handler panic | 用 middleware recover，返回 500 |

---

## 18. Defer

```go
func f() {
    defer fmt.Println("3")
    defer fmt.Println("2")
    defer fmt.Println("1")
    fmt.Println("0")
}
// 输出：0 1 2 3（LIFO）
```

### 18.1 核心语义

- defer 在函数返回前按**后进先出**执行
- 参数在 defer 语句处求值（不是执行时）

```go
i := 0
defer fmt.Println(i)      // 输出 0（参数立即求值）
i++
```

### 18.2 修改返回值

```go
func doubleSum(a, b int) (sum int) {
    defer func() {
        sum *= 2          // 修改命名返回值
    }()
    sum = a + b
    return                // 等价于 return sum
}
```

### 18.3 defer 与闭包

```go
// ❌ 常见错误：循环中 defer
for _, f := range files {
    defer f.Close()       // f 是复用变量，最终只关闭最后一个
}

// ✅ 修正
for _, f := range files {
    f := f                // 创建局部副本
    defer f.Close()
}
```

### 18.4 defer 的开销

- defer 有性能开销（约几十纳秒）
- 热路径中避免 defer
- Go 1.14+ 优化了 defer 的性能，但仍非零成本

---

## 19. 内置函数

| 函数 | 用途 | 示例 |
|------|------|------|
| `append` | 向 slice 追加元素 | `s = append(s, 1)` |
| `copy` | 复制 slice | `n := copy(dst, src)` |
| `delete` | 删除 map 键 | `delete(m, "key")` |
| `len` | 长度 | `len(s)`, `len(m)` |
| `cap` | 容量 | `cap(s)` |
| `make` | 创建 slice/map/channel | `make([]int, 10)` |
| `new` | 分配零值内存 | `new(int)` 返回 `*int` |
| `panic` | 引发 panic | `panic("error")` |
| `recover` | 恢复 panic | 必须在 defer 中 |
| `close` | 关闭 channel | `close(ch)` |
| `complex` | 创建复数 | `complex(1, 2)` |
| `real` / `imag` | 复数实部/虚部 | `real(c)` |

---

## 20. Nil 的完整语义

### 20.1 Nil 不是类型

`nil` 是预声明标识符，没有统一类型。它的含义取决于上下文：

```go
var p *int = nil
var s []int = nil
var m map[int]int = nil
var c chan int = nil
var f func() = nil
var i interface{} = nil
```

### 20.2 各类型的 nil 行为

| 类型 | nil 值 | 可读 | 可写 | 特殊行为 |
|------|--------|------|------|---------|
| 指针 | 不指向任何内存 | panic | panic | - |
| slice | ptr=nil, len=0, cap=0 | ✅（零值） | ✅（append 会分配） | `len(nil) == 0` |
| map | 未初始化 | ✅（返回零值） | ❌ panic | 必须用 make |
| channel | 未初始化 | 永久阻塞 | 永久阻塞 | `nil chan` 在 select 中禁用 case |
| function | 未赋值 | panic | - | 只能用 `== nil` 比较 |
| interface | tab=nil, data=nil | - | - | `i == nil` |

### 20.3 Interface nil 陷阱

```go
var p *int = nil
var i interface{} = p
fmt.Println(i == nil)     // false！

// 原因：
// i 的结构是 {tab: *int类型信息, data: nil}
// interface 为 nil 的条件是 tab == nil 且 data == nil
```

### 20.4 安全判断

```go
// 接口是否 nil
if i != nil {
    if p, ok := i.(*MyType); ok && p != nil {
        // 安全使用
    }
}

// 函数是否 nil
if f != nil {
    f()
}

// map 是否 nil
if m != nil {
    m["key"] = 1
}
```

---

## 关联文件

- 指针深入：[`pointers.md`](pointers.md)
- 接口深入：[`interfaces.md`](interfaces.md)
- 方法深入：[`methods.md`](methods.md)
- 关键字速查：[`keywords.md`](keywords.md)
