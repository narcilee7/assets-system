# Capacity Planning Worksheet

## 目标

掌握容量规划的方法：基线建立、需求预测、扩缩容策略、成本估算。

## 场景

- 如何估算服务的容量？
- QPS 和资源配置的关系？
- 什么时候应该扩容？
- 如何做成本优化？

## 容量规划流程

```
1. 建立基线：当前资源使用和性能
2. 预测需求：业务增长 + 峰值
3. 规划容量：资源规划
4. 执行：扩容/缩容
5. 监控：持续评估
```

## 核心指标

### 关键指标

| 指标 | 含义 | 测量方法 |
|---|---|---|
| QPS | 每秒请求数 | Prometheus `rate(http_requests_total[5m])` |
| Latency | 请求延迟 | P50/P90/P99 histogram |
| CPU 使用率 | 计算资源 | `cpu_usage / allocatable_cpu` |
| Memory 使用率 | 内存资源 | `memory_usage / allocatable_memory` |
| Error Rate | 错误率 | `errors / total_requests` |
| Saturation | 饱和度 | 队列深度、连接数 |

### 资源计算

```
服务容量 = 节点数量 × 每节点容量

每节点容量 = (CPU 频率 × 核心数 × 利用率) / 单请求 CPU 消耗

例子：
  - 节点：4 核 CPU，2.5 GHz
  - 利用率：70%（高负载）
  - 单请求：10ms CPU 时间
  - 单核每秒处理：1000ms / 10ms = 100 req/s
  - 4 核 × 100 = 400 req/s（单节点）
```

## 建立基线

### Step 1: 收集指标

```bash
# 当前 QPS
promQL: sum(rate(http_requests_total{service="api"}[5m]))

# 当前 Latency
promQL: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="api"}[5m]))

# 当前资源使用
promQL: 
  - cpu: sum(rate(container_cpu_usage_seconds_total{service="api"}[5m])) by (pod)
  - memory: sum(container_memory_working_set_bytes{service="api"}) by (pod)
```

### Step 2: 单请求成本

```bash
# 单请求平均 CPU
promQL: 
  sum(rate(container_cpu_usage_seconds_total{service="api"}[5m])) 
  / 
  sum(rate(http_requests_total{service="api"}[5m]))

# 单请求平均内存
promQL:
  sum(container_memory_working_set_bytes{service="api"}) 
  / 
  sum(http_requests_total{service="api"})
```

### Step 3: 计算容量

```python
def calculate_capacity(
    cpu_per_request: float,    # CPU 秒/请求
    memory_per_request: float, # MB/请求
    available_cpu: float,      # 可用 CPU 核数
    available_memory: float,   # 可用内存 MB
) -> dict:
    
    # 每秒最大请求数（CPU 限制）
    max_qps_cpu = available_cpu / cpu_per_request
    
    # 每秒最大请求数（内存限制）
    max_qps_memory = available_memory / memory_per_request
    
    # 瓶颈
    bottleneck = min(max_qps_cpu, max_qps_memory)
    
    # 建议安全阈值（80%）
    safe_qps = bottleneck * 0.8
    
    return {
        "max_qps_cpu": max_qps_cpu,
        "max_qps_memory": max_qps_memory,
        "bottleneck": bottleneck,
        "safe_qps": safe_qps,
        "replicas_needed_for_target_qps": lambda target_qps: math.ceil(target_qps / safe_qps)
    }

# 示例
result = calculate_capacity(
    cpu_per_request=0.01,     # 10ms CPU/请求
    memory_per_request=50,    # 50MB/请求
    available_cpu=4,          # 4 核
    available_memory=4096,    # 4GB
)
# max_qps_cpu = 400
# max_qps_memory = 81
# bottleneck = 81
# safe_qps = 65
```

## 扩缩容规划

### 扩容触发条件

```yaml
# HPA 配置示例
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # CPU > 70% 时扩容
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80  # Memory > 80% 时扩容
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60  # 扩容稳定窗口
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300  # 缩容稳定窗口（5 分钟）
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### 扩容决策表

| CPU 使用率 | Memory 使用率 | 行动 |
|---|---|---|
| < 50% | < 60% | 可以缩容 |
| 50-70% | 60-80% | 正常 |
| 70-85% | 80-90% | 监控，准备扩容 |
| > 85% | > 90% | 立即扩容 |
| > 95% | > 95% | 紧急扩容 + 告警 |

## 峰值规划

### 峰值估算

```python
def plan_for_peak(
    baseline_qps: float,
    peak_factor: float,      # 峰值倍数（如 3x）
    sla_latency_p99: float,  # SLA 要求的 P99 延迟
    current_latency_p99: float,
) -> dict:
    
    # 目标 QPS
    target_qps = baseline_qps * peak_factor
    
    # 延迟与负载关系（简化：延迟随 QPS 线性增长）
    # 如果 P99 延迟已经 > SLA，峰值会更严重
    if current_latency_p99 > sla_latency_p99:
        risk = "HIGH: Current latency already exceeds SLA"
    else:
        headroom = (sla_latency_p99 - current_latency_p99) / current_latency_p99
        risk = "LOW" if headroom > 0.3 else "MEDIUM"
    
    return {
        "baseline_qps": baseline_qps,
        "target_qps": target_qps,
        "risk": risk,
        "recommendation": "扩容" if risk == "HIGH" else "继续监控"
    }
```

### 容量预留

```
峰值容量规划要留 buffer：

最低配置：满足平均 QPS
标准配置：满足峰值 × 1.5
高可用配置：满足峰值 × 2 + 冗余

成本考虑：
  - 按峰值配置：成本高，弹性差
  - 弹性配置：成本低，可能在峰值时性能下降
```

## 成本估算

```python
def estimate_monthly_cost(
    replicas: int,
    cpu_per_replica: float,    # 核数
    memory_per_replica: float, # GB
    region: str = "us-west-2",
    use_spot: bool = False,
) -> dict:
    
    # 价格（示例）
    prices = {
        "us-west-2": {
            "on_demand_cpu": 0.0216,  # $/核/小时
            "on_demand_memory": 0.0059,  # $/GB/小时
            "spot_discount": 0.6,
        },
        "cn-beijing": {
            "on_demand_cpu": 0.034,  # ¥0.24/核/小时
            "on_demand_memory": 0.008,  # ¥0.06/GB/小时
        }
    }
    
    region_prices = prices.get(region, prices["us-west-2"])
    hourly_cpu = replicas * cpu_per_replica * region_prices["on_demand_cpu"]
    hourly_memory = replicas * memory_per_replica * region_prices["on_demand_memory"]
    hourly_total = hourly_cpu + hourly_memory
    
    if use_spot:
        hourly_total *= (1 - region_prices["spot_discount"])
    
    monthly = hourly_total * 24 * 30
    
    return {
        "hourly_cpu": round(hourly_cpu, 2),
        "hourly_memory": round(hourly_memory, 2),
        "hourly_total": round(hourly_total, 2),
        "monthly_estimate": round(monthly, 2),
        "currency": "USD" if region == "us-west-2" else "CNY"
    }

# 示例：3 副本，2 核，4GB
result = estimate_monthly_cost(3, 2, 4, "us-west-2")
# hourly: $0.54 + $0.36 = $0.90/h
# monthly: $648
```

## 核心追问

1. **如何确定单请求的资源消耗？** 通过压测或监控统计：`total_resource / total_qps`
2. **扩缩容应该用什么指标？** 推荐用自定义指标（HPA 自定义指标）如 `requests_per_second`，比 CPU 更准确
3. **峰值倍数怎么算？** 基于历史数据或业务预估，通常取 2-5 倍
4. **什么时候应该预扩容？** 大促前、新版本发布前、节假日，需要提前 1-2 天扩容
5. **Spot 实例的风险？** 可能被回收，导致服务中断；适合无状态服务，需要做好 graceful shutdown

## 状态

| 资产 | 状态 |
|---|---|
| SLO worksheet | done |
| incident response playbook | done |
| error budget policy | done |
| capacity planning worksheet | done |
| disaster recovery checklist | todo |