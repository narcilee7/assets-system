# Capacity Estimation Template

## 目标

掌握快速估算服务容量的方法，用于方案评审和资源规划。

## 场景

- 新服务上线前需要多少资源？
- 10 倍流量增长需要多少扩容？
- 方案评审时如何快速估算？

## 估算公式

```
服务容量 = 单节点容量 × 节点数 × 利用率

单节点容量 = min(单节点 CPU 承载, 单节点内存承载)

单节点 CPU 承载 = 可用 CPU 核数 / 单请求 CPU 时间

单节点内存承载 = 可用内存 / 单请求内存占用
```

## 快速估算模板

```python
def estimate_capacity(
    # 服务参数
    avg_cpu_per_request_ms: float = 10,      # ms CPU/请求
    avg_memory_per_request_mb: float = 50,   # MB/请求
    peak_factor: float = 3,                 # 峰值倍数
    
    # 资源配置
    cpu_cores_per_node: float = 4,           # 每节点 CPU 核数
    memory_gb_per_node: float = 8,           # 每节点内存 GB
    
    # 业务目标
    target_qps: int = 1000,                  # 目标 QPS
) -> dict:
    
    # 单节点容量
    cpu_limit_qps = (cpu_cores_per_node * 1000) / avg_cpu_per_request_ms
    memory_limit_qps = (memory_gb_per_node * 1024) / avg_memory_per_request_mb
    
    node_capacity = min(cpu_limit_qps, memory_limit_qps)
    safe_capacity = node_capacity * 0.7  # 70% 安全阈值
    
    # 满足目标需要的节点数
    nodes_needed = (target_qps * peak_factor) / safe_capacity
    
    return {
        "cpu_limit_qps_per_node": round(cpu_limit_qps, 0),
        "memory_limit_qps_per_node": round(memory_limit_qps, 0),
        "safe_qps_per_node": round(safe_capacity, 0),
        "nodes_needed": round(nodes_needed, 1),
        "nodes_needed_rounded": math.ceil(nodes_needed),
        "headroom_pct": round((safe_capacity * math.ceil(nodes_needed) - target_qps * peak_factor) / (target_qps * peak_factor) * 100, 1),
    }
```

## 资源规划表

| 服务 | 峰值 QPS | 单请求成本 | 安全 QPS/节点 | 需要节点 | CPU 预留 | 内存预留 |
|---|---|---|---|---|---|---|
| API Gateway | 10,000 | 5ms / 20MB | 200 | 50 | 80% | 70% |
| User Service | 5,000 | 10ms / 50MB | 100 | 50 | 80% | 70% |
| Order Service | 2,000 | 20ms / 100MB | 50 | 40 | 80% | 70% |

## 常见服务的经验值

```
Web 服务（无状态）：
  - 单核 CPU：200-500 QPS
  - 内存：取决于请求大小，通常 50-200MB/请求

API 服务：
  - 简单查询：500-1000 QPS/核
  - 复杂计算：50-100 QPS/核

数据库：
  - MySQL 简单查询：1000-5000 QPS
  - PostgreSQL：500-2000 QPS
  - 写操作通常只有读的 1/10

Redis：
  - GET：100,000+ QPS
  - SET：50,000+ QPS
```

## 成本估算

```python
def estimate_monthly_cost(
    nodes: int,
    cpu_per_node: float,
    memory_per_node: float,
    region: str = "us-west-2",
) -> dict:
    
    prices = {
        "us-west-2": {"cpu_per_core_hour": 0.0216, "gb_hour": 0.0059},
        "cn-beijing": {"cpu_per_core_hour": 0.034, "gb_hour": 0.008},
    }
    
    p = prices.get(region, prices["us-west-2"])
    
    hourly = nodes * (cpu_per_node * p["cpu_per_core_hour"] + memory_per_node * p["gb_hour"])
    monthly = hourly * 24 * 30
    
    return {
        "hourly": round(hourly, 2),
        "monthly_usd": round(monthly, 2),
        "nodes": nodes,
        "region": region,
    }
```

## 核心追问

1. **为什么用 70% 作为安全阈值？** 留 buffer 处理流量波动、应对突发、以及防止系统过载
2. **峰值因子怎么选？** 基于历史数据，通常 2-3 倍；电商大促可能 5-10 倍
3. **CPU 和内存谁先成为瓶颈？** CPU bound 更常见（计算密集）；内存 bound 通常是请求体大或泄漏
4. **如何验证估算准确？** 压测；实际运行观察资源使用
5. **估算和实际差距大怎么办？** 检查：实际单请求成本是否和估算一致、是否有缓存影响、是否有其他瓶颈

## 状态

| 资产 | 状态 |
|---|---|
| performance profiling toolkit | done |
| flame graph lab | done |
| latency budget worksheet | done |
| load test methodology | done |
| capacity estimation template | done |