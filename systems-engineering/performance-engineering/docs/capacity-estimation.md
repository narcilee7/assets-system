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

## L2 深挖：排队论基础与利用率陷阱

### Little's Law

```
L = λ × W

L = 系统中平均请求数（并发数）
λ = 到达率（QPS）
W = 平均停留时间（延迟）
```

**工程意义**：
- 如果 SLA 要求平均延迟 < 200ms，峰值 QPS = 1000，则系统必须能同时处理 `L = 1000 × 0.2 = 200` 个并发请求。
- 如果单节点只能处理 50 个并发，则至少需要 4 个节点。

### M/M/1 队列与利用率-延迟关系

单服务台、泊松到达、指数服务时间的排队模型：

```
利用率 ρ = λ / μ  （到达率 / 服务率）

平均队列长度：Lq = ρ² / (1 - ρ)
平均等待时间：Wq = Lq / λ = ρ / (μ - λ)
平均系统时间：W = Wq + 1/μ = 1 / (μ - λ)
```

**关键数字**：

| ρ | 平均排队延迟 / 服务时间 | P99 排队延迟 / 服务时间 | 系统状态 |
|---|---|---|---|
| 0.5 | 0.5× | ~3× | 健康，队列短 |
| 0.7 | 1.2× | ~5× | 可接受，轻微排队 |
| 0.8 | 2.0× | ~10× | 紧张，明显感知 |
| 0.9 | 5.0× | ~30× | 危险，长尾严重 |
| 0.95 | 10.0× | ~60× | 濒临崩溃 |

**为什么 70% 是安全阈值？**

- ρ = 70% 时，平均排队延迟 ≈ 1.2 × 服务时间，额外开销可控。
- 留有 30% headroom 应对突发流量（burst）和故障转移。
- 云原生场景下，HPA（Horizontal Pod Autoscaler）通常以 70% CPU 为扩容阈值。

### 超线程（SMT）的容量陷阱

Intel/AMD 超线程将单个物理核心暴露为 2 个逻辑核心，但**执行单元是共享的**：

```
实际性能提升：
  - 理想混合负载（整数 + 浮点）：~1.3x
  - 同质化负载（全是相似指令）：~1.1x
  - 极端竞争（两个线程争用同一执行单元）：~1.0x
```

**工程建议**：
- 容量估算时，`effective_cores = physical_cores × 1.2`（而非 × 2）。
- 延迟敏感服务应绑定物理核心（`taskset` 或 Kubernetes `cpu-manager-policy=static`）。

### 数字锚定：真实服务的单核 QPS

| 服务类型 | 单核 QPS | 条件 | 出处 |
|---|---|---|---|
| Nginx static file | ~100,000 | 4KB, keep-alive | `wrk` 官方 benchmark |
| Nginx + PHP-FPM | ~500-1,000 | 简单业务逻辑 | 生产环境观测 |
| Node.js Express | ~5,000-10,000 | JSON API, no DB | `autocannon` benchmark |
| Go net/http | ~30,000-50,000 | Echo server | `wrk` benchmark |
| Java Spring Boot | ~3,000-8,000 | 简单 REST | JMH + wrk |
| Python FastAPI | ~2,000-5,000 | Async, no DB | `wrk` benchmark |
| MySQL simple SELECT | ~1,000-3,000 | PK lookup, in-memory | `sysbench` |
| Redis GET | ~100,000+ | 本地, pipeline | `redis-benchmark` |
| PostgreSQL simple | ~500-2,000 | 索引查询 | `pgbench` |

**关键结论**：
- 语言/框架差异可达 10-50 倍（Nginx C vs Python）。
- 数据库的瓶颈通常不在 CPU，而在锁、I/O 和连接数。
- 缓存（Redis）可以把读 QPS 提升 100 倍。

### 边界陷阱

1. **冷启动惩罚**：JVM、Python 进程、容器启动都有预热时间，容量估算必须包含 warmup 阶段的额外资源消耗。
2. **缓存命中率突变**：缓存失效或预热不足时，QPS 可能骤降 10 倍，但 CPU 使用率反而上升（更多计算替代缓存读取）。
3. **NUMA 亲和性**：跨 NUMA 节点的内存访问延迟增加 ~20-30%，高并发服务应使用 `numactl --interleave=all` 或绑定本地内存。
4. **网络带宽瓶颈**：1Gbps 网卡的理论上限 ~125MB/s，如果单请求响应 100KB，则最大 QPS ≈ 1250。这在视频/图片服务中很常见。
5. **连接池耗尽**：即使 CPU 和内存充足，Tomcat/DB 连接池耗尽也会导致错误率飙升。

## L3：可运行实验

见 `impl/capacity_lab/`：

```bash
cd systems-engineering/performance-engineering/impl/capacity_lab

# 实验 1：单场景容量估算
python3 capacity_calculator.py --scenario simple_api --target-qps 10000 --peak-factor 2.5

# 实验 2：节点规格对比（成本 vs 利用率）
python3 capacity_calculator.py --scenario complex_api --target-qps 5000 --compare

# 实验 3：交互式容量规划
python3 capacity_calculator.py --interactive

# 实验 4：排队论模拟 — 验证 Little's Law
python3 capacity_simulator.py --lambda 1000 --mu 500 --servers 4 --time 30

# 实验 5：利用率-延迟扫描（核心洞察）
python3 capacity_simulator.py --sweep --max-rho 0.95
```

实验覆盖：
- `capacity_calculator.py`：验证"节点数 × 单节点容量 × 安全阈值"的容量公式
- `capacity_simulator.py`：验证"ρ → 1 时延迟指数级上升"的排队论结论

## 核心追问

1. **为什么用 70% 作为安全阈值？** 排队论：ρ=70% 时平均排队延迟 ≈ 1.2× 服务时间；同时留 30% buffer 应对突发和故障
2. **峰值因子怎么选？** 基于历史数据，通常 2-3 倍；电商大促可能 5-10 倍；必须配合压测验证
3. **CPU 和内存谁先成为瓶颈？** CPU bound 更常见（计算密集）；内存 bound 通常是请求体大、泄漏或缓存未命中导致的大量堆分配
4. **如何验证估算准确？** 阶梯加压压测（见 `loadtest.md` L3），观察 QPS-延迟曲线是否按排队论预测的趋势变化
5. **估算和实际差距大怎么办？** 检查：实际单请求 CPU 时间（`perf`）、缓存命中率、GC 频率、锁竞争、网络带宽；用 `capacity_simulator.py` 的 ρ 扫描找到真实饱和点

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| performance profiling toolkit | L2 | done |
| flame graph lab | L2 | done |
| latency budget worksheet | L2+L3 | done |
| load test methodology | L2+L3 | done |
| capacity estimation template | **L2+L3** | **done** |