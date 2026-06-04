# Container Resource Limit Lab

## 目标

掌握 Linux 容器资源限制的机制和实操：cgroup、memory.limit、cpu.shares、IO limits、PID limits，以及 Kubernetes 的资源 requests/limits。

## 核心概念

容器资源限制的本质是 **cgroup 隔离**。Docker 用 cgroup v1，Kubernetes 用 cgroup v2（现代）。

```
Container Runtime (Docker/containerd)
    └── cgroupfs
        ├── memory (限制内存)
        ├── cpu (限制 CPU)
        ├── blkio (限制 IO)
        └── pids (限制 PID 数)

Kubernetes (cgroup v2)
    └── /sys/fs/cgroup/system.slice/
        ├── docker-<id>.scope/
        └── kubepods.slice/
```

## Memory Limits

### Docker

```bash
# 启动时限制内存
docker run -m 256m nginx

# 限制内存+Swap（256MB RAM + 256MB Swap）
docker run -m 256m --memory-swap 512m nginx

# 限制内存（但允许使用 swap）
docker run -m 256m --memory-swap -1 nginx  # -1 = 无限制

# 软限制（尽量不超，超了也可申请）
docker run -m 256m --memory-reservation 128m nginx

# OOM 控制（默认kill，--oom-kill-disable 关闭）
docker run -m 256m --oom-kill-disable nginx

# 查看运行中容器的内存限制
docker inspect <id> --format='{{.HostConfig.Memory}}'
docker stats <id>

# 容器内查看 cgroup 内存
docker exec <id> cat /sys/fs/cgroup/memory/memory.limit_in_bytes
docker exec <id> cat /sys/fs/cgroup/memory/memory.usage_in_bytes
```

### Kubernetes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: nginx
    resources:
      requests:        # 调度时保证
        memory: "128Mi"
        cpu: "100m"
      limits:          # 运行时上限
        memory: "256Mi"
        cpu: "500m"
```

**QOS 等级**：
- `Guaranteed`：所有 container 都设置了 limits 且 `requests == limits`
- `Burstable`：至少有一个 container 设置了 requests 但不满足 guaranteed
- `BestEffort`：没有任何 container 设置 requests/limits

```bash
# 查看 Pod QOS
kubectl get pod <pod> -o jsonpath='{.status.qosClass}'

# 节点上的 cgroup 路径
# Guaranteed: /kubepods.slice/kubepods-burstable.slice/...
# Burstable: /kubepods.slice/kubepods-burstable.slice/...
```

### 内存限制的坑

1. **Go 进程的 GOGC**：Go GC 默认 100% 时触发，RSS 可能超过 limit。解决方案：`GOGC=50` 或在 K8s 设置 `memory.limit` 时多留 20%
2. **JVM -Xmx vs RSS**：JVM 堆外还有 metaspace、direct buffer、native memory，RSS 可能远超 -Xmx
3. **page cache**：`memory.limit` 限制的是 RSS（包括 page cache），不是用户内存

## CPU Limits

### Docker

```bash
# 限制 CPU 核数（可以是小数）
docker run --cpus 0.5 nginx

# 限制特定 CPU 核（亲和性）
docker run --cpuset-cpus="0,1" nginx

# 限制 CFS 周期（docker 默认 100ms）
docker run --cpu-quota 50000 --cpu-period 100000 nginx
# = 50% CPU（quota/period）

# CPU share（相对权重，默认 1024）
docker run --cpu-shares 512 nginx  # 512/1024 = 50% 相对权重

# 看运行容器的 CPU limit
docker inspect <id> --format='{{.HostConfig.CpuPeriod}}'
```

### Kubernetes

```yaml
resources:
  requests:
    cpu: "100m"      # 0.1 CPU
  limits:
    cpu: "500m"      # 0.5 CPU
```

**CFS vs CFS Scheduler**：
- K8s 默认使用 CFS quota 限制 CPU
- `--cpu-limit` 最终转换成 cgroup 的 `cpu.cfs_quota_us` 和 `cpu.cfs_period_us`
- 如果 limit 设置过小，会导致 CPU throttling（`nr_throttled` 增加）

### CPU throttling 问题排查

```bash
# 查看容器的 throttling 统计
docker exec <id> cat /sys/fs/cgroup/cpu/cpu.stat
# nr_throttled: 被限制次数
# throttled_time: 总被限制时间(ns)

# 如果 throttled_time 持续增长，说明 CPU limit 太紧
# 解决：调高 limits.cpu 或改用 Burstable QOS

# cgroup v2 的 CPU max
cat /sys/fs/cgroup/system.slice/docker-<id>.scope/cpu.max
# 格式: "max 100000" (100ms 周期) 或 "50000 100000" (50ms quota = 50%)
```

## I/O Limits

### Docker (blkio cgroup)

```bash
# 限制读带宽 (bytes/s)
docker run --device-read-bps /dev/sda:10MB nginx

# 限制写带宽
docker run --device-write-bps /dev/sda:10MB nginx

# 限制读 IOPS
docker run --device-read-iops /dev/sda:1000 nginx

# 限制写 IOPS
docker run --device-write-iops /dev/sda:1000 nginx

# cgroup v1 blkio throttling
echo "8:0 10485760" > /sys/fs/cgroup/blkio/docker/<id>/blkio.throttle.read_bps_device
```

### Kubernetes (IO weight)

```yaml
resources:
  limits:
    ephemeral-storage: "1Gi"  # 临时存储限制

# 或者用 PVC + StorageClass 限制 IO
```

## PID Limits

### Docker

```bash
# 限制容器内最大 PID 数
docker run --pids-limit 100 nginx

# 容器内查看
docker exec <id> cat /sys/fs/cgroup/pids/pids.max
docker exec <id> cat /sys/fs/cgroup/pids/pids.current
```

### Kubernetes

```yaml
spec:
  containers:
  - name: app
    resources:
      limits:
        pods: "100"  # Pod 级别的 PID 限制
```

## 实操验证

### Lab 1: 验证内存限制

```bash
# 启动一个受限制的容器
docker run -d --name test-mem --memory 256m alpine sh -c "while true; do sleep 1; done"

# 容器内监控
docker exec test-mem cat /sys/fs/cgroup/memory/memory.limit_in_bytes
# 输出: 268435456 (256MB)

# 容器内触发 OOM
docker exec test-mem sh -c "echo 1 > /proc/sys/vm/drop_caches; stress-ng --vm 1 --vm-bytes 300M --timeout 10s" || true

# 查看是否被 OOM kill
docker logs test-mem 2>&1 | tail
dmesg | grep -i "oom\|killed" | tail
```

### Lab 2: 验证 CPU throttling

```bash
# 启动一个 CPU 受限的容器
docker run -d --name test-cpu --cpus 0.2 alpine sh -c "while true; do :; done"

# 安装 stress
docker exec test-cpu apk add --no-cache stress-ng

# 测试 CPU 压力
docker exec test-cpu stress-ng --cpu 2 --timeout 30s

# 查看 throttling
docker exec test-cpu cat /sys/fs/cgroup/cpu/cpu.stat
# nr_throttled 应该 > 0

# 对比无限制的情况
docker run -d --name test-cpu-unlimited --cpus 1 alpine sh -c "while true; do :; done"
docker exec test-cpu-unlimited apk add --no-cache stress-ng 2>/dev/null
docker exec test-cpu-unlimited stress-ng --cpu 2 --timeout 30s 2>/dev/null || true
docker exec test-cpu-unlimited cat /sys/fs/cgroup/cpu/cpu.stat
# nr_throttled 应该 = 0
```

### Lab 3: Kubernetes 资源限制验证

```bash
# 创建有资源限制的 Pod
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: resource-test
spec:
  containers:
  - name: app
    image: alpine
    command: ["sh", "-c", "while true; do sleep 1; done"]
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "200m"
EOF

# 验证调度
kubectl get pod resource-test -o wide

# 查看节点上的 cgroup
kubectl debug node/<node> -it --image=alpine -- sh
# 找到 Pod 的 cgroup
# cat /sys/fs/cgroup/system.slice/kubepods.slice/.../memory.limit_in_bytes

# 触发 OOM
kubectl exec resource-test -- sh -c "stress-ng --vm 1 --vm-bytes 150M --timeout 10s" || true

# 查看 OOM
kubectl describe pod resource-test | grep -A 10 "Events"
```

## 资源限制与性能

| 限制 | 影响 | 建议 |
|---|---|---|
| memory limit 太紧 | OOM kill、GC 频繁 | 预留 20% headroom |
| CPU limit 太紧 | throttling、延迟增加 | 用 burstable 或调高 limit |
| IOPS limit 太低 | 磁盘吞吐受限 | 评估读写模式 |
| PID limit 太低 | fork 失败 | 小心设置 |

## 核心追问

1. **容器内 `free` 和宿主机 `free` 的区别？** 容器内 `free` 看到的是 cgroup 视角的内存，宿主机看到的是整个节点
2. **Go 进程的 GOGC 为什么需要调整？** GOGC=100 时 RSS 可能增长到 2x heap，在 memory limit 下容易触发 OOM
3. **CPU `requests` 和 `limits` 的调度语义？** requests 用于调度决策，limits 用于运行时上限
4. **JVM -Xmx 和容器 memory limit 的关系？** -Xmx 只是堆，RSS 还包括 metaspace、native、direct buffer，可能超 limit
5. **cgroup v2 的 CPU max 格式？** `max` 或 `quota period`，如 `50000 100000` 表示 50ms/quota 的 100ms 周期

## 工程迁移

- **K8s 部署**：始终设置 `resources.limits`，避免单机 OOM
- **Java/Go 服务**：根据语言特性调高 headroom（Java 20%，Go 10%）
- **监控**：关注 `container_memory_working_set_bytes` 和 `container_cpu_throttling_seconds`

## 状态

| 资产 | 状态 |
|---|---|
| Linux troubleshooting playbook | reviewed |
| strace syscall lab | done |
| cgroup and namespace notes | done |
| file descriptor leak diagnosis | done |
| container resource limit lab | done |