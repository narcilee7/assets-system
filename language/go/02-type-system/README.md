# Go 类型系统深度解析

这一层从语言规范层面理解 Go 的类型系统：不仅是「怎么用」，而是「类型如何被编译器理解、内存如何布局、转换规则是什么」。

---

## 1. 类型分类体系

```
Types
├── Basic Types（预声明）
│   ├── boolean: bool
│   ├── numeric: int, uint, float64, complex128, uintptr...
│   └── string
├── Composite Types（复合类型）
│   ├── array — 固定长度，值类型
│   ├── slice — 动态长度，描述符（ptr, len, cap）
│   ├── map — 哈希表，描述符
│   ├── struct — 字段集合
│   ├── pointer — *T
│   ├── function — func
│   ├── channel — chan T
│   └── interface — 动态类型+动态值
└── Defined Types（自定义类型）
    ├── type MyInt int        // 新类型，与 int 不兼容
    └── type MyInt = int      // 别名，完全等价
```

## 2. 核心类型深度剖析

### 2.1 Slice 的完整真相

```go
type sliceHeader struct {
    Data unsafe.Pointer
    Len  int
    Cap  int
}
```

- append 的扩容策略：`<1024` 翻倍，`>=1024` 约 1.25 倍（具体由运行时决定）
- 子切片共享底层数组：风险与性能权衡
- `nil slice` vs `empty slice` 的区别
- 遍历时的值拷贝陷阱（`for _, v := range s` 中 v 是复用变量）

### 2.2 Map 的实现原理

- 哈希表 + 桶（bucket）结构
- 每个桶 8 个键值对，溢出桶处理
- 扩容：渐进式迁移，不是一次性复制
- 为什么 map 不能取地址？（`&m[k]` 非法）—— 因为 rehash 会改变地址
- 为什么并发读写会 panic？—— 没有内置同步，检测到有数据竞争直接崩溃

### 2.3 Interface 的内部表示

```go
type iface struct {
    tab  *itab          // 类型信息 + 方法表
    data unsafe.Pointer // 动态值指针
}

type eface struct {
    _type *_type        // 类型信息
    data  unsafe.Pointer
}
```

- `iface`：带方法的接口（如 `io.Reader`）
- `eface`：空接口 `interface{}` / `any`
- 装箱（boxing）开销：值拷贝到堆上
- **nil interface 陷阱**：`var p *int = nil; var i interface{} = p` → i 不是 nil

### 2.4 Channel 的类型语义

- 有缓冲 vs 无缓冲：同步 vs 异步语义
- `close` 后的行为：接收方继续读到零值，`send` panic
- `select` 的随机公平性：多个 case 就绪时随机选择
- `nil channel` 在 select 中的妙用：永远阻塞，用于动态开关 case

### 2.5 Function 与 Closure

- 函数是一等公民，但函数值本身是双指针（代码指针 + 上下文指针）
- 闭包捕获的是变量的引用，不是值拷贝
- 循环变量陷阱：`for _, v := range items { go func() { use(v) }() }`

## 3. 类型转换规则

| 场景 | 是否允许 | 示例 |
|------|---------|------|
| 同底层类型不同名类型 | 不允许 | `type A int; var b int = a` ❌ |
| 显式转换 | 允许 | `int(a)` ✅ |
| 别名类型 | 允许 | `type A = int` ✅ |
| 接口断言 | 运行时检查 | `v.(ConcreteType)` |
| 类型开关 | 多分支断言 | `switch v := x.(type)` |

## 4. 泛型（Go 1.18+）

### 4.1 核心概念
- 类型参数：`func Min[T constraints.Ordered](a, b T) T`
- 类型约束：`comparable`、`any`、`constraints.Ordered`
- 类型推导：编译器从实参推导 T
- 类型集合：`~int` 包含底层类型为 int 的所有类型

### 4.2 实现机制
- 单态化（monomorphization）+ 字典（GC shape stenciling + dictionaries）
- 不是 C++ 模板那种文本替换
- 编译器根据 GC shape（指针 vs 值）生成代码，减少代码膨胀

### 4.3 使用边界
- 不能用于方法（只能用泛型函数或泛型类型）
- 不能将类型参数用于类型断言
- 结构体字段不能用类型参数

## 5. Method Set 与接收者

| 接收者类型 | 值 T 可调用的方法 | *T 可调用的方法 |
|-----------|-----------------|----------------|
| func (t T)  | ✅ | ✅（自动取地址） |
| func (t *T) | ❌ | ✅ |

- 接口赋值时的 method set 检查：值接收者 vs 指针接收者的关键差异
- 为什么 `var rb io.Reader = bytes.Buffer{}` 可以，但 `var rb io.Reader = &bytes.Buffer{}` 有时候不行？—— 看方法集

## 6. 内存对齐与布局

- struct 字段按声明顺序布局
- 编译器插入 padding 进行对齐
- `unsafe.Sizeof`、`unsafe.Alignof`、`unsafe.Offsetof`
- 字段重排可以减小 struct 大小

## 7. 类型系统边界与陷阱

- `nil` 没有统一类型，只是预声明标识符
- `[]byte` 与 `string` 的转换：有内存拷贝（除非是 `unsafe` 强转）
- `reflect` 的性能代价：反射绕过编译期类型检查
- 自定义类型不继承原类型的方法
