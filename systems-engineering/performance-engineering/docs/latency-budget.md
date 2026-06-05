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

## 核心追问

1. **P99 和 P999 的区别？** P99 是 99% 请求低于此值；P999 是 99.9% 请求低于此值；P999 会明显更高，因为抓到的是尾部
2. **如何估算组件的 P99？** 通常取 average × 1.5；或者用实际监控数据的历史 P99
3. **为什么延迟会波动？** 资源竞争（CPU 争抢）、GC、锁等待、网络抖动、数据库连接池耗尽
4. **延迟 budget 怎么设定？** 基于 SLA 倒推；如果 SLA 是 500ms P99，留 20% buffer，budget 是 400ms
5. **哪个组件最容易成为瓶颈？** 数据库（MySQL/Redis）通常是瓶颈；网络是跨机房延迟的主要来源

## 状态

| 资产 | 状态 |
|---|---|
| performance profiling toolkit | done |
| flame graph lab | done |
| latency budget worksheet | done |
| load test methodology | todo |
| capacity estimation template | todo |