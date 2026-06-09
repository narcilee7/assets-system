# 性能分析与调试

## 1. CPU Profiling

```
CPU Profiling 方法

采样型（Sampling）
├── 原理：定时中断，记录当前执行位置
├── 频率：100Hz（每 10ms 采样一次）
├── 优点：低开销（< 5%），适合生产
├── 缺点：可能错过短时执行
└── 工具：pprof（Go）、py-spy（Python）、async-profiler（Java）

插桩型（Instrumentation）
├── 原理：在每个函数入口/出口插入计时代码
├── 优点：精确，捕获所有调用
├── 缺点：高开销（10-50%），不适合生产
└── 工具：gperftools、JProfiler

解读 Flame Graph
├── 宽度 = 该函数在采样中出现的频率
├── 高度 = 调用栈深度
├── 颜色 = 无意义（仅区分不同函数）
├── 底部 = 入口函数（main / request handler）
└── 宽且平顶 = 热点函数（优化目标）
```

```bash
# Go pprof
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Python py-spy
py-spy top --pid 12345
py-spy record -o profile.svg --pid 12345

# Node.js
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

## 2. Memory Profiling

```
内存分析类型

Heap Profile
├── 原理：记录堆内存分配
├── 用途：
│   ├── 查找内存泄漏
│   ├── 识别大对象分配
│   └── 优化内存使用
├── 视图：
│   ├── inuse_space：当前仍在使用的内存
│   ├── inuse_objects：当前仍在使用的对象数
│   ├── alloc_space：累计分配的内存
│   └── alloc_objects：累计分配的对象数
└── 工具：pprof heap、valgrind、heaptrack

Goroutine / Thread Dump
├── 原理：记录所有 goroutine/thread 的堆栈
├── 用途：
│   ├── 查找 goroutine 泄漏
│   ├── 检测死锁
│   └── 理解并发模式
└── 工具：pprof goroutine、jstack

内存泄漏检测
├── 现象：内存持续增长，GC 后不回降
├── 原因：
│   ├── 全局缓存无上限
│   ├── goroutine 泄漏（channel 阻塞）
│   ├── 未关闭的连接/文件句柄
│   └── 闭包捕获大对象
└── 方法：对比两个时间点的 heap profile
```

```bash
# Go heap profile
curl http://localhost:6060/debug/pprof/heap > heap.pb.gz
go tool pprof -http=:8080 heap.pb.gz

# 对比两个 heap profile
go tool pprof -base=heap1.pb.gz heap2.pb.gz
```

## 3. Continuous Profiling

```
持续性能分析

传统方式：
├── 问题发生后手动采集
├── 需要复现问题
└── 可能错过关键时刻

Continuous Profiling：
├── 7x24 小时自动采集
├── 保存历史数据
├── 任意时间点对比
└── 与告警联动（异常时自动深度采集）

工具：
├── Parca：开源，Prometheus 风格
├── Pyroscope：开源，支持多种语言
├── Google Cloud Profiler：托管
├── AWS CodeGuru Profiler：托管
└── Datadog Continuous Profiler：商业

架构：
App ──▶ Agent ──▶ Profile Server ──▶ Storage
            │            │              │
         eBPF/        Parca/         Object
         Manual       Pyroscope      Storage
```

## 4. 调试工具

```
运行时调试

GDB / LLDB
├── 断点调试
├── 查看变量
├── 调用栈回溯
└── 适合：C/C++/Go/Rust

Delve（Go）
dlv attach <pid>
dlv debug --headless --listen=:2345 --api-version=2

pdb（Python）
import pdb; pdb.set_trace()

Node.js Inspector
node --inspect app.js
chrome://inspect

远程调试
├── IDE 连接远程调试端口
├── K8s：kubectl port-forward pod 端口映射
└── 安全：仅允许特定 IP，使用 SSH 隧道
```

```
分布式调试

日志追踪
├── 按 RequestID 查询所有相关日志
├── 按 TraceID 查看完整调用链
└── 按 UserID 查看用户行为轨迹

混沌工程
├── 目的：验证系统韧性
├── 方法：
│   ├── 随机终止 Pod（Chaos Monkey）
│   ├── 模拟网络分区
│   ├── 注入延迟
│   └── 模拟依赖故障
└── 工具：Chaos Mesh、Litmus、Gremlin

Snapshot Debugging
├── 原理：捕获程序状态的快照
├── 用途：离线分析生产环境问题
└── 工具：_rr_（Mozilla）、LiveRecorder
```
