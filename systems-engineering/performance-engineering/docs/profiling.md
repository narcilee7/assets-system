# Performance Profiling Toolkit

## 目标

掌握 Linux 性能分析工具：CPU profiling、内存分析、I/O 分析、以及火焰图生成和解读。

## 场景

- 服务 CPU 高，怎么定位热点函数？
- 内存泄漏怎么排查？
- 为什么延迟高但 CPU 不高？
- 火焰图怎么读？

## 工具地图

| 场景 | 工具 | 用途 |
|---|---|---|
| CPU 热点 | perf / flamegraph | 采样 CPU 调用栈，生成火焰图 |
| 内存分配 | /usr/bin/time -v / pmap | 查看内存使用详情 |
| 内存泄漏 | memleak-tools / bcc | 跟踪 malloc/free 找到泄漏点 |
| I/O | iostat / pidstat | 磁盘和进程 I/O |
| 网络 | ss / tcpdump | Socket 统计和抓包 |
| 系统调用 | strace / perf | 系统调用分析 |

## CPU Profiling

### perf 基本用法

```bash
# 1. 采样 CPU 调用栈（需要 root）
perf record -F 99 -g -p <pid> -- sleep 30
# -F 99: 每秒 99 次采样（足够精确）
# -g: 记录调用栈
# -p <pid>: 采样指定进程
# -- sleep 30: 采样 30 秒

# 2. 生成火焰图
git clone https://github.com/brendangregg/FlameGraph.git
perf script | FlameGraph/stackcollapse-perf.pl | FlameGraph/flamegraph.pl > flame.svg

# 3. 查看采样结果
perf report

# 4. 系统级采样（所有进程）
perf record -F 99 -ag -- sleep 30
```

### perf 进阶用法

```bash
# 采样特定符号
perf record -F 99 -g -p <pid> --call-graph dwarf -e cycles:u -e cycles:k

# 查看特定时间范围
perf record -F 99 -p <pid> -- sleep 60
perf report --stdio | grep -A 5 "function_name"

# 热点分析（按 CPU 时间排序）
perf report --stdio -g none | head -50

# 热点分析（带调用栈）
perf report --stdio -g | head -100
```

## Flame Graph（火焰图）

### 火焰图怎么看

```
含义：
  - 每个方块 = 一个函数
  - 方块宽度 = 该函数在采样中出现的比例（越宽越慢）
  - 纵向 = 调用栈（从上到下是调用顺序）
  - 横向 = 同一层级函数的并列关系

读法：
  - 宽的方块 = 热点（占用 CPU 多）
  - 顶层 = 叶函数（不调用其他函数）
  - 底部 = 根函数（主函数）
```

### 生成火焰图

```bash
# 方式 1: perf + FlameGraph
perf record -F 99 -ag -- sleep 30 -- <program>
perf script | ./stackcollapse-perf.pl | ./flamegraph.pl > output.svg

# 方式 2: 内存火焰图
perf record -F 99 -g -p <pid> -e allocstall -- sleep 30

# 方式 3: Java 火焰图
java -XX:+PreserveFramePointer -jar app.jar &
perf record -F 99 -g -p $(pgrep java) -- sleep 60
```

## 内存分析

### 内存使用分析

```bash
# 查看进程内存使用
ps aux --sort=-%mem | head

# 详细内存映射
pmap -x <pid> | sort -k 3 -rn | head 20

# 查看内存增长趋势
for i in {1..10}; do
  cat /proc/$pid/status | grep VmRSS
  sleep 5
done

# 查看 slab 内存（kernel 对象）
slabtop -o | head -20
```

### 内存泄漏检测

```bash
# 方法 1: 手动对比 RSS 增长
# 监控进程 RSS 变化
watch -n 5 "ps -o pid,rss,vsz -p <pid>"

# 方法 2: valgrind（会影响性能）
valgrind --leak-check=full --track-origins=yes ./program

# 方法 3: bcc tools（生产可用）
# 查找未释放的内存分配
/usr/share/bcc/tools/memleak -p <pid> 10
# 每 10 秒采样，打印仍未释放的分配
```

### 对象大小分析

```bash
# 查看堆对象统计
cat /proc/<pid>/smaps | grep -A 5 "Heap"

# 查看内存分配大小
pmap -x <pid> | grep -E "rw-p|堆" | head
```

## 延迟分析

### 延迟来源分析

```bash
# 抖动分析（Latency）
# perf sched 追踪调度延迟
perf sched record -p <pid> -- sleep 30
perf sched latency --stdio

# 输出：
#  Task                  | Runtime ms  | Switches | Avg delay ms | Max delay ms
#  app                   |  5000.00 ms |      100 |      0.50 ms |      5.00 ms

# 追踪 I/O 延迟
blktrace -d /dev/sda -o - | blkparse -i -

# 网络延迟
ping -c 100 <target>
```

### 队列延迟

```bash
# 查看运行队列长度（调度延迟）
vmstat 1

# 查看 CPU 运行状态
mpstat -P ALL 1

# 查看调度延迟分布
perf sched timehist
```

## L2：Profiler 底层机制对照

### perf_event_open 与 PMU

```
perf record -F 99 -g -p <pid>
  └── 内核创建 perf_event，绑定到进程的 context switch
      └── 硬件 PMU (Performance Monitoring Unit) 的 cycle counter
          └── 每 N 个 CPU cycle 触发一次 PMI (Performance Monitoring Interrupt)
              └── 内核保存当前 PC (program counter) 和调用栈
                  └── 写入 perf_event mmap ring buffer
                      └── 用户态 perf 读取并生成 perf.data
```

为什么选 **99Hz** 而不是 100Hz？避免与电源管理或其他固定 100Hz 事件对齐，减少采样偏差。

### 语言级 Profiler 原理

| 语言 | Profiler | 底层机制 | 开销 |
|---|---|---|---|
| Go | `runtime/pprof` | `setitimer(ITIMER_PROF, 99Hz)` → `SIGPROF` → 遍历所有 `g` 的栈 | 低（纯用户态，无内核栈 walk） |
| Python | `cProfile` | `_PyEval_EvalFrameDefault` 进入/退出时计数 | 中高（解释器钩子，10-30% 开销） |
| Java | async-profiler | `perf_event_open` + `mmap` 读取内核栈，配合 `AsyncGetCallTrace` | 极低（< 1%） |
| Node.js | `--prof` | V8 内置采样器，基于 wall-clock 采样 JS 栈 | 低 |

### 火焰图反模式

1. **inline 函数消失**：编译器内联后，小函数不会出现在栈中；Go 用 `-l` 关闭内联观察，Java 用 `-XX:-Inline`（仅 debug）。
2. **尾递归失真**：尾调用优化后，递归深度不会体现在栈高度上。
3. **动态代理栈爆炸**：Java 的 `ReflectiveMethodAccessor` 和 CGLIB 会在火焰图中产生大量窄条，掩盖真实业务热点。

## L3：可运行实验

见 `impl/profiling_lab/`。推荐用 **Python** 快速体验：

```bash
cd systems-engineering/performance-engineering/impl/profiling_lab/python
pip install -r requirements.txt
./profile.sh
# 生成 flame.svg，观察 fib 函数占比
```

Go / Java / TS 实现也在同级目录，供对照。

## 核心追问

1. **perf 和火焰图的关系？** perf 是采样工具，收集 CPU 调用栈；火焰图是可视化工具，把采样数据渲染成 SVG
2. **火焰图怎么定位问题？** 找最宽的方块，从上往下看调用栈，找到"为什么这个函数占这么多 CPU"
3. **采样频率怎么选？** 99Hz 适合 30 秒采样，太高会有 overhead；生产环境建议 49Hz 或 99Hz 采样 30s
4. **如何判断是 CPU bound 还是 I/O bound？** CPU 高但 I/O 低：CPU bound；CPU 低但延迟高：I/O bound 或锁等待
5. **生产环境能用 perf 吗？** 可以，但建议低频采样（49Hz）且限制时间（30s），对性能影响 < 5%

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| performance profiling toolkit | L2 | done |
| flame graph lab | L2 | done |
| latency budget worksheet | L1 | todo |
| load test methodology | L1 | todo |
| capacity estimation template | L1 | todo |