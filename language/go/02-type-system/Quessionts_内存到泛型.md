# Go 类型系统面试题集 — 从内存到泛型

---

## Level 1：Interface 底层与内存模型（4 题）

### 题 1：iface / eface 的内存布局

```go
var a interface{} = int64(42)
var b fmt.Stringer = time.Now()
```

**问题**：`a` 和 `b` 在内存中的结构分别是什么？`eface` 和 `iface` 各几个机器字？`itab` 里存了什么？为什么 `interface{}` 可以装任何值，而 `fmt.Stringer` 不行？

<details>
<summary>答案与解析</summary>

**答案**：

- `a` 是 **eface（空接口）**：
  ```go
  type eface struct {
      _type *_type          // 8 bytes：指向类型元数据
      data  unsafe.Pointer  // 8 bytes：指向实际数据
  }
  ```

- `b` 是 **iface（非空接口）**：
  ```go
  type iface struct {
      tab  *itab           // 8 bytes：接口表
      data unsafe.Pointer  // 8 bytes：指向实际数据
  }
  ```

**`itab` 结构**：
```go
type itab struct {
    inter *interfacetype   // 接口类型元数据
    _type *_type            // 具体类型元数据
    hash  uint32            // 类型哈希，用于接口比较
    _     [4]byte           // 对齐
    fun   [1]uintptr        // 变长数组，方法地址表（fun[0]是第一个方法）
}
```

**为什么 `interface{}` 可以装任何值**：
- `eface` 只需要 `_type`（所有类型都有）和 `data`，不需要方法表。
- `iface` 需要 `itab`，即**具体类型必须实现接口的方法集**。如果类型没实现接口，无法生成 `itab`，编译/运行时报错。

**考点**：`eface` 比 `iface` 少一层方法表，这是空接口可以装任何值的根本原因。

</details>

---

### 题 2：itab 的生成与缓存

```go
type Reader interface { Read([]byte) (int, error) }

type MyReader struct{}

func (MyReader) Read([]byte) (int, error) { return 0, nil }

func main() {
    var r Reader = MyReader{}
    // 第一次赋值时发生了什么？
}
```

**问题**：`itab` 是在编译期生成还是运行时生成？如果运行时生成，会缓存吗？`itab` 的查找过程是什么？`sync.Map` 还是全局哈希表？

<details>
<summary>答案与解析</summary>

**答案**：**运行时生成，全局缓存，不复用则 GC 回收**。

**解析**：

**生成时机**：
- 编译期：编译器知道 `MyReader` 实现了 `Reader`，但无法确定所有接口组合（如第三方接口）。
- 运行时：首次将 `MyReader` 赋值给 `Reader` 时，调用 `runtime.getitab` 或 `runtime.assertE2I`。

**查找过程**：
1. 计算 `(interfacetype, concrete_type)` 的哈希。
2. 查全局 `itabTable`（哈希表，大小约 512，可扩容）。
3. 命中则直接返回缓存的 `itab`。
4. 未命中则生成新的 `itab`，填入方法地址，插入表。

**缓存策略**：
- `itab` 缓存是**全局的**，所有 goroutine 共享。
- 用 `atomic` 操作保证并发安全。
- 如果 `itab` 不再被引用，会被 GC 回收（`itab` 不是永久驻留）。

**考点**：接口赋值不是"零成本"，首次有 `itab` 生成开销（约 ~100ns），后续缓存命中极快。

</details>

---

### 题 3：接口值比较与动态类型

```go
var a interface{} = []int{1, 2}
var b interface{} = []int{1, 2}

fmt.Println(a == b)  // panic？
```

**问题**：什么情况下接口值可以 `==` 比较？`panic` 的条件是什么？如果 `a` 和 `b` 都是 `interface{}` 装的 `nil` 指针，结果是什么？`reflect.DeepEqual` 为什么能比较 slice？

<details>
<summary>答案与解析</summary>

**答案**：**panic**：`comparing uncomparable type []int`。

**解析**：

**接口比较规则**：
1. 先比较 `tab/_type`（动态类型），类型不同则 `false`。
2. 类型相同则比较 `data`（动态值）。
3. 如果动态类型是**不可比较类型**（slice、map、function），直接 **panic**。

**nil 指针比较**：
```go
var p *int = nil
var a interface{} = p
var b interface{} = (*int)(nil)

fmt.Println(a == b)  // true！
// 因为两者的 _type 都是 *int，data 都是 nil
```

**`reflect.DeepEqual`**：
- 递归遍历 slice 元素逐个比较，不依赖 `==`。
- 慢，但安全。

**考点**：接口 `==` 不是"安全的"，底层类型不可比较时 panic。这是用 `map[interface{}]` 或 `switch` 时的隐藏炸弹。

</details>

---

### 题 4：接口装 nil 指针的终极形态

```go
type Error interface { Error() string }

func foo() Error {
    var p *MyError = nil
    return p
}

func bar() Error {
    return nil
}

func main() {
    err1 := foo()
    err2 := bar()
    
    fmt.Println(err1 == nil)  // false
    fmt.Println(err2 == nil)  // true
    
    // 追问：如何正确判断 err1 是"nil 错误"？
}
```

**问题**：`err1` 和 `err2` 的内存结构差异？为什么 `err1 != nil`？如果函数返回类型是 `*MyError` 而不是 `Error`，结果会变吗？工程上如何防御这种 bug？

<details>
<summary>答案与解析</summary>

**答案**：

**内存结构**：
- `err1`：`iface(tab=*MyError 的 itab, data=nil)` → **非 nil 接口**
- `err2`：`iface(tab=nil, data=nil)` → **nil 接口**

**为什么返回类型是 `*MyError` 就不同**：
```go
func foo() *MyError {
    var p *MyError = nil
    return p  // 返回的就是 nil 指针，不是接口
}
```

**工程防御**：
1. **不要返回具体类型的 nil 给接口**：直接 `return nil`。
2. **判空方式**：
   ```go
   func IsNilError(err error) bool {
       return err == nil  // 唯一正确方式
   }
   ```
3. **防御式编程**：
   ```go
   func foo() Error {
       if !ok {
           return nil  // 直接返回 untyped nil
       }
       return &MyError{...}
   }
   ```

**考点**：这是 Go 类型系统的**头号陷阱**，面试必考，必须能画出内存图解释。

</details>

---

## Level 2：类型断言与转换（3 题）

### 题 5：类型断言的编译期与运行时

```go
var i interface{} = int64(42)

v1, ok1 := i.(int)      // ok1=?
v2, ok2 := i.(int64)    // ok2=?
v3 := i.(string)        // panic？

// 编译期能检查什么？
var s fmt.Stringer = time.Now()
v4 := s.(*time.Time)    // 编译错误？
v5 := s.(fmt.Stringer)  // 编译错误？
```

**问题**：类型断言 `.(T)` 的编译期检查规则？`ok` 断言和直接断言的区别？为什么 `s.(fmt.Stringer)` 会编译错误？

<details>
<summary>答案与解析</summary>

**答案**：
- `ok1 = false`（动态类型是 `int64`，不是 `int`）
- `ok2 = true`
- `v3`：**panic**（`panic: interface conversion: interface {} is int64, not string`）
- `v4`：编译通过（`*time.Time` 实现了 `fmt.Stringer`，但运行时可能 panic）
- `v5`：**编译错误**

**解析**：

**编译期检查**：
- **具体类型断言**（如 `.(int)`）：编译器只检查语法，运行时判断动态类型。
- **接口类型断言**（如 `.(fmt.Stringer)`）：编译器检查**被断言的接口是否包含目标接口的方法集**。如果目标接口的方法集不是被断言接口的**子集**，编译错误。

**为什么 `s.(fmt.Stringer)` 编译错误**：
- `s` 已经是 `fmt.Stringer` 类型，断言自己无意义。
- 编译器优化：直接禁止，防止无意义代码。

**ok 断言 vs 直接断言**：
- `v, ok := i.(T)`：失败时 `ok=false`，不 panic。
- `v := i.(T)`：失败时 panic。

**考点**：类型断言是**运行时操作**，有性能开销（查 `itab` 或 `_type`）。

</details>

---

### 题 6：类型开关的编译优化与陷阱

```go
var i interface{} = 42

switch v := i.(type) {
case int:
    fmt.Printf("%T %v\n", v, v)  // v 的类型？
case int64:
    fmt.Println("int64")
default:
    fmt.Printf("%T %v\n", v, v)  // v 的类型？
}
```

**问题**：`v` 在各 case 中的类型？`default` 中呢？类型开关会被编译成什么？如果 case 里有 `fallthrough`，会怎样？

<details>
<summary>答案与解析</summary>

**答案**：
- `case int`：`v` 是 `int`（已断言）
- `case int64`：`v` 是 `int64`
- `default`：`v` 是 `interface{}`（原始类型）

**编译优化**：
- 编译器将类型开关转换为**跳转表**或**二分查找**（按类型哈希排序）。
- 时间复杂度 O(1) 或 O(log n)，不是线性 `if-else`。
- 常见类型（`int`、`string`）通常优先匹配。

**fallthrough**：
- 类型开关**不允许** `fallthrough`（编译错误）。
- 因为每个 case 中 `v` 的类型不同，无法穿透。

**考点**：类型开关是 Go 的**零成本抽象**，比 `reflect.TypeOf` + `if` 快一个数量级。

</details>

---

### 题 7：接口到接口的转换

```go
type Reader interface { Read([]byte) (int, error) }
type ReadWriter interface {
    Reader
    Write([]byte) (int, error)
}

var r Reader = &bytes.Buffer{}

rw, ok := r.(ReadWriter)  // ok=?
r2 := ReadWriter(r)       // 编译错误？
```

**问题**：`r.(ReadWriter)` 的 `ok` 是什么？`ReadWriter(r)` 的编译结果？接口到接口的转换规则？与 Java 的强制类型转换有何不同？

<details>
<summary>答案与解析</summary>

**答案**：
- `ok = false`（`*bytes.Buffer` 不一定实现了 `Write`）
- `ReadWriter(r)`：**编译错误**

**解析**：

**接口到接口转换**：
- `r.(ReadWriter)`：运行时检查 `r` 的动态类型是否实现了 `ReadWriter`。是**向下断言**。
- `ReadWriter(r)`：编译期检查 `r` 的**静态类型**（`Reader`）是否实现了 `ReadWriter`。因为 `Reader` 只有 `Read` 方法，没有 `Write`，所以编译错误。

**对比 Java**：
- Java：`ReadWriter rw = (ReadWriter) r;` 编译通过，运行时 `ClassCastException`。
- Go：`ReadWriter(r)` 编译期就拒绝，更安全。

**正确做法**：
```go
if rw, ok := r.(ReadWriter); ok {
    rw.Write([]byte("hello"))
}
```

**考点**：Go 的接口转换是**静态类型检查优先**，减少运行时 panic。

</details>

---

## Level 3：反射（Reflect）（3 题）

### 题 8：ValueOf / TypeOf 的缓存与性能

```go
func inspect(v interface{}) {
    t := reflect.TypeOf(v)
    val := reflect.ValueOf(v)
    
    fmt.Println(t.Kind())       // 与 t.Name() 的区别？
    fmt.Println(val.IsValid())  // 什么时候 false？
}
```

**问题**：`reflect.TypeOf` 和 `reflect.ValueOf` 有缓存吗？`Kind()` 和 `Type()` 的区别？`reflect.Value` 的零值是什么？为什么 `reflect.ValueOf(nil).IsValid()` 是 `false`？

<details>
<summary>答案与解析</summary>

**答案**：

**缓存**：
- `TypeOf` 返回的 `*rtype` 是**全局单例**（每个类型只创建一个 `_type` 元数据），所以 `TypeOf` 本身只是指针读取，很快。
- `ValueOf` 需要**装箱**（将值拷贝到堆或栈上的反射结构），有分配开销。

**Kind vs Type**：
- `Kind()`：底层分类（`int`、`struct`、`slice`、`ptr` 等），是 `reflect` 包的枚举。
- `Type()` / `Name()`：具体类型名（如 `main.MyInt`），自定义类型有名字，匿名类型无名字。

**Value 的零值**：
```go
var v reflect.Value  // 零值：typ=nil, ptr=nil, flag=0
v.IsValid()          // false
```

**`reflect.ValueOf(nil)`**：
- `nil` 没有类型信息，`ValueOf` 返回零值 `reflect.Value`，`IsValid()` 为 `false`。

**考点**：反射的**性能杀手**是装箱和方法调用，不是 `TypeOf`。

</details>

---

### 题 9：反射修改值的可设置性

```go
func main() {
    x := 42
    v := reflect.ValueOf(x)
    v.SetInt(100)  // panic？
    
    p := reflect.ValueOf(&x)
    p.Elem().SetInt(100)  // 合法？
    
    type T struct { X int }
    t := T{10}
    reflect.ValueOf(t).Field(0).SetInt(20)  // panic？
}
```

**问题**：`CanSet()` 的规则是什么？为什么值传递的反射无法修改？`Elem()` 的作用？如果字段是小写（未导出），能修改吗？

<details>
<summary>答案与解析</summary>

**答案**：
- `v.SetInt(100)`：**panic**：`reflect.Value.SetInt using unaddressable value`
- `p.Elem().SetInt(100)`：**合法**，`x` 变为 `100`
- `reflect.ValueOf(t).Field(0).SetInt(20)`：**panic**：`reflect.Value.SetInt using value obtained using unexported field`

**解析**：

**可设置性（CanSet）**：
- 反射值必须**可寻址**（addressable）且**非只读**。
- `ValueOf(x)` 传递的是 `x` 的副本，不可寻址。
- `ValueOf(&x)` 得到指针，`.Elem()` 解引用得到指向 `x` 的反射值，可寻址。

**未导出字段**：
- 即使可寻址，小写字段**不能修改**（Go 的封装性）。
- 必须用 `unsafe` 绕过：
  ```go
  f := reflect.ValueOf(&t).Elem().Field(0)
  ptr := unsafe.Pointer(f.UnsafeAddr())
  *(*int)(ptr) = 20  // 危险！
  ```

**考点**：反射修改的**三要素**：可寻址、可导出、非常量。

</details>

---

### 题 10：反射与接口的性能对比

```go
type Stringer interface { String() string }

func callDirect(s Stringer) string {
    return s.String()
}

func callReflect(v interface{}) string {
    // 用反射调用 String()，怎么写？
}
```

**问题**：用反射实现 `callReflect`，并分析性能差异。`reflect.Value.MethodByName` 和 `Method` 索引的区别？为什么反射调用慢 10-100 倍？

<details>
<summary>答案与解析</summary>

**反射实现**：
```go
func callReflect(v interface{}) string {
    val := reflect.ValueOf(v)
    m := val.MethodByName("String")
    // 或 m := val.Method(0)  // 按索引，更快
    res := m.Call(nil)
    return res[0].String()
}
```

**性能差异**：
- **直接调用**：编译期确定方法地址，直接跳转，~1-2ns。
- **反射调用**：
  1. `ValueOf` 装箱（分配内存）。
  2. `MethodByName` 字符串查找（哈希或遍历）。
  3. `Call` 构建参数切片（`[]reflect.Value`），反射调用。
  4. 返回值装箱。
  总开销 ~100-500ns。

**优化**：
```go
// 缓存 Method
var stringMethod = reflect.TypeOf((*Stringer)(nil)).Elem().Method(0)

// 或避免反射，用类型断言
if s, ok := v.(Stringer); ok {
    return s.String()
}
```

**考点**：反射调用有**装箱 + 查找 + 参数组装**三重开销，热路径避免。

</details>

---

## Level 4：泛型（Go 1.18+）（4 题）

### 题 11：类型参数与类型推断

```go
func Max[T constraints.Ordered](a, b T) T {
    if a > b { return a }
    return b
}

func main() {
    m1 := Max(1, 2)           // T=?
    m2 := Max(1.5, 2)         // 编译错误？
    m3 := Max[int](1, 2)      // 显式指定？
    m4 := Max("a", "b")       // T=?
}
```

**问题**：泛型函数的类型推断规则？为什么 `Max(1.5, 2)` 可能编译错误？`constraints.Ordered` 包含哪些类型？如果 `T` 是 `~int`，`Max(MyInt(1), MyInt(2))` 合法吗？

<details>
<summary>答案与解析</summary>

**答案**：
- `m1`：`T=int`（默认推断为 `int`）
- `m2`：**编译错误**（`1.5` 是 `float64`，`2` 是 `int`，类型不统一）
- `m3`：合法，显式指定 `T=int`
- `m4`：`T=string`（`string` 也实现了 `Ordered`）

**解析**：

**类型推断**：
1. **从参数推断**：`Max(1, 2)` → `T=int`。
2. **统一类型**：所有参数必须是同一类型（或可由同一类型表示）。`1.5`（无类型浮点）和 `2`（无类型整数）无法统一为单一类型。
3. **显式指定**：`Max[float64](1.5, 2)` 合法（`2` 隐式转 `float64`）。

**`constraints.Ordered`**：
- 所有可比较的有序类型：`integer`、`float`、`string`。
- 注意：**不包含 `complex`**（不可比较大小）。

**`~int` 约束**：
```go
type MyInt int

func Foo[T ~int](v T) {}

Foo(MyInt(1))  // 合法！~ 表示底层类型是 int
Foo(1)         // 也合法
```

**考点**：`~` 是泛型约束的**核心符号**，匹配底层类型。

</details>

---

### 题 12：泛型类型与单态化

```go
type Stack[T any] struct {
    items []T
}

func (s *Stack[T]) Push(v T) { ... }
func (s *Stack[T]) Pop() T   { ... }

// 编译后生成几份代码？
var s1 Stack[int]
var s2 Stack[int64]
var s3 Stack[string]
```

**问题**：Go 的泛型是单态化（Monomorphization）还是字典（Dictionary）传递？`Stack[int]` 和 `Stack[int64]` 在运行时是一份代码还是多份？与 C++ 模板和 Java 泛型擦除有何不同？

<details>
<summary>答案与解析</summary>

**答案**：**混合策略**：GC Shape 相同的一份代码，GC Shape 不同的多份。

**解析**：

**GC Shape**：
- 由指针大小和 GC 位图决定。
- `int`、`int64`、`float64`、`string`、指针 都是**8 字节**，GC Shape 相同。
- `Stack[int]` 和 `Stack[int64]` 共享**同一份机器码**（通过类型字典传递 `T` 的元数据）。
- `Stack[[2]int]` 和 `Stack[[4]int]` 可能不同（大小不同）。

**与 C++ 对比**：
- C++：完全单态化（`Stack<int>` 和 `Stack<long>` 是完全独立的代码，可能二进制膨胀）。
- Go：GC Shape 相同的共享代码，平衡性能和体积。

**与 Java 对比**：
- Java：类型擦除（`Stack<Object>`，运行时无类型信息）。
- Go：保留类型信息（`T` 的 `_type` 在运行时可用），支持 `any` 的类型断言。

**考点**：Go 泛型不是纯单态化，也不是纯擦除，是**GC Shape 驱动的代码共享**。

</details>

---

### 题 13：泛型约束的接口

```go
type Adder interface {
    Add(int) int
}

func Sum[T Adder](items []T) int {
    var total int
    for _, item := range items {
        total += item.Add(1)  // 合法？
    }
    return total
}
```

**问题**：泛型约束接口与普通接口的区别？`any` 和 `interface{}` 在泛型中的等价性？为什么 Go 泛型不支持 `operator +` 的泛化？

<details>
<summary>答案与解析</summary>

**答案**：

**泛型约束接口**：
- 普通接口：方法集约束。
- 泛型约束接口：可以是**方法集**或**类型列表**（`~int | ~float64`）。

**`any` vs `interface{}`**：
- 完全等价。`any` 是 Go 1.18 引入的预声明标识符，就是 `interface{}` 的别名。
- 泛型中推荐用 `any`，更简洁。

**为什么不支持运算符泛化**：
- Go 设计哲学：不引入运算符重载。
- `+`、`-`、`*` 等运算符在编译器中是特殊语法，不是方法。
-  workaround：用 `constraints.Ordered` 或 `constraints.Integer`，但内部仍用硬编码的运算符。

**替代方案**：
```go
type Number interface {
    ~int | ~int8 | ~int16 | ~int32 | ~int64 |
    ~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 | ~uintptr |
    ~float32 | ~float64
}

func Add[T Number](a, b T) T {
    return a + b  // 合法，因为 Number 约束的类型都支持 +
}
```

**考点**：Go 泛型约束是**类型集合**，不是 C++ 的 SFINAE。

</details>

---

### 题 14：泛型与类型断言

```go
func Print[T any](v T) {
    // 下面哪些能编译？
    fmt.Println(v.(string))           // 1
    s, ok := v.(string)               // 2
    switch v.(type) {                 // 3
    case string:
        fmt.Println("string")
    }
    
    // 正确的做法？
}
```

**问题**：泛型参数 `T` 的类型断言规则？为什么 `v.(string)` 编译错误？如何对泛型值做类型分支？

<details>
<summary>答案与解析</summary>

**答案**：
- `v.(string)`：**编译错误**（`v` 是 `T`，不是 `interface{}`）
- `s, ok := v.(string)`：**编译错误**
- `switch v.(type)`：**编译错误**

**解析**：

**泛型类型断言限制**：
- 类型断言要求操作数是**接口类型**。
- `T` 虽然有 `any` 约束（即 `interface{}`），但在泛型函数体内，`v` 的**静态类型**是 `T`，不是接口。

**正确做法**：
```go
func Print[T any](v T) {
    // 先转成 interface{}
    anyV := any(v)
    if s, ok := anyV.(string); ok {
        fmt.Println(s)
    }
    
    // 或用 type switch
    switch x := anyV.(type) {
    case string:
        fmt.Println("string:", x)
    case int:
        fmt.Println("int:", x)
    }
}
```

**Go 1.20+ 简化**：
```go
func Print[T any](v T) {
    switch x := any(v).(type) {
    case string:
        fmt.Println(x)
    }
}
```

**考点**：泛型参数**不是接口值**，需要显式 `any(v)` 转换后才能断言。

</details>

---

## Level 5：Unsafe 与高级类型操作（3 题）

### 题 15：unsafe.Pointer 与 uintptr 的区别

```go
var x int = 42
p := unsafe.Pointer(&x)
u := uintptr(p)

// 下面是否安全？
p2 := unsafe.Pointer(u + 4)
```

**问题**：`unsafe.Pointer` 和 `uintptr` 的本质区别？为什么 `uintptr` 不能单独做指针运算？GC 时会发生什么？

<details>
<summary>答案与解析</summary>

**答案**：**不安全**，GC 可能把 `x` 移到别处，`u` 变成悬空地址。

**解析**：

| 特性 | `unsafe.Pointer` | `uintptr` |
|------|-----------------|-----------|
| 本质 | 通用指针，GC 认识 | 整数，GC 不认识 |
| 指针运算 | 不能直接运算 | 可以算术运算 |
| GC 安全 | 是，GC 会更新 | 否，GC 不追踪 |
| 转换 | `*T` ↔ `unsafe.Pointer` ↔ `uintptr` | 单向 |

**安全规则**：
1. `uintptr` 不能单独存指针，必须和 `unsafe.Pointer` 在同一表达式中转换。
2. 正确的指针运算：
   ```go
   p := unsafe.Pointer(uintptr(unsafe.Pointer(&x)) + 4)  // 同一表达式，安全
   ```

**GC 场景**：
- Go 是**移动式 GC**（虽然当前版本很少移动，但规范允许）。
- 如果 `x` 被移动，`p` 会被 GC 更新，但 `u` 不会。

**考点**：`uintptr` 是**整数**，不是指针，GC 不保证其有效性。

</details>

---

### 题 16：unsafe 修改私有字段

```go
type User struct {
    name string  // 小写，未导出
    age  int
}

func main() {
    u := User{"Tom", 20}
    
    // 如何修改 u.name？
}
```

**问题**：用 `unsafe` 和 `reflect` 分别如何实现？有什么风险？跨版本兼容性如何保证？

<details>
<summary>答案与解析</summary>

**答案**：

**reflect + unsafe**：
```go
v := reflect.ValueOf(&u).Elem()
f := v.FieldByName("name")
ptr := unsafe.Pointer(f.UnsafeAddr())
*(*string)(ptr) = "Jerry"
```

**纯 unsafe**：
```go
// 知道偏移量
ptr := unsafe.Pointer(uintptr(unsafe.Pointer(&u)) + unsafe.Offsetof(u.name))
*(*string)(ptr) = "Jerry"
```

**风险**：
1. **GC 不安全**：如果 `f` 不是指针类型，`UnsafeAddr()` 返回的地址可能被 GC 移动。
2. **版本不兼容**：字段偏移量、内存布局可能随编译器/版本变化。
3. **封装破坏**：破坏类型不变式。

**跨版本兼容**：
- 用 `reflect` 获取偏移量，不要硬编码。
- 但 `unsafe.Offsetof` 要求字段可导出... 对未导出字段无效。

**真正安全的方式**：
- 不要修改未导出字段。
- 如果必须，用 `go:linkname` 或修改源码。

**考点**：`unsafe` 是**最后的手段**，面试问到了解即可，工程上不推荐。

</details>

---

### 题 17：unsafe 实现类型转换（零拷贝）

```go
func StringToBytes(s string) []byte {
    // 如何实现零拷贝转换？
}

func BytesToString(b []byte) string {
    // 如何实现零拷贝转换？
}
```

**问题**：`string` 和 `[]byte` 的内存结构？为什么直接 `[]byte(s)` 会拷贝？零拷贝的实现？有什么风险？

<details>
<summary>答案与解析</summary>

**答案**：

**内存结构**：
```go
type StringHeader struct {
    Data uintptr
    Len  int
}

type SliceHeader struct {
    Data uintptr
    Len  int
    Cap  int
}
```

**零拷贝实现**：
```go
func StringToBytes(s string) []byte {
    return *(*[]byte)(unsafe.Pointer(
        &struct {
            string
            Cap int
        }{s, len(s)},
    ))
}

// 更简洁（Go 1.20+ 推荐用 unsafe.Slice）
func StringToBytes(s string) []byte {
    return unsafe.Slice(unsafe.StringData(s), len(s))
}

func BytesToString(b []byte) string {
    return unsafe.String(unsafe.SliceData(b), len(b))
}
```

**风险**：
- `StringToBytes` 得到的 `[]byte` 如果修改，会**破坏 string 的不可变性**（导致不可预期的行为，因为 string 可能被复用）。
- `BytesToString` 如果 `b` 被修改，string 也会变化（string 应该是不可变的）。

**安全场景**：
- 只读访问。
- 临时转换，不长期持有。

**考点**：零拷贝是**性能优化手段**，但破坏类型不变式，必须只读使用。

</details>

---

## 类型系统面试速查卡

| 考点 | 一句话 | 必会陷阱 |
|------|--------|----------|
| eface/iface | 空接口只有 type+data，非空接口多 itab | itab 运行时生成，首次有开销 |
| 接口 nil | tab≠nil 但 data=nil 时，接口≠nil | 返回具体类型 nil 给接口 |
| 类型断言 | 编译期检查静态类型，运行时查动态类型 | 接口到接口的转换规则不同 |
| 类型开关 | 编译为跳转表，case 内已断言 | 不允许 fallthrough |
| 反射 | TypeOf 缓存，ValueOf 装箱 | CanSet 需要可寻址+可导出 |
| 泛型 GC Shape | 相同 Shape 共享代码，不同则多份 | 不是纯单态化，也不是擦除 |
| 泛型断言 | 泛型参数不是接口，需 any(v) 转 | 直接 v.(T) 编译错误 |
| unsafe.Pointer | GC 认识的指针，uintptr 是整数 | uintptr 单独存指针 GC 时不更新 |
| 零拷贝转换 | string/[]byte 共享底层数组 | 破坏 string 不可变性，只读使用 |

---
