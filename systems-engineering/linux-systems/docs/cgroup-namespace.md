# Cgroup and Namespace Notes

## 目标

理解 Linux 资源隔离机制：cgroup 控制资源（CPU/内存/IO），namespace 控制视图（PID/网络/挂载）。

## 核心概念

### Cgroup (Control Group)

**层级结构**：cgroup 是树形层级，每个子系统（CPU、内存、IO）在 `/sys/fs/cgroup/` 下有独立层级。

```
cgroup v2 hierarchy (统一层级)
├── cpu/
│   └── docker/
│       └── container_id/
├── memory/
│   └── docker/
│       └── container_id/
└── io/
    └── docker/
        └── container_id/
```

**cgroup v1 vs v2**：
- v1：每个子系统独立层级（cpu, memory, blkio 分开）
- v2：统一层级，所有子系统在同一树（kernel 5.x+ 推荐）

### Namespace

| Namespace | 隔离内容 | 关键 flag |
|---|---|---|
| PID | 进程 ID 空间 | CLONE_NEWPID |
| Network | 网络设备、端口、路由 | CLONE_NEWNET |
| Mount | 挂载点视图 | CLONE_NEWNS |
| UTS | hostname / domain name | CLONE_NEWUTS |
| IPC | System V IPC / POSIX msg | CLONE_NEWIPC |
| User | UID/GID 映射 | CLONE_NEWUSER |
| Cgroup | cgroup 视图 | CLONE_NEWCGROUP |

## Cgroup 资源控制

### Memory

```bash
# 内存硬限制
echo 256M > /sys/fs/cgroup/memory/docker/<id>/memory.limit_in_bytes

# 内存软限制（不保证）
echo 128M > /sys/fs/cgroup/memory/docker/<id>/memory.soft_limit_in_bytes

# Swap 限制（0 = 禁用 swap）
echo 0 > /sys/fs/cgroup/memory/docker/<id>/memory.swappiness

# OOM 控制
cat /sys/fs/cgroup/memory/docker/<id>/memory.oom_control
# oom_kill_disable = 0 (允许 OOM kill)
# under_oom = 0 (是否已经 OOM)

# 查看当前使用
cat /sys/fs/cgroup/memory/docker/<id>/memory.usage_in_bytes
cat /sys/fs/cgroup/memory/docker/<id>/memory.stat
```

### CPU

```bash
# CFS 限制（cgroup v1）
# 100ms 周期内最多使用 50ms = 50% CPU
echo 50000 > /sys/fs/cgroup/cpu/docker/<id>/cpu.cfs_quota_us
echo 100000 > /sys/fs/cgroup/cpu/docker/<id>/cpu.cfs_period_us

# CPU share（相对权重，默认 1024）
echo 512 > /sys/fs/cgroup/cpu/docker/<id>/cpu.shares

# 实时查看
cat /sys/fs/cgroup/cpu/docker/<id>/cpu.stat

# cgroup v2
echo 50 > /sys/fs/cgroup/system.slice/docker-<id>.scope/cpu.max
# 表示 50% CPU
```

### I/O (blkio)

```bash
# 限制读带宽
echo "8:0 10M" > /sys/fs/cgroup/blkio/docker/<id>/blkio.throttle.read_bps_device

# 限制写带宽
echo "8:0 10M" > /sys/fs/cgroup/blkio/docker/<id>/blkio.throttle.write_bps_device

# 限制 IOPS
echo "8:0 1000" > /sys/fs/cgroup/blkio/docker/<id>/blkio.throttle.read_iops_device
echo "8:0 1000" > /sys/fs/cgroup/blkio/docker/<id>/blkio.throttle.write_iops_device

# 查看 throttle 统计
cat /sys/fs/cgroup/blkio/docker/<id>/blkio.throttle.io_service_bytes
```

### PIDs

```bash
# 限制 PID 数量
echo 100 > /sys/fs/cgroup/pids/docker/<id>/pids.max

# 查看当前 PID 使用
cat /sys/fs/cgroup/pids/docker/<id>/pids.current
```

### 完整示例：创建带限制的 cgroup

```bash
# 1. 创建 cgroup
mkdir -p /sys/fs/cgroup/memory/myapp

# 2. 设置内存限制 (256MB)
echo 256M > /sys/fs/cgroup/memory/myapp/memory.limit_in_bytes

# 3. 设置内存+Swap 限制（256MB RAM + 256MB Swap）
echo 256M > /sys/fs/cgroup/memory/myapp/memory.limit_in_bytes
echo 512M > /sys/fs/cgroup/memory/myapp/memory.memsw.limit_in_bytes

# 4. 加入进程
echo <pid> > /sys/fs/cgroup/memory/myapp/tasks

# 5. 验证
cat /sys/fs/cgroup/memory/myapp/memory.usage_in_bytes

# 6. 清理（删除 cgroup）
rmdir /sys/fs/cgroup/memory/myapp
```

## Namespace 查看和操作

### 查看进程 Namespace

```bash
# 查看进程的 namespace
ls -la /proc/<pid>/ns/
# lrwxrwxrwx 1 root root 0 Jun  5 10:00 pid -> 'pid:[4026531836]'
# lrwxrwxrwx 1 root root 0 Jun  5 10:00 net -> 'net:[4026531956]'
# ...

# 相同 inode 表示在同一 namespace
# 进入另一个进程的 namespace
nsenter --target <pid> --pid --net -- ls
```

### 查看当前 Namespace

```bash
# 查看当前进程
ls -la /proc/self/ns/

# 查看系统所有 namespace
ls -la /proc/*/ns/ 2>/dev/null | head -20

# 统计每个 namespace 类型的数量
find /proc/*/ns -type l 2>/dev/null | awk -F'/' '{print $NF}' | sort | uniq -c
```

### 创建带 Namespace 的进程

```bash
# 创建独立的 PID namespace（新 PID 空间从 1 开始）
unshare --pid --fork bash

# 创建独立的网络 namespace
unshare --net bash
ip link  # 看不到了，只有 lo

# 创建独立的挂载 namespace
unshare --mount bash
mount -t tmpfs tmpfs /mnt  # 隔离的挂载

# 组合：PID + 网络 + 挂载
unshare --pid --fork --net --mount bash

# 使用 rootless 用户（user namespace）
unshare --user bash
```

### 在容器的视角理解

Docker 的 `--privileged` 关闭了哪些 namespace：

```bash
# 查看容器默认隔离
docker run --rm -it alpine ls -la /proc/self/ns/

# 无特权容器 vs 有特权容器
docker run --rm -it --privileged alpine ls -la /proc/self/ns/

# 查看 AppArmor / seccomp 限制
docker run --rm --rm --security-opt seccomp=default alpine cat /proc/1/status
```

## Docker 和 Kubernetes 的 cgroup

### Docker 默认 cgroup 驱动

```bash
# cgroupfs (默认，Ubuntu/Debian)
docker info | grep "Cgroup"

# systemd (CentOS/RHEL)
docker info | grep "Cgroup"
# Runtime: docker-runc
# Cgroup Driver: systemd
```

### Kubernetes cgroup

```yaml
# kubelet 配置 cgroup 驱动
# /var/lib/kubelet/config.yaml
cgroupDriver: systemd  # 或 cgroupfs

# Pod 的 QOS 等级影响 cgroup 层级
# Guaranteed: /kubepods/pod<uid>
# Burstable: /kubepods/burstable/pod<uid>
# BestEffort: /kubepods/besteffort/pod<uid>
```

## 常见问题

### 容器 OOMKilled

```bash
# 1. 查看是否被 OOM
dmesg | grep -i "oom\|killed"

# 2. 查看容器 memory.oom_control
docker exec <id> cat /sys/fs/cgroup/memory/memory.oom_control

# 3. 查看 memory.usage_in_bytes 是否接近 limit
docker exec <id> cat /sys/fs/cgroup/memory/memory.limit_in_bytes
docker exec <id> cat /sys/fs/cgroup/memory/memory.usage_in_bytes

# 4. Kubernetes: 查看 OOMKilled 计数
kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[*].lastState.terminated.reason}'
```

### CPU throttling

```bash
# 查看 CPU throttling 统计
cat /sys/fs/cgroup/cpu/docker/<id>/cpu.stat
# nr_throttled: 被限制次数
# throttled_time: 被限制的总时间(ns)

# 如果 throttled_time 很高，说明 CPU limit 太紧
```

### PID 耗尽

```bash
# 查看当前 PID 使用
cat /sys/fs/cgroup/pids/docker/<id>/pids.current
cat /sys/fs/cgroup/pids/docker/<id>/pids.max

# 系统级 PID 上限
cat /proc/sys/kernel/pid_max
```

## 核心追问

1. **cgroup 和 namespace 的区别？** cgroup 限制资源（你用多少），namespace 隔离视图（你看到什么）
2. **cgroup 为什么是层级结构？** 子进程自动继承父进程 cgroup，形成树形；资源限制在层级中向下传递
3. **为什么容器内 `top` 看到 CPU 100% 但实际不是？** 因为容器有 CPU limit，但 `top` 默认显示的是宿主机视角；需要 `docker stats` 或 `top -b` 按 cgroup 统计
4. **memory.limit 和 memory.memsw.limit 的关系？** memsw = memory + swap；先超 limit 才触发 OOM
5. **unshare 和 setns 的区别？** unshare = 创建新 namespace 并进入；setns = 加入已存在的 namespace

## 工程迁移

- **资源限制**：在 Kubernetes 中用 `resources.limits` 设置 cgroup
- **调试**：`/sys/fs/cgroup` 是 cgroup v2 的统一位置（v1 是 `/sys/fs/cgroup/{cpu,memory,...}/`）
- **故障排查**：OOM 看 dmesg + cgroup oom_control；throttling 看 cpu.stat

## 状态

| 资产 | 状态 |
|---|---|
| Linux troubleshooting playbook | reviewed |
| strace syscall lab | done |
| cgroup and namespace notes | done |