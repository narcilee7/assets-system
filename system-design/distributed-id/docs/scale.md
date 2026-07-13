# Scale

## 容量规划

### 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 单实例 QPS | ≥ 10W（雪花）/ ≥ 100W（号段） | 不同模式差异大 |
| 集群 QPS | ≥ 1000W | 水平扩展支持 |
| 端到端延迟（P99） | < 5ms | 同步 RPC 模式 |
| 本地计算延迟 | < 0.1ms | Leaf 客户端嵌入模式 |
| 可用性 | 99.99% | 年停机 < 53min |
| 单机房 Worker 数 | ≤ 32 | 5-bit 限制 |
| 集群 Worker 数 | ≤ 1024 | 10-bit 限制 |

### 业务规模假设

```
基础场景（中型互联网）：
  - 总 QPS = 10W
  - 业务数 = 50 个
  - 单业务 QPS = 2000
  - 节点数 = 8（2 个机房 × 4 个 worker）

大促场景（双 11 峰值）：
  - 总 QPS = 100W（10 倍）
  - 订单业务 QPS = 50W
  - 支付业务 QPS = 20W
  - 消息业务 QPS = 30W
  - 节点数 = 32（4 个机房 × 8 个 worker）
  - 持续时间 = 30 分钟
```

---

## 1. 雪花算法扩展瓶颈

### 1.1 Worker ID 数量限制

```
Twitter 经典：5-bit datacenter + 5-bit worker = 1024 个节点
Leaf 变种  ：6-bit datacenter + 6-bit worker = 4096 个节点

单机房 32 个节点：
  - 假设单机 1W QPS
  - 单机房 32W QPS
  - 适合中等业务

扩到 4096 节点（Leaf）：
  - 单机房 64 个 × 64 机房
  - 单机房 64W QPS
  - 适合超大规模
```

### 1.2 Sequence 容量

```
12-bit sequence = 单毫秒 4096 ID
13-bit sequence = 单毫秒 8192 ID
22-bit sequence = 单秒 4M ID（百度 UidGenerator）

QPS 5W 的业务：
  - 平均 50 ID/毫秒
  - 峰值可能 5000 ID/毫秒（秒杀）
  - 12-bit 够用，但峰值时有溢出风险

QPS 50W 的业务：
  - 峰值 50000 ID/毫秒
  - 12-bit 不够（溢出）
  - 需要 13-bit 或多 worker 分摊
```

### 1.3 时间戳可用年限

```
41-bit 毫秒时间戳：
  2^41 / 365 / 24 / 3600 / 1000 ≈ 69.7 年

epoch = 2024-01-01：
  - 可用到 2093 年
  - 足够（业务系统基本不会运行 70 年）

40-bit 毫秒时间戳：
  2^40 / 365 / 24 / 3600 / 1000 ≈ 34.8 年
  - 用到 2058 年（够用）
  - 节省 1 bit 给其他字段
```

---

## 2. 号段模式扩展瓶颈

### 2.1 DB 写入 QPS

```
假设：
  - 业务 QPS = 5W
  - 号段 step = 1000
  - 号段加载频率 = 5W / 1000 = 50 QPS

DB UPDATE id_segment QPS = 50（极低）

结论：号段模式下，DB 完全不是瓶颈
```

### 2.2 号段步长与 QPS 关系

```
┌──────────────────────────────────────────────┐
│ 业务 QPS   │ 推荐 step │ DB 加载 QPS │ 内存   │
├──────────────────────────────────────────────┤
│ < 100      │ 100       │ < 1         │ 极小   │
│ 100-1K     │ 500       │ < 2         │ 极小   │
│ 1K-10K     │ 1000      │ 10          │ 极小   │
│ 10K-100K   │ 5000      │ 20          │ 小     │
│ > 100K     │ 10000+    │ 10+         │ 中     │
└──────────────────────────────────────────────┘

经验公式：step = QPS / 10（保证每 10 秒加载一次）
```

### 2.3 多业务号段隔离

```
50 个业务 × 每个 1000 步长 = 总占用 50000 ID（一次性）
→ 实际上每 1000 个 ID 用完才加载，50 个业务并发加载也才 50 QPS
→ DB 完全无压力
```

---

## 3. 水平扩展方案

### 3.1 加 Worker 节点

```
原始：1 个机房 × 4 个 worker，QPS = 4W
扩容：1 个机房 × 8 个 worker，QPS = 8W（线性提升）

步骤：
  1. 启动新 Worker 节点（自动注册到 DB）
  2. 获得 worker_id（不能与现有冲突）
  3. 业务调用端按权重分配（LB 或 hash）
  4. 新 Worker 立即生效

瓶颈：单机房 worker_id ≤ 32（5-bit）或 64（6-bit）
解决：扩机房（datacenter_id 加位）
```

### 3.2 加机房

```
原始：1 个机房
扩容：2 个机房，每个机房 16 个 worker = 32 个 worker

datacenter_id：0 / 1
worker_id：0-15

跨机房路由：
  - 业务调用端就近访问机房
  - 跨机房通过专线，延迟 < 5ms
  - ID 全局唯一（datacenter_id 区分机房）
```

### 3.3 加业务（biz_tag）

```
50 个 biz_tag：
  - 每个独立号段
  - 互相隔离
  - 互不影响

加 1 个 biz_tag：
  - INSERT 一行 id_segment
  - 几乎无成本
```

---

## 4. 容量估算（详细推导）

### 4.1 假设

```
业务规模：
  - 注册用户 1 亿
  - 日活 1000 万
  - 日订单 500 万
  - 日消息 1 亿
  - 大促峰值 10x

时间维度：
  - 日 QPS（平均） = 500 万 / 86400 ≈ 580 QPS
  - 峰值 QPS = 5800 QPS（10x）
  - 大促峰值 = 58000 QPS（100x）
```

### 4.2 资源推算

```
IDGen 服务：
  - 单节点 1W QPS（RPC 模式）
  - 大促 58000 QPS → 需要 6 个节点
  - 考虑冗余 + 滚动升级 → 10 个节点
  - 8C16G 容器足够

DB（号段模式）：
  - 号段加载 58000 / 1000 = 58 QPS（极低）
  - 单 MySQL 主从足够（4C8G）

Redis 缓存：
  - 缓存号段（每个 biz_tag 1 个 key）
  - 50 个 key，QPS < 100
  - 单 Redis 1G 内存足够

总成本（月）：
  - 10 个容器 × 100 元 ≈ 1000 元
  - 1 个 MySQL 主从 ≈ 500 元
  - 1 个 Redis ≈ 200 元
  - 合计 ≈ 1700 元/月
```

### 4.3 对比方案成本

| 方案 | 成本/月 | 复杂度 | 性能 |
|------|---------|--------|------|
| 自建 IDGen（Leaf） | 1700 元 | 高 | 100W+ QPS |
| Redis INCR | 500 元（1 个 Redis） | 低 | 20W QPS |
| DB AUTO_INCREMENT | 5000 元（高配 MySQL） | 中 | 5K QPS |
| UUID 本地生成 | 0 元（嵌入业务） | 最低 | 500W QPS |

---

## 5. 性能瓶颈与优化

### 5.1 雪花算法性能瓶颈

```
瓶颈 1：mutex 竞争
  - 高并发下 mutex.Lock() 成为瓶颈
  - 优化：无锁实现（atomic）

  无锁实现（Go）：
  type Snowflake struct {
      lastTimestamp atomic.Int64
      sequence      atomic.Int64
      workerID      int64
      datacenterID  int64
  }

  func (s *Snowflake) NextID() int64 {
      for {
          now := time.Now().UnixMilli()
          last := s.lastTimestamp.Load()
          seq := s.sequence.Load()

          if now != last {
              if s.lastTimestamp.CompareAndSwap(last, now) {
                  s.sequence.Store(1)
                  return ((now - epoch) << 22) | (s.workerID << 12) | 1
              }
              continue
          }

          // 同毫秒，CAS 自增 seq
          if s.sequence.CompareAndSwap(seq, seq+1) {
              if seq+1 > 4095 {
                  // 溢出等待
                  for now <= last {
                      now = time.Now().UnixMilli()
                  }
                  continue
              }
              return ((now - epoch) << 22) | (s.workerID << 12) | (seq + 1)
          }
      }
  }

瓶颈 2：time.Now() 系统调用
  - 每次调用约 100ns
  - 高并发下累积影响
  - 优化：每毫秒缓存一次时间戳

  var lastMs atomic.Int64
  func currentMs() int64 {
      now := time.Now().UnixMilli()
      for !lastMs.CompareAndSwap(now-1, now) {
          now = time.Now().UnixMilli()
      }
      return now
  }

瓶颈 3：fmt.Errorf
  - 错误路径每次分配内存
  - 优化：返回 error code
```

### 5.2 号段模式性能瓶颈

```
瓶颈 1：DB 加载延迟
  - 单次 DB UPDATE 约 5-10ms
  - 影响：当前号段用尽时阻塞
  - 优化：双 buffer 异步预加载

瓶颈 2：Redis 序列化
  - 缓存号段用 JSON 序列化
  - 高并发下序列化开销大
  - 优化：用 msgpack / protobuf

瓶颈 3：mutex 竞争
  - SegmentBuffer 用 mutex 保护
  - 多 goroutine 同时 genID 竞争
  - 优化：thread-local 号段（每个 goroutine 独立号段）
```

### 5.3 批量预生成优化

```go
// 客户端批量预生成池
type IdPool struct {
    queue chan int64
}

func NewIdPool(idGen IdGenClient, bizTag string, size int) *IdPool {
    p := &IdPool{queue: make(chan int64, size)}
    go func() {
        for {
            ids, _ := idGen.GenBatch(bizTag, size)
            for _, id := range ids {
                p.queue <- id
            }
        }
    }()
    return p
}

func (p *IdPool) Get() int64 {
    return <-p.queue  // 阻塞获取
}

// 性能对比：
// 单次 RPC：1000000 QPS → 5W QPS（瓶颈在 RPC）
// 批量预生成：1000 个一批 → 5000W QPS（摊薄 RPC 开销）
// 提升 1000 倍
```

---

## 6. 未来挑战

### 6.1 41-bit 时间戳耗尽

```
当前 epoch（2024-01-01）：
  41-bit 毫秒时间戳可用 69 年 → 2093 年

应对：
  - 2093 年前需要扩展时间戳到 42-43 bit
  - 或更换 epoch（牺牲历史 ID 的解析能力）
  - 或迁移到 128-bit ID（UUID v7）

实际影响：
  - 业务系统基本不可能运行 70 年
  - 不用担心
```

### 6.2 64-bit 整数溢出（JS 端）

```
JS Number 最大安全整数 = 2^53 - 1 = 9007199254740992
雪花 ID 最大值 = 2^63 - 1 = 9223372036854775807

跨毫秒后：
  - 雪花 ID 后 11 位是 0，前 53 位有效
  - 实际可用 = 2^53 - 1（JS 安全范围）
  - 当前毫秒数 = 1704067201000 ≈ 1.7e12，远小于 2^53 ≈ 9e15
  - JS 端安全

风险：
  - 未来 285 年后，毫秒数超过 2^53
  - JS 端会丢精度
  - 应对：JS 端用 BigInt 或 String 表示 ID
```

### 6.3 万亿级 ID（IoT / 5G 消息）

```
IoT 场景：每台设备每秒发 10 条消息
  - 全球 100 亿设备
  - 总 QPS = 100 亿 × 10 = 1000 亿 QPS
  - 远超单集群能力

应对：
  - 分层发号（国家级 → 城市级 → 设备级）
  - 每个设备带 device_id 前缀
  - 用 UUID v7（128-bit，趋势递增）
  - 或 HashID（业务可读短 ID）
```

### 6.4 跨大洲多活

```
场景：
  - 美东、欧洲、亚太三地多活
  - 跨大洲延迟 100-300ms

挑战：
  - 雪花算法跨大洲时钟差异
  - 跨大洲 ID 排序错乱

方案：
  - 大洲内用本地雪花（datacenter_id 区分大洲）
  - 跨大洲数据合并按业务时间戳（created_at）排序
  - 接受"趋势递增"而非"严格递增"
```

---

## 7. 容量监控

### 7.1 核心指标

```
实时：
  - idgen.qps.rate（每秒发号数）
  - idgen.qps.peak（峰值）
  - idgen.latency.p50/p99（发号延迟）
  - idgen.sequence.max_used（sequence 最大使用值）
  - idgen.clock_back.count_24h（24h 回拨次数）
  - idgen.worker.active_count（活跃 worker 数）
  - idgen.segment.remaining（当前号段剩余）
  - idgen.segment.load_count（号段加载次数）
  - idgen.db.update.latency（DB 更新延迟）

累计：
  - idgen.id.total（累计发号）
  - idgen.worker.register_total（累计注册）
  - idgen.biz_tag.count（业务标签数）
```

### 7.2 容量预警

```
预警 1：sequence 使用率 > 50%
  → 扩容 worker 或扩展 sequence bit

预警 2：号段浪费率 > 30%
  → 减小 step 或合并号段

预警 3：DB 加载延迟 > 100ms
  → 优化 DB（加索引、主从分离）

预警 4：时钟回拨 > 0 次/天
  → 检查 NTP、排查运维操作

预警 5：Worker 数量 > 80% 容量
  → 准备扩机房
```
