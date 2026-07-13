# testing

# Go `testing` 标准库面试深度指南

## 一、核心接口与基础用法

### 1. 三种测试类型

| 类型 | 签名 | 用途 | 运行方式 |
|------|------|------|----------|
| **单元测试** | `func TestXxx(t *testing.T)` | 验证功能正确性 | `go test` |
| **基准测试** | `func BenchmarkXxx(b *testing.B)` | 测量性能 | `go test -bench=.` |
| **模糊测试** | `func FuzzXxx(f *testing.F)` | 发现边界case | `go test -fuzz=.` (Go 1.18+) |

### 2. `testing.T` 核心方法

```go
// 失败控制
t.Fail()      // 标记失败，继续执行
t.FailNow()   // 标记失败，立即终止当前goroutine
t.Error(args) // 等价于 Log + Fail
t.Fatal(args) // 等价于 Log + FailNow

// 跳过与清理
t.Skip(args)      // 跳过当前测试
t.Cleanup(func()) // 注册清理函数（LIFO顺序执行）
t.Helper()        // 标记为辅助函数，错误行号定位到调用处

// 并行执行
t.Parallel()      // 标记可并行（与其他Parallel测试并发）
```

### 3. 高频面试考点：`Fail` vs `FailNow` 底层差异

```go
// Fail 只设置标志位，不触发 runtime.Goexit
func (c *common) Fail() {
    c.mu.Lock()
    defer c.mu.Unlock()
    if c.done {
        panic("Fail in goroutine after test completion")
    }
    c.failed = true
}

// FailNow 调用 runtime.Goexit，终止当前 goroutine
func (c *common) FailNow() {
    c.Fail()
    c.finished = true
    runtime.Goexit() // 关键：只退出当前 goroutine
}
```

**面试陷阱**：`t.Fatal` 在 goroutine 中调用**不会**终止主测试 goroutine，只退出当前 goroutine。如果在子 goroutine 里用 `t.Fatal`，主测试可能继续执行并通过，导致漏报。

---

## 二、子测试与表驱动测试（Table-Driven）

### 1. 子测试 `t.Run`

```go
func TestDivide(t *testing.T) {
    cases := []struct {
        name     string
        a, b, want int
        wantErr  bool
    }{
        {"normal", 6, 2, 3, false},
        {"zero_divisor", 6, 0, 0, true},
        {"negative", -6, 2, -3, false},
    }

    for _, tc := range cases {
        tc := tc // 捕获循环变量（Go < 1.22 必须）
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel() // 子测试也可并行
            got, err := Divide(tc.a, tc.b)
            if tc.wantErr {
                if err == nil { t.Fatal("expected error") }
                return
            }
            if got != tc.want {
                t.Fatalf("got %d, want %d", got, tc.want)
            }
        })
    }
}
```

### 2. 子测试执行控制

```go
t.Run("A", func(t *testing.T) { ... })     // 顺序执行
t.Run("B", func(t *testing.T) { ... })     // A 完成后才执行 B

// 并行子测试：A1/A2/A3 并行，但全部完成后才执行 B
t.Run("A", func(t *testing.T) {
    for i := 0; i < 3; i++ {
        t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
            t.Parallel()
            // ...
        })
    }
})
t.Run("B", func(t *testing.T) { ... })
```

---

## 三、基准测试深度原理

### 1. `testing.B` 核心机制

```go
func BenchmarkAppend(b *testing.B) {
    // 1. 基准测试自动决定 b.N（1, 2, 3, 5, 10, 20, 30, 50... 直到时间足够）
    // 2. 每次迭代都重新执行函数体
    for i := 0; i < b.N; i++ {
        _ = append([]int(nil), 1, 2, 3)
    }
}
```

### 2. 高级基准测试模式

```go
// 1. 重置计时器（排除初始化开销）
func BenchmarkComplex(b *testing.B) {
    heavySetup()
    b.ResetTimer() // 从此处开始计时
    for i := 0; i < b.N; i++ {
        TargetFunc()
    }
}

// 2. 停止/启动计时器（排除每次迭代的清理）
func BenchmarkWithCleanup(b *testing.B) {
    for i := 0; i < b.N; i++ {
        b.StopTimer()
        data := prepareData()
        b.StartTimer()
        Process(data)
    }
}

// 3. 内存分配统计
func BenchmarkAlloc(b *testing.B) {
    b.ReportAllocs() // 输出每次操作的内存分配次数和字节数
    for i := 0; i < b.N; i++ {
        _ = make([]byte, 1024)
    }
}
```

### 3. 面试常问：`b.N` 如何确定？

`testing` 包使用 **dynamically increasing N** 算法：
1. 初始 `b.N = 1`
2. 运行测试，测量耗时
3. 如果耗时 < 1s（默认），按 `1, 2, 3, 5, 10, 20, 30, 50, 100...` 序列增加 N
4. 直到总运行时间 ≥ 1s 或 `b.N` 达到上限（1e9）
5. 最终用稳定后的 N 计算 `ns/op`

---

## 四、模糊测试（Fuzzing）Go 1.18+

### 1. 基本结构

```go
func FuzzParse(f *testing.F) {
    // 1. 种子语料（corpus）
    f.Add("hello")
    f.Add("world123")
    
    // 2. 模糊目标函数
    f.Fuzz(func(t *testing.T, input string) {
        result, err := Parse(input)
        if err != nil {
            t.Skip() // 某些输入可能确实无效
        }
        // 验证不变量
        if len(result) > len(input) {
            t.Fatal("result longer than input")
        }
    })
}
```

### 2. 面试要点

- **语料库**：`test/fuzz/` 目录或 `f.Add()` 提供的种子输入
- **覆盖率引导**：Go 的 fuzzer 使用覆盖率反馈生成新输入
- **崩溃复现**：发现崩溃后，最小化输入并保存到 `testdata/fuzz/`
- **运行命令**：`go test -fuzz=FuzzParse -fuzztime=30s`

---

## 五、测试辅助工具与最佳实践

### 1. `testify` vs 标准库

虽然 `testify` 很流行，但面试时展示标准库能力更重要：

```go
// 标准库写法（面试推荐）
if got != want {
    t.Errorf("Add(%d, %d) = %d, want %d", a, b, got, want)
}

// testify 写法（项目常用）
assert.Equal(t, want, got)
require.NoError(t, err)
```

**面试建议**：可以说"项目里用 testify 提高效率，但底层原理都清楚"。

### 2. `TestMain` 全局控制

```go
func TestMain(m *testing.M) {
    // 全局 setup
    setup()
    
    // 运行所有测试
    code := m.Run()
    
    // 全局 teardown
    teardown()
    
    os.Exit(code)
}
```

### 3. 常用 `go test` 标志

```bash
# 基础
go test -v                    # 详细输出
go test -run=TestFoo        # 正则匹配测试名
go test -count=1            # 禁用缓存（强制重新运行）

# 覆盖率
go test -cover              # 覆盖率概览
go test -coverprofile=c.out # 输出覆盖率文件
go tool cover -html=c.out   # 可视化

# 竞态检测
go test -race               # 检测 data race（面试高频！）

# 性能
go test -bench=. -benchmem  # 显示内存分配
go test -cpuprofile=cpu.out # CPU 分析
go test -memprofile=mem.out # 内存分析
```

---

## 六、底层实现与面试深挖

### 1. 测试文件的编译与执行

```
go test 执行流程：
1. go test 收集所有 _test.go 文件
2. 生成临时测试二进制（包含 testing 包的 test runner）
3. 编译时注入测试函数列表（通过 go tool 生成的 _testmain.go）
4. 运行测试二进制，按依赖顺序执行
```

### 2. `Parallel()` 的并发模型

```go
// 伪代码示意
func (t *T) Parallel() {
    t.isParallel = true
    t.parent.sub = append(t.parent.sub, t)
    // 当前 goroutine 阻塞，等待调度器唤醒
    <-t.parallelStart
}
```

- 顶层 `Parallel()` 测试默认并发数 = `GOMAXPROCS`
- 子测试的并行受父测试控制：父测试等待所有子测试完成
- 使用 `t.Setenv` 的测试**不能**并行（环境变量是进程全局的）

### 3. 测试缓存机制

```go
// 测试缓存 key = 文件哈希 + 测试参数 + 环境变量
// 命中缓存时直接输出 (cached)，跳过执行
go test -count=1  // 禁用缓存
go clean -testcache // 清除缓存
```

---

## 七、高频面试题与答案

### Q1: `t.Fatal` 能在 goroutine 里用吗？
**A**: 能调用，但**效果不对**。`t.Fatal` 内部调用 `runtime.Goexit()` 只退出当前 goroutine。如果在子 goroutine 里调用，主测试 goroutine 继续运行，测试可能错误地通过。正确做法是用 `sync.WaitGroup` + `errChan` 收集错误，在主 goroutine 里 `t.Fatal`。

### Q2: 如何测试未导出的函数？
**A**: 
1. 测试文件放在同包（`package foo` 而非 `package foo_test`）
2. 或使用 `export_test.go` 模式导出内部符号：
```go
// export_test.go
package foo
var ParseInternal = parseInternal  // 小写转大写导出，仅测试用
```

### Q3: `go test` 的 `-race` 原理？
**A**: Go 的 race detector 基于 **ThreadSanitizer (TSAN)**，编译时插桩所有内存访问和同步原语调用。运行时记录内存访问历史，检测无锁保护的并发读写。开销约 5-10x 内存，10x 执行时间。

### Q4: 子测试 `t.Run` 和顶层测试的 `Parallel` 如何交互？
**A**: 顶层测试先串行执行，遇到 `t.Parallel()` 时暂停该 goroutine 加入并行队列。等所有顶层测试的"串行部分"执行完，调度器按 `GOMAXPROCS` 并发执行所有被标记为 Parallel 的测试。子测试的 Parallel 行为类似，但受父测试生命周期约束。

### Q5: 测试里怎么 mock 时间/network？
**A**: 标准库推荐**接口注入**：
```go
type HTTPClient interface {
    Do(req *http.Request) (*http.Response, error)
}

// 生产用 http.DefaultClient，测试用 mock
```

---

## 八、快速记忆卡片

```
T: Test, Error/Fatal, Skip, Parallel, Run, Cleanup, Helper
B: Benchmark, N, ResetTimer, StopTimer, StartTimer, ReportAllocs
F: Fuzz, Add, Fuzz (corpus-guided)
M: TestMain, Run, Exit
```
