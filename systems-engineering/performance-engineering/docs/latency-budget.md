# Latency Budget Worksheet

## 目标

掌握端到端延迟的拆解方法，将总延迟分配到每个组件，识别瓶颈。

## 场景

- P99 延迟 500ms，怎么定位慢在哪？
- 网络延迟、服务处理时间、数据库查询时间各占多少？
- 如何设定合理的延迟 budget？

## 延迟拆解框架

```
总延迟 = 网络延迟 + 服务处理 + 中间件 + 数据库

P99 总延迟 = P99(网络) + P99(服务) + P99(中间件) + P99(数据库)
```

## 典型延迟数字

```
现代数据中心：
  - L1 cache: 1 ns
  - L2 cache: 4 ns
  - L3 cache: 15 ns
  - Memory: 100 ns
  - NVMe SSD: 100 μs
  - SATA SSD: 500 μs
  - HDD: 10 ms
  - Network (same AZ): 0.5 ms
  - Network (cross AZ): 1-5 ms
  - Network (cross region): 50-100 ms

DNS lookup: 10-100 ms
TCP connection (same region): 1-5 ms
TLS handshake (1-RTT): 5-15 ms
```

## 延迟拆解实例

### Web API 请求

```
请求路径：
  客户端 -> CDN -> LB -> Nginx -> 应用 -> Redis -> MySQL
```

| 阶段 | 典型延迟 | P99 估算 |
|---|---|---|
| DNS | 5 ms | 20 ms |
| TCP/TLS 连接 | 10 ms | 30 ms |
| LB 转发 | 1 ms | 3 ms |
| Nginx 处理 | 2 ms | 5 ms |
| 应用逻辑 | 20 ms | 50 ms |
| Redis 查询 | 2 ms | 10 ms |
| MySQL 查询 | 5 ms | 30 ms |
| **总计** | **45 ms** | **148 ms** |

### 计算公式

```python
def budget_latency(
    network_latency: float,    # ms
    service_latency: float,    # ms
    db_latency: float,         # ms
    p99_multiplier: float = 1.5,  # P99 vs avg 通常 1.5x
) -> dict:
    
    avg_total = network_latency + service_latency + db_latency
    
    # P99 估算（各组件 P99 叠加）
    p99_total = sum([
        network_latency * p99_multiplier,
        service_latency * p99_multiplier,
        db_latency * p99_multiplier,
    ])
    
    return {
        "avg_latency_ms": round(avg_total, 1),
        "p99_latency_ms": round(p99_total, 1),
        "network_pct": round(network_latency / avg_total * 100, 1),
        "service_pct": round(service_latency / avg_total * 100, 1),
        "db_pct": round(db_latency / avg_total * 100, 1),
    }
```

## 定位延迟瓶颈

### 方法 1：日志打点

```python
import time

class LatencyTracker:
    def __init__(self):
        self.timestamps = {}
    
    def start(self, name: str):
        self.timestamps[name] = time.perf_counter()
    
    def end(self, name: str) -> float:
        if name not in self.timestamps:
            return 0
        return (time.perf_counter() - self.timestamps[name]) * 1000
    
    def report(self):
        return {k: f"{v:.2f}ms" for k, v in self.items()}

# 使用
tracker = LatencyTracker()
tracker.start("db_query")
# ... db query ...
db_time = tracker.end("db_query")

tracker.start("cache_check")
# ... cache check ...
cache_time = tracker.end("cache_check")
```

### 方法 2：分布式追踪

```yaml
# OpenTelemetry 配置
instrumentation:
  trace:
    - name: http.request
      attributes:
        - key: service.name
          value: api
        - key: http.method
    - name: db.query
      attributes:
        - key: db.system
          value: mysql
        - key: db.statement
```

### 方法 3：主动测量

```bash
# 测量各组件延迟
# Redis
redis-cli --latency-history -h redis-host

# MySQL
mysqlslap --concurrency=10 --iterations=5 --query="SELECT * FROM users WHERE id=1"

# 网络
ping -c 100 redis-host | tail -1
```

## 延迟优化优先级

```
高价值优化（延迟占比 > 30%）：
  - 优化主要瓶颈
  - 可能减少 50%+ 总延迟

中等价值优化（延迟占比 10-30%）：
  - 缓存、索引、连接池
  - 可能减少 20-30% 总延迟

低价值优化（延迟占比 < 10%）：
  - 小幅优化收效甚微
  - 除非没有其他选择
```

## L2 深挖：数字锚定与源码出处

### 典型延迟数字的出处与可复现性

以下数字均来自可复现实验或内核源码，而非经验估算：

| 操作 | 延迟 | 出处 | 复现方式 |
|---|---|---|---|
| L1 cache hit | ~1 ns | CPU 架构手册 | `lmbench` lat_mem_rd |
| L2 cache hit | ~4 ns | CPU 架构手册 | `lmbench` lat_mem_rd |
| Main memory access | ~100 ns | `mem_latency.c` | `lmbench` lat_mem_rd |
| `getpid()` syscall | ~60 ns | Linux 5.15 x86-64 | `bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @start[tid] = nsecs; } tracepoint:raw_syscalls:sys_exit { @us = hist((nsecs - @start[tid]) / 1000); }'` |
| `read()` pipe | ~300 ns | Linux 5.15 x86-64 | `bpftrace` 同上，过滤 `args->id == 0` |
| Context switch | ~1.5-3 μs | `perf sched latency` | `perf sched record -- sleep 10 && perf sched latency` |
| `epoll_wait(0)` | ~600 ns | `syscount-bpfcc` | `syscount-bpfcc -L -P` |
| NVMe SSD I/O | ~100 μs | `fio --randread` | `fio --name=randread --ioengine=libaio --iodepth=1 --rw=randread --bs=4k --direct=1` |
| TCP same-AZ RTT | ~0.5 ms | `ping` | `ping -c 100 <same_az_ip>` |
| TCP cross-region RTT | ~50-150 ms | `ping` | `ping -c 100 <cross_region_ip>` |
| TLS 1.3 握手 | ~5-15 ms | `openssl s_time` | `openssl s_time -connect host:443 -new` |
| MySQL simple query | ~1-5 ms | `performance_schema.events_statements_history_long` | `SELECT EVENT_NAME, AVG_TIMER_WAIT/1e9 FROM events_statements_summary_by_digest` |
| Redis GET | ~0.5-2 ms | `redis-cli --latency` | `redis-cli --latency -h host` |

### 内核延迟路径源码锚定

**DNS 解析路径（Linux glibc）**：

```c
// resolv/res_send.c: __res_context_send
//  -> 构造 UDP/TCP DNS 查询包
//  -> 发送到 /etc/resolv.conf 中的 nameserver
//  -> 默认超时 5s，重试 2 次
```

DNS 延迟长尾的主要来源：
1. **递归查询**：本地缓存 miss → 向权威 DNS 递归查询（+1-2 RTT）。
2. **TCP fallback**：UDP 响应 > 512B 时，glibc 自动切换到 TCP（额外 1 RTT + TCP 握手）。
3. **`ndots` 陷阱**：`resolv.conf` 中 `ndots:5` 导致短域名先尝试 5 次绝对域名查询（见 `cloud-native/impl/ingress_lab/dns_ndots.py`）。

**TCP 握手到首字节路径（Linux 内核）**：

```
网卡中断 → NAPI poll → tcp_v4_rcv() → tcp_rcv_established()
  → socket 就绪 → epoll_wait 返回 → 用户态 read()
  → HTTP parser → 业务处理 → write() → tcp_transmit_skb()
```

关键观测点：`ss -i` 输出的 `rtt` 和 `ato`（ack timeout）可以直接反映内核 TCP 栈的延迟状态。

**MySQL 查询延迟路径**：

```
SQL parse (sql/sql_parse.cc: mysql_parse)
  -> Optimizer (sql/sql_optimizer.cc)
  -> Executor
     -> handler::ha_index_read() 或 ha_rnd_pos()（回表）
     -> buf_page_get() 从 InnoDB Buffer Pool 取页
        -> 若 miss：fil_io() 从磁盘读取（~10ms）
```

InnoDB Buffer Pool hit rate 是数据库延迟的核心变量。`SHOW ENGINE INNODB STATUS` 中的 `Buffer pool hit rate` 应 > 99%。

### P99 叠加的统计陷阱

**保守估计**：`P99_total ≈ Σ P99_component`

这个公式的假设是"所有组件同时到达各自的 P99"，这在统计学上概率极低。如果各组件延迟独立且服从正态分布：

```
Var(total) = Σ Var(component)
σ_total = sqrt(Σ σ_i^2)
```

实际 P99_total（独立正态和）通常小于直接相加。但工程上保守估计更安全：
- **直接相加** = 最坏情况预算（所有组件同时坏）
- **平方和开方** = 理想独立情况
- 真相通常介于两者之间

**陷阱**：如果两个组件强相关（如 "数据库查询慢" 和 "Redis 查询慢" 都由同一台机器 CPU 高引起），则它们不是独立的，直接相加反而可能低估。

### 延迟与吞吐的权衡曲线

```
延迟
  ^
  |      _______ 饱和点
  |     /
  |    /
  |___/
  +----------------> 并发数/QPS

低负载区：延迟稳定（资源充足）
饱和区：延迟指数上升（队列堆积）
崩溃区：错误率飙升（连接池耗尽、超时）
```

**Little's Law**：`L = λ × W`
- `L` = 系统中平均请求数（并发数）
- `λ` = 到达率（QPS）
- `W` = 平均延迟

当 `λ` 接近服务能力上限时，`W` 会非线性增长。延迟预算必须定义在"期望负载"下，而非空载下。

## L3：可运行实验

见 `impl/latency_budget_lab/`：

```bash
cd systems-engineering/performance-engineering/impl/latency_budget_lab
pip install -r requirements.txt

# 实验 1：内置场景预算分析
python3 budget_calculator.py --scenario web_api
python3 budget_calculator.py --scenario microservice
python3 budget_calculator.py --scenario ai_inference

# 实验 2：交互式自定义预算
python3 budget_calculator.py --interactive

# 实验 3：端到端延迟追踪（真实 URL）
python3 trace_request.py --url https://httpbin.org/get --samples 50
python3 trace_request.py --url https://your-api.com/endpoint --samples 100

# 实验 4：本地服务追踪（配合 loadtest_lab）
# 终端 A: python3 ../loadtest_lab/target_server.py --port 8080
# 终端 B: python3 trace_request.py --url http://localhost:8080/api/slow --samples 50
```

实验覆盖：
- `budget_calculator.py`：验证"组件延迟贡献占比"和"敏感性分析"
- `trace_request.py`：验证"真实 HTTP 请求各阶段延迟拆解"（DNS / TCP+TLS / TTFB / Download）

## 核心追问

1. **P99 和 P999 的区别？** P99 是 99% 请求低于此值；P999 是 99.9% 请求低于此值；P999 会明显更高，因为抓到的是尾部
2. **如何估算组件的 P99？** 通常取 average × 1.5；或者用实际监控数据的历史 P99
3. **为什么延迟会波动？** 资源竞争（CPU 争抢）、GC、锁等待、网络抖动、数据库连接池耗尽
4. **延迟 budget 怎么设定？** 基于 SLA 倒推；如果 SLA 是 500ms P99，留 20% buffer，budget 是 400ms
5. **哪个组件最容易成为瓶颈？** 数据库（MySQL/Redis）通常是瓶颈；网络是跨机房延迟的主要来源

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| performance profiling toolkit | L2 | done |
| flame graph lab | L2 | done |
| latency budget worksheet | **L2+L3** | **done** |
| load test methodology | L2+L3 | done |
| capacity estimation template | L1 | todo |