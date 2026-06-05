# Virtual Memory Lab — Chain-1

可运行实验，演示虚拟内存、COW、Page Fault、RSS/VSZ 差异。

## 运行环境

- **Linux 真机**或 **Docker**（`/proc/self/status` 和 `smaps` 是 Linux 接口）。
- macOS 用户请用 Docker：`docker run --rm -it -v $(pwd):/lab ubuntu:22.04 bash`

## 实验列表

### 1. Page Fault 计数器（Python）

```bash
python3 page_fault_counter.py
```

预期输出：
- 分配 100MB 但不触摸 → `minflt` 几乎不变（Linux 推迟分配）。
- 触摸每一页 → `minflt` 增加约 `100MB / 4KB = 25600` 次。

### 2. COW 观测（Python）

```bash
python3 cow_demo.py
```

预期输出：
- 子进程 `fork` 后，父子共享物理页，`Private_Dirty` 很低。
- 子进程写入映射页后，触发 COW，`Private_Dirty` 上升约 4KB。

### 3. RSS / VSZ 观测（Go）

```bash
cd go
go run memstats.go
```

预期输出：
- `make([]byte, 100MB)` 后 `VmSize` 增加 100MB，`VmRSS` 几乎不变。
- 写入后 `VmRSS` 增加约 100MB。

### 4. RSS / VSZ 观测（Java）

```bash
cd java
javac MemoryStats.java
java MemoryStats
```

注意：Java `new byte[]` 会**立即清零**，因此 JVM 上分配即触摸，RSS 会立刻上升。

## 原理速查

| 指标 | 含义 | 观察方式 |
|---|---|---|
| VmSize | 虚拟地址空间大小 | `/proc/self/status` |
| VmRSS | 实际驻留物理内存 | `/proc/self/status` |
| minflt | 次要缺页（无需磁盘） | `/proc/self/stat` 第 10 字段 |
| majflt | 主要缺页（需要磁盘 I/O） | `/proc/self/stat` 第 12 字段 |
| Private_Dirty | 私有脏页（COW 后） | `/proc/self/smaps` |
