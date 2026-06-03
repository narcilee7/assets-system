# 五大设计哲学

## 1. 少即是多（Less is More）

**核心信念**：每种新特性都有认知代价，特性之间还会产生交互复杂度。

| Go 的克制 | 其他语言的扩张 |
|----------|-------------|
| 没有类继承，只有组合 | C++ 的多重继承 + 虚继承 + Mixin |
| 没有泛型直到 Go 1.18（2009-2022） | C++ 模板元编程的图灵完备性 |
| 没有异常机制 | Java 的 checked/unchecked exception 层级 |
| 没有访问修饰符（public/private），只靠首字母大小写 | Java 的 4 级访问控制 |
| 没有构造函数/析构函数 | C++ 的 RAII + 构造函数链 |
| 没有运算符重载 | C++ 的 `<<`、`[]`、`()` 全部可重载 |
| 没有默认参数 | Python/C++ 的默认参数 + 关键字参数 |
| 没有枚举类型直到 Go 1.21（用常量+iota） | Java 的 Enum 类，可含方法 |

**代码对比：继承 vs 组合**

```go
// Go：组合式复用
type Reader struct{ ... }
func (r *Reader) Read() { ... }

type BufReader struct {
    Reader           // embedding，不是继承
    buf  []byte
}
// BufReader 自动获得 Read 方法，但 Reader 不是基类，只是组件
```

```java
// Java：继承式复用
class BufReader extends Reader {
    private byte[] buf;
    // 深度耦合，脆弱的基类问题
}
```

**代价**：Go 的「少」意味着某些优雅模式需要更多样板代码。例如没有泛型时，每种类型都需要手写重复的逻辑（`IntStack`、`StringStack`）。Go 1.18 引入泛型时，团队坚持了「最小可用」原则——不是 C++ 模板，而是有约束的类型参数。

## 2. 显式优于隐式（Explicit is Better than Implicit）

**核心信念**：代码应该诚实地表达它在做什么，魔法和语法糖隐藏了控制流和代价。

| Go 的显式 | 其他语言的隐式 |
|----------|-------------|
| `if err != nil` 显式处理每个错误 | Java 的 try-catch 块，异常从深处抛出 |
| 没有隐式类型转换：`int64` ≠ `int` | C 的 `int` → `float` 自动提升 |
| 没有隐式接口实现，但也不需要 `implements` 关键字 | Java 必须显式 `implements` |
| 没有 `this` 指针的隐式绑定（方法接收者显式命名） | JavaScript 的 `this` 动态绑定 |
| goroutine 必须显式 `go` 启动 | JavaScript 的 Promise 自动微任务调度 |

**代码对比：错误处理**

```go
// Go：每一行可能的错误都可见
f, err := os.Open("file.txt")
if err != nil {
    return fmt.Errorf("open file: %w", err)
}
defer f.Close()

b, err := io.ReadAll(f)
if err != nil {
    return fmt.Errorf("read file: %w", err)
}
```

```java
// Java：异常在方法签名中声明，但实际抛出点可能在深处
public String readFile(String path) throws IOException {
    return Files.readString(Path.of(path));  // 异常从哪里抛出？在内部
}
```

> "It is not the language that makes programs seem simple. It is the programmer that makes the language seem simple." — Rob Pike

## 3. 组合优于继承（Composition Over Inheritance）

**核心信念**：代码复用应该通过组合独立组件实现，而不是构建层级树。

Go 的组合机制：
- **Embedding**：struct 嵌入另一个 struct，自动提升被嵌入类型的方法
- **Interface**：隐式实现，任何类型只要实现了方法集就自动满足接口

**关键洞察**：Go 的 interface 是**结构化类型**（structural typing），不是**名义类型**（nominal typing）。

```go
// 任何有 Read([]byte) (int, error) 方法的类型都是 io.Reader
// 不需要声明 "implements io.Reader"

type MyReader struct{}
func (m *MyReader) Read(p []byte) (int, error) { ... }

var _ io.Reader = (*MyReader)(nil)  // 编译期验证，不是声明
```

**对比**：
| 类型系统 | 语言 | 特点 |
|---------|------|------|
| 名义类型（Nominal） | Java、C++、C# | 必须显式声明继承/实现关系 |
| 结构化类型（Structural） | Go、TypeScript、OCaml | 只要方法集匹配即可 |
| 鸭子类型（Duck Typing） | Python、Ruby | 运行时检查，无编译期保证 |

Go 的组合哲学消除了「脆弱的基类问题」（Fragile Base Class Problem）：
- Java 中，子类依赖父类的内部实现细节，父类修改可能导致子类崩溃
- Go 中，嵌入只是语法糖，内部实现不暴露给外层

## 4. 正交性（Orthogonality）

**核心信念**：语言特性应该独立可组合，一个特性的存在不应该强制另一个特性的使用。

| Go 的正交设计 | 其他语言的耦合设计 |
|-------------|----------------|
| goroutine 和 channel 独立存在 | C# 的 `async`/`await` 强制返回 `Task` |
| interface 和 struct 完全解耦 | Java 的接口只能被类实现 |
| 方法接收者可以是值或指针，独立选择 | C++ 的虚函数强制指针语义 |
| error 是普通的值，不依赖控制流机制 | Java 的 Exception 是特殊的控制流 |
| 泛型（Go 1.18+）不破坏接口系统 | C++ 模板与虚函数是完全不同的机制 |

**正交性的工程价值**：当你需要一个并发任务时，不需要学习整个 async 框架；当你需要一个接口时，不需要改变类的定义方式。

## 5. 面向工程（Engineering-Oriented）

**核心信念**：语言设计应该服务大规模团队协作，而不仅仅是个人表达。

| 工程设施 | Go 的解决方案 | 其他语言的现状 |
|---------|-------------|-------------|
| 代码风格统一 | `gofmt`：没有选择，只有标准 | Python PEP 8 有多个格式化工具争论 |
| 文档 | `go doc`：注释即文档，自动提取 | Javadoc、Sphinx 需要额外配置 |
| 测试 | `go test`：内置，无需外部框架 | Java 需要 JUnit，JS 需要 Jest/Mocha |
| 依赖管理 | `go modules`：版本锁定、可复现构建 | npm 的 lockfile 地狱、pip 的依赖冲突 |
| 编译速度 | 包级并行编译、无头文件 | C++ 的头文件展开、模板实例化爆炸 |
| 交叉编译 | `GOOS`/`GOARCH` 单命令切换 | C/C++ 需要复杂的 toolchain 配置 |

> "Gofmt's style is no one's favorite, yet gofmt is everyone's favorite." — Rob Pike
