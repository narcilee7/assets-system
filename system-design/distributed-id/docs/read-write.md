# Read Write

## 核心设计原则

- **写路径**：雪花算法是纯本地计算（无 IO），号段模式是预加载 + 内存递增
- **读路径**：从客户端角度看，发号接口都是"写"（生成新 ID）
- **关键优化**：把"取号段"从同步阻塞变成异步预加载
- **故障兜底**：DB 不可用时降级到雪花算法；雪花算法时钟回拨时降级到号段

---

## 1. 雪花算法发号流程

### 1.1 单节点发号（核心算法）

```go
// Snowflake 算法核心实现（Go）
const (
    epoch          = int64(1704067200000) // 自定义纪元（2024-01-01）
    workerIDBits   = 5
    datacenterIDBits = 5
    sequenceBits   = 12
    maxWorkerID    = -1 ^ (-1 << workerIDBits)         // 31
    maxDatacenterID = -1 ^ (-1 << datacenterIDBits)    // 31
    sequenceMask   = -1 ^ (-1 << sequenceBits)         // 4095
    workerIDShift  = sequenceBits                      // 12
    datacenterIDShift = sequenceBits + workerIDBits    // 17
    timestampShift = sequenceBits + workerIDBits + datacenterIDBits  // 22
)

type Snowflake struct {
    mu             sync.Mutex
    lastTimestamp  int64
    workerID       int64
    datacenterID   int64
    sequence       int64
}

func (s *Snowflake) NextID() (int64, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    now := time.Now().UnixMilli()

    // 1. 时钟回拨检测
    if now < s.lastTimestamp {
        backMs := s.lastTimestamp - now
        if backMs > 100 {  // 超过容忍阈值
            return 0, fmt.Errorf("clock moved backwards by %dms", backMs)
        }
        // 小幅回拨：等待追上
        time.Sleep(time.Duration(backMs) * time.Millisecond)
        now = time.Now().UnixMilli()
    }

    // 2. 同一毫秒内：sequence 自增
    if now == s.lastTimestamp {
        s.sequence = (s.sequence + 1) & sequenceMask
        if s.sequence == 0 {
            // sequence 溢出，等待下一毫秒
            for now <= s.lastTimestamp {
                now = time.Now().UnixMilli()
            }
        }
    } else {
        // 不同毫秒：sequence 从 0 开始
        s.sequence = 0
    }

    s.lastTimestamp = now

    // 3. 拼接 64-bit ID
    return ((now - epoch) << timestampShift) |
        (s.datacenterID << datacenterIDShift) |
        (s.workerID << workerIDShift) |
        s.sequence, nil
}
```

### 1.2 关键时序图

```
时间轴 →
────────────────────────────────────────────────────────
t0          t0+1ms       t0+2ms       t0+3ms
────────────────────────────────────────────────────────
seq=0       seq=1        seq=0        seq=0
seq=1       seq=2        seq=1        seq=1
...         ...          ...          ...
seq=4094    seq=4094     seq=2        seq=2
seq=4095⚠   seq=4095⚠   seq=3        seq=3
seq溢出等待  seq溢出等待  ...          ...

⚠ seq=4095 后下一个是 0（溢出），必须等下一毫秒
```

### 1.3 性能特征

```
单线程：约 200W QPS（纯计算，无 IO）
4 线程：约 700W QPS（接近线性）
网络 RPC 后：约 50W QPS（瓶颈在网络）
批量发号（10 个）：约 200W QPS（摊薄网络开销）

关键瓶颈：
  - mutex 竞争（高并发下争用锁）
  - 时间获取（time.Now() 系统调用）
  - 内存分配（fmt.Errorf 在错误路径）

优化方案：
  - 用 atomic 替代 mutex（无锁雪花）
  - 批量预生成（每次返回 100 个 ID）
  - 时间戳缓存（每毫秒更新一次）
```

---

## 2. 号段模式发号流程

### 2.1 双 buffer 号段分配

```go
// 号段分配核心逻辑
func (s *SegmentService) GetNextSegment(bizTag string) (*Segment, error) {
    buf := s.buffers[bizTag]
    buf.mu.Lock()
    defer buf.mu.Unlock()

    // 1. 检查当前号段是否够用
    if !buf.InitOK {
        // 首次加载：从 DB 同步加载
        if err := s.loadSegmentFromDB(buf); err != nil {
            return nil, err
        }
    }

    // 2. 当前号段用到 80%，异步加载下一号段
    if buf.Current.Value >= buf.Current.End - buf.Current.End/5 {
        if !buf.LoadingNext && !buf.NextReady {
            buf.LoadingNext = true
            go s.asyncLoadNextSegment(buf)
        }
    }

    // 3. 当前号段用尽：切换到下一号段
    if buf.Current.Value >= buf.Current.End {
        if !buf.NextReady {
            // 下一号段未加载完成，阻塞等待
            buf.mu.Unlock()
            time.Sleep(10 * time.Millisecond)
            buf.mu.Lock()
            if !buf.NextReady {
                return nil, errors.New("segment not ready")
            }
        }
        // 切换：Next → Current
        buf.Current = buf.Next
        buf.Next = nil
        buf.NextReady = false
    }

    // 4. 返回当前号段
    return buf.Current, nil
}
```

### 2.2 加载下一号段（DB 更新）

```sql
-- 原子更新：使用乐观锁
UPDATE id_segment
SET current_max_id = current_max_id + step,
    version = version + 1,
    updated_at = NOW()
WHERE biz_tag = ? AND version = ?;

-- 检查 affected rows
-- = 1 → 成功，current_max_id + step 是新号段 [end - step + 1, end]
-- = 0 → 并发冲突，重试（最多 3 次）
```

```go
func (s *SegmentService) loadSegmentFromDB(buf *SegmentBuffer) error {
    for i := 0; i < 3; i++ {
        seg, err := s.db.GetSegment(buf.BizTag)
        if err != nil {
            return err
        }

        newMaxID := seg.CurrentMaxID + int64(seg.Step)
        affected, err := s.db.AtomicUpdateSegment(buf.BizTag, seg.Version, newMaxID)
        if err != nil {
            return err
        }

        if affected == 1 {
            // 成功
            buf.Current = &Segment{
                Start: seg.CurrentMaxID + 1,
                End:   newMaxID + 1,
                Value: seg.CurrentMaxID,
            }
            buf.InitOK = true
            return nil
        }

        // 冲突，重试
        log.Warnf("segment update conflict, retry %d", i+1)
    }
    return errors.New("segment update failed after 3 retries")
}
```

### 2.3 内存发号（无 IO）

```go
// 纯内存发号，极快
func (buf *SegmentBuffer) NextID() (int64, error) {
    buf.mu.Lock()
    defer buf.mu.Unlock()

    if buf.Current.Value >= buf.Current.End {
        return 0, errors.New("segment exhausted")
    }

    buf.Current.Value++
    return buf.Current.Value, nil
}
```

### 2.4 性能特征

```
纯内存发号（号段内）：约 1000W QPS（无锁情况下）
DB 加载号段：约 5W QPS（取决于 DB 性能）
平均混合：约 100W QPS（号段大小 1000，每 1000 个号加载 1 次 DB）

关键优化：
  - 加大号段步长（step=10000）→ 减少 DB 加载频率
  - 双 buffer 预加载 → 消除同步阻塞
  - 异步加载时不影响当前号段使用
```

---

## 3. 混合模式（Leaf 美团方案）

### 3.1 架构

```
                    ┌───────────────┐
                    │  IDGen Service│
                    │  (Spring Boot)│
                    └───────┬───────┘
                            │
                ┌───────────┴───────────┐
                │                       │
          ┌─────▼─────┐           ┌─────▼─────┐
          │ Snowflake │           │  Segment  │
          │   Mode    │           │   Mode    │
          │           │           │           │
          │ - 本地计算 │           │ - 预加载  │
          │ - 无 DB    │           │ - 异步    │
          └─────┬─────┘           └─────┬─────┘
                │                       │
                │                  ┌────▼────┐
                │                  │   DB    │
                │                  │(MySQL)  │
                │                  └─────────┘
                │
        ┌───────▼────────┐
        │  Worker Node   │
        │ (auto assign)  │
        └────────────────┘
```

### 3.2 切换策略

```
默认：雪花算法（性能高，无 DB 依赖）

触发切换到号段模式：
  1. 检测到时钟回拨（雪花算法不可用）
  2. Worker ID 耗尽（1024 个 worker 都注册了）
  3. 业务方要求严格递增（雪花算法只能趋势递增）

切换流程：
  1. 雪花算法服务降级（暂停或返回错误）
  2. 初始化号段（从 DB 加载起始号段）
  3. 用号段继续发号
  4. 时钟恢复后，逐步切回雪花算法（双写对比）

实际生产：美团在 2018 年后切换到 Leaf-snowflake，时钟回拨作为兜底场景
```

---

## 4. 客户端 SDK 流程

### 4.1 嵌入式发号（Leaf 客户端模式）

```java
// 业务进程启动时
@PostConstruct
public void init() {
    // 1. 注册 worker
    WorkerNode worker = idGenClient.registerWorker(host, port);
    this.workerID = worker.getId();
    this.datacenterID = worker.getDatacenterId();

    // 2. 初始化雪花算法
    this.snowflake = new Snowflake(workerID, datacenterID);
}

// 业务调用
public long genId(String bizTag) {
    return snowflake.nextId();
}
```

### 4.2 RPC 发号（中央服务模式）

```java
// 业务调用
public long genId(String bizTag) {
    return idGenClient.gen(bizTag, 1).get(0);
}
```

### 4.3 批量预生成（性能优化）

```java
// 高并发场景：预生成一批 ID 到本地环形队列
public class IdPool {
    private ArrayDeque<Long> queue = new ArrayDeque<>(1000);
    private static final int BATCH_SIZE = 1000;

    public synchronized long getId() {
        if (queue.isEmpty()) {
            // 批量拉取
            List<Long> ids = idGenClient.gen("order", BATCH_SIZE);
            queue.addAll(ids);
        }
        return queue.poll();
    }
}
```

**效果**：将 RPC 调用降低 1000 倍，本地取 ID < 100ns

---

## 5. 故障模式下的读写

### 5.1 时钟回拨

```
检测：
  - 每次发号前 now := time.Now()
  - 如果 now < lastTimestamp → 回拨

处理流程：
  ┌─────────────────────────────────────────────┐
  │ 1. back = lastTimestamp - now               │
  │                                              │
  │ 2. if back <= 5ms:                           │
  │      wait back ms, retry                     │
  │                                              │
  │ 3. else if back <= 100ms:                    │
  │      extend sequence bits (using retry bits) │
  │      log warning                             │
  │                                              │
  │ 4. else (back > 100ms):                      │
  │      throw error → 业务降级或切号段模式       │
  │      alert ops team                          │
  └─────────────────────────────────────────────┘
```

### 5.2 DB 不可用（号段模式）

```
检测：
  - 加载下一号段 3 次失败
  - DB 连接超时

降级流程：
  1. 标记该 biz_tag 为"号段降级"
  2. 切换到雪花算法（如果 worker_id 已分配）
  3. 业务发号短暂延迟（10-100ms 等待雪花算法初始化）
  4. DB 恢复后，逐步切回号段模式
  5. 上报告警

注意：
  - 降级期间雪花算法可能生成比号段更大的 ID（断层）
  - 业务需要容忍 ID 断层（通常不影响）
```

### 5.3 Worker 故障

```
Worker 崩溃：
  - 内存中的 sequence 丢失
  - worker_node 表 status=0

影响：
  - 该 worker 正在使用的号段：剩余 ID 浪费（最多浪费 step-1 个）
  - DB 中 current_max_id 已递增，新 worker 接管后会跳过这段

恢复：
  - 新 worker 启动 → 重新注册 → 拿到新 worker_id
  - 从 DB 加载号段 → 继续发号
  - ID 仍然全局唯一（不同 worker_id + 不同 sequence 范围）
```

---

## 6. 写入路径对比

| 方案 | 写入 IO | 写入延迟 | 写吞吐 | ID 长度 |
|------|---------|---------|--------|---------|
| Snowflake 本地 | 0 | < 0.1ms | 100W+ QPS | 64-bit |
| Snowflake RPC | 1 网络 | < 5ms | 50W QPS | 64-bit |
| Segment 内存 | 0（预加载） | < 0.01ms | 1000W QPS | 64-bit |
| Segment 加载 | 1 DB 写 | 10-50ms | 5W QPS | 64-bit |
| UUID v4 本地 | 0 | < 0.01ms | 500W QPS | 128-bit |
| Redis INCR | 1 网络 | < 2ms | 20W QPS | 64-bit |
| DB AUTO_INCREMENT | 1 DB 写 | 10ms | 5K QPS | 64-bit |

---

## 7. 读路径（反解 ID）

### 7.1 本地反解（推荐）

```go
// 不需要远程调用，纯本地计算
func ParseSnowflakeID(id int64) SnowflakeInfo {
    return SnowflakeInfo{
        TimestampMs:  (id >> 22) + epoch,
        DatacenterID: int((id >> 17) & 0x1F),
        WorkerID:     int((id >> 12) & 0x1F),
        Sequence:     int(id & 0xFFF),
        Datetime:     time.UnixMilli((id >> 22) + epoch),
    }
}
```

### 7.2 服务端反解

```http
POST /id/v1/parse
{ "ids": ["1704067201000123456", ...] }
```

适用于：批量反解、日志分析、运维排查。

---

## 8. 端到端流程：下单

```
1. 用户下单
   ↓
2. OrderService.createOrder(req)
   ↓
3. idGenService.gen("order")  → 雪花算法本地生成 → 100ns 返回
   ↓
4. orderRepository.save(order) → MySQL INSERT
   ↓
5. 返回订单详情（含 ID）

整链路：
  - ID 生成：100ns
  - MySQL 写入：5ms（包含 ID 作为主键插入）
  - 总延迟：~5ms

对比号段模式：
  - ID 生成：50ns（纯内存）
  - MySQL 写入：5ms
  - 总延迟：~5ms
  - 优势：号段模式无时钟风险
```
