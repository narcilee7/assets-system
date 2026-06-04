# File Descriptor Leak Diagnosis

## 目标

掌握 FD 泄漏的诊断和定位能力：什么是 FD、为何会泄漏、如何定位、如何预防。

## 什么是文件描述符

**文件描述符（FD）**：进程访问文件/ socket/ pipe 的内核句柄，本质是一个整数索引，指向进程文件描述符表中的 entry。

```
进程文件描述符表（每个进程独立）
fd 0: stdin  -> /dev/null
fd 1: stdout -> /dev/pts/0
fd 2: stderr -> /dev/pts/0
fd 3: /var/log/app.log (O_APPEND)
fd 4: socket:10.0.0.1:80
fd 5: pipe:[12345]
...
fd 1023: (最后默认限制)
```

**默认限制**：
- `ulimit -n`：单个进程默认 1024（soft）/ 1024（hard）
- 现代系统通常 65536 或更高

## FD 泄漏的原因

| 场景 | 根因 | 典型表现 |
|---|---|---|
| 文件没关 | open 后没 close | `lsof` 显示大量 `/var/log/xxx` 未关闭 |
| socket 没关 | 连接后没 close | `ss -s` 显示大量 `orphan` socket |
| 子进程 FD 没关 | fork 后 exec 前没 close | 短生命周期进程泄漏父进程 FD |
| 异常路径没关 | error/goto/panic 路径遗漏 | 特定错误码下泄漏 |
| dup2 没恢复 | 重定向后没恢复 | stderr 指向废弃 buffer |

## 诊断路径

### 1. 快速发现：FD 总数

```bash
# 快速看所有进程的 FD 使用
ls /proc/*/fd | wc -l

# 看 FD 最多的进程
for pid in $(ls /proc | grep '^[0-9]*$'); do
  count=$(ls /proc/$pid/fd 2>/dev/null | wc -l)
  if [[ $count -gt 500 ]]; then
    echo "PID $pid: $count FDs"
  fi
done

# 实时看某个进程的 FD 变化
watch -n 1 "ls -la /proc/<pid>/fd | wc -l"
```

### 2. 定位：lsof

```bash
# 看某个进程打开了哪些 FD
lsof -p <pid>

# 看某类文件（正则过滤）
lsof -p <pid> | grep -E "REG|CHR" | head
lsof -p <pid> | grep socket

# 看某个端口被哪些 FD 占用
lsof -i :8080

# 看打开文件数最多的进程
lsof +c 0 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head

# 看某个文件被哪些进程打开
lsof /var/log/syslog
```

### 3. 定位：/proc/<pid>/fd

```bash
# 列出某进程所有 FD
ls -la /proc/<pid>/fd
# 类型标识：
# l -> 符号链接（指向真实文件/socket）
# /dev/null -> 字符设备
# socket:[12345] -> socket（[] 内是 inode）

# 按类型分组
ls -la /proc/<pid>/fd | grep "^l" | awk '{print $NF}' | sort | uniq -c
# 输出: 50 /var/log/app.log  (50 个指向同一文件)
# 输出: 30 socket:[12345]

# 看 FD 对应的文件路径（readlink）
for fd in /proc/<pid>/fd/*; do
  target=$(readlink "$fd" 2>/dev/null)
  echo "$fd -> $target"
done

# 找泄漏：统计每种文件的数量
ls -la /proc/<pid>/fd 2>/dev/null | grep -v "^total" | awk '{print $NF}' | \
  sort | uniq -c | sort -rn | head
# 大量重复文件说明有泄漏
```

### 4. 分析：FD 增长趋势

```bash
# 监控 FD 增长（每 5 秒采样一次）
for i in {1..12}; do
  echo "--- $(date '+%H:%M:%S') ---"
  ls -la /proc/<pid>/fd | wc -l
  sleep 5
done

# 画图（简单文本图）
count=$(( $(ls -la /proc/<pid>/fd 2>/dev/null | wc -l) - 1 ))
printf "FD count: %d " $count
printf "#%.0s" $(seq 1 $((count / 100)))
echo
```

### 5. 分析：socket 泄漏

```bash
# 看所有 socket
ss -tunapl | head -20

# 按 state 分组
ss -s | grep -v "Netid"

# 看 TIME_WAIT
ss -ant state time-wait | wc -l

# 看 orphan socket（没有被进程引用的 socket）
ss -tunapl | grep -v "pid"

# 看具体进程的 socket
lsof -p <pid> -i -a

# 看是否有 bind 失败（端口没释放）
ss -tunapl sport = :8080
```

### 6. 分析：文件句柄泄漏

```bash
# 看哪个目录下的文件最多
for pid in $(pgrep -f <process_name>); do
  echo "PID $pid:"
  ls -la /proc/$pid/fd 2>/dev/null | grep -v "^total" | awk '{print $NF}' | \
    xargs -I{} dirname {} 2>/dev/null | sort | uniq -c | sort -rn | head -5
done

# 看某进程是否不断打开文件（每次请求打开一个）
strace -e trace=open,openat,close -p <pid> -c 2>&1 | tail -10
```

## 修复模式

### Go: defer close

```go
f, err := os.Open("file.txt")
if err != nil {
    return err
}
defer f.Close()  // 函数退出时自动关闭
```

### Go: 错误路径也要 close

```go
f, err := os.Open("file.txt")
if err != nil {
    // 这里不需要 close，因为没打开成功
    return err
}
defer f.Close()

// 可能在中间 return，记得 defer 会处理
if someCondition {
    return errors.New("bad")
}
// ...
```

### Go: 多文件 close

```go
f1, err := os.Open("a.txt")
if err != nil { return err }
f2, err := os.Open("b.txt")
if err != nil {
    f1.Close()  // 要手动关第一个
    return err
}
defer f1.Close()
defer f2.Close()
```

### C: fopen/fclose

```c
FILE *f = fopen("file.txt", "r");
if (!f) {
    return -1;
}
// ... 操作 ...
fclose(f);  // 错误路径也要关
```

### C: fork 后在子进程关闭 FD

```c
int fd = open("file.txt", O_RDONLY);
// fork 后子进程继承 fd，需要在 exec 前关闭
if (fork() == 0) {
    close(fd);  // 子进程关闭
    execvp("ls", args);
}
// 父进程继续使用 fd
```

## 预防措施

1. **代码规范**：所有 `open/fopen/socket/accept` 配对 `close/fclose`
2. **lint 工具**：`golangci-lint` 有 `gosec` 检查未关闭 FD
3. **监控告警**：FD 使用率 > 80% 时告警
4. **资源限制**：在 cgroup 或 systemd unit 中设置 `LimitNOFILE`
5. **测试**：在测试中检查 FD 增长

## 验证方法

```bash
# 运行前记录 FD 数
before=$(ls -la /proc/$(pgrep -f myapp)/fd 2>/dev/null | wc -l)

# 跑测试
./myapp_test

# 运行后记录 FD 数
after=$(ls -la /proc/$(pgrep -f myapp)/fd 2>/dev/null | wc -l)

# 对比
echo "Before: $before, After: $after, Diff: $((after - before))"
```

## 核心追问

1. **FD 耗尽会怎样？** 新的 open/socket/accept 会返回 `EMFILE`（too many open files）
2. **为什么 `lsof` 需要 root？** 普通用户看不到其他进程的 FD，但可以看到自己的
3. **`/proc/<pid>/fd` 和 `lsof` 的区别？** `/proc` 是 Linux 内核接口，lsof 是包装；结果一样
4. **socket 为什么也算 FD？** socket 是文件描述符的一种，通过 `socket()` 系统调用创建
5. **容器内 FD 限制？** 容器默认继承宿主机的 ulimit，K8s 可以通过 `resources.limits` 设置

## 状态

| 资产 | 状态 |
|---|---|
| Linux troubleshooting playbook | reviewed |
| strace syscall lab | done |
| cgroup and namespace notes | done |
| file descriptor leak diagnosis | done |