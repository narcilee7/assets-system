# File System and Page Cache

## 目标

理解文件系统的核心抽象：inode、VFS、page cache、fsync，以及它们如何保证数据的持久性和一致性。

## 场景

- 为什么 rm 一个大文件很快，但写满磁盘后删文件不会立即释放空间？
- fsync 和 fdatasync 有什么区别？
- 为什么数据库要自己管理 page cache（O_DIRECT）？
- 断电后数据为什么会丢失？WAL 如何保证 crash safety？
- 软链接和硬链接的本质区别？

## 文件系统的背景

在操作系统的荒蛮时代，是没有“文件”这个概念的。计算机面对的只有最原始的硬件：一块由无数个扇区（Sector，通常是 512 字节）组成的磁带或机械硬盘。

如果当时你要写一个程序保存数据，你必须直接和硬件打交道：

1. **绝对物理地址：** 你需要对驱动程序说：“把我这段数据，写到磁头 0、柱面 3、第 5 个扇区开始的连续 20 个扇区里。”
2. **数据覆盖灾难：** 另一个程序运行了，它不知道你占用了哪里，一不小心也往这几个扇区写了数据，你的数据瞬间灰飞烟灭。
3. **数据碎片化：** 如果你的数据后来变大了，原来的 20 个扇区装不下了，你必须人工去寻找另外的空闲扇区，并在代码里记住“前半部分在 A 处，后半部分在 B 处”。

**总结当时的痛点：**

- **难用：** 程序员必须精通硬件结构，手动管理物理块（Block/Sector）。
- **冲突：** 多个程序之间没有任何数据隔离和保护，互相踩踏。
- **无法跨硬件：** 换一块不同扇区大小或磁头数量的硬盘，所有的代码都要重写。

### 操作系统的伟大使命：如何抽象？

为了解决这个烂摊子，操作系统施展了它的核心魔法——**虚拟化与抽象（Abstraction）**。

操作系统作为中间层，对上（用户和程序员）瞒天过海，对下（物理硬件）严加管理。它连续完成了**三重完美的抽象**，逐步演变成了今天我们熟悉的文件系统。

#### 第一重抽象：将“物理扇区”抽象为“逻辑块（Logical Block）”

- **硬件层：** 硬盘有不同的磁头、柱面、扇区（CHS 寻址），或者不同的闪存颗粒（SSD）。
- **操作系统的动作：** 内核的硬件驱动层把这些复杂的物理结构屏蔽掉，统一看作是一个**巨大的、一维的、连续的逻辑块数组**（比如每个块 4KB，编号为 Block 0, Block 1, Block 2...）。
- **意义：** 这一步让操作系统上层的代码彻底摆脱了硬件物理结构的束缚（LBA 寻址）。

#### 第二重抽象：将“逻辑块集合”抽象为“文件（File）”

- **用户的需求：** 人类不想看到“Block 1024”，人类只想看到 `resume.pdf` 或者 `config.json`。
- **操作系统的动作：** 操作系统提出了“文件（File）”**的概念。它是对**“一组具有符号名的、相关联的逻辑字节流”的抽象。
- **内核要解决的核心问题：** 怎么把人类眼中的“一个文件”，映射到一维数组里的“好几个逻辑块”？
    - 为此，操作系统设计了一个专门的数据结构来记录文件的元数据（大小、权限、创建时间、以及**它占用了哪些 Block**）。在 Linux 中，这个结构叫 **Inode（Index Node，索引节点）**。

#### 第三重抽象：将“扁平的文件群”抽象为“树状目录树（Directory Tree）”

- **管理的难题：** 硬盘里现在有几万个文件了，如果把它们全部平铺在一个池子里，人类根本无法查找，且极其容易重名。
- **操作系统的动作：** 引入“目录（Directory）”。
    - **颠覆认知的本质：** **在操作系统的底层，目录也是一个文件！**
    - 只不过这个文件的内容很特殊，它里面装的是一个**键值对表格**（Key 是文件名，Value 是该文件对应的 Inode 编号）。
    - 通过这种嵌套（目录文件的内容指向另一个文件的 Inode，而这个 Inode 又可能是一个目录文件），操作系统在扁平的硬盘上凭空构筑出了一棵极其漂亮的**树状层级结构（/usr/local/bin...）**。

### 最终的宏观图景：VFS（虚拟文件系统）

当这三重抽象完成后，操作系统的上层建筑已经非常稳固了。但现实中又遇到了新问题：世界上有各种各样的文件系统格式（Windows 的 NTFS/FAT32，Linux 的 ext4/XFS，还有网络文件系统 NFS）。

为了让程序员不用针对不同的文件系统写不同的代码，Linux 提出了终极武器——**VFS（Virtual File System，虚拟文件系统）**。

VFS 在内核中定义了一套通用的标准接口（面向对象的设计思想）：

- 只要是文件系统，就必须实现 `read()`, `write()`, `open()` 这套 POSIX 接口。
- 无论底层是 U 盘、SSD、还是远程服务器的挂载点，应用层看到的永远是一个统一的、万物皆文件的世界：
    
    ```c
    int fd = open("/dev/sda1/photo.jpg", O_RDONLY);
    read(fd, buf, size);
    ```
    

### 💡 复盘时的思维闭环

当我们谈完这些背景和抽象，再去看面试常问的八股文时，你就会有一种通透感：

- 为什么会有**硬链接**？因为硬链接只是在目录文件（那个表格）里增加了一条记录，让不同的“文件名”指向了同一个“Inode 编号”。
- 为什么删除一个正在被程序读取的文件，磁盘空间不会释放？因为该文件的 Inode 里的引用计数（Reference Count）还没有清零，操作系统知道底层那些 Block 还有程序在读，所以不能回收。

## 文件系统抽象

### 文件 = inode + data blocks

```
inode（索引节点）：
  - 文件元数据：大小、权限、所有者、时间戳
  - 指向 data blocks 的指针（直接/间接/双间接）
  - 每个 inode 有唯一的 inode number

data blocks：
  - 实际存储文件内容的磁盘块（通常 4KB）
  - inode 指向这些块的地址

目录：
  - 特殊的文件，内容是 "文件名 → inode number" 的映射表
  - ls 时读取目录文件，找到 inode，再读取 inode 元数据
```

### inode 结构（ext4）

```
struct ext4_inode {
  __le16 i_mode;      // 文件类型 + 权限
  __le16 i_uid;       // 用户 ID
  __le32 i_size_lo;   // 文件大小（低 32 位）
  __le32 i_atime;     // 访问时间
  __le32 i_ctime;     // 状态改变时间
  __le32 i_mtime;     // 修改时间
  __le32 i_dtime;     // 删除时间
  __le16 i_gid;       // 组 ID
  __le16 i_links_count; // 硬链接计数
  __le32 i_blocks_lo; // 占用的块数
  __le32 i_block[EXT4_N_BLOCKS]; // 块指针
  // EXT4_N_BLOCKS = 15
  // i_block[0..11]：12 个直接块指针
  // i_block[12]：一级间接块指针
  // i_block[13]：二级间接块指针
  // i_block[14]：三级间接块指针
}
```

### 块指针寻址

```
直接块：12 × 4KB = 48KB
一级间接：1 × (4KB/4B) × 4KB = 1024 × 4KB = 4MB
二级间接：1 × 1024 × 1024 × 4KB = 4GB
三级间接：1 × 1024 × 1024 × 1024 × 4KB = 4TB

ext4 最大单文件：16TB（受限于 48 位块寻址）
```

## VFS（Virtual File System）

### 设计

```
VFS = 文件系统的抽象层，统一所有文件系统的接口

        用户空间
           │
    ┌──────┴──────┐
    │  sys_open   │
    └──────┬──────┘
           ▼
    ┌─────────────┐
    │     VFS     │
    │  file_operations
    │  inode_operations
    │  super_operations
    └──────┬──────┘
           │
    ┌──────┼──────┬──────────┐
    ▼      ▼      ▼          ▼
  ext4   xfs   btrfs    procfs/sysfs
```

### 核心结构

```
superblock：文件系统全局信息（块大小、inode 总数、空闲块）
inode：文件的元数据和块指针
dentry：目录项缓存（路径 → inode 的映射）
file：打开文件的实例（文件偏移、打开模式）

关系：
  路径 /a/b/c
    → 查找 dentry cache
    → / → a → b → c
    → 每个 dentry 指向一个 inode
    → inode 指向 superblock 和 data blocks
```

### Dentry Cache

```
目的：加速路径解析

/example/path/file.txt
  解析过程：
    /        → dentry " / "  → inode 2
    example  → dentry "example" → inode 123
    path     → dentry "path"    → inode 456
    file.txt → dentry "file.txt" → inode 789

缓存命中：O(1) 直接拿到 inode
缓存未命中：逐级读取磁盘目录块
```

## Page Cache

### 原理

```
Page Cache = 文件数据的内核缓存（内存中的磁盘数据）

读文件：
  1. 检查 page cache 是否有该文件的页
  2. 命中：直接从内存返回，零磁盘 I/O
  3. 未命中：从磁盘读取，放入 page cache，再返回

写文件：
  1. 拷贝数据到 page cache（标记为 dirty）
  2. 立即返回 write() 调用（异步）
  3. 后台 flush 线程定期把 dirty page 刷盘
  4. 或者 fsync() 强制刷盘
```

### 为什么写操作先写 page cache？

```
1. 合并写：多次小写合并成一次大写（减少磁盘 I/O）
2. 延迟写：数据可能被删除或覆盖，避免无效写盘
3. 预读：顺序读取时预加载后续页
4. 共享：多个进程读同一文件共享 page cache
```

### 查看 Page Cache

```bash
# 查看系统 page cache 使用情况
cat /proc/meminfo | grep -E "Cached|Buffers|Dirty|Writeback"
# Cached: 缓存的文件数据
# Buffers: 块设备元数据缓存
# Dirty: 已修改未刷盘的页
# Writeback: 正在刷盘的页

# 查看某个文件的 page cache 命中情况
cat /proc/vmstat | grep -E "pgpgin|pgpgout|pswpin|pswpout"
# pgpgin: 从磁盘读入的页数
# pgpgout: 写出到磁盘的页数
```

### Page Cache 的回收

```
内存不足时，内核回收 page cache：
  1. 干净的 page cache：直接丢弃（下次读再从磁盘加载）
  2. 脏页（dirty）：先写回磁盘，再丢弃

回收策略：
  - LRU（Least Recently Used）：最近最少使用
  - active / inactive list：活跃页和不活跃页分开管理
  - swappiness：控制回收 page cache vs swap 的倾向（0-100）
```

## fsync、fdatasync、sync

### 区别

```c
int fsync(int fd);
// 刷盘文件的数据和元数据（inode、时间戳等）
// 等待磁盘控制器确认写入

int fdatasync(int fd);
// 只刷盘文件的数据，不刷元数据（除非元数据影响读取）
// 比 fsync 快

void sync(void);
// 刷盘所有脏页和脏 inode
// 不等待完成，只是发起写请求
```

### 为什么 fsync 慢？

```
1. 把 dirty page 从 page cache 发送到磁盘队列
2. 磁盘控制器可能还有 cache，需要等待真正落盘
3. 机械磁盘：寻道 + 旋转延迟（ms 级）
4. SSD：擦除-写入周期，但仍有 μs 级延迟
5. 元数据刷盘：更新 inode、目录项、superblock
```

### 数据库为什么用 O_DIRECT？

```c
int fd = open("data.db", O_RDWR | O_DIRECT);
// O_DIRECT 绕过 page cache，直接读写磁盘

// 原因：
//   1. 数据库自己管理缓存（buffer pool），不需要双重缓存
//   2. 避免 page cache 和 buffer pool 数据不一致
//   3. 精确控制刷盘时机（WAL + checkpoint）
//   4. 避免内核的预读/延迟写策略干扰

// 代价：
//   - 失去内核的预读优化
//   - 需要自己处理对齐（通常 512B 或 4KB 对齐）
```

## 硬链接 vs 软链接

### 硬链接（Hard Link）

```bash
ln original.txt hardlink.txt
```

```
本质：多个目录项指向同一个 inode

inode 123:
  i_links_count = 2
  
目录 A: "original.txt" → inode 123
目录 B: "hardlink.txt" → inode 123

特点：
  - 同一文件系统内
  - 删除一个不影响另一个（i_links_count - 1）
  - 只有 i_links_count 减到 0 才真正删除数据
  - 不能链接目录（防止循环）
```

### 软链接（Symbolic Link / Symlink）

```bash
ln -s original.txt symlink.txt
```

```
本质：特殊的文件，内容是目标路径字符串

symlink.txt:
  inode 456
  内容："original.txt"（路径字符串）

特点：
  - 可以跨文件系统
  - 可以链接目录
  - 目标删除后变成"悬空链接"（dangling）
  - 访问时需要解析路径（有额外开销）
```

### 对比

| 特性 | 硬链接 | 软链接 |
|---|---|---|
| 指向 | inode | 路径字符串 |
| 跨文件系统 | 否 | 是 |
| 链接目录 | 否 | 是 |
| 原文件删除 | 仍可访问 | 悬空，无法访问 |
| 磁盘空间 | 不额外占用 | 占用路径字符串空间 |
| 读取开销 | 无 | 需要路径解析 |

## 日志文件系统（Journaling）

### ext4 的日志模式

```
目标：保证元数据一致性，防止 crash 导致文件系统损坏

日志区域：磁盘上独立的区域，记录待执行的元数据操作

三种模式：
  1. journal：数据和元数据都写日志（最安全，最慢）
  2. ordered：只记录元数据，但数据先刷盘（默认，平衡）
  3. writeback：只记录元数据，数据刷盘顺序不保证（最快，可能丢数据）

ordered 模式流程：
  1. 写数据到磁盘
  2. 写元数据到日志
  3. 提交日志（checkpoint）
  4. 从日志写入元数据到实际位置
  
Crash 恢复：
  - 检查日志中未完成的操作
  - 重放（replay）日志，保证元数据一致
```

## L2：VFS 与 Page Cache 源码锚定

### VFS 打开文件路径（Linux 5.10+）

```c
// fs/namei.c: path_openat()
// 用户态 open() 的内核入口
static struct file *path_openat(...)
{
    // 1. 路径解析：/a/b/c → 逐级查找 dentry cache
    //    fs/namei.c: link_path_walk()
    //    每级先在 dentry cache（dcache）中查找，miss 则读磁盘目录块
    
    // 2. 找到 inode 后，调用 inode->i_op->lookup()
    //    ext4: fs/ext4/namei.c: ext4_lookup()
    
    // 3. 创建 file 结构体，绑定 file_operations
    //    ext4: fs/ext4/file.c: ext4_file_operations
}
```

**Dentry Cache 的哈希结构**：
- 全局哈希表 `dentry_hashtable`，键 = `(parent_dentry, name)`。
- 命中时 O(1)，miss 时需要逐级读取磁盘（路径深度 × 磁盘 I/O）。
- `dcache` 大小由 `vfs_cache_pressure` 控制（默认 100），内存紧张时回收。

### Page Cache 核心源码

```c
// mm/filemap.c: generic_file_read_iter()
// 文件读取的通用路径
ssize_t generic_file_read_iter(struct kiocb *iocb, struct iov_iter *iter)
{
    // 1. 查找 page cache：find_get_page(mapping, index)
    //    mapping = address_space，index = 文件偏移 >> PAGE_SHIFT
    
    // 2. 命中：直接拷贝到用户态（zero-copy 如果支持）
    //    miss：调用 mapping->a_ops->readpage() 从磁盘读取
    
    // 3. 预读：page_cache_async_readahead()
    //    顺序读取时，内核预加载后续 page
}

// mm/page-writeback.c: wb_writeback()
// dirty page 回写线程
static long wb_writeback(struct bdi_writeback *wb, ...)
{
    // 定期扫描 inode 的 dirty page
    // 通过 /proc/sys/vm/dirty_expire_centisecs 控制（默认 3000 = 30s）
    // 通过 /proc/sys/vm/dirty_ratio 控制脏页上限（默认 20%）
}
```

### 数字锚定：I/O 路径延迟

| 操作 | 延迟 | 出处 |
|---|---|---|
| Dentry Cache 命中 | ~100 ns | 纯内存哈希查找 |
| Dentry Cache miss（读磁盘目录块） | ~10-100 μs | NVMe 随机读 |
| Page Cache 命中 | ~200 ns-1 μs | 内存拷贝 |
| Page Cache miss（NVMe 读） | ~50-100 μs | `fio` randread |
| Page Cache miss（HDD 读） | ~5-10 ms | 寻道 + 旋转延迟 |
| fsync()（SSD） | ~0.5-2 ms | `io_uring` fsync bench |
| fsync()（HDD） | ~5-20 ms | 机械磁盘延迟 |

### `O_DIRECT` 的边界陷阱

1. **对齐要求**：缓冲区起始地址和长度都必须对齐到磁盘扇区大小（通常 512B 或 4KB）。不对齐的 `O_DIRECT` 会返回 `EINVAL`。
2. **绕过 page cache ≠ 绕过磁盘缓存**：SSD 的控制器缓存仍然可能延迟刷盘，需要 `fsync()` 或设置磁盘 write-through 模式。
3. **顺序读性能下降**：`O_DIRECT` 失去了内核的预读（readahead）优化，顺序读取大文件时性能可能比 buffered I/O 差 2-5 倍。

## L3：可运行实验

见 `impl/file_system_lab/`：

```bash
cd systems-engineering/operating-systems/impl/file_system_lab
python3 page_cache_bench.py --file /tmp/test_io.bin --size-mb 100
```

实验覆盖：
- Buffered I/O vs O_DIRECT 的写吞吐对比
- fsync 延迟分布（mean / P50 / P99）
- 冷缓存 vs 热缓存的读取速度对比

## 核心追问

1. **为什么删除大文件后 df 不立即显示空间释放？** 有进程仍持有该文件的 fd，inode 的 i_links_count 未归零，数据块未释放
2. **fsync 一定能保证数据不丢吗？** 不一定，磁盘控制器可能还有 cache，需要 `fsync + 磁盘 write-through` 或 `O_DIRECT`
3. **Page cache 对数据库是好是坏？** 对读友好（缓存热数据），对写不友好（双重缓存、刷盘时机不可控），所以数据库常用 O_DIRECT
4. **硬链接为什么无法跨文件系统？** 不同文件系统的 inode 编号空间独立，指向的 inode 在另一个文件系统中可能不存在或含义不同
5. **为什么日志文件系统 ordered 模式是默认？** journal 模式太慢（所有数据写两遍），writeback 可能 crash 后数据不一致，ordered 在性能和安全间平衡

# 文件系统命令

在 Linux/macOS 的世界里，要看清文件系统的全貌，不能只靠单一的命令。我们需要把命令分成三个层次，分别对应文件系统的**宏观挂载、中观空间占用、以及底层的元数据（Inode/Block）微观结构**。

以下是一张为你梳理的“全貌命令拓扑图”：

---

## 1. 宏观层：查看“文件系统树”与挂载全局

这一层的命令用来观察操作系统把哪些设备（硬盘、分区）挂载（Mount）到了这棵树的哪个位置。

### `lsblk`（List Blocks）—— 查看物理拓扑（首选）

最直观的命令，以树状结构展示物理硬盘、分区以及它们的挂载点。

```bash
lsblk

```

* **面试/复盘点：** 观察它的层次结构。你会看到 `sda`（主设备）下分出了 `sda1`, `sda2`（分区），或者被 LVM（逻辑卷管理）进一步抽象。

### `mount` —— 查看挂载属性与文件系统类型

不加任何参数直接输入 `mount`，可以列出当前系统所有已挂载的分区，包括 VFS 的虚拟文件系统（如 `proc`, `sysfs`）。

```bash
mount | grep '^/dev'

```

* **关键输出：** 会显示该分区是用什么格式格式化的（如 `type ext4` 或 `type xfs`），以及挂载参数（如 `ro` 只读，`rw` 读写）。

---

## 2. 中观层：空间与容量盘点

这一层用来回答：“我的磁盘被谁吃掉了？还剩多少空间和 Inode？”

### `df -hT` —— 宏观容量与类型盘点

* `-h`：以人类可读的格式（GB/MB）显示。
* `-T`：显示文件系统类型（ext4, xfs, btrfs...）。

```bash
df -hT

```

### `df -i` —— 查看 Inode 计数器（大厂高频排查题）

**极其重要。** 很多时候磁盘还有几个 G 空间，但应用突然报错 `No space left on device`，原因就是 **Inode 被耗尽了**（比如系统里产生了数百万个 1 字节的微型日志文件）。

```bash
df -i

```

### `du -sh *` —— 定位“磁盘杀手”

查看当前目录下各个文件/文件夹实际占用的物理空间。

```bash
du -sh /* --max-depth=1 2>/dev/null

```

---

## 3. 微观层：透视“万物皆文件”的底层数据结构

这一层直接扒开 VFS 和文件系统的外衣，去看我们在上一节提到的 **Inode、Block 和文件描述符（FD）**。

### `stat` —— 文件的“出生证明”

查看一个文件在文件系统底层的最完整元数据。

```bash
stat filename.txt

```

* **核心输出：**
* `Device`：文件所在的硬件设备号。
* `Inode`：该文件在这个分区里的 **唯一索引编号**。
* `Links`：**硬链接数**（如果有多个文件名指向这个 Inode，这里会显示大于 1）。
* **三时（Three Timestamps）：** `Access`（最后读取）、`Modify`（内容最后修改）、`Change`（元数据/权限最后修改）。



### `ls -li` —— 揪出链接的本质

通过 `-i` 参数，可以直接在列表第一列打印出文件的 Inode 编号。

```bash
ls -li

```

* **实验点：** 如果你对一个文件做硬链接 `ln a.txt b.txt`，用这个命令看，它们的 Inode 编号完全一样；如果是软链接 `ln -s a.txt c.txt`，它的 Inode 编号是全新的，内容大小等于目标路径的字符数。

### `lsof`（List Open Files）—— 查看进程与内核 FD 的映射

在 Linux 中，进程打开一个文件，内核就会给它分配一个文件描述符（FD）。这个命令能看到当前系统哪个进程打开了哪个文件。

```bash
lsof -p <PID>     # 查看某个进程打开的所有文件/Socket/管道
lsof /path/to/file # 查看这个文件正被哪个进程死死咬住（导致无法被 umount）

```

---

## 💡 一张表总结：命令与文件系统抽象层的对应关系

| 命令 | 操纵/查看的抽象概念 | 面试/生产排查高频场景 |
| --- | --- | --- |
| `lsblk` / `mount` | **硬件逻辑块 $\rightarrow$ VFS 挂载点** | 新加了物理硬盘、排查挂载参数（如 `noatime` 优化性能） |
| `df -hT` / `du` | **逻辑块（Block）分配与空间** | 磁盘满了解析、揪出大文件 |
| `df -i` | **索引节点（Inode）分配数** | 空间充足但无法写文件（小文件过多导致 Inode 耗尽） |
| `stat` / `ls -i` | **单个文件的 Inode 元数据** | 排查文件权限、硬链接计数、文件最后修改时间 |
| `lsof` | **用户态进程 $\rightarrow$ 内核文件描述符（FD）** | “文件删除了但磁盘空间没释放”（排查哪个进程还持有 FD） |

这套命令组合拳涵盖了从硬件到应用层的整个文件系统生命周期。在复盘时，你可以尝试在终端里把这几个命令连起来敲一遍（比如用 `stat` 查一个文件的 Inode，再用 `df -i` 看整体状况），肉眼看一遍数据的映射，这个模型在脑子里就彻底活了。

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| process vs thread notes | L2+L3 | done |
| virtual memory deep dive | L2+L3 | done |
| epoll and event loop bridge | L2+L3 | done |
| file system and page cache | **L2+L3** | **done** |
| lock primitives comparison | L1 | todo |
