# Virtual Memory Deep Dive

## 目标

理解虚拟内存的完整机制：页表、TLB、缺页中断、Copy-on-Write、内存映射文件，以及它们如何支撑现代操作系统的高效运行。

## 场景

- 为什么 32 位系统只能使用 4GB 内存？
- 进程 A 和进程 B 的 0x400000 地址为什么不冲突？
- malloc 后物理内存真的分配了吗？
- fork() 为什么不立即复制全部内存？
- mmap 和普通 read/write 有什么区别？

## 虚拟内存的核心思想

```
为每个进程提供独立的、连续的地址空间假象

虚拟地址（VA） → 页表（Page Table） → 物理地址（PA）

好处：
  1. 隔离：进程互不干扰
  2. 超额分配：使用比物理内存更多的地址空间（swap）
  3. 共享：共享库通过相同物理页映射到不同进程
  4. 保护：页表项中的权限位（R/W/X）
```

## 地址空间布局（Linux x86_64）

```
高地址
0xFFFF_FFFF_FFFF_FFFF  ┌─────────────┐
                       │  内核空间    │  ← 所有进程共享，用户态不可访问
0xFFFF_8000_0000_0000  ├─────────────┤
                       │   栈 ↓       │  ← 向下增长，默认 8MB
                       │    ...      │
                       │   堆 ↑       │  ← 向上增长，malloc 分配
                       ├─────────────┤
                       │   BSS        │  ← 未初始化的全局变量
                       │   数据段     │  ← 已初始化的全局变量
                       │   代码段     │  ← 程序指令（只读）
0x0040_0000            ├─────────────┤
                       │   保留区     │
0x0000_0000_0000_0000  └─────────────┘
低地址
```

## 页表机制

### 多级页表（x86_64，4-level）

```
虚拟地址（48位有效）：
  [ PML4 (9b) | PDPT (9b) | PD (9b) | PT (9b) | Offset (12b) ]

每级页表 512 项（2^9），每项 8 字节
页大小：4KB（2^12）

转换过程：
  1. CR3 → PML4 基地址
  2. PML4[索引] → PDPT 基地址
  3. PDPT[索引] → PD 基地址
  4. PD[索引] → PT 基地址
  5. PT[索引] → 物理页基地址
  6. 物理页 + Offset = 物理地址
```

### 页表项（PTE）结构

```
┌─────┬─────┬───┬───┬───┬───┬───┬───┬──────────────┐
│ ... │ PFN │ D │ A │ G │ P │ W │ U │    标志位     │
└─────┴─────┴───┴───┴───┴───┴───┴───┴──────────────┘

PFN: Page Frame Number（物理页框号）
D (Dirty): 页是否被写过
A (Accessed): 页是否被访问过
G (Global): 全局页（内核页表，切换进程时不 flush TLB）
P (Present): 页是否在物理内存中
W (Writable): 是否可写
U (User): 是否用户态可访问
```

### 大页（Huge Page）

```
标准页：4KB
大页：2MB（PD 直接指向物理页，省一级页表）
巨页：1GB（PDPT 直接指向物理页）

好处：
  - 减少页表层级，加速地址转换
  - 减少 TLB miss（同样 TLB 项覆盖更大范围）
  - 减少 page walk 的内存访问次数

代价：
  - 内部碎片（最少分配 2MB）
  - 需要连续物理内存
```

## TLB（Translation Lookaside Buffer）

```
TLB = 页表的硬件缓存

命中：VA → PA 直接转换，零额外内存访问
未命中：需要遍历 4 级页表（4 次内存访问），然后填充 TLB

TLB 结构：
  ┌─────────────┬─────────────┬──────┐
  │  VPN (Tag)  │  PFN + 权限  │  ASID│
  └─────────────┴─────────────┴──────┘
  
  ASID (Address Space ID)：区分不同进程的 TLB 项
  切换进程时：无 ASID → 必须 flush TLB；有 ASID → 选择性失效
```

## 缺页中断（Page Fault）

### 触发条件

```
1. 访问的页不在物理内存（P=0）
2. 访问权限不足（写只读页，用户态访问内核页）
3. 访问未分配的地址（野指针）
```

### 处理流程

```
1. CPU 触发 Page Fault，保存状态，切换到内核态
2. 内核检查 fault 地址的合法性
   a. 合法且未加载 → 从磁盘加载页（major page fault）
   b. 合法且被 swap out → 从 swap 加载
   c. 合法且 COW → 复制物理页
   d. 非法 → 发送 SIGSEGV（Segmentation Fault）
3. 更新页表，设置 P=1
4. 重新执行触发 fault 的指令
```

### Minor vs Major Page Fault

```
Minor：
  - 页已分配但还未建立映射
  - 或者 COW 触发复制
  - 不涉及磁盘 I/O
  - 快（μs 级）

Major：
  - 需要从磁盘加载（可执行文件、内存映射文件、swap）
  - 涉及磁盘 I/O
  - 慢（ms 级）
```

## Copy-on-Write（COW）

### 机制

```
fork() 时：
  - 不复制物理页
  - 父子进程共享同一物理页
  - 页表项标记为只读（W=0）

写操作时：
  - CPU 触发 Page Fault（写只读页）
  - 内核检查：这是 COW 页 → 复制物理页
  - 子进程获得新物理页，标记为可写
  - 父进程的页保持原样，也恢复可写

效果：
  - 如果 fork 后 exec：只读共享，exec 时丢弃，零复制开销
  - 如果 fork 后少量写：只复制被修改的页
```

### 示例

```c
int main() {
    int *p = mmap(NULL, 4096, PROT_READ|PROT_WRITE, 
                  MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
    *p = 42;
    
    pid_t pid = fork();
    if (pid == 0) {
        // 子进程：共享同一物理页，COW
        *p = 100;  // 触发 COW，复制新页
        printf("child: %d\n", *p);  // 100
    } else {
        wait(NULL);
        printf("parent: %d\n", *p);  // 42
    }
}
```

## 内存映射文件（mmap）

### 原理

```
将文件直接映射到进程的虚拟地址空间

普通 read/write：
  read(fd, buf, size) → 内核页缓存 → 拷贝到用户态 buf
  write(fd, buf, size) → 用户态 buf → 内核页缓存

mmap：
  addr = mmap(NULL, size, PROT_READ, MAP_SHARED, fd, 0)
  // 直接访问 addr，就像访问内存一样
  // 实际数据通过 page fault 按需加载
```

### Private vs Shared

```
MAP_PRIVATE：
  - 写操作触发 COW
  - 不影响其他进程，不写回文件
  - 用途：加载共享库（.so）、只读配置

MAP_SHARED：
  - 写操作直接修改页缓存
  - 其他进程可见，msync() 后写回磁盘
  - 用途：进程间共享内存、数据库 mmap
```

### 性能对比

```
小文件随机访问：read/write 可能更快（避免 page fault 开销）
大文件顺序访问：mmap 更快（减少一次拷贝，内核直接管理页缓存）
大量小文件：read/write 更好（mmap 需要维护页表，TLB 压力大）
```

## 物理内存管理

### Buddy System（伙伴系统）

```
目标：管理物理页的分配和回收，减少外部碎片

原理：
  - 将空闲页组织成 2^n 大小的块
  - 分配：找到最小满足的块，不够则分裂大块
  - 回收：检查相邻伙伴是否空闲，是则合并

阶（Order）：
  order 0 = 1 页（4KB）
  order 1 = 2 页（8KB）
  order 2 = 4 页（16KB）
  ...
  order 10 = 1024 页（4MB）
```

### SLAB Allocator

```
目标：高效分配小对象（task_struct、inode、socket 等）

原理：
  - 从 buddy system 获取一页或多页
  - 划分成固定大小的对象缓存
  - 回收时放回缓存，不立即归还 buddy

优势：
  - 减少碎片
  - 快速分配（O(1)）
  - 对象复用，cache line 友好
```

## 核心追问

1. **为什么 32 位系统限制 4GB？** 虚拟地址 32 位，2^32 = 4GB 地址空间
2. **malloc(100MB) 后物理内存增加多少？** 通常不增加，直到实际写入触发缺页分配物理页
3. **为什么 fork + exec 比直接创建进程高效？** COW 机制让 fork 几乎零拷贝，exec 时丢弃未修改的共享页
4. **TLB miss 后为什么慢？** 需要遍历 4 级页表，4 次内存访问，每次访问可能还有 cache miss
5. **mmap vs read 哪个快？** 取决于访问模式：大文件顺序读 mmap 快（零拷贝），小文件/随机读 read 稳定（预读友好）

## 状态

| 资产 | 状态 |
|---|---|
| process vs thread notes | done |
| virtual memory deep dive | done |
| epoll and event loop bridge | todo |
| file system and page cache | todo |
| lock primitives comparison | todo |
