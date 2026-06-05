# Page Cache and fsync

## 目标

理解存储系统中的 page cache 机制、fsync 语义、O_DIRECT 选项，以及它们在数据库和文件系统中的一致性与性能权衡。

## 场景

- write() 后数据真的到磁盘了吗？
- 为什么数据库 crash 后可能丢数据？
- O_DIRECT 绕过 page cache 是万能药吗？
- 为什么 SSD 的 fsync 比 HDD 快？
- 写日志时为什么先 fsync 日志再 fsync 数据？

## 写路径

### 应用写入数据的完整路径

```
应用层：
  write(fd, buf, 4096)
    │
    ▼
VFS（虚拟文件系统）：
  - 分配 page cache 页
  - 拷贝用户数据 buf → page cache（内核空间）
  - 标记页为 dirty
  - write() 立即返回（异步）
    │
    ▼
Page Cache（内存）：
  - 脏页积累
  - 内核 flush 线程定期刷盘（dirty_expire_centisecs）
  - 或内存不足时回收（先写回再丢弃）
    │
    ▼
块层（Block Layer）：
  - I/O 调度（电梯算法、NOOP、 deadline）
  - 合并相邻请求
    │
    ▼
设备驱动：
  - 提交到磁盘控制器
    │
    ▼
磁盘：
  - HDD：磁头寻道 → 旋转 → 写入（ms 级）
  - SSD：FTL 映射 → 写入闪存（μs 级）
  - 磁盘控制器可能还有 cache（volatile）
```

### 关键认知

```
write() 返回 ≠ 数据在磁盘上

数据可能在：
  1. CPU cache（用户态 → 内核态拷贝后已不在）
  2. Page cache（内存）
  3. 磁盘控制器 cache（易失）
  4. 持久化存储（真正安全）

掉电风险：
  - page cache 丢失：数据丢失（未 fsync）
  - 磁盘控制器 cache 丢失：如果控制器无电池备份（BBU），数据丢失
```

## fsync 语义

### 三个刷盘函数

```c
int fsync(int fd);
// 刷盘 fd 对应文件的数据和元数据
// 等待磁盘控制器确认
// 最慢，最安全

int fdatasync(int fd);
// 只刷数据，不刷元数据（除非元数据影响数据读取）
// 例如：文件大小变化必须刷元数据
// 通常比 fsync 快 20-50%

void sync(void);
// 发起所有脏页和脏 inode 的刷盘
// 不等待完成，异步发起
```

### 为什么 fsync 慢？

```
1. 数据同步：
   - 把该文件的所有 dirty page 发送到磁盘队列
   - 等待磁盘控制器处理完成

2. 元数据同步（fsync 特有）：
   - 更新 inode（文件大小、mtime）
   - 更新目录项（如果新建文件）
   - 更新 superblock（空闲块信息）
   - 这些元数据可能在不同的磁盘位置 → 随机 I/O

3. 磁盘物理延迟：
   - HDD：寻道 4-10ms + 旋转 2-5ms
   - SSD：擦除-写入周期，但仍有 100μs-1ms

4. 写放大：
   - 日志文件系统（ext4 ordered）：
     数据写盘 → 元数据写日志 → 日志提交
```

### 批量 fsync 优化

```
问题：每条事务都 fsync，QPS 骤降（从 10K → 几百）

组提交（Group Commit）：
  - 多个事务的日志缓冲合并
  - 一次 fsync 刷多个事务的日志
  - MySQL InnoDB：binlog_group_commit_sync_delay

示例：
  T1: write log1 → 等待 fsync
  T2: write log2 → 等待 fsync
  T3: write log3 → 等待 fsync
  
  组提交后：
    fsync(log1 + log2 + log3) 一次
    T1, T2, T3 同时返回
```

## O_DIRECT

### 绕过 Page Cache

```c
int fd = open("data.db", O_RDWR | O_DIRECT);
// 直接读写磁盘，不经过 page cache
```

### 为什么数据库喜欢用 O_DIRECT？

```
问题 1：双重缓存
  Page cache（内核）+ Buffer pool（数据库）
  同一份数据占两份内存

问题 2：一致性问题
  - 数据库修改 buffer pool 页
  - 内核 page cache 还是旧数据
  - 另一个进程直接读文件 → 读到旧数据

问题 3：刷盘不可控
  - 内核 flush 线程策略不透明
  - 数据库需要精确控制 WAL + checkpoint 时机

O_DIRECT 解决：
  - 读写都直接走磁盘
  - 数据库自己管理缓存和预读
  - 自己控制对齐（通常 512B 或 4KB）
```

### O_DIRECT 的代价

```
1. 对齐要求：
   - 缓冲区地址和长度必须按扇区对齐（通常 512B）
   - 文件偏移也必须对齐
   - 不对齐 → EINVAL

2. 失去预读：
   - 内核 page cache 的顺序预读消失
   - 数据库需要自己实现预读

3. 失去缓存：
   - 每次读都走磁盘
   - 数据库必须有高效的 buffer pool

4. 代码复杂度：
   - 需要处理内存对齐分配（posix_memalign）
   - 自己管理脏页和刷盘
```

### O_SYNC / O_DSYNC

```c
int fd = open("log", O_WRONLY | O_SYNC);
// 每次 write() 都等价于 write() + fsync()

O_SYNC：数据和元数据同步
O_DSYNC：只同步数据（类似 fdatasync）

比 fsync 更慢：
  - 每次 write 都等待磁盘
  - 吞吐量极低
  
适用：
  - 极少数需要逐条持久化的场景
  - 通常用 fsync 批量刷盘更好
```

## 存储栈调优

### 内核参数

```bash
# 脏页占系统内存的比例开始刷盘
vm.dirty_ratio = 40
vm.dirty_background_ratio = 10

# 脏页在内存中保留的最长时间（单位：百分之一秒）
vm.dirty_expire_centisecs = 3000  # 30秒

# flush 线程唤醒间隔
vm.dirty_writeback_centisecs = 500  # 5秒

# 禁用 swap（数据库服务器常见）
vm.swappiness = 1

# 透明大页（数据库建议关闭，避免内存抖动）
vm.nr_hugepages = 1024
echo never > /sys/kernel/mm/transparent_hugepage/enabled
```

### SSD 优化

```bash
# 启用 TRIM（ discard ），通知 SSD 哪些块已删除
mount -o discard /dev/sdb1 /data

# I/O 调度器：SSD 用 noop 或 none，HDD 用 deadline
echo noop > /sys/block/sda/queue/scheduler

# 预读：SSD 随机读好，可降低预读
blockdev --setra 256 /dev/sda

# 禁用磁盘缓存（如果无 BBU）
hdparm -W 0 /dev/sda
```

## WAL 与 fsync 顺序

### 为什么先写日志再写数据？

```
数据库事务提交：
  1. 写 WAL（redo log）：记录"做了什么修改"
  2. fsync WAL（保证日志持久化）
  3. 返回客户端"提交成功"
  4. 后台异步写数据页到磁盘（checkpoint）

Crash 恢复：
  - 数据页可能还没刷盘（丢了）
  - 但 WAL 里有完整记录
  - 重启后重放 WAL，恢复数据页

关键顺序：
  WAL fsync 必须在返回客户端之前完成
  数据页可以延迟刷盘

为什么反过来不行？
  - 先写数据页 → 返回成功 → crash → WAL 没写
  - 数据页已修改但无记录 → 无法恢复 → 不一致
```

### 两阶段提交中的 fsync

```
分布式事务（2PC）：
  Coordinator                    Participant
     │                                │
     │── Prepare ────────────────────►│
     │                                │ 写本地 prepare 日志
     │                                │ fsync prepare 日志
     │◄─ Yes/No ─────────────────────│
     │                                │
     │── Commit ─────────────────────►│
     │                                │ 写 commit 日志
     │                                │ fsync commit 日志
     │◄─ ACK ────────────────────────│

两个 fsync 点：
  - Prepare 时 fsync：保证能恢复决定
  - Commit 时 fsync：保证事务持久化

优化：
  - 组提交减少 fsync 次数
  - 部分实现用 "early ack"（风险换性能）
```

## 核心追问

1. **fsync 后掉电数据还会丢吗？** 如果磁盘控制器有 cache 且无 BBU（电池备份），fsync 只保证数据到控制器 cache，不到闪存/ platter → 仍可能丢；解决方案：禁用磁盘写 cache 或启用 BBU
2. **O_DIRECT 和 fsync 的关系？** O_DIRECT 绕过 page cache，但数据可能仍在磁盘控制器 cache；要真正持久化仍需 fsync；O_DIRECT + fsync 是最强保证
3. **为什么 MySQL 的 double write buffer 需要 fsync？** InnoDB 页大小 16KB，文件系统页 4KB，一页写可能分两次；double write 先写共享表空间（2MB 顺序写），再写数据文件；崩溃时用 double write 恢复 torn page
4. **page cache 对读友好但对写不友好？** 读时缓存命中避免磁盘 I/O；写时延迟写提升吞吐，但增加了丢数据窗口，且数据库自己有 buffer pool 造成双重缓存
5. **如何测试真正的磁盘持久化？** 模拟掉电（物理断电或 echo b > /proc/sysrq-trigger），检查 fsync 后的数据是否还在；或检查磁盘控制器的 write-cache 状态

## 状态

| 资产 | 状态 |
|---|---|
| object storage multipart design | done |
| LSM compaction notes | done |
| page cache and fsync | done |
| storage durability checklist | todo |
