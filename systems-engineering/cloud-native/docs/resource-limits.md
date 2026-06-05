# Resource Requests and Limits

## 目标

掌握 Kubernetes 资源模型：requests、limits、QoS 等级、调度和限制的关系。

## 场景

- 为什么 Pod 调度失败（Pending）但节点资源明明够？
- CPU limit 太紧导致 throttling 怎么排查？
- QoS 等级如何影响 Pod 调度和驱逐优先级？
- 如何设置合理的资源配额？

## 资源模型

```yaml
spec:
  containers:
  - name: app
    image: myapp
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "256Mi"
        cpu: "500m"
```

| 字段 | 作用 | 影响 |
|---|---|---|
| requests.memory | 调度时保证的内存 | 用于调度决策，节点必须满足 |
| requests.cpu | 调度时保证的 CPU | 用于调度决策，节点必须满足 |
| limits.memory | 运行时上限 | 超限触发 OOM Kill |
| limits.cpu | 运行时上限 | 超限触发 CPU throttling |

## 调度

### 调度决策

```bash
# 节点资源
kubectl describe node <node>
# 查看 Capacity 和 Allocatable

# Pod 资源请求
kubectl get pod <pod> -o jsonpath='{.spec.containers[0].resources}'
# {"limits":{"cpu":"500m","memory":"256Mi"},
#  "requests":{"cpu":"100m","memory":"128Mi"}}

# 调度检查
kubectl describe pod <pod> | grep -A 5 "Events"
# 如果调度失败，会显示原因（如 " Insufficient cpu"）
```

**调度流程**：
1. Scheduler 计算 Pod 的 requests 总和（所有容器）
2. 遍历所有节点，找出满足 `allocatable >= pod requests` 的节点
3. 预选（Predicates）：资源、污点、亲和性
4. 打分（Priorities）：最低负载、拓扑分布
5. 选择最优节点 bind

### requests vs limits 对调度的影响

```yaml
# 场景：节点有 1 CPU，Pod A requests 500m, limits 1000m
#       Pod B requests 600m, limits 2000m

# 调度时：检查 requests 是否满足
# A: 500m < 1000m，可以调度
# B: 600m < 1000m，可以调度

# 但运行时：
# 如果 A 和 B 都跑满（各自到 limits）：
#   A 用 1000m + B 用 2000m = 3000m > 1000m 节点
#   导致 CPU 竞争/throttling

# 所以 requests 设置要合理，limits 不要设太高
```

## CPU 资源

### CPU 单位

```
m = milliCPU = 1/1000 CPU core
1 CPU = 1000m
0.5 CPU = 500m
100m = 0.1 CPU

Kubernetes 中 1 CPU = 1 AWS vCPU = 1 GCP Core = 1 Azure Core
```

### CPU Throttling

```yaml
# 如果 limit 设置过低，会触发 CFS throttling
# CFS：Completely Fair Scheduler，Linux 内核调度器

# 查看 throttling
kubectl exec -it <pod> -- cat /sys/fs/cgroup/cpu/cpu.stat
# nr_throttled: 被限制次数
# throttled_time: 总限制时间

# 解决：
# 1. 调高 CPU limit
# 2. 用 Burstable QoS（requests < limits）
# 3. 改用 GOMAXPROCS 限制 Go 进程数
```

### CPU 限制原理

```bash
# cgroup v1（默认）
cpu.cfs_quota_us: 50000   # 50ms
cpu.cfs_period_us: 100000 # 100ms
# = 50% CPU

# cgroup v2
cpu.max: "50000 100000"  # 同上

# kubelet 将 Pod 的 cpu limit 转换为 cgroup 配置
```

## Memory 资源

### Memory 限制

```yaml
# 内存限制会导致 OOM Kill
resources:
  limits:
    memory: "256Mi"
    # 超过这个值：OOMKillExitCode=137

# 内存限制原理
# cgroup memory.limit_in_bytes
# 超过限制触发 OOM Killer
```

### OOM Kill 排查

```bash
# 方法 1：describe pod 看 Last State
kubectl describe pod <pod>
# Last State: Terminated
# Reason: OOMKilled
# Exit Code: 137
# Started: ...
# Finished: ...

# 方法 2：dmesg
kubectl node debug <node> -- dmesg | grep -i "oom\|killed"

# 方法 3：metric
kubectl top pod
# 看内存是否持续接近 limit
```

### Memory Requests 和 Limits

```yaml
# Go 应用的特殊考虑
# Go 的 GOGC 默认 100%，RSS 可能达到 2x heap
# 所以设置 memory limit 时要预留 headroom

resources:
  requests:
    memory: "256Mi"  # 实际使用可能接近这个
  limits:
    memory: "320Mi"  # 预留 +20% 给 RSS 和 GC overhead
```

## QoS 等级

```yaml
# Guaranteed（最高优先级，最晚被驱逐）
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "128Mi"  # requests == limits
    cpu: "100m"

# Burstable（中等）
resources:
  requests:
    memory: "64Mi"
    cpu: "50m"
  limits:
    memory: "256Mi"  # limits > requests
    cpu: "200m"

# BestEffort（最低优先级，最先被驱逐）
# 没有设置 resources 的 Pod
```

### QoS 对调度和驱逐的影响

```bash
# 查看 Pod QoS
kubectl get pod <pod> -o jsonpath='{.status.qosClass}'

# 调度：requests 用于调度决策
# - Guaranteed: 调度时严格保证
# - Burstable: 尽量保证，可以借
# - BestEffort: 调度时随意，有就用，没有就等

# 驱逐：资源不足时按 QoS 顺序驱逐
# 1. BestEffort（先驱逐）
# 2. Burstable（超过 requests 时）
# 3. Guaranteed（尽量不驱逐，除非节点真正资源耗尽）
```

## LimitRange 和 ResourceQuota

### LimitRange（命名空间级别）

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
spec:
  limits:
  - type: Container
    default:
      cpu: 500m
      memory: 256Mi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
    max:
      cpu: 2
      memory: 1Gi
    min:
      cpu: 10m
      memory: 16Mi
```

### ResourceQuota（命名空间级别）

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: quota
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "8"
    limits.memory: 8Gi
    pods: "20"
```

## 核心追问

1. **requests 和 limits 的区别？** requests 用于调度决策，limits 用于运行时上限；requests 保证可用，limits 防止失控
2. **为什么设置了资源但调度还是失败？** 节点 allocatable 是总量减去已有 Pod 的 requests 之和；可能有碎片（CPU 碎片、内存碎片）；污点也可能限制
3. **CPU throttling 怎么排查和解决？** 看 `/sys/fs/cgroup/cpu/cpu.stat` 的 `nr_throttled`；调高 limits.cpu 或用 Burstable（requests < limits）
4. **QoS 等级和调度的关系？** Guaranteed Pod 调度时严格匹配；Burstable Pod 可以借节点空闲资源；BestEffort 可能被调度到有空闲资源的节点
5. **Pod 被 OOMKilled 后会怎样？** kubelet 看到容器退出（ExitCode=137），根据 restartPolicy 决定是否重启；如果是 OOMKilled，说明 memory limit 设置太低

## 状态

| 资产 | 状态 |
|---|---|
| Kubernetes request path | done |
| pod lifecycle notes | done |
| resource requests and limits | done |
| ingress and service networking | todo |
| operator pattern notes | todo |