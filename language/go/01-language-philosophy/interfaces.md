# 接口机制深度解析

接口是 Go 类型系统的核心，也是 Go 区别于 C++/Java 的最显著特征。

---

## 1. 接口的本质

```go
type Reader interface {
    Read(p []byte) (int, error)
}
```

- 接口是**方法集的约束**，不是继承层级
- 接口是**结构化类型**：只要方法集匹配，就自动满足（隐式实现）
- 接口值 = 动态类型信息 + 动态值

---

## 2. 内部实现

### 2.1 两种接口结构

```go
// 带方法的接口（如 io.Reader）
type iface struct {
    tab  *itab          // 类型信息 + 方法表
    data unsafe.Pointer // 动态值指针
}

// 空接口 interface{} / any
type eface struct {
    _type *_type        // 类型信息
    data  unsafe.Pointer
}
```

### 2.2 装箱（Boxing）

```go
var x int = 42
var i interface{} = x   // x 被拷贝到堆上，iface 持有指针
```

- 值被赋给接口时会发生装箱：值拷贝到堆上，接口持有指针
- 装箱有性能开销：堆分配 + 间接寻址
- 热路径中避免频繁装箱

---

## 3. 隐式实现

```go
type MyReader struct{}

func (m *MyReader) Read(p []byte) (int, error) {
    return 0, io.EOF
}

// 自动满足 io.Reader，不需要声明
var _ io.Reader = (*MyReader)(nil)
```

**优点**：
- 解耦：接口定义方和实现方不需要知道彼此
- mock 测试方便：测试代码定义小接口，生产代码自动满足

**代价**：
- 编译器无法在定义处检查实现（IDE 辅助弥补）
- 阅读代码时不容易看出一个类型实现了哪些接口

---

## 4. Nil Interface 陷阱

### 4.1 经典陷阱

```go
var p *int = nil
var i interface{} = p
fmt.Println(i == nil)  // false！
```

### 4.2 为什么？

```
p = nil 时：
  i 的内部结构：
    tab  = *int 的类型信息（非 nil）
    data = nil（p 的值是 nil）

interface 为 nil 的条件：tab == nil 且 data == nil
这里的 tab 不是 nil，所以 i 不是 nil
```

### 4.3 安全判断

```go
if i != nil {
    // i 有动态类型
    if p, ok := i.(*MyType); ok && p != nil {
        // 安全使用 p
    }
}
```

---

## 5. 类型断言与类型开关

### 5.1 类型断言

```go
var r io.Reader = strings.NewReader("hello")

// 安全断言
if sr, ok := r.(*strings.Reader); ok {
    sr.Seek(0, io.SeekStart)
}

// 不安全断言（失败 panic）
sr := r.(*strings.Reader)  // panic if fails
```

### 5.2 类型开关

```go
func describe(i interface{}) {
    switch v := i.(type) {
    case int:
        fmt.Printf("int: %d\n", v)
    case string:
        fmt.Printf("string: %s\n", v)
    case io.Reader:
        fmt.Printf("reader\n")
    default:
        fmt.Printf("unknown: %T\n", v)
    }
}
```

---

## 6. 空接口 `interface{}` 与 `any`

```go
// Go 1.18 前
var x interface{} = 42

// Go 1.18+
var x any = 42

// any 是 interface{} 的别名，完全等价
type any = interface{}
```

- 空接口可以持有任何类型的值
- 过度使用空接口会失去类型安全
- 泛型（Go 1.18+）减少了对空接口的依赖

---

## 7. 接口组合

```go
// 小接口组合成大接口
type Reader interface {
    Read(p []byte) (int, error)
}

type Writer interface {
    Write(p []byte) (int, error)
}

type ReadWriter interface {
    Reader
    Writer
}
```

- 接口可以嵌入其他接口
- 推崇**小接口**：方法越少，满足越容易，复用越广

---

## 8. 接口与 nil 的完整规则

| 场景 | 结果 |
|------|------|
| `var i Reader` | `i == nil`，tab 和 data 都是 nil |
| `var p *T = nil; var i Reader = p` | `i != nil`，tab 非 nil，data 是 nil |
| `var s []int = nil; var i any = s` | `i != nil`（slice 的 nil 有类型信息） |
| `var m map[int]int; var i any = m` | `i == nil`（map 零值就是 nil，没有分配） |

---

## 9. 工程建议

1. **接口定义在消费者侧**：依赖方定义自己需要什么
2. **先写具体类型，再提取接口**：不要预定义接口
3. **避免返回具体类型的 nil 给接口**：总是返回 `nil` 接口本身
4. **用编译期断言验证实现**：`var _ io.Reader = (*MyReader)(nil)`
5. **警惕空接口的滥用**：能用具体类型/泛型就不用 `any`
