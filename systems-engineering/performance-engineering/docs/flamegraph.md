# Flame Graph Lab

## 目标

通过实际案例掌握火焰图的生成和解读方法。

## 环境准备

```bash
# 安装 perf
sudo apt install linux-tools-common linux-tools-generic

# 安装 FlameGraph
git clone https://github.com/brendangregg/FlameGraph.git
export PATH=$PATH:$(pwd)/FlameGraph

# 检查权限
perf --version
# 如果 Permission denied: sudo sysctl kernel.perf_event_open=1
```

## Lab 1: CPU 火焰图

### 场景

```
假设服务响应慢，CPU 使用率高，想知道热点在哪里。

1. 启动测试服务（模拟 CPU 热点）
2. 采样 CPU 调用栈
3. 生成火焰图
4. 分析热点
```

### 步骤 1: 准备测试程序

```bash
cat > /tmp/hotspot.c << 'EOF'
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

void math_function() {
    double result = 0;
    for (int i = 0; i < 1000000; i++) {
        result += (double)i * i;
    }
}

void io_function() {
    volatile int x = 0;
    for (int i = 0; i < 1000; i++) {
        x = x * i + 1;
    }
}

void worker() {
    math_function();  // CPU 热点
    io_function();   // 模拟 I/O
}

int main() {
    while (1) {
        worker();
        usleep(1000);
    }
    return 0;
}
EOF
gcc -o /tmp/hotspot /tmp/hotspot.c
/tmp/hotspot &
HOTSPOT_PID=$!
```

### 步骤 2: 采样

```bash
# 采样 30 秒
sudo perf record -F 99 -g -p $HOTSPOT_PID -- sleep 30

# 检查采样数据
ls -la perf.data*
perf script --header | head -20
```

### 步骤 3: 生成火焰图

```bash
# 生成火焰图
perf script | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl > /tmp/cpu_flame.svg

# 查看火焰图（在浏览器中）
# open /tmp/cpu_flame.svg
```

### 步骤 4: 解读火焰图

```
火焰图解读：
  - 顶部：main -> worker -> math_function（最宽，CPU 热点）
  - main -> worker -> io_function（较窄）

如果 math_function 最宽，说明 CPU 时间主要花在这个函数上
优化方向：减少循环次数、改算法、用 SIMD
```

## Lab 2: Off-CPU 火焰图（锁等待）

### 场景

```
服务卡住了，CPU 不高但延迟高。
可能是锁等待、I/O 等待。

Off-CPU 火焰图可以显示等待时间分布。
```

### 步骤 1: 采样 Off-CPU

```bash
# 采样 Off-CPU（等待中的调用栈）
sudo perf record -F 99 -g -p $HOTSPOT_PID --sleep 30 -e sched:sched_stat_sleep -e sched:sched_switch

# 生成 Off-CPU 火焰图
perf script | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl --colors=blue > /tmp/offcpu_flame.svg
```

### 步骤 2: 对比

```
On-CPU Flame（红色）：显示 CPU 执行时间
Off-CPU Flame（蓝色）：显示等待时间

如果 Off-CPU 火焰图很宽，说明大部分时间在等待
```

## Lab 3: 内存分配火焰图

### 场景

```
内存持续增长，想知道是谁在分配内存。
```

### 步骤 1: 采样内存分配

```bash
# 使用 bcc 的 memleak
sudo /usr/share/bcc/tools/memleak -p $HOTSPOT_PID -t 10

# 输出示例：
# 追踪 10 秒后显示：
# [heap] size=1024 bytes, function=alloc_one, count=1000
# [heap] size=4096 bytes, function=alloc_two, count=500
```

### 步骤 2: 生成分配火焰图

```bash
# 如果程序支持，用 tcmalloc 的 heap profiler
HEAPPROFILE=/tmp/heap /tmp/hotspot &
google-pprof --svg /tmp/hotspot /tmp/heap.0001.heap > /tmp/heap_flame.svg
```

## Lab 4: Java 火焰图

### 前提

```bash
# Java 需要 -XX:+PreserveFramePointer
java -XX:+PreserveFramePointer -jar application.jar &
PID=$(pgrep -f application.jar)
sudo perf record -F 99 -g -p $PID -- sleep 30
perf script | ./FlameGraph/stackcollapse-perf.pl | ./FlameGraph/flamegraph.pl > /tmp/java_flame.svg
```

### Java 特定问题

```
Java 问题：
  - JIT 编译后函数名可能不准确
  - 需要 perf-map-agent 提供符号表

解决：
  - 启用 -XX:+PreserveFramePointer
  - 使用 async-profiler 比 perf 更准确
```

## 常见火焰图模式

### 1. 平顶山（Flat Top）

```
函数 A |████████████████████████████| 80%
其他函数  ▏

说明：A 是主要 CPU 热点
优化：A 函数本身的效率
```

### 2. 锯齿（Spikes）

```
    B
A   C
_____|_____

说明：C 是 B 调用的，但宽度来自 A
优化：看 B 是否必要，再看 A
```

### 3. 平庸平台（Boring Flat）

```
A |████████████|
B  |████████████|
C   |████████████|

说明：三个函数占用差不多
优化：可能是均衡的，没有单一热点
```

## 核心追问

1. **火焰图的方块宽度代表什么？** 在采样中出现的比例；越宽表示该函数占用 CPU 时间越多
2. **为什么火焰图是倒过来的？** 顶部是当前执行的函数，底部是根调用；宽的在上面说明是热点
3. **On-CPU 和 Off-CPU 火焰图的区别？** On-CPU 显示在 CPU 上执行的时间；Off-CPU 显示等待（锁、I/O）的时间
4. **采样频率对结果的影响？** 太高（> 200Hz）会干扰实际执行，太低（< 10Hz）可能漏掉短时热点
5. **为什么有时候看不到函数名？** 可能是内联、符号表缺失（需要 debug symbols）或 JIT 编译

## 状态

| 资产 | 状态 |
|---|---|
| performance profiling toolkit | done |
| flame graph lab | done |
| latency budget worksheet | done |
| load test methodology | todo |
| capacity estimation template | todo |