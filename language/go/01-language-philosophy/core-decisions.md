# 语言本质决策深度解析

## 1. 为什么 Go 没有类继承？

**历史教训**：Google 的 C++ 代码库中，深层继承树是维护噩梦。

```cpp
// C++ 的继承灾难：谁重写了谁？行为在哪里？
class Base { virtual void work() = 0; };
class Mid : public Base { void work() override; };
class Derived : public Mid { void work() override; };
// 修改 Base::work() 的默认行为 → 所有子类可能崩溃
```

Go 的替代方案：
- **组合**：`struct A` 嵌入 `struct B`，`B` 的方法自动提升到 `A`
- **接口多态**：任何类型满足接口方法集即可赋值给接口变量
- **无层级**：没有 "is-a" 关系，只有 "has-a" 和 "can-do"

**代码对比**：

```go
// Go：明确、可预测
type Writer struct{}
func (w *Writer) Write(p []byte) (int, error) { ... }

type BufferedWriter struct {
    w    *Writer
    buf  []byte
}
// BufferedWriter 明确委托给 w，行为在代码中可见
func (bw *BufferedWriter) Write(p []byte) (int, error) {
    // 可以选择委托，也可以覆盖
    return bw.w.Write(p)
}
```

**代价**：
- 无法表达「自然的」层级关系（如「动物 → 哺乳动物 → 狗」）
- 需要更多样板代码来转发方法
- 没有继承带来的 IDE 自动补全优势（"查看所有重写方法"）

## 2. 为什么 error 是值而不是异常？

**核心论证**：异常是一种**非局部控制流**，它打破了程序的可读性和可预测性。

**代码对比**：

```go
// Go：错误路径显式、局部
func processFile(path string) error {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer f.Close()

    data, err := io.ReadAll(f)
    if err != nil {
        return err
    }

    result, err := parse(data)
    if err != nil {
        return fmt.Errorf("parse: %w", err)
    }

    return save(result)
}
// 所有错误处理都在眼前，没有隐藏的跳转
```

```python
# Python：异常从深处抛出，调用栈可能很深
def process_file(path):
    with open(path) as f:
        data = f.read()
    result = parse(data)      # 可能抛出 ParseError，在哪处理？
    save(result)              # 可能抛出 SaveError
# 调用者需要知道哪些异常可能从哪里抛出
```

**Go error 的演进**：
- Go 1.13 前：错误比较靠 `==`，包装靠字符串拼接
- Go 1.13+：`fmt.Errorf("...: %w", err)`、`errors.Is`、`errors.As`
- 趋势：从 sentinel error（`var ErrNotFound = errors.New(...)`) 转向自定义错误类型

**代价**：
- `if err != nil` 重复代码多，被戏称为 "Go 的错误处理八股文"
- 容易遗漏错误检查（虽然有 `errcheck` 等 linter）
- 不像异常那样能自动跨多层调用栈传播

## 3. 为什么 goroutine 不是线程？

**OS 线程的问题**：
- 创建代价高：内核态上下文切换，初始栈 ~1-8MB
- 数量受限：几千线程就可能耗尽系统资源
- 调度由 OS 控制，程序无法优化

**goroutine 的设计**：
- 用户态调度（GMP 模型），切换成本 ~纳秒级
- 初始栈仅 2KB，按需增长/收缩
- 百万级 goroutine 轻松运行

> "Goroutines are cheap. Threads are expensive. The difference is not subtle." — Andrew Gerrand

**关键设计决策**：
- **M:N 调度**：M 个 goroutine 映射到 N 个 OS 线程
- **协作式调度 + 抢占**（Go 1.14+）：基于信号的抢占式调度
- **网络轮询器（netpoller）**：I/O 阻塞不占用线程

## 4. 为什么 channel 是通信原语？

**CSP 理论背景**：Tony Hoare 1978 年提出的 Communicating Sequential Processes。

Go 对 CSP 的简化：
- 进程 = goroutine（无命名，轻量）
- 通道 = channel（有类型，有缓冲选项）
- 没有 CSP 中的输入/输出命令前缀语法

**两条格言**：

> "Do not communicate by sharing memory; instead, share memory by communicating."

**但 Go 不教条**：`sync.Mutex`、`sync.RWMutex`、`sync.Map` 都存在。工程实践是：
- **channel**：用于编排（orchestration）、流水线、事件通知
- **mutex**：用于保护共享状态（state protection）

**代码对比**：

```go
// Channel 风格：数据流清晰
func producer(ch chan<- int) {
    for i := 0; i < 10; i++ {
        ch <- i
    }
    close(ch)
}

func consumer(ch <-chan int) {
    for v := range ch {
        fmt.Println(v)
    }
}
```

```go
// Mutex 风格：状态保护直接
var count int
var mu sync.Mutex

func increment() {
    mu.Lock()
    count++
    mu.Unlock()
}
```
