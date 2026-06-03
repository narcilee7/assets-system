# 指针深度解析

Go 的指针是 C 指针的简化版：有地址、能解引用，但没有指针算术。

---

## 1. 基础语法

```go
var x int = 10
var p *int = &x     // 取地址
fmt.Println(*p)      // 解引用，输出 10
*p = 20              // 通过指针修改
```

| 操作 | 符号 | 含义 |
|------|------|------|
| 取地址 | `&x` | 获取变量 x 的地址 |
| 解引用 | `*p` | 获取指针 p 指向的值 |
| 声明指针 | `*T` | T 类型的指针 |

---

## 2. 指针的零值：nil

```go
var p *int
fmt.Println(p == nil)  // true
fmt.Println(*p)        // panic: runtime error: invalid memory address
```

- 指针的零值是 `nil`
- 解引用 `nil` 指针会 panic
- 所有引用类型的零值都是 `nil`：指针、slice、map、channel、function、interface

---

## 3. Go 没有指针算术

```go
arr := [3]int{1, 2, 3}
p := &arr[0]
// p++              // ❌ 编译错误：Go 没有指针算术
// p + 1            // ❌ 编译错误
```

**为什么？**
- 指针算术是 C 中缓冲区溢出、内存损坏的主要来源
- Go 通过 slice 的 `ptr+len+cap` 模型安全地表达偏移和范围
- 需要底层操作时，用 `unsafe.Pointer` + `uintptr`（但会失去安全保证）

---

## 4. 指针 vs 值传递

### 4.1 默认行为：按值传递

```go
func modify(x int) {
    x = 100
}

func main() {
    a := 1
    modify(a)
    fmt.Println(a)  // 1
}
```

### 4.2 传递指针

```go
func modify(p *int) {
    *p = 100
}

func main() {
    a := 1
    modify(&a)
    fmt.Println(a)  // 100
}
```

### 4.3 选择原则

| 场景 | 推荐 | 原因 |
|------|------|------|
| 小值类型（int, bool, struct < 64B） | 值传递 | 避免间接寻址、GC 追踪 |
| 大结构体 | 指针 | 减少拷贝开销 |
| 需要修改原值 | 指针 | 必须 |
| 接口实现 | 视方法集而定 | 值接收者 vs 指针接收者 |
| 返回值 | 优先值 | 逃逸分析决定栈/堆分配 |

---

## 5. 指针与逃逸分析

```go
func newInt() *int {
    x := 1
    return &x   // x 逃逸到堆上
}
```

- 局部变量的地址被返回，变量必须分配到堆上（逃逸）
- 逃逸分析决定指针是否导致堆分配
- 查看逃逸分析：`go build -gcflags="-m"`

---

## 6. `new` 与 `make`

| 函数 | 用途 | 返回类型 |
|------|------|---------|
| `new(T)` | 分配零值内存，返回 `*T` | 指针 |
| `make(T, ...)` | 初始化 slice、map、channel | 描述符（非指针） |

```go
p := new(int)           // *int，值为 0
s := make([]int, 0, 10) // []int
m := make(map[string]int) // map[string]int
ch := make(chan int)    // chan int
```

---

## 7. 指针的常见陷阱

### 7.1 循环变量指针

```go
items := []int{1, 2, 3}
ptrs := make([]*int, 3)
for i, v := range items {
    ptrs[i] = &v      // ❌ 都是指向同一个 v
}
// 修正
for i := range items {
    ptrs[i] = &items[i]  // ✅ 指向不同元素
}
```

### 7.2 函数返回局部指针

```go
// ✅ 安全：Go 编译器会自动将 x 分配到堆上
func f() *int {
    x := 1
    return &x
}
```

### 7.3 slice 元素的地址

```go
s := []int{1, 2, 3}
p := &s[0]
s = append(s, 4)
// p 可能失效！append 可能导致底层数组重新分配
```

---

## 8. 对比：Go vs C vs Rust

| 特性 | Go | C | Rust |
|------|-----|---|------|
| 指针算术 | ❌ | ✅ | ❌（unsafe 块除外） |
| 空指针检查 | 运行时 panic | UB（未定义行为） | 编译期：Option<&T> |
| 悬垂指针 | GC 防止 | 可能发生 | 编译期：借用检查器 |
| 多级指针 | `**T` | `**T` | `&&T`（极少见） |
| 函数返回局部地址 | ✅（自动堆分配） | ❌（悬垂指针） | 编译期检查生命周期 |

Go 的指针策略：**简化但不放弃**。保留了指针的表达力，去掉了最危险的部分。
