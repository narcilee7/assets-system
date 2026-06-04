# Strace Syscall Lab

## 目标

掌握用 strace 分析进程系统调用的能力：过滤，跟踪，统计耗时，识别异常行为。

## 场景

- 服务响应慢，想知道在等什么 syscall
- 怀疑有文件描述符泄漏，想看 open/close 调用
- 想看进程的网络行为（connect/accept/send/recv）
- 想统计一段时间内各 syscall 的耗时分布

## 核心命令

### 基础用法

```bash
# 跟踪单个进程
strace -p <pid>

# 跟踪并显示返回值
strace -p <pid> -f

# 跟踪子进程（fork/vfork 后的子进程）
strace -f -p <pid>

# 只跟踪特定的 syscall
strace -e trace=open,read,write,close -p <pid>

# 跟踪网络相关 syscall
strace -e trace=network -p <pid>
# 或
strace -e trace=send,recv,connect,accept -p <pid>

# 跟踪文件描述符相关
strace -e trace=open,openat,close,dup,dup2 -p <pid>

# 跟踪内存映射
strace -e trace=mmap,mprotect,brk,munmap -p <pid>
```

### 耗时分析

```bash
# 显示每次调用的耗时（-T flag）
strace -T -p <pid>
# [    0.000123] open("/etc/passwd", O_RDONLY) = 4 <0.000456>

# 统计每个 syscall 的总耗时（-c flag）
strace -c -p <pid>
# % time     seconds  usecs/call     calls    errors syscall
# ------ ----------- ----------- --------- --------- ----------------
#  25.00    0.001234         123      10      5    read

# 实时显示调用耗时（-t flag，每行加时间戳）
strace -t -p <pid>

# 相对时间戳（-r flag，显示每步的相对耗时）
strace -r -p <pid>
#  0.000123 open("/etc/passwd", O_RDONLY) = 4
#  0.000456 read(4, "root:x:0:0:root", 1024) = 33
```

### 输出控制

```bash
# 输出到文件（不影响性能）
strace -o /tmp/strace.log -p <pid>

# 设置输出缓冲区大小（减少 writes 的次数）
strace -s 4096 -p <pid>
# -s 设置字符串最大显示长度（默认32）

# 只显示错误（-z flag）
strace -z -p <pid>

# 只显示有错误的调用（-Z flag）
strace -Z -p <pid>
```

### 常用组合

```bash
# 完整记录（-f 跟踪子进程，-ff 按 PID 分文件，-tt 时间戳，-s 字符串长度）
strace -f -ff -tt -s 4096 -o /tmp/strace.out <command>

# 统计耗时 top（运行命令而非 PID）
strace -c <command>
# syscalls: seconds  usecs/call  calls  errors  syscall
#   total:  0.012345    123        100     5

# 查看特定 syscalls 并统计
strace -c -e trace=write,read -p <pid>

# 跟踪某个目录下的文件操作
strace -e trace=open,openat,read,write -p <pid> 2>&1 | grep "/tmp"
```

## 实战场景

### 场景 1：定位为什么读文件很慢

```bash
# 用 -T 看到底哪个 read 慢
strace -T -e trace=read -p <pid> 2>&1 | grep read | sort -k 6 -rn | head

# 用 -c 看读操作占比
strace -c -e trace=read -p <pid> -- <wait 10 seconds> -a

# 对比不同阶段：启动时 vs 稳态
strace -c -o /tmp/phase1.txt -p <pid> &
sleep 30
strace -c -o /tmp/phase2.txt -p <pid> &
```

### 场景 2：文件描述符泄漏

```bash
# 跟踪 open/close 的次数差
strace -c -e trace=open,openat,close -p <pid>

# 实时看 fd 分配
strace -e trace=dup,dup2,pipe,socket -p <pid>

# 配合 lsof 验证
lsof -p <pid> | wc -l  # 当前 fd 数
# 等 1 分钟后再看，看是否持续增长
```

### 场景 3：网络连接问题

```bash
# 跟踪 connect/accept/send/recv
strace -e trace=connect,accept,send,recv -p <pid>

# 跟踪失败的连接（ENOTCONN, ECONNREFUSED）
strace -z -e trace=connect -p <pid>

# 跟踪耗时过长的 connect（可能 DNS 超时）
strace -T -e trace=connect -p <pid> 2>&1 | grep -v " = -1" | head
```

### 场景 4：分析程序启动过程

```bash
# 跟踪整个命令执行（不用 -p）
strace -f -tt -s 4096 -o /tmp/strace.out <command>

# 分析启动日志
cat /tmp/strace.out | grep -E "execve|mmap|openat|read" | head -50

# 看加载了哪些 so
cat /tmp/strace.out | grep "openat.*\.so" | head -20
```

### 场景 5：信号和子进程

```bash
# 跟踪 fork/clone 和 signal
strace -f -e trace=fork,clone,execve,signal -p <pid>

# 看 SIGCHLD 发送时机
strace -e trace=signal -p <pid>
```

## Syscall 速查表

| 分类 | Syscalls | 用途 |
|---|---|---|
| 文件 I/O | open, openat, read, write, close, pread, pwrite, lseek, fsync | 文件读写 |
| 文件管理 | mkdir, rmdir, unlink, rename, truncate, chmod, chown | 文件结构 |
| 进程 | fork, vfork, clone, execve, wait4, exit, kill | 进程生命周期 |
| 内存 | mmap, mprotect, brk, munmap, madvise | 内存映射 |
| 线程 | clone (CLONE_THREAD), futex | 线程创建/同步 |
| 网络 | socket, connect, accept, send, recv, bind, listen, shutdown | 网络操作 |
| IPC | pipe, mkfifo, socket, sendmsg, recvmsg | 进程间通信 |
| 时间 | gettimeofday, clock_gettime, nanosleep | 时间查询 |
| 配置 | getrlimit, setrlimit, prctl, sysinfo | 系统配置 |

## 核心追问

1. `strace -c` 统计的是 CPU 时间还是墙上时间？（墙上时间，包括等待）
2. `strace -f` 和不带 `-f` 的区别？（`-f` 跟踪子进程，通过 fork/vfork/clone 创建）
3. 为什么生产环境慎用 `strace -p`？（开销大，会显著变慢）
4. `strace -T` 显示的 `<0.000123>` 是什么？（该次调用的墙上时间）
5. `strace -c` 的 `calls` 列和实际调用次数有差异吗？（有些 syscall 被过滤或未捕获）

## 复杂度

- 时间复杂度：O(n) — 每步命令 O(1)
- 空间复杂度：O(n) — `-o` 输出到文件

## 工程迁移

生产环境：先用 `-c` 采样看趋势，再针对特定 syscall 用 `-T` 定位热点。输出到文件后用 grep/awk 分析。

## 状态

| 资产 | 状态 |
|---|---|
| Linux troubleshooting playbook | reviewed |
| strace syscall lab | done |