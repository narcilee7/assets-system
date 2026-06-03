# Go 关键字全景

Go 只有 25 个关键字，这是「少即是多」最直接的体现。

```go
break        default      func         interface      select
case         defer        go           map            struct
chan         else         goto         package        switch
const        fallthrough  if           range          type
continue     for          import       return         var
```

---

## 1. 声明与定义

| 关键字 | 作用 | 示例 |
|--------|------|------|
| `var` | 变量声明 | `var x int = 1` |
| `const` | 常量声明 | `const Pi = 3.14` |
| `type` | 类型定义/别名 | `type Age int` |
| `func` | 函数/方法声明 | `func f() {}` |
| `package` | 包声明 | `package main` |
| `import` | 包导入 | `import "fmt"` |

### 1.1 `var` 的多种形态

```go
var x int           // 零值初始化
var x = 1           // 类型推导
var x int = 1       // 显式类型
var x, y = 1, 2     // 多变量
var (               // 组声明
    a = 1
    b = 2
)

x := 1              // 短变量声明，只能在函数内
x, y := 1, 2        // 至少一个变量是新声明的
```

### 1.2 `const` 与 iota

```go
const (
    Sunday = iota    // 0
    Monday           // 1
    Tuesday          // 2
)
```

- `iota` 在 const 组内逐行递增
- 常量只能是基本类型：布尔、数字、字符串
- 无类型常量：`const Big = 1 << 100`（直到赋值时才确定类型）

### 1.3 `type` 的两种语义

```go
type Age int          // 定义新类型，与 int 不兼容
type Age = int        // 类型别名，完全等价

var a Age = 1
var b int = a         // ❌ 新类型不能隐式转换
var c int = int(a)    // ✅ 显式转换
```

---

## 2. 控制流

| 关键字 | 作用 |
|--------|------|
| `if` / `else` | 条件分支 |
| `for` | 唯一循环关键字 |
| `switch` / `case` / `default` / `fallthrough` | 多路分支 |
| `break` | 跳出循环/switch |
| `continue` | 跳过本次迭代 |
| `goto` | 跳转到标签 |
| `return` | 函数返回 |

### 2.1 `if` 的短声明

```go
if err := doSomething(); err != nil {
    return err
}
// err 作用域只在 if 块内
```

### 2.2 `for` 的三副面孔

```go
// C 风格
for i := 0; i < 10; i++ { ... }

// while 风格（条件循环）
for condition { ... }

// 无限循环
for { ... }

// range 风格
for i, v := range slice { ... }
for k, v := range map { ... }
for i, r := range string { ... }  // r 是 rune，i 是字节索引
```

### 2.3 `switch` 的灵活

```go
// 表达式 switch
switch x {
case 1, 2, 3:
    // 多值匹配
    fallthrough       // 继续执行下一个 case（默认不穿透）
case 4:
    // ...
default:
    // ...
}

// 类型 switch
switch v := x.(type) {
case int:
    fmt.Println("int:", v)
case string:
    fmt.Println("string:", v)
default:
    fmt.Println("unknown")
}

// 无条件 switch（更清晰的 if-else 链）
switch {
case x < 0:
    // ...
case x > 0:
    // ...
default:
    // ...
}
```

### 2.4 `goto` 的合法使用

```go
func find() {
    for i := 0; i < 10; i++ {
        for j := 0; j < 10; j++ {
            if found(i, j) {
                goto DONE
            }
        }
    }
    return
DONE:
    fmt.Println("found")
}
```

- 只能跳转到同一函数内的标签
- 不能跳入块、跳过变量声明
- 用于深层嵌套中的快速跳出

---

## 3. 并发与通信

| 关键字 | 作用 |
|--------|------|
| `go` | 启动 goroutine |
| `chan` | channel 类型 |
| `select` | 多路 channel 等待 |

### 3.1 `go` 语句

```go
go func() { ... }()     // 立即在后台执行
```

- `go` 之前的操作 happens-before goroutine 内操作
- 不等待、不返回值、不处理 panic

### 3.2 `chan` 的方向

```go
ch := make(chan int)      // 双向
var rc <-chan int = ch    // 只接收
var sc chan<- int = ch    // 只发送
```

### 3.3 `select` 的行为

```go
select {
case v := <-ch1:
    // ...
case ch2 <- value:
    // ...
default:
    // 非阻塞
}
```

- 多个 case 就绪时**随机**选择
- 无 default 且全部阻塞时挂起
- `nil channel` 的 case 永远不会被选中

---

## 4. 复合类型

| 关键字 | 作用 |
|--------|------|
| `struct` | 结构体类型 |
| `interface` | 接口类型 |
| `map` | 映射类型 |

### 4.1 `struct` 与 embedding

```go
type Animal struct {
    Name string
}

type Dog struct {
    Animal          // embedding，自动提升方法
    Breed string
}

d := Dog{Animal: Animal{Name: "Buddy"}, Breed: "Golden"}
fmt.Println(d.Name)  // 直接访问嵌入字段的方法
```

### 4.2 `interface` 的隐式实现

```go
type Reader interface {
    Read([]byte) (int, error)
}

// 任何有 Read 方法的类型自动满足 Reader
// 不需要声明 "implements Reader"
```

### 4.3 `map` 的声明与使用

```go
var m map[string]int          // nil map，不能写入
m = make(map[string]int)      // 初始化
m["key"] = 1

v, ok := m["key"]             // 取值 + 存在性检查
```

---

## 5. 延迟与跳转

| 关键字 | 作用 |
|--------|------|
| `defer` | 延迟执行到函数返回前 |
| `fallthrough` | switch case 穿透 |

### 5.1 `defer` 的核心语义

```go
func f() {
    defer fmt.Println("3")
    defer fmt.Println("2")
    defer fmt.Println("1")
    fmt.Println("0")
}
// 输出：0 1 2 3（LIFO）
```

- defer 在函数返回前按**后进先出**执行
- 参数在 defer 语句处求值（不是执行时）
- 与命名返回值配合可修改返回值

```go
func doubleSum(a, b int) (sum int) {
    defer func() {
        sum *= 2  // 修改命名返回值
    }()
    sum = a + b
    return       // 等价于 return sum
}
```

---

## 6. 关键字的缺失（设计意图）

| 常见语言有，Go 没有 | 原因 |
|-------------------|------|
| `class` | 没有类继承模型 |
| `public`/`private`/`protected` | 首字母大小写控制可见性 |
| `try`/`catch`/`finally` | 没有异常机制，用 error + defer |
| `while`/`do-while` | `for` 覆盖所有循环场景 |
| `extends`/`implements` | embedding + 隐式接口 |
| `new`（作为关键字） | `new` 是内置函数，不是关键字 |
| `this`/`self` | 接收者显式命名 |

---

## 7. 关键字数量对比

| 语言 | 关键字数量 |
|------|-----------|
| Go | **25** |
| C | 32 |
| Python | 35 |
| Java | 50+ |
| C++ | 90+（含保留字） |

Go 的少关键字不是功能缺失，而是**正交设计**的结果：`for` 覆盖三种循环，`switch` 覆盖表达式/类型/无条件三种场景。
