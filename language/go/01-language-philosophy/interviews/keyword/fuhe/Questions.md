# 复合类型面试题集 — `struct` / `interface` / `map` / `chan`

---

## 一、`struct`（3 题）

### 题 1：内存对齐与字段重排

```go
type Bad struct {
    A bool     // 1
    B int32    // 4
    C bool     // 1
    D int64    // 8
    E bool     // 1
}

type Good struct {
    D int64    // 8
    B int32    // 4
    A bool     // 1
    C bool     // 1
    E bool     // 1
}
```

**问题**：`unsafe.Sizeof(Bad{})` 和 `unsafe.Sizeof(Good{})` 分别是多少？为什么？

<details>
<summary>答案与解析</summary>

**答案**：`Bad = 32`，`Good = 16`。

**解析**：

**对齐规则**：
- 结构体对齐值 = 最大字段对齐值（这里是 `int64` 的 8）。
- 每个字段偏移必须是其对齐值的倍数。

**Bad 布局**：
```
| A(1) | pad(3) | B(4) | C(1) | pad(7) | D(8) | E(1) | pad(7) |
  1      3        4      1      7        8      1      7        = 32
```

**Good 布局**：
```
| D(8) | B(4) | A(1) | C(1) | E(1) | pad(1) |
  8      4      1      1      1      1        = 16
```

**考点**：按字段大小**从大到小**排列，减少内部填充。这是性能优化面试的送分题。

</details>

---

### 题 2：嵌入字段的方法集与接口实现

```go
type Inner struct{}

func (Inner) M1() {}
func (*Inner) M2() {}

type Outer struct {
    Inner
}

var _ interface{ M1() } = Outer{}    // 合法？
var _ interface{ M1() } = &Outer{}  // 合法？
var _ interface{ M2() } = Outer{}     // 合法？
var _ interface{ M2() } = &Outer{}  // 合法？
```

**问题**：逐行判断。嵌入字段的方法提升规则是什么？如果 `Outer` 自己实现了 `M1`，会怎样？

<details>
<summary>答案与解析</summary>

**答案**：
- `Outer{}` 实现 `M1`：✅
- `&Outer{}` 实现 `M1`：✅
- `Outer{}` 实现 `M2`：❌
- `&Outer{}` 实现 `M2`：✅

**解析**：

**方法提升**：`Outer` 可以调用 `Inner` 的方法，但方法集规则不变：
- `Outer` 值的方法集 = `Inner` 值的方法集（`M1`）
- `*Outer` 指针的方法集 = `Inner` 值 + `Inner` 指针（`M1` + `M2`）

**遮蔽**：如果 `Outer` 自己实现了 `M1`，则 `Outer.M1` 遮蔽 `Inner.M1`，但 `Inner.M1` 仍可通过 `o.Inner.M1()` 调用。

**考点**：嵌入 ≠ 继承。方法提升不改变值/指针方法集规则。

</details>

---

### 题 3：结构体标签（Struct Tag）与反射

```go
type User struct {
    Name  string `json:"name" db:"user_name"`
    Age   int    `json:"age,omitempty"`
    Email string `json:"-"`
}

func main() {
    t := reflect.TypeOf(User{})
    field, _ := t.FieldByName("Name")
    fmt.Println(field.Tag.Get("json"))   // ?
    fmt.Println(field.Tag.Get("db"))     // ?
    
    // 下面输出什么？
    u := User{Age: 0}
    b, _ := json.Marshal(u)
    fmt.Println(string(b))  // ?
}
```

**问题**：反射读取标签的机制？`omitempty` 对零值的作用？`json:"-"` 的含义？

<details>
<summary>答案与解析</summary>

**答案**：
- `field.Tag.Get("json")`：`"name"`
- `field.Tag.Get("db")`：`"user_name"`
- `json.Marshal(u)`：`{"name":"","age":0}` 或 `{}`？

等等，`Age` 有 `omitempty`，但 `Age` 是 `int`，零值 `0`。`Name` 没有 `omitempty`，零值 `""` 会输出。

`Email` 是 `json:"-"`，完全忽略。

所以输出：`{"name":"","age":0}`？不对，`omitempty` 对零值 `int` 会省略吗？

`omitempty` 会省略零值。所以 `Age: 0` 会被省略。但 `Name` 没有 `omitempty`，所以输出 `{"name":""}`。

等等，如果 `Name` 也有值呢？题目是 `u := User{Age: 0}`，`Name` 是零值 `""`。

输出：`{"name":""}`

**解析**：

- **Struct Tag**：`reflect.StructTag` 是字符串，格式为 `key:"value"`，通过 `Get(key)` 解析。
- **json 包解析**：运行时读取 `json` tag，不是编译期。
- **omitempty**：字段为零值时省略（`false`, `0`, `""`, `nil`, 空 slice/map）。
- **`-`**：完全忽略该字段。

**考点**：Struct Tag 是**字符串元数据**，反射解析有运行时开销。

</details>

---

## 二、`interface`（5 题）

### 题 4：iface vs eface 的内存结构

```go
var a interface{} = int64(42)
var b interface{ String() string } = time.Now()
```

**问题**：`a` 和 `b` 在内存中的结构分别是什么？`interface{}` 和带方法接口的底层区别？为什么 `interface{}` 可以装任何值？

<details>
<summary>答案与解析</summary>

**答案**：

- `a` 是 **eface（空接口）**：
  ```go
  type eface struct {
      _type *_type      // 类型元数据
      data  unsafe.Pointer  // 数据指针
  }
  ```

- `b` 是 **iface（非空接口）**：
  ```go
  type iface struct {
      tab  *itab       // 接口类型 + 具体类型 + 方法表
      data unsafe.Pointer  // 数据指针
  }
  ```

**解析**：

- **eface**：只需要知道**类型**和**数据**，不需要方法表。所以 `interface{}` 可以装任何值。
- **iface**：需要 `itab`（interface table），在**首次赋值**时生成或从缓存查找，后续复用。
- **itab 结构**：`hash`（用于快速比较）、`_type`（具体类型）、`fun[0]`（方法地址数组）。

**考点**：iface 比 eface 多一层方法表，赋值时有 itab 查找/生成开销。

</details>

---

### 题 5：接口 nil 的终极陷阱

```go
func returnsError() error {
    var p *MyError = nil
    return p
}

func main() {
    err := returnsError()
    fmt.Println(err == nil)        // ?
    fmt.Println(err == (*MyError)(nil))  // 合法？输出？
}
```

**问题**：为什么 `err != nil`？`error` 接口的内部状态是什么？如何正确判断？

<details>
<summary>答案与解析</summary>

**答案**：
- `err == nil`：`false`
- `err == (*MyError)(nil)`：编译错误（类型不匹配）

**解析**：

**接口值结构**：
```go
type error interface { Error() string }

// returnsError 返回的 err：
// tab = *itab(MyError 实现了 error)
// data = nil（因为 p 是 nil 指针）
```

- `err == nil` 要求 `tab == nil && data == nil`，但这里 `tab != nil`，所以 `err != nil`。

**正确判空**：
```go
func returnsError() error {
    if bad() {
        return &MyError{}
    }
    return nil  // 返回 untyped nil，接口值 (nil, nil)
}
```

**防御式检查**：
```go
func IsNilError(err error) bool {
    return err == nil  // 唯一正确方式
    // 不要用 reflect.ValueOf(err).IsNil()，可能 panic
}
```

**考点**：这是 Go 最著名的陷阱，面试必考。

</details>

---

### 题 6：类型断言与类型开关

```go
var i interface{} = []int{1, 2, 3}

v, ok := i.([]int)      // 合法？
v2, ok2 := i.([]int32)  // 合法？ok2=？

switch x := i.(type) {
case []int:
    fmt.Printf("%T\n", x)  // ?
case []int32:
    fmt.Println("int32")
default:
    fmt.Printf("%T\n", x)  // ?
}
```

**问题**：类型断言失败时 `ok` 的值？`x` 在 case 内和 default 内的类型？类型开关的编译器优化？

<details>
<summary>答案与解析</summary>

**答案**：
- `v, ok`：`ok=true`，`v=[]int{1,2,3}`
- `v2, ok2`：`ok2=false`，`v2=nil`（`[]int32` 的零值）
- `case []int`：`x` 是 `[]int`
- `default`：`x` 是 `interface{}`（原始类型）

**解析**：

**类型断言**：
- `i.(T)`：如果 `i` 的动态类型是 `T`，成功；否则 panic（或 `ok=false`）。
- 失败时返回值是 `T` 的零值。

**类型开关**：
- 每个 case 中，`x` 已被断言为具体类型。
- `default` 中，`x` 仍是原始接口类型。
- 编译器优化为**跳转表**或**二分查找**，不是线性 if-else。

**考点**：类型断言失败有零值，类型开关 case 内是具体类型。

</details>

---

### 题 7：接口比较与可比较性

```go
var a interface{} = []int{1, 2}
var b interface{} = []int{1, 2}

fmt.Println(a == b)  // 合法？panic？
```

**问题**：什么情况下接口值可以比较？`panic` 的条件是什么？`reflect.DeepEqual` 的替代方案？

<details>
<summary>答案与解析</summary>

**答案**：**panic**：`runtime error: comparing uncomparable type []int`。

**解析**：

**接口比较规则**：
- 接口值 `==` 比较：先比较动态类型，再比较动态值。
- 如果动态类型**不可比较**（slice、map、function），直接 panic。
- 即使两个值相同，类型不可比较也会 panic。

**安全比较**：
```go
// 用反射（慢）
reflect.DeepEqual(a, b)  // true，不 panic

// 或先判断类型
if reflect.TypeOf(a).Comparable() {
    fmt.Println(a == b)
}
```

**考点**：接口比较不是"安全的"，底层类型不可比较时 panic。

</details>

---

### 题 8：接口实现的隐式性

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type MyReader struct{}

func (MyReader) Read(p []byte) (n int, err error) { return 0, nil }

// 下面是否合法？
var _ Reader = MyReader{}     // ?
var _ Reader = &MyReader{}    // ?
```

**问题**：Go 的隐式实现与 Java/C# 的显式实现有何优劣？编译器如何检查实现？如果 `MyReader` 后来删除了 `Read` 方法，会发生什么？

<details>
<summary>答案与解析</summary>

**答案**：两者都合法。`*MyReader` 也实现了 `Reader`（值接收者方法对指针也可用）。

**解析**：

**隐式实现**：
- 优点：无依赖、无侵入、可事后适配（如给 `io.Reader` 写实现，不需要 import `io`）。
- 缺点：找不到"谁实现了这个接口"的显式声明。

**编译器检查**：
- 编译期检查：赋值给接口变量时验证方法集。
- 常用技巧：`var _ Reader = (*MyReader)(nil)` 编译期检查，不分配内存。

**接口变更影响**：
- 如果 `Reader` 新增方法，所有实现者编译错误（破坏式变更）。
- 解决方案：接口组合（小接口原则），如 `io.Reader`、`io.Writer`、`io.Closer` 分开。

**考点**：Go 的隐式接口是**解耦**的核心设计，小接口是最佳实践。

</details>

---

## 三、`map`（5 题）

### 题 9：map 的并发崩溃

```go
var m = map[string]int{}

func main() {
    go func() {
        for {
            m["a"] = 1
        }
    }()
    go func() {
        for {
            _ = m["a"]
        }
    }()
    time.Sleep(time.Second)
}
```

**问题**：程序会怎样？为什么读 map 也会崩溃？`map` 为什么不做成并发安全？

<details>
<summary>答案与解析</summary>

**答案**：**fatal error: concurrent map read and map write**（或 `concurrent map writes`）。

**解析**：

**为什么读也会崩溃**：
- `map` 在读取时可能触发**扩容**（grow），或遇到**写时标记**。
- 读操作不是纯只读，可能修改内部状态（如迭代器、哈希冲突链）。

**为什么不做成并发安全**：
- 性能：加锁的 map 在单 goroutine 场景下慢 2-3 倍。
- 哲学：Go 推崇"显式同步"，让程序员选择 `sync.RWMutex` 或 `sync.Map`。

**并发方案**：
```go
// 方案 1：Mutex（适合写多读少）
var mu sync.RWMutex
mu.RLock()
v := m["a"]
mu.RUnlock()

// 方案 2：sync.Map（适合读多写少、键值类型不固定）
var sm sync.Map
sm.Store("a", 1)
v, ok := sm.Load("a")

// 方案 3：分片 map（高并发）
type ShardMap [256]struct {
    mu sync.RWMutex
    m  map[string]int
}
```

**考点**：`map` 的**任何并发访问**（包括读）都是未定义行为，可能 panic。

</details>

---

### 题 10：map 的扩容与遍历

```go
m := map[int]int{1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9}

for k := range m {
    if k == 3 {
        delete(m, 3)      // 合法？
        m[10] = 10        // 合法？
    }
    fmt.Println(k)
}
```

**问题**：`delete` 和 `m[10] = 10` 在遍历中合法吗？遍历顺序是否固定？为什么？

<details>
<summary>答案与解析</summary>

**答案**：两者都合法。遍历顺序**不固定**，每次运行不同。

**解析**：

**遍历中修改**：
- `delete`：安全，不影响当前遍历（可能跳过某些元素，但不 panic）。
- 插入：安全，但新元素**不一定**在当前遍历中出现。

**随机顺序**：
- 遍历从**随机桶**开始，随机偏移。
- 防止程序员依赖顺序，保证未来扩容实现不受限制。

**扩容触发**：
- 负载因子 > 6.5（平均每个桶 6.5 个元素）。
- 翻倍扩容，渐进式迁移（不是一次性复制所有数据）。

**考点**：遍历顺序**随机**是语言规范，不是实现细节。

</details>

---

### 题 11：map 的 key 限制

```go
type Key struct {
    A []int
    B int
}

m := map[Key]int{}
```

**问题**：编译错误吗？什么类型可以作为 map key？为什么 slice 不能？如果必须用 slice 做 key，怎么办？

<details>
<summary>答案与解析</summary>

**答案**：编译错误：`invalid map key type Key`。

**解析**：

**可比较类型**：
- 基本类型：`int`, `string`, `bool`, 指针
- 数组（元素可比较）
- 结构体（所有字段可比较）
- 接口（动态值可比较）

**不可比较类型**：
- slice、map、function

**原因**：
- slice 是**引用类型**，底层数组可能变化，无法做稳定哈希。
- map 本身无序，无法哈希。
- function 地址不唯一（闭包环境不同）。

**解决方案**：
```go
// 方案 1：用字符串拼接
key := fmt.Sprintf("%v", slice)

// 方案 2：自定义结构体包装
type SliceKey struct {
    hash string  // 预计算哈希
}

// 方案 3：用 map[uint64] 存哈希（注意冲突）
```

**考点**：map key 必须是**可比较类型**，这是编译期限制。

</details>

---

### 题 12：map 的 delete 与内存释放

```go
m := make(map[int][1024]byte)
for i := 0; i < 1000; i++ {
    m[i] = [1024]byte{}
}
for i := 0; i < 1000; i++ {
    delete(m, i)
}
runtime.GC()

fmt.Println(len(m))  // ?
```

**问题**：`delete` 后内存是否立即释放？`len(m)` 是多少？如何真正释放 map 的内存？

<details>
<summary>答案与解析</summary>

**答案**：`len(m) = 0`，但**内存不会释放**。

**解析**：

**delete 的语义**：
- 标记 key 为**空槽**，不立即释放底层桶数组。
- 底层 `hmap` 的 `buckets` 指针不会缩容。

**内存释放**：
-  Go 的 map **不会缩容**，只有扩容。
- 删除大量元素后，内存仍占用。

**强制释放**：
```go
// 方案 1：重新创建 map
m = make(map[int][1024]byte)

// 方案 2：定期重建（copy-on-write）
newM := make(map[int][1024]byte, len(m))
for k, v := range m {
    newM[k] = v
}
m = newM  // 旧 map 被 GC
```

**考点**：map **只扩不缩**，大量删除后内存不释放，需要重建。

</details>

---

### 题 13：map 的 value 不可寻址

```go
m := map[string]int{"a": 1}
p := &m["a"]  // 合法？
m["a"]++      // 合法？
```

**问题**：为什么 value 不能取地址？`m["a"]++` 为什么可以？如果 value 是结构体，如何修改其字段？

<details>
<summary>答案与解析</summary>

**答案**：`&m["a"]` 编译错误。`m["a"]++` 合法。

**解析**：

**不可寻址原因**：
- map 可能**扩容**，value 地址会变化。
- 如果允许取地址，指针可能在扩容后**悬空**。

**为什么 `m["a"]++` 可以**：
- 编译器将其翻译为：
  ```go
  v := m["a"]
  v++
  m["a"] = v
  ```
- 不是原地修改，而是**读-改-写**。

**修改结构体 value**：
```go
type User struct{ Name string }
m := map[string]User{"a": {"Tom"}}

// 错误：
m["a"].Name = "Jerry"  // 编译错误：不可寻址

// 正确：
u := m["a"]
u.Name = "Jerry"
m["a"] = u

// 或 value 存指针：
m2 := map[string]*User{"a": {"Tom"}}
m2["a"].Name = "Jerry"  // 合法！
```

**考点**：map value 不可寻址，结构体 value 修改必须**整体替换**或存**指针**。

</details>

---

## 四、`chan`（5 题）

### 题 14：channel 的零值与 nil

```go
var ch chan int

go func() {
    ch <- 1  // 行为？
}()

v, ok := <-ch  // 行为？
close(ch)      // 行为？
```

**问题**：三种操作分别发生什么？`nil` channel 在 `select` 中的行为？

<details>
<summary>答案与解析</summary>

**答案**：
- `ch <- 1`：**永久阻塞**
- `<-ch`：**永久阻塞**
- `close(ch)`：**panic**

**解析**：

**nil channel 行为**：
- 发送：阻塞
- 接收：阻塞
- 关闭：panic

**select 中的 nil channel**：
```go
select {
case <-ch:      // 永远不会选中
case <-other:   // 可能选中
}
```
- nil channel 的 case **永远不会 ready**，但不会 panic。
- 常用于**动态禁用**某个分支：
  ```go
  if disabled {
      ch = nil  // 禁用这个 case
  }
  ```

**考点**：nil channel 是**阻塞**而非 panic（除 close 外），select 中可用于条件分支。

</details>

---

### 题 15：channel 关闭的语义

```go
ch := make(chan int, 2)
ch <- 1
ch <- 2
close(ch)

v1, ok1 := <-ch  // ?
v2, ok2 := <-ch  // ?
v3, ok3 := <-ch  // ?
```

**问题**：三次接收的值和 `ok`？关闭后还能发送吗？重复关闭会怎样？如何判断 channel 是否关闭？

<details>
<summary>答案与解析</summary>

**答案**：
- `v1=1, ok1=true`
- `v2=2, ok2=true`
- `v3=0, ok3=false`（零值 + false）

**解析**：

**关闭语义**：
- 关闭后**不能发送**，发送 panic。
- 关闭后**可以接收**，直到缓冲清空。
- 缓冲清空后，接收返回零值 + `ok=false`。
- **重复关闭 panic**。

**判断关闭**：
```go
// 错误：直接判断
if ch == nil { ... }  // 无法判断关闭

// 正确：用 comma ok
v, ok := <-ch
if !ok {
    // channel 已关闭且无数据
}

// 或单独 goroutine 监听
go func() {
    for v := range ch {
        // 处理
    }
    // ch 关闭，range 退出
}()
```

**考点**：关闭是**广播机制**，所有等待的接收者都能收到通知。

</details>

---

### 题 16：select 的随机公平性

```go
ch1 := make(chan int, 1)
ch2 := make(chan int, 1)
ch1 <- 1
ch2 <- 2

select {
case v := <-ch1:
    fmt.Println("ch1", v)
case v := <-ch2:
    fmt.Println("ch2", v)
default:
    fmt.Println("default")
}
```

**问题**：输出是否确定？如果去掉 `default` 呢？`select` 的伪随机实现？

<details>
<summary>答案与解析</summary>

**答案**：**不确定**，可能是 `ch1 1` 或 `ch2 2`。去掉 `default` 仍然不确定。

**解析**：

**select 机制**：
- 多个 case 同时 ready 时，**伪随机**选择一个。
- 防止某个 channel 饥饿，保证公平性。
- 随机性由 `runtime.fastrand` 生成。

**实现**：
- 编译器将 `select` 转换为 `runtime.selectgo`。
- 生成**随机轮询顺序**，遍历所有 case。

**考点**：select 的随机性是**语言规范**，不是实现细节。不要依赖顺序。

</details>

---

### 题 17：无缓冲 channel 的同步语义

```go
func worker(done chan bool) {
    // 干活
    time.Sleep(time.Second)
    done <- true
}

func main() {
    done := make(chan bool)
    go worker(done)
    <-done
    fmt.Println("done")
}
```

**问题**：如果 `done` 改为缓冲 1，行为有何不同？如果 `worker` 里 `done <- true` 放在 `go` 之前呢？如何防止 goroutine 泄漏？

<details>
<summary>答案与解析</summary>

**答案**：

**缓冲 1 的区别**：
- 无缓冲：`done <- true` 阻塞，直到 `main` 接收。保证 `main` 在 worker 完成后才继续。
- 缓冲 1：`done <- true` 不阻塞，worker 立即返回。`main` 可能在 worker 还在干活时就收到信号（如果发送在干活之后，只是不阻塞）。

**发送在 `go` 之前**：
```go
done <- true  // 阻塞！main 还没启动接收，死锁
go worker(done)
```

**防止泄漏**：
```go
// 方案 1：缓冲 channel（允许发送方不阻塞退出）
done := make(chan bool, 1)

// 方案 2：select + timeout
select {
case <-done:
case <-time.After(5 * time.Second):
    // 超时
}

// 方案 3：context 取消
ctx, cancel := context.WithCancel(context.Background())
go worker(ctx)
defer cancel()
```

**考点**：无缓冲 channel 是**强同步点**，缓冲 channel 是**弱同步/信号**。

</details>

---

### 题 18：channel 实现信号量

```go
type Semaphore chan struct{}

func NewSemaphore(n int) Semaphore {
    return make(chan struct{}, n)
}

func (s Semaphore) Acquire() {
    s <- struct{}{}
}

func (s Semaphore) Release() {
    <-s
}
```

**问题**：这个实现有问题吗？`Release` 不检查是否已 Acquire 会怎样？与 `sync.Semaphore`（x/sync/semaphore）相比有何不足？

<details>
<summary>答案与解析</summary>

**答案**：**有严重问题**。`Release` 可以从空 channel 接收，导致信号量计数为负（实际表现为 `Acquire` 不阻塞）。

**解析**：

**问题**：
- `Release` 直接 `<-s`，如果之前没有 `Acquire`，会从空 channel 阻塞等待，而不是报错。
- 更糟的是，如果多个 goroutine 同时 `Release`，会释放不存在的许可。

**正确实现**：
```go
func (s Semaphore) Release() {
    select {
    case <-s:
        // 正常释放
    default:
        // 没有可释放的，panic 或忽略
        panic("release without acquire")
    }
}
```

**与 `x/sync/semaphore` 对比**：
- 标准库支持 `Acquire(ctx)` 带 context 取消。
- 支持动态权重（一次获取 N 个许可）。
- 内部用 `Mutex` + 等待队列，不是简单 channel。

**考点**：channel 信号量要注意**释放次数不能超过获取次数**。

</details>

---

## 复合类型面试速查卡

| 类型 | 最高频考点 | 必会陷阱 |
|------|-----------|----------|
| `struct` | 内存对齐、嵌入方法提升 | 嵌入 ≠ 继承，方法集规则不变 |
| `interface` | iface/eface、nil 接口陷阱 | 装 nil 指针的接口 ≠ nil |
| `map` | 并发不安全、只扩不缩、key 可比较 | value 不可寻址、遍历顺序随机 |
| `chan` | 关闭语义、select 随机、nil 行为 | 关闭后发送 panic、重复关闭 panic |

---
