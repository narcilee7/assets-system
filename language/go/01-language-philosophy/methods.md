# 方法集与接收者

Go 的方法不是类的方法，而是**绑定到类型的函数**。

---

## 1. 基本语法

```go
type Point struct {
    X, Y float64
}

// 值接收者
func (p Point) Distance(q Point) float64 {
    return math.Hypot(q.X-p.X, q.Y-p.Y)
}

// 指针接收者
func (p *Point) Scale(factor float64) {
    p.X *= factor
    p.Y *= factor
}
```

---

## 2. 值接收者 vs 指针接收者

| 维度 | 值接收者 `(p T)` | 指针接收者 `(p *T)` |
|------|------------------|---------------------|
| 修改原值 | ❌ 修改的是副本 | ✅ 修改原值 |
| 方法内修改外部可见 | ❌ | ✅ |
| 大结构体拷贝开销 | 有 | 无（只传地址） |
| 并发安全 | 副本安全 | 需要同步保护 |
| 方法集归属 | T 和 *T 都有 | 只有 *T 有 |

### 2.1 自动解引用与取地址

```go
p := Point{1, 2}
p.Scale(2)        // ✅ 编译器自动 &p

pp := &Point{1, 2}
pp.Distance(q)    // ✅ 编译器自动 *pp
```

- 值类型变量调用指针接收者方法 → 自动取地址
- 指针类型变量调用值接收者方法 → 自动解引用

---

## 3. Method Set（方法集）

方法集决定了一个类型能满足哪些接口。

| 接收者类型 | T 的方法集 | *T 的方法集 |
|-----------|-----------|------------|
| `func (t T)`  | ✅ 包含 | ✅ 包含（自动解引用） |
| `func (t *T)` | ❌ 不包含 | ✅ 包含 |

```go
type Writer interface {
    Write([]byte) (int, error)
}

type MyWriter struct{}

// 值接收者
func (m MyWriter) Write(p []byte) (int, error) { ... }

var _ Writer = MyWriter{}     // ✅
var _ Writer = &MyWriter{}    // ✅（自动解引用）
```

```go
type MyWriter struct{}

// 指针接收者
func (m *MyWriter) Write(p []byte) (int, error) { ... }

var _ Writer = MyWriter{}     // ❌ MyWriter 没有 Write 方法
var _ Writer = &MyWriter{}    // ✅
```

---

## 4. 混合接收者的陷阱

```go
type Counter struct {
    count int
}

func (c Counter) Value() int { return c.count }      // 值接收者
func (c *Counter) Inc() { c.count++ }                // 指针接收者

c := Counter{}
c.Inc()
fmt.Println(c.Value())  // 0！为什么？

// 实际上上面的代码输出是 1，因为 c.Inc() 自动取地址
// 但如果是：
Counter{}.Value()       // ✅
Counter{}.Inc()         // ❌ 不能对临时值取地址
```

**最佳实践**：一个类型的方法应该统一使用值接收者或指针接收者，不要混用。

---

## 5. 嵌入与方法提升

```go
type Animal struct {
    Name string
}
func (a Animal) Speak() string { return "..." }

type Dog struct {
    Animal      // embedding
    Breed string
}

// Dog 自动获得 Speak 方法
d := Dog{Animal: Animal{Name: "Buddy"}}
d.Speak()  // "..."
```

- 嵌入不是继承，只是**方法提升**
- 嵌入字段的方法集被提升到外层类型
- 嵌入接口时，外层类型自动满足该接口

---

## 6. 方法作为值

```go
p := Point{1, 2}

// 方法值：绑定接收者
getX := p.Distance     // func(Point) float64

// 方法表达式：不绑定接收者
dist := Point.Distance  // func(Point, Point) float64
```

---

## 7. 函数 vs 方法的选择

| 场景 | 选择 |
|------|------|
| 操作特定类型的数据 | 方法 |
| 通用工具函数 | 包级函数 |
| 需要修改状态 | 指针接收者方法 |
| 纯计算、无副作用 | 值接收者方法 |

---

## 8. 常见错误

```go
// ❌ 混用接收者，导致方法集不一致
type T struct{}
func (t T) Read() {}    // T 有 Read
func (t *T) Write() {}  // T 没有 Write

// ❌ nil 指针调用方法（如果方法不检查 nil）
var p *Point
fmt.Println(p.X)  // panic

// ✅ 可以在方法中处理 nil
func (p *Point) IsNil() bool {
    return p == nil
}
```
