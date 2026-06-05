# Storage Durability Checklist

## 目标

建立存储系统数据持久化的系统性检查清单，覆盖从应用层到磁盘控制器的每一环，确保在 crash、断电、网络分区等异常下数据不丢、不错、不乱。

## 场景

- 数据库承诺了 durability，为什么 crash 后还是丢数据？
- 如何验证存储系统真正的持久化保证？
- 从应用 write 到磁盘 platter，哪些环节可能丢数据？
- RAID、副本、ECC 分别解决什么问题？
- 云厂商的 11 个 9 持久性承诺意味着什么？

## 持久化层次模型

```
L1 应用层
  ├── 事务日志（WAL / binlog / redo log）
  ├── 写顺序保证（WAL before data）
  └── 幂等性和去重

L2 运行时库
  ├── 标准 I/O（libc buffered I/O）
  ├── 用户态缓冲（application buffer）
  └── 批处理和组提交

L3 操作系统
  ├── Page cache
  ├── VFS / 文件系统（ext4/xfs）
  ├── fsync / fdatasync / sync
  └── I/O 调度器

L4 块设备层
  ├── 设备映射（LVM / mdraid / dm-crypt）
  ├── RAID 控制器
  └── 多路径 I/O

L5 磁盘控制器
  ├── 磁盘 cache（write-back / write-through）
  ├── NCQ（Native Command Queuing）
  └── BBU（Battery Backup Unit）

L6 物理介质
  ├── HDD（磁性记录）
  ├── SSD（NAND flash / FTL）
  ├── 磨损均衡和坏块管理
  └── 掉电保护电容（SSD PLP）
```

## 检查清单

### L1 应用层

| # | 检查项 | 通过标准 | 测试方法 |
|---|---|---|---|
| 1.1 | 关键操作是否写 WAL | 所有写操作先记录日志 | 代码审查 + 注入 crash |
| 1.2 | WAL 是否先 fsync 再返回成功 | 事务 commit 前 WAL 已落盘 | 断点 + 模拟掉电 |
| 1.3 | 是否支持幂等写入 | 同一操作重试不产生副作用 | 重复提交测试 |
| 1.4 | 是否有 checksum 校验 | 每条记录 / 每个页有 CRC | 位翻转注入测试 |
| 1.5 | 写顺序是否严格保证 | WAL → data 的顺序不可颠倒 | stress + crash 测试 |

### L2 运行时库

| # | 检查项 | 通过标准 | 测试方法 |
|---|---|---|---|
| 2.1 | 是否避免 stdio buffering 误导 | 关键路径用 sys_write 或 O_DIRECT | strace 确认无意外缓冲 |
| 2.2 | 用户态缓冲区是否有 flush 机制 | 定期或阈值触发刷盘 | 监控 dirty buffer 大小 |
| 2.3 | 组提交是否生效 | 多线程共享 fsync，吞吐量不线性下降 | benchmark TPS vs 线程数 |

### L3 操作系统

| # | 检查项 | 通过标准 | 测试方法 |
|---|---|---|---|
| 3.1 | 关键 fd 是否使用 fsync / fdatasync | 每次事务提交后显式刷盘 | strace -e fsync |
| 3.2 | fsync 返回值是否被检查 | 失败时回滚或重试 | 注入 EIO 错误 |
| 3.3 | O_DIRECT 对齐是否正确 | 地址、长度、偏移都按扇区对齐 | 运行时验证 |
| 3.4 | 文件系统是否为日志型 | ext4/xfs with journaling | mount 参数检查 |
| 3.5 | 文件系统挂载参数 | data=ordered 或 data=journal | /proc/mounts 检查 |
| 3.6 | 脏页比例和超时配置 | dirty_ratio < 50%，有超时上限 | sysctl vm.dirty* |
| 3.7 | 透明大页是否关闭 | echo never > /sys/.../enabled | 启动脚本检查 |

### L4 块设备层

| # | 检查项 | 通过标准 | 测试方法 |
|---|---|---|---|
| 4.1 | RAID 级别是否匹配 RPO/RTO | RAID1/10 高可用，RAID6 大容量 | 架构审查 |
| 4.2 | RAID 是否带电池保护 | RAID 控制器 cache 有 BBU | 硬件管理界面检查 |
| 4.3 | RAID write policy | write-through 或 BBU-backed write-back | RAID 配置检查 |
| 4.4 | LVM snapshot 是否影响性能 | snapshot 不导致写放大飙升 | 监控 COW 表大小 |

### L5 磁盘控制器

| # | 检查项 | 通过标准 | 测试方法 |
|---|---|---|---|
| 5.1 | 磁盘 write cache 是否关闭（无 BBU 时） | hdparm -W 0 或 equivalent | hdparm -I /dev/sda |
| 5.2 | SSD 是否有掉电保护（PLP） | 电容阵列保证 cache 落盘 | 厂商 spec |
| 5.3 | 磁盘是否启用 SMART 监控 | 提前预警坏道/磨损 | smartctl -a |
| 5.4 | NCQ / TCQ 是否启用 | I/O 队列深度 > 1 | hdparm -I |

### L6 物理介质

| # | 检查项 | 通过标准 | 测试方法 |
|---|---|---|---|
| 6.1 | SSD 剩余寿命（Wear Leveling） | 剩余 block erase cycle > 阈值 | smartctl Media_Wearout_Indicator |
| 6.2 | HDD 坏道扫描 | 定期 badblocks 或厂商工具 | badblocks -v |
| 6.3 | 温湿度/震动监控（机房） | 在磁盘 spec 范围内 | 机房环境传感器 |
| 6.4 | 多副本 / 跨机架分布 | 副本不在同一故障域 | 拓扑检查 |

## 常见故障与防护

### Torn Write（撕裂写）

```
现象：
  写入 16KB 页，断电后只有前 4KB 写入，后 12KB 是旧数据

原因：
  - 文件系统块大小（4KB）< 数据库页大小（16KB）
  - 断电时部分块已写，部分未写

防护：
  - Double Write Buffer（InnoDB）：先写共享区，再写数据文件
  - 日志记录完整页内容：恢复时用日志覆盖 torn page
  - 使用原子写（Atomic Write，部分 SSD 支持）
```

### Bit Rot（静默位翻转）

```
现象：
  磁盘上的数据自然老化，某些 bit 翻转，读取时返回错误数据
  但磁盘不报错（不是坏道，只是磁性衰减）

检测：
  - 每页存储 checksum（CRC32 / xxHash）
  - 读取时验证 checksum，不匹配则报错

修复：
  - RAID：用其他盘的校验数据重建
  - 副本：从其他副本读取正确数据
  - 纠删码：用校验块恢复

预防：
  - 定期 scrub（全盘读取+校验）
  - 及时更换老化磁盘
```

### 假 fsync（Fsync Fallacy）

```
现象：
  代码调用了 fsync()，但数据实际上没持久化

原因：
  1. 磁盘控制器 write-back cache，无 BBU
  2. 虚拟机 hypervisor 缓存未穿透到物理磁盘
  3. 网络存储（SAN/NAS）中间层缓存
  4. 内核 bug（极少数）

检测：
  - 物理掉电测试（pull the plug test）
  - 使用 `hdparm -W 0` 禁用磁盘缓存
  - 云环境使用增强型 SSD（有 PLP）
```

## 验证方法

### 1. 掉电测试（Pull the Plug）

```
步骤：
  1. 运行写负载（如 sysbench）
  2. 在峰值时物理断电（或 echo b > /proc/sysrq-trigger）
  3. 重新上电启动
  4. 检查数据一致性
     - 记录数是否匹配
     - checksum 是否正确
     - 是否有 torn page

频率：
  - 新版本发布前必做
  - 硬件变更后必做
  - 定期（季度）抽检
```

### 2. 错误注入

```bash
# Linux dm-flakey：模拟设备故障
# 可以配置随机丢写、延迟、错误

# 使用 fault injection framework
echo 3 > /sys/kernel/debug/fail_function/fail_alloc_page

# 使用 blktrace 分析 I/O 路径
blktrace -d /dev/sda -o - | blkparse -i -
```

### 3. 校验和审计

```
定期任务：
  - 每天随机抽样 1% 数据验证 checksum
  - 每周全量 scrub
  - 每月跨副本比对

监控告警：
  - checksum mismatch 数 > 0 立即告警
  - scrub 发现的错误数趋势图
```

## 云环境的持久化

### 云厂商承诺

```
AWS S3：99.999999999%（11 个 9）持久性
  - 跨多可用区自动复制
  - 定期自动修复（detect and repair）
  - 不是 100%，意味着 10^11 个对象每年可能丢 1 个

AWS EBS：99.8% - 99.9% 可用性，依赖快照持久化
  - 单 AZ 内多副本
  - 跨区域 snapshot 复制保证持久性

注意：
  - 持久性 ≠ 可用性
  - 持久性高不代表不会短暂不可读
  - 关键数据仍需应用层备份
```

### 云上检查项

| # | 检查项 | 说明 |
|---|---|---|
| 7.1 | 是否启用跨区域复制 | 单地域灾难时恢复 |
| 7.2 | 是否定期 snapshot / 备份 | 防逻辑错误（误删、bug） |
| 7.3 | 是否测试过恢复流程 | 备份能恢复才是真的备份 |
| 7.4 | 是否了解云盘的 write-back 策略 | 部分云盘默认不保证 fsync 穿透 |
| 7.5 | 是否使用增强型 SSD（有 PLP） | 掉电保护电容 |

## 核心追问

1. **RAID 5 为什么不适合大容量盘？** 重建时 URE（不可恢复读错误）概率高；4TB 盘重建时遇到 URE 的概率接近 100%，导致重建失败和数据丢失
2. **fsync + BBU 和 O_DIRECT + 无 BBU 哪个更安全？** fsync + BBU 更安全，因为 BBU 保证控制器 cache 掉电不丢；O_DIRECT 绕过 page cache 但数据仍可能在控制器 cache
3. **为什么逻辑删除比物理删除更安全？** 物理删除立即释放空间，不可恢复；逻辑删除（标记删除）保留数据一段时间，误删后可恢复
4. **数据库的 checksum 应该在哪一层做？** 每层都做：应用层（业务校验）+ 存储引擎层（页 checksum）+ 文件系统层（DIF/DIX）+ 磁盘层（T10 PI）；每层检测不同范围的故障
5. **11 个 9 的持久性意味着绝对不会丢数据吗？** 不意味着。是概率承诺，对象数足够多时仍可能丢；且不包括逻辑错误（bug、误删、勒索软件）

## 状态

| 资产 | 状态 |
|---|---|
| object storage multipart design | done |
| LSM compaction notes | done |
| page cache and fsync | done |
| storage durability checklist | done |
