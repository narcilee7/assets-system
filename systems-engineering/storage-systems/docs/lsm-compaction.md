# LSM Compaction Notes

## 目标

理解 LSM-Tree（Log-Structured Merge Tree）的核心机制：写入路径、分层结构、Compaction 策略、空间放大和读放大，以及 RocksDB/LevelDB 的工程实践。

## 场景

- 为什么 LSM-Tree 写比 B+Tree 快？
- LevelDB 和 RocksDB 的 Compaction 有什么区别？
- 写放大、读放大、空间放大如何权衡？
- LSM 的 Range Scan 性能为什么不如 B+Tree？
- TiKV、CockroachDB 为什么选 LSM？

## LSM-Tree 核心思想

```
核心：将随机写转为顺序写

传统 B+Tree：
  INSERT/UPDATE → 找到数据页 → 修改页 → 写回磁盘（随机 I/O）

LSM-Tree：
  INSERT/UPDATE → 写 WAL（顺序写）→ 写 MemTable（内存）
  → 后台批量 flush 到磁盘（顺序写）
  → 后台 Compaction 合并（顺序读 + 顺序写）

优势：
  - 写操作始终是顺序 I/O，磁盘吞吐最大化
  - 适合写密集型负载（日志、时序数据、KV 存储）
```

## 写入路径

```
1. 写 WAL（Write-Ahead Log）
   - 顺序追加到日志文件
   - fsync 保证 durability
   - 用于崩溃恢复

2. 写 MemTable（内存表）
   - 有序数据结构（Skip List 或 B+Tree）
   - 同时支持点查和范围扫描

3. MemTable 满 → Flush 为 Immutable MemTable
   - 新写转到新的 MemTable
   - 后台将 Immutable MemTable 写入磁盘为 SSTable

4. SSTable 写入磁盘（Level 0）
   - 有序键值对文件
   - 不可变
   - 内含索引块（Index Block）和布隆过滤器（Bloom Filter）

        Write
          │
          ▼
    ┌───────────┐
    │  MemTable │ ◄── Skip List（内存）
    └─────┬─────┘
          │ 满
          ▼
    ┌───────────┐
    │Immutable  │
    │ MemTable  │
    └─────┬─────┘
          │ 后台 flush
          ▼
    ┌───────────┐
    │  SSTable  │ ◄── Level 0（磁盘）
    └───────────┘
```

## SSTable 格式

```
SSTable（Sorted String Table）：

┌─────────────────────────────────────┐
│           Data Blocks               │
│  ┌─────────┐ ┌─────────┐           │
│  │ Block 1 │ │ Block 2 │ ...       │
│  │ (64KB)  │ │ (64KB)  │           │
│  └─────────┘ └─────────┘           │
├─────────────────────────────────────┤
│         Index Block                 │
│  key1 → Block 1 offset              │
│  key2 → Block 2 offset              │
├─────────────────────────────────────┤
│       Filter Block (Bloom Filter)   │
│  快速判断 key 是否可能在 SSTable 中  │
├─────────────────────────────────────┤
│         Footer                      │
│  Index offset, Filter offset, Magic │
└─────────────────────────────────────┘

Block 内部：
  - 有序 KV 对
  - 前缀压缩（Restart Point 每隔 16 个 key）
  
读取时：
  1. Footer → 找到 Index Block
  2. Index Block → 找到对应的 Data Block
  3. Bloom Filter → 快速排除（不存在则不用读 Block）
  4. Data Block → 二分查找或线性扫描
```

## 分层结构（Level）

```
Level 0：
  - 直接从 Immutable MemTable flush 而来
  - 多个 SSTable，key 范围可能重叠
  - 读取时需要检查所有 L0 文件

Level 1 ~ N：
  - 每层总大小有上限（指数增长）
    Level 1: 10MB
    Level 2: 100MB
    Level 3: 1GB
    Level 4: 10GB
    ...
  - 每层内部 SSTable 的 key 范围不重叠
  - 读取时只需查一个 SSTable

              L0 (4 files, 重叠)
              ┌───┐┌───┐┌───┐┌───┐
              │ a ││ c ││ a ││ d │
              └───┘└───┘└───┘└───┘
                 
              L1 (1 file, 10MB)
              ┌───────────────────┐
              │  a  ...  e        │
              └───────────────────┘
                 
              L2 (2 files, 100MB)
              ┌──────────┐┌──────────┐
              │  a  ... m││  n  ... z│
              └──────────┘└──────────┘
```

## Compaction 策略

### Leveled Compaction（LevelDB/RocksDB 默认）

```
触发条件：某层大小超过阈值

流程：
  1. L0 文件数超过 4 个 → L0→L1 Compaction
  2. 选择 L0 的一个文件，找到 L1 中重叠范围的文件
  3. 多路归并（K-way merge）生成新的 L1 文件
  4. L1 超过 10MB → L1→L2 Compaction
  5. 以此类推

特点：
  - 每层大小指数增长
  - 每层内部无重叠，读高效
  - 写放大较高（一次写入可能触发多层 Compaction）

写放大估算：
  - L1→L2：数据被重写 1 次
  - L2→L3：再重写 1 次
  - ...
  - 总写放大：约 10 倍（取决于层数和大小比）
```

### Tiered Compaction（Size-Tiered，Cassandra 早期）

```
触发条件：某层文件数或大小达到阈值

流程：
  L0: 文件大小相近时合并（如 4 个 4MB → 1 个 16MB）→ 放到 L1
  L1: 文件大小相近时合并 → 放到 L2

特点：
  - 同层文件允许重叠
  - 写放大低（一次数据只合并几次）
  - 读放大高（读可能要查多个文件）
  - 空间放大高（旧版本数据清理慢）

适用：
  - 写密集型、读少
  - 时序数据（Cassandra、InfluxDB）
```

### RocksDB 的 Universal Compaction

```
Size-Tiered 的改进版：
  - 减少 Compaction 时的写放大
  - 通过 bloom filter 缓解读放大
  - 适合写多读少的场景
```

## 放大问题

### 写放大（Write Amplification）

```
定义：实际写入磁盘的数据量 / 用户写入的数据量

来源：
  1. WAL：每份数据先写 WAL
  2. Flush：MemTable → SSTable
  3. Compaction：多层合并时反复重写

Leveled：写放大 ~ 10-30x
Tiered：写放大 ~ 2-5x

优化：
  - 更大的 SSTable 块（减少元数据开销）
  - 延迟 Compaction（RocksDB 的 rate_limiter）
  - 关闭不必要的 Compaction（导入数据时）
```

### 读放大（Read Amplification）

```
定义：一次读取需要访问的磁盘页数

来源：
  1. MemTable（内存，快）
  2. Immutable MemTable（内存，快）
  3. L0 SSTables（多个文件，可能都要查）
  4. L1~Ln SSTable（每层查一个文件）
  5. 每个 SSTable：Bloom Filter → Index → Data Block

Leveled：读放大 ~ 1-3（每层最多一个文件）
Tiered：读放大 ~ 5-20（同层多个文件）

优化：
  - Bloom Filter（减少不必要的 SSTable 读取）
  - Block Cache（缓存热数据块）
  - 更大的 Block（减少索引层级）
```

### 空间放大（Space Amplification）

```
定义：实际磁盘占用 / 逻辑数据量

来源：
  1. 旧版本数据（MVCC snapshot）
  2. Compaction 未完成时的临时文件
  3. 已删除数据（墓碑标记，等 Compaction 清理）

Leveled：空间放大 ~ 1.1x（低）
Tiered：空间放大 ~ 2-3x（高）

优化：
  - 及时 Compaction
  - 手动 Compact Range（删除大量数据后）
  - 设置 ttl（自动过期清理）
```

## RocksDB 调参

```
关键参数：

write_buffer_size = 64MB
  - MemTable 大小，越大写放大越小，但恢复越慢

max_write_buffer_number = 5
  - 最大 MemTable 数量（含 immutable）

target_file_size_base = 64MB
  - L1 SSTable 大小

target_file_size_multiplier = 1
  - 每层 SSTable 大小倍数

max_bytes_for_level_base = 256MB
  - L1 总大小上限

max_bytes_for_level_multiplier = 10
  - 每层总大小倍数（L2=2.56GB, L3=25.6GB）

level_compaction_dynamic_level_bytes = true
  - 根据实际数据量动态调整层大小

compression = kLZ4/kZSTD
  - 压缩算法，权衡 CPU 和磁盘
```

## LSM vs B+Tree

| 维度 | LSM-Tree | B+Tree |
|---|---|---|
| 写模式 | 顺序写（快） | 随机写（慢） |
| 读模式 | 多层查询（较慢） | 树遍历（稳定） |
| 范围扫描 | 多路归并（中等） | 叶子节点链表（快） |
| 写放大 | 高（10-30x） | 低（1-2x） |
| 读放大 | 中等 | 低 |
| 空间放大 | 低（leveled） | 低 |
| 更新/删除 | 标记+后台清理 | 原地修改 |
| 适用 | 写多读少、日志、时序 | 读多写少、事务型 |

## 核心追问

1. **LSM 的删除为什么不是立即生效？** 删除只是写入一个墓碑（tombstone）标记，等 Compaction 时才真正清理旧数据；如果直接删，历史版本和 snapshot 会读到不一致
2. **RocksDB 的 WAL 可以关吗？** 可以（setWriteOptions({disableWAL: true})），但崩溃会丢数据；大批量导入时临时关闭可提升性能，导入完再手动 flush
3. **为什么 L0 文件重叠会导致读放大？** 读一个 key 时，需要检查 L0 所有文件（因为不知道哪个文件有最新版本）；L1+ 每层只需查一个文件（范围不重叠）
4. **Compaction 会阻塞写入吗？** 不会阻塞前台写入，但会竞争磁盘 I/O；RocksDB 可以用 rate_limiter 限制 Compaction 带宽，避免影响读延迟
5. **TiKV 为什么用 RocksDB 而不是纯内存？** 纯内存无法保证 durability 且成本高；RocksDB 提供持久化 + 高性能写入，通过 Raft 多副本保证可用性

## 状态

| 资产 | 状态 |
|---|---|
| object storage multipart design | done |
| LSM compaction notes | done |
| page cache and fsync | todo |
| storage durability checklist | todo |
