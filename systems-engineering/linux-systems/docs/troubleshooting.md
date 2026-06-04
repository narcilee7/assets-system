# Linux Troubleshooting Playbook

## 目标

训练在生产环境快速定位 Linux 资源问题的能力：CPU、内存、磁盘、网络、进程、容器。

## 场景

- 服务响应变慢，P99 延迟上升
- 机器负载高但不确定是 CPU/内存/磁盘/网络的哪一层
- 容器被 OOMKilled 或 CPU throttling
- 文件描述符耗尽、连接数异常
- 磁盘 I/O 导致吞吐量下降

## 诊断路径

### 0. 快速概览（30 秒定位方向）

```bash
# 1. 整体负载
uptime
# load average: 1min, 5min, 15min

# 2. CPU 和进程
top -bn1 | head -20
# %Cpu(s): us sy id wa ni
# 关注: us高=用户态CPU瓶颈, sy高=系统调用或上下文切换, wa高=磁盘IO等待

# 3. 内存
free -h
# available > used * 0.8 正常; available 接近 free 说明页缓存不足

# 4. 磁盘 I/O
iostat -xz 1 3
# %util > 80% 说明磁盘成为瓶颈; await > 10ms 说明IO延迟高

# 5. 网络
ss -s
# Recv-Q/Send-Q 持续非零说明 socket 积压

# 6. 整体概览（单条命令）
vmstat 1 5
# r: 运行中进程数; us: CPU用户态; sy: 系统态; wa: IO等待
```

### 1. CPU 诊断路径

```bash
# 1. 定位 CPU 高的进程
top -bn1 | sort -k 3 -rn | head -10
# 或者
ps aux --sort=-%cpu | head -10

# 2. 查看进程树看谁在调用
pstree -p <pid>
# 或
ps auxf | grep <pid>

# 3. 查看进程的线程 CPU 分布
ps -eL-o pid,tid,%cpu,comm | grep <pid> | sort -k 3 -rn | head -10

# 4. 用 perf 定位热点函数
perf top -p <pid> -d 5
# 或
perf record -g -p <pid> -o perf.data -- sleep 10
perf report --stdio --symbol-filter=list_append

# 5. 查看系统调用是否频繁
strace -c -p <pid> 2>&1 | head -20
# 统计 syscal 次数和时间
```

**CPU 瓶颈的典型原因：**
- us 高：业务计算瓶颈（算法、加密、压缩）
- sy 高：系统调用频繁（raw syscall）、上下文切换过多
- wa 高：等待磁盘/网络 I/O
- ni 高：nice 调度优先级问题

### 2. Memory 诊断路径

```bash
# 1. 定位内存高的进程
ps aux --sort=-%mem | head -10

# 2. 查看内存详细分布
cat /proc/meminfo
# 关注: MemAvailable, AnonPages, Shmem, SReclaimable, Buffers, Cached

# 3. 查看进程的内存映射
pmap -x <pid> | sort -k 3 -rn | head -10
# -x 显示扩展格式，3列=匿名页大小

# 4. 查看 RSS 是否有异常增长
for pid in $(pgrep -f <process_name>); do
  echo "PID: $pid"
  cat /proc/$pid/status | grep -E "VmRSS|VmSize|VmSwap"
done

# 5. 查看 swap 使用
swapon -s
cat /proc/vmstat | grep -E "pswp|pswpin"

# 6. 查看 OOM killer 日志
dmesg | grep -i "oom\|killed"
# 或者
journalctl -k | grep -i oom

# 7. glibc malloc 碎片诊断
malloc_trim(0)  # 尝试归还内存到操作系统
# 或
mallinfo2()
```

**内存问题的典型表现：**
- VmSwap > 0 且持续：物理内存不足
- AnonPages 接近 MemTotal：大量匿名内存（堆）
- SReclaimable 高：slab 缓存可回收
- 进程 RSS 持续增长不回落：内存泄漏

### 3. Disk I/O 诊断路径

```bash
# 1. 查看哪个设备最忙
iostat -xz 1 3
# 关注: tps, KB_read/s, KB_wrtn/s, %util, await, avgqu-sz

# 2. 定位 I/O 高的进程
iotop -b -n 3
# 或
pidstat -d 1 3

# 3. 查看进程打开了哪些文件
lsof -p <pid>
# 或者
ls -la /proc/<pid>/fd | wc -l

# 4. 查看哪个文件系统的 I/O 最重
df -h
# 然后
du -sh /var/log/* 2>/dev/null | sort -rh | head -10

# 5. 查看 inode 使用情况
df -i

# 6. 找出大文件
find / -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k 5 -rh | head -10

# 7. 查看 I/O 等待的进程
ps -eo pid,comm,wchan:W20,state | sort -k 4 -rn | head -10
# wchan 显示进程在等待什么（内核函数）
```

**磁盘瓶颈的典型表现：**
- %util > 80%：设备饱和
- await > 10ms：I/O 延迟高
- avgqu-sz > 1：请求队列过长
- %iowait 高但磁盘吞吐不高：大量同步小 I/O

### 4. Network 诊断路径

```bash
# 1. 快速网络状态概览
ss -tunapl | head -20
# State: Recv-Q, Send-Q
# Local Address:Port

# 2. 查看连接统计
ss -s

# 3. 查看 TIME_WAIT 连接数量（高则有问题）
ss -ant state time-wait | wc -l

# 4. 查看丢包和错误
cat /proc/net/dev
# 注意: drops, fifo errors, frame errors

# 5. 查看 TCP 重传率
cat /proc/net/snmp | grep -E "RetransSegs|OutSegs"
# RetransSegs / OutSegs > 1% 说明有重传

# 6. tcpdump 抓包分析
# 抓 SYN 看连接建立
tcpdump -i eth0 'tcp[tcpflags] == tcp-syn' -c 100

# 抓 HTTP 响应
tcpdump -i eth0 'tcp port 80 and tcp[tcpflags] & tcp-ack != 0' -A

# 抓 DNS
tcpdump -i eth0 port 53 -A

# 7. 查看 socket 内存
cat /proc/net/sockstat

# 8. 查看网络接口统计
ip -s link show
ethtool -S eth0
```

**网络瓶颈的典型表现：**
- Recv-Q / Send-Q 持续非零：socket 积压
- TIME_WAIT 数量过多：连接没有正确关闭
- drops / errors 增长：丢包或错误
- RetransSegs 比例高：网络质量差或拥塞

### 5. Process 诊断路径

```bash
# 1. 查看进程状态
ps aux | grep <pid>
cat /proc/<pid>/status
# 关注: State, VmRSS, FD total, Threads

# 2. 查看打开的文件描述符
ls -la /proc/<pid>/fd | head -20
lsof -p <pid>

# 3. 查看进程的系统调用
strace -T -p <pid> -e trace=write,read 2>&1 | head -20

# 4. 查看进程的文件描述符限制
cat /proc/<pid>/limits

# 5. 查看进程的命令行
cat /proc/<pid>/cmdline | xargs -0 echo

# 6. 查看进程的工作目录
ls -la /proc/<pid>/cwd

# 7. 查看进程的内存映射
cat /proc/<pid>/maps

# 8. 查看 zombie 进程
ps aux | grep zombie
```

### 6. Container 诊断路径

```bash
# 1. 查看容器资源使用
docker stats --no-stream
# 或
crictl stats

# 2. 查看 cgroup 限制
cat /sys/fs/cgroup/memory/docker/<container_id>/memory.limit_in_bytes
cat /sys/fs/cgroup/cpu/docker/<container_id>/cpu.cfs_quota_us

# 3. 查看 OOM 次数
cat /sys/fs/cgroup/memory/docker/<container_id>/memory.oom_control

# 4. 查看容器的进程
docker top <container_id>
ls -la /proc/<pid>/ns/

# 5. 查看 overlay 文件系统
df -h /var/lib/docker/overlay2/
du -sh /var/lib/docker/overlay2/*

# 6. 查看 namespace 隔离
ls -la /proc/<pid>/ns/
```

## 常见故障处理对照表

| 现象 | 快速命令 | 根因 | 解决方案 |
|---|---|---|---|
| Load 高，CPU us 低 | vmstat 1, iostat | I/O 等待或进程阻塞 | 定位 I/O 瓶颈或阻塞点 |
| Load 高，CPU sy 高 | ps aux, strace | 频繁系统调用或上下文切换 | 优化 syscall，排查 CFS 调度 |
| 内存持续增长 | pmap, /proc/meminfo | 内存泄漏或 page cache 回收 | dump heap，定位泄漏点 |
| Swap 不断被使用 | swapon -s | 内存不足 | 扩容或限制内存 |
| 磁盘写满 | du -sh, iostat | 日志或临时文件 | 清理或压缩 |
| TIME_WAIT 过多 | ss -ant state time-wait | 连接关闭太慢 | 调整 net.ipv4.tcp_fin_timeout |
| 链接数耗尽 | ss -s, lsof | FD 泄漏或连接没释放 | 检查 FD，修复连接泄漏 |
| 容器被 OOMKilled | docker stats, dmesg | 内存超限 | 调高 memory.limit 或优化内存 |

## 核心追问

1. Load 高但 CPU 利用率低，说明什么？（I/O 等待或进程在等待锁/网络/磁盘）
2. 大量 TIME_WAIT 怎么优化？（tcp_tw_reuse, tcp_fin_timeout, keepalive）
3. 进程 RSS 和进程内存限制是什么关系？（RSS 是实际使用，limit 是上限）
4. iowait 高但磁盘吞吐低说明什么问题？（大量同步小 I/O，合并度低）
5. 如何判断是内存泄漏还是 page cache？（AnonPages vs Cached，持续增长 vs 波动）

## 复杂度

- 时间复杂度：O(n) — 每步命令 O(1)
- 空间复杂度：O(1) — 只读 /proc，不影响系统

## 工程迁移

生产环境：配合监控（Prometheus/Grafana）建立资源基线，在告警触发时快速执行 playbook 定位根因。

容器环境：将诊断路径映射到 crictl、docker stats、kubectl exec 等容器接口。

## 状态

| 子资产 | 状态 |
|---|---|
| Linux troubleshooting playbook | done |
| strace syscall lab | todo |
| cgroup and namespace notes | todo |
| file descriptor leak diagnosis | todo |
| container resource limit lab | todo |