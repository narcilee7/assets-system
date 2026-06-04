# Linux Systems

## 目标

训练 Linux 生产环境诊断能力：CPU、内存、磁盘、网络、进程、容器和系统调用。

## 工具地图

| 方向 | 工具 |
| --- | --- |
| CPU | `top`、`htop`、`pidstat`、`perf` |
| Memory | `free`、`vmstat`、`pmap`、`smem` |
| Disk | `iostat`、`df`、`du`、`iotop` |
| Network | `ss`、`netstat`、`tcpdump`、`iftop` |
| Process | `ps`、`lsof`、`strace` |
| Kernel | `/proc`、`dmesg`、`sysctl` |
| Container | `cgroup`、`namespace`、`overlayfs` |

## 资产

| 资产 | 状态 |
| --- | --- |
| Linux troubleshooting playbook | `docs/troubleshooting.md` |
| strace syscall lab | `docs/strace.md` |
| cgroup and namespace notes | `docs/cgroup-namespace.md` |
| file descriptor leak diagnosis | `docs/fd-leak.md` |
| container resource limit lab | `docs/container-resource.md` |

