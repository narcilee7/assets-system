# Pod Lifecycle Notes

## 目标

理解 Pod 的完整生命周期：创建过程、状态转换、探针类型、调度和驱逐。

## 场景

- Pod 一直处于 Pending 状态为什么？
- 为什么需要 readinessProbe 和 livenessProbe 两种探针？
- Pod 被驱逐的原因是什么？
- Init Container 和 Sidecar 的区别？

## Pod 状态

```bash
# Pod 状态
kubectl get pod <pod> -o jsonpath='{.status.phase}'
# Possible values: Pending, Running, Succeeded, Failed, Unknown

# 详细状态
kubectl describe pod <pod>
# 看 Conditions: PodScheduled, Initialized, ContainersReady, Ready
```

| 状态 | 含义 |
|---|---|
| Pending | Pod 已被 Kubernetes 系统接受，镜像还在下载或调度中 |
| Running | Pod 已绑定到节点，容器已创建（可能正在启动） |
| Succeeded | 所有容器正常退出（不再重启） |
| Failed | 容器异常退出（Exit Code != 0） |
| Unknown | 无法获取 Pod 状态（节点通信问题） |

## Pod 创建流程

```
1. kubectl 发送请求到 API Server
2. API Server 创建 Pod 对象（status: Pending）
3. Scheduler 调度 Pod 到节点（bind）
4. kubelet 收到调度，调用 CRI 创建容器
5. 拉取镜像（可能需要时间）
6. 启动 Init Container（如有）
7. 启动 Main Container
8. Pod 状态变为 Running
```

### Init Container

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  initContainers:
  - name: wait-for-db
    image: busybox
    command: ['sh', '-c', 'until nslookup db.default.svc.cluster.local; do echo waiting for db; sleep 2; done']
  containers:
  - name: app
    image: myapp:latest
```

**特点**：
- Init Container 按顺序执行，全部成功才启动主容器
- 每个 Init Container 必须在下一个启动前成功退出
- 失败会导致 Pod 重启（取决于 restartPolicy）
- 用于：等待依赖服务、注册到服务发现、初始化配置

## Container 探针

### 三种探针

```yaml
spec:
  containers:
  - name: app
    image: myapp:latest
    livenessProbe:       # 存活探针：容器是否活着
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 10
      failureThreshold: 3
    
    readinessProbe:      # 就绪探针：容器是否可以接收流量
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
    
    startupProbe:        # 启动探针：容器启动完成前（最慢的探针）
      httpGet:
        path: /started
        port: 8080
      failureThreshold: 30
      periodSeconds: 10
```

### 探针行为

| 探针 | 失败后果 | 用途 |
|---|---|---|
| livenessProbe 失败 | 重启容器（restartPolicy=Always） | 容器崩溃后恢复 |
| readinessProbe 失败 | 从 Service Endpoints 移除 | 不再接收流量 |
| startupProbe 失败 | 容器终止（restartPolicy） | 给启动慢的应用更多时间 |

### 探针参数

```yaml
failureThreshold: 3      # 连续失败 3 次才触发动作
successThreshold: 1     # 连续成功 1 次（默认）
periodSeconds: 10        # 检查间隔（默认 10s）
initialDelaySeconds: 5  # 启动后多久开始检查
timeoutSeconds: 1       # 超时（默认 1s）
```

## 调度

### 调度流程

```
1. API Server 创建 Pod（未调度）
2. Scheduler 监听未调度 Pod
3. Scheduler 筛选可行节点：
   - 资源检查（CPU、内存）
   - 亲和性/反亲和性
   - 污点和容忍
   - 拓扑（topologyKey）
4. 选择最优节点，bind Pod 到节点
5. kubelet 收到调度事件，开始创建
```

### 调度约束

```yaml
spec:
  nodeSelector:
    disktype: ssd
  
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 1
        preference:
          matchExpressions:
          - key: zone
            operator: In
            values: ["cn-north"]
    
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: database
        topologyKey: kubernetes.io/hostname
    
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: redis
          topologyKey: topology.kubernetes.io/zone
```

### 污点和容忍

```bash
# 查看节点污点
kubectl describe node <node> | grep Taints

# 节点污点
kubectl taint nodes <node> key=value:NoSchedule
kubectl taint nodes <node> key=value:NoExecute
kubectl taint nodes <node> key=value:PreferNoSchedule

# Pod 容忍
spec:
  tolerations:
  - key: "key"
    operator: "Equal"
    value: "value"
    effect: "NoSchedule"
  - key: "key"
    operator: "Exists"
    effect: "NoExecute"
    tolerationSeconds: 3600
```

## 驱逐（Eviction）

### 资源不足驱逐

```
 kubelet 监控资源使用：
   - 内存 > 85%：开始驱逐低优先级 Pod
   - CPU 持续高：可能驱逐

Eviction 顺序（先驱逐低优先级）：
  1. BestEffort Pod
  2. Burstable Pod（超过 limit）
  3. Guaranteed Pod（ Guaranteed 一般不驱逐）
```

### 驱离原因

```bash
# 查看 Pod 驱逐原因
kubectl describe pod <pod>
# Last State: Terminated
# Reason: Evicted
# Exit Code: 137 (SIGKILL)

# 查看节点资源
kubectl top node
kubectl describe node | grep -A 5 "Allocated resources"
```

## 核心追问

1. **Pending 状态的 Pod 怎么办？** 检查调度（kubectl describe pod 看事件）、资源不足（kubectl top node）、污点不允许（kubectl describe node）、镜像拉取失败（describe 看 ImagePullBackOff）
2. **Init Container 和 Sidecar 的区别？** Init Container 在主容器前运行，按顺序全部成功才启动主容器；Sidecar 是和主容器并行运行的辅助容器（如日志收集、代理）
3. **readinessProbe 和 livenessProbe 的区别？** readinessProbe 失败：从 Endpoints 移除，不再接收流量，但容器不重启；livenessProbe 失败：容器重启
4. **Pod 被驱逐后会发生什么？** Pod 对象还在 Kubernetes 中，kubelet 会尝试重新调度（在同等节点或新节点），Pod 会有新的 UID 和 IP
5. **为什么需要 startupProbe？** 启动慢的应用（如 Java）需要更长时间初始化，如果没有 startupProbe，livenessProbe 会在启动期间失败导致容器重启

## 状态

| 资产 | 状态 |
|---|---|
| Kubernetes request path | done |
| pod lifecycle notes | done |
| resource requests and limits | todo |
| ingress and service networking | todo |
| operator pattern notes | todo |