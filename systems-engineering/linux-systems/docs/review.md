# Review: Linux Troubleshooting Playbook

## 核心能力

训练在生产环境中快速定位问题的能力。目标是 **30 秒定位方向，5 分钟找到根因**。

## 我一开始容易写错什么

1. **只看 top，不看 vmstat/iostat**：top 显示的是采样瞬间，vmstat 的 r 列显示等待运行的进程数才是真正的"有没有排队"
2. **忽略 %iowait 的含义**：%iowait 高不等于磁盘瓶颈，也可能是网络 I/O 等待或 NFS 挂载的远程 I/O
3. **只看内存 free 不看 available**：Linux 会把 page cache 算进 free，但 available 才真正代表可分配内存
4. **只看 CPU 不看 Load Average**：单核 CPU 100% 但 Load 0.5 说明任务在等 I/O 而不是 CPU

## 这个 playbook 为什么成立

**分层诊断原则**：从上到下逐层定位，而不是盲猜。

```
uptime / vmstat          -> 知道方向（CPU/IO/Memory/Swap）
  -> top / ps            -> 定位进程
    -> pidstat / perf    -> 定位热点函数
      -> strace          -> 定位 syscall
```

每一步都是幂等的，只读 /proc，不影响系统。

## 和标准工具的差距

- `vmstat 1 5`：只显示汇总，需要配合 `iostat -xz 1` 看 I/O 细节
- `strace -c`：统计的是 syscall 次数，但看不出调用链路（用 `-f` 跟踪子进程）
- `top -bn1`：第一屏是累计值，需要等 3-5 秒看增量
- `perf top`：需要符号表（debug symbols），容器内可能看不到函数名

## 工具对比

| 工具 | 场景 | 局限 |
|---|---|---|
| `top` | 快速看进程 CPU/MEM | 采样瞬间，不连续 |
| `vmstat` | 看整体负载方向 | 不能定位到进程 |
| `iostat` | 磁盘 I/O 瓶颈 | 需要确认是读还是写 |
| `pidstat` | 进程级 I/O 统计 | 默认可能没装 |
| `perf` | CPU 热点函数 | 需符号表，权限 |
| `strace` | syscall 跟踪 | 开销大，不能长期跑 |
| `ss` | socket 统计 | 看不到进程名（用 -p） |
| `tcpdump` | 网络包分析 | 只管抓包，不做分析 |
| `pmap` | 进程内存映射 | 匿名页才准确 |

## 工程里怎么取舍

1. **有监控 vs 无监控**：有监控时先看 dashboard 趋势再决定跑哪个命令；无监控时用 playbook 手动定位
2. **容器内 vs 物理机**：容器内 `/proc/<pid>/fd` 仍然可用但 `/sys/fs/cgroup` 结构可能不同
3. **生产环境**：strace 和 perf 在生产环境慎用，开销大；先 `perf top -p <pid> -d 5` 采样，不要直接 `perf record`
4. **多进程场景**：nginx/uwsgi 多 worker 时，看 PIDs 需要用 `pgrep -f` 或者 `ps aux | grep`

## 下次复习重点

1. `vmstat` 的 r 列和 `top` 的 load average 的关系
2. `ps aux` 和 `ps auxf` 的区别（树形 vs 扁平）
3. `/proc/<pid>/status` 里 VmRSS vs VmSize 的含义
4. `strace -c` 统计的是墙上时间还是 CPU 时间？
5. `iostat -xz` 的 await 和 avgqu-sz 的关系

## 状态

| 资产 | 状态 |
|---|---|
| Linux troubleshooting playbook | reviewed |