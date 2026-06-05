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

## 核心追问

1. **perf 和火焰图的关系？** perf 是采样工具，收集 CPU 调用栈；火焰图是可视化工具，把采样数据渲染成 SVG
2. **火焰图怎么定位问题？** 找最宽的方块，从上往下看调用栈，找到"为什么这个函数占这么多 CPU"
3. **采样频率怎么选？** 99Hz 适合 30 秒采样，太高会有 overhead；生产环境建议 49Hz 或 99Hz 采样 30s
4. **如何判断是 CPU bound 还是 I/O bound？** CPU 高但 I/O 低：CPU bound；CPU 低但延迟高：I/O bound 或锁等待
5. **生产环境能用 perf 吗？** 可以，但建议低频采样（49Hz）且限制时间（30s），对性能影响 < 5%

## 状态

| 资产 | 状态 |
|---|---|
| performance profiling toolkit | done |
| flame graph lab | done |
| latency budget worksheet | todo |
| load test methodology | todo |
| capacity estimation template | todo |