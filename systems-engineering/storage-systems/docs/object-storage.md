# Object Storage Multipart Design

## 目标

理解对象存储的核心设计：扁平命名空间、multipart 分片上传、一致性模型、checksum 校验，以及大规模分布式存储的工程实践。

## 场景

- 为什么对象存储不用传统文件系统的目录树？
- 100GB 大文件上传失败如何断点续传？
- 对象存储的强一致性和最终一致性有什么区别？
- multipart 分片大小怎么选？
- 跨地域复制时数据一致性如何保证？

## 对象存储 vs 文件存储 vs 块存储

| 维度 | 块存储（EBS） | 文件存储（NAS） | 对象存储（S3/OSS） |
|---|---|---|---|
| 接口 | RAW 块设备（iSCSI） | POSIX 文件系统（NFS） | HTTP REST API |
| 数据结构 | 固定大小块（4KB/8KB） | 层级目录树 | 扁平桶 + 对象键 |
| 元数据 | 极少（LBA） | 丰富（inode、权限、ACL） | 用户自定义元数据 |
| 扩展性 | 挂载到单台机器 | 有限（NFS 性能瓶颈） | 无限水平扩展 |
| 适用 | 数据库、虚拟机磁盘 | 共享文件、 home 目录 | 图片、视频、备份、日志 |
| 一致性 | 强一致 | 强一致 | 通常最终一致 |

## 核心抽象

### Bucket + Object + Key

```
Bucket（桶）：
  - 命名空间容器
  - 配置地域、权限、生命周期、版本控制
  - 全局唯一名称

Object（对象）：
  - 数据 + 元数据 + 唯一标识（Key）
  - 无大小限制（通常支持 TB 级）
  - 不可变（修改 = 上传新版本）

Key（键）：
  - 类似文件路径的字符串："images/2024/photo.jpg"
  - 实际存储是扁平的，没有真正的"目录"
  - "目录"只是前缀（prefix）的概念
```

### 扁平命名空间

```
文件系统：
  /images/
    /2024/
      photo1.jpg
      photo2.jpg
    /2023/
      photo3.jpg

对象存储：
  bucket: my-bucket
  objects:
    "images/2024/photo1.jpg" → data1
    "images/2024/photo2.jpg" → data2
    "images/2023/photo3.jpg" → data3

没有目录 inode：
  - "images/2024/" 只是 key 的前缀
  - ListObjects(prefix="images/2024/") 做前缀匹配
  - 没有 rename 目录的操作（只能逐个 copy + delete）
```

## Multipart 分片上传

### 为什么需要分片？

```
问题：
  1. 网络不稳定：上传 10GB 文件，99% 时失败，必须重来
  2. 单连接带宽限制：一条 TCP 连接无法跑满带宽
  3. 内存限制：不能把整个大文件读入内存
  4. 超时：网关/负载均衡有请求体大小限制和超时

解决：分片上传（Multipart Upload）
  - 文件切成多个 Part（通常 5MB ~ 1GB）
  - 每个 Part 独立上传，失败只重传该 Part
  - 多 Part 并行上传，充分利用带宽
```

### 协议流程

```
1. Initiate Multipart Upload
   Client ──POST /object?uploads──► Server
   Server ◄──UploadId───────────── Client

2. Upload Parts（并行）
   Client ──PUT /object?partNumber=1&uploadId=xxx + data──► Server
   Client ◄──ETag─────────────────────────────────────────── Server
   
   Client ──PUT /object?partNumber=2&uploadId=xxx + data──► Server
   Client ◄──ETag─────────────────────────────────────────── Server
   
   ...（最多 10000 个 Part）

3. Complete Multipart Upload
   Client ──POST /object?uploadId=xxx──► Server
   Body: <CompleteMultipartUpload>
         <Part><PartNumber>1</PartNumber><ETag>"abc"</ETag></Part>
         <Part><PartNumber>2</PartNumber><ETag>"def"</ETag></Part>
         </CompleteMultipartUpload>
   
   Server：按 PartNumber 顺序合并，返回最终 ETag

4. Abort Multipart Upload（可选，取消时）
   Client ──DELETE /object?uploadId=xxx──► Server
```

### 断点续传

```
场景：上传 10GB 文件到 Part 800/1000 时网络断开

恢复上传：
  1. Client 保存 UploadId 和各 Part 的 ETag 到本地
  2. 网络恢复后，调用 ListParts(UploadId)
  3. Server 返回已上传的 Part 列表
  4. Client 跳过已完成的 Part，只上传剩余 Part
  5. CompleteMultipartUpload

关键：
  - UploadId 是恢复的核心标识
  - ETag（通常是 MD5）用于校验每个 Part
  - 客户端需持久化 UploadId 和进度
```

### Part 大小选择

```
Part 太小：
  - 并行度受限（连接数固定）
  - 管理开销大（10000 Part 上限容易触达）
  - Complete 时合并开销大

Part 太大：
  - 单 Part 失败重传成本高
  - 内存占用高
  - 并行度低（大文件 Part 数量少）

推荐：
  - 默认：8MB 或 16MB
  - 大文件（>100GB）：64MB 或 100MB
  - 最大 Part 数：10000（S3 限制）
  - 最小 Part 大小：5MB（除最后一个）
  
计算：
  文件 100GB，Part 10MB → 10000 Part（达上限，不合适）
  文件 100GB，Part 16MB → 6400 Part（合适）
  文件 10TB，Part 100MB → 100000 Part（超上限，需用更大 Part）
```

## 数据一致性

### 写后读一致性（Read-After-Write）

```
新上传的对象：
  Client ──PUT /new-object──► Server
  Client ──GET /new-object──► Server
  
  强一致性：GET 一定能读到新数据
  最终一致性：GET 可能暂时读不到或读到旧数据

S3 现状：
  - 新对象：强一致（2020 年后）
  - 覆盖/删除：最终一致（短暂可能读到旧版本）
  - List：最终一致
```

### 版本控制

```
开启版本控制后：

  PUT /photo.jpg (version 1) → null 版本
  PUT /photo.jpg (version 2) → version-id-2
  DELETE /photo.jpg → 插入删除标记（delete marker）
  
  GET /photo.jpg → 返回 404（最新是删除标记）
  GET /photo.jpg?versionId=version-id-2 → 读到版本 2

用途：
  - 防止误删除
  - 审计和回滚
  - 多版本共存

生命周期：
  - 自动清理旧版本（如保留 30 天）
  - 转移冷数据到低频/归档存储
```

## 校验机制

### ETag

```
ETag 通常是对象的 MD5 或类似哈希：

小对象：ETag = MD5(object_data)
Multipart 对象：ETag = MD5(MD5(part1) + MD5(part2) + ...)

客户端校验：
  上传时本地计算 MD5，对比服务端返回的 ETag
  不匹配 → 网络 corruption，重传
```

### Checksum 算法选择

| 算法 | 速度 | 碰撞概率 | 用途 |
|---|---|---|---|
| MD5 | 快 | 理论可碰撞 | 传统兼容，已不推荐 |
| SHA-256 | 中等 | 极低 | 安全校验 |
| CRC32C | 极快 | 较高 | 硬件加速（SSE4.2），检测 bit flip |
| xxHash | 极快 | 低 | 非加密场景，大数据校验 |

```
分层校验：
  1. 网络层：TCP checksum（弱，仅检测传输错误）
  2. 应用层：Part 级别 CRC32C/MD5
  3. 对象层：完整对象 SHA-256
  4. 复制层：跨地域复制后逐 bit 比对
```

## 高可用架构

### 数据冗余

```
副本策略：
  - 3 副本：写入 3 个独立节点/机架
  - EC（Erasure Coding）：6+3、10+4 等
    - 6 个数据块 + 3 个校验块
    - 可容忍任意 3 个块丢失
    - 存储效率：6/9 = 67%（vs 3 副本 33%）

写入流程：
  Client ──► Load Balancer ──► Gateway
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                 Node A          Node B          Node C
                 (Primary)       (Replica 1)     (Replica 2)
                    │               │               │
                    └───────────────┴───────────────┘
                                    ▼
                              写入确认（多数派）
```

### 跨地域复制

```
同步复制：
  - 写入主地域，同步写入备地域
  - 延迟高（跨地域 RTT）
  - 一致性最强

异步复制：
  - 写入主地域后立即返回
  - 后台异步复制到备地域
  - 延迟低，RPO > 0（可能丢数据）

就近读取：
  - DNS 解析到最近的地域
  - 读本地副本，降低延迟
```

## 核心追问

1. **对象存储为什么不适合做随机修改？** 对象不可变，修改需上传整个新版本；适合写一次读多次（WORM），不适合频繁随机写
2. **multipart 的 Complete 操作为什么是瓶颈？** 服务端需要按顺序合并所有 Part，大文件 Part 多时耗时长；可以通过更大 Part 减少数量
3. **S3 的强一致性和最终一致性边界在哪里？** 新 PUT 的对象 GET 是强一致；覆盖 PUT 和 DELETE 后 LIST/HEAD 可能短暂不一致
4. **EC 比 3 副本省空间，为什么热数据还用副本？** EC 编码/解码消耗 CPU，延迟高；热数据用 3 副本保证低延迟，冷数据转 EC 节省成本
5. **对象存储如何解决小文件问题？** 小文件合并（compaction）、对象聚合（将多个小对象打包成大对象）、索引层分离（元数据存数据库，数据存对象存储）

## 状态

| 资产 | 状态 |
|---|---|
| object storage multipart design | done |
| LSM compaction notes | todo |
| page cache and fsync | todo |
| storage durability checklist | todo |
