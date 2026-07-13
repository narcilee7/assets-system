# Failure

## 7 大失败模式

分布式 ID 生成器的失败模式集中在**时钟**、**号段**、**Worker**、**DB** 四个维度。下面逐一分析。

---

## 1. 时钟回拨（Snowflake 头号故障）

### 现象

```
错误日志：
  clock moved backwards by 500ms (max: 100ms)
  ClockBackError: backMs=2000, lastTimestamp=1704067201000, now=1704067199000
```

### 根因

1. **NTP 同步**：服务器启动 NTP 同步，时钟被强制拉回
2. **运维误操作**：`date -s "..."` 手动改时间
3. **虚拟机迁移**：VM 跨物理机迁移时，时钟可能跳变
4. **硬件时钟异常**：CMOS 电池失效、RTC 故障

### 检测

```go
now := time.Now().UnixMilli()
if now < s.lastTimestamp {
    backMs := s.lastTimestamp - now
    // 检测到回拨
}
```

### 处理策略

```
┌──────────────────────────────────────────────────────────┐
│ 策略 1：等待追上（默认）                                  │
│   - backMs ≤ 5ms：sleep(backMs) 后重试                    │
│   - 优点：简单，绝对不冲突                                │
│   - 缺点：业务延迟 backMs                                 │
│                                                          │
│ 策略 2：扩展 sequence（推荐）                             │
│   - 使用 sequence 的高 1-2 bit 作为"扩展时间戳"           │
│   - 一次回拨 extend +1，最多支持 3 次                     │
│   - 优点：无延迟                                          │
│   - 缺点：sequence 容量变小（13→11 bit）                  │
│                                                          │
│ 策略 3：抛错（保守）                                      │
│   - backMs > 100ms 直接返回错误                          │
│   - 业务降级到号段模式                                    │
│   - 优点：绝对保证 ID 唯一                                │
│   - 缺点：业务调用失败                                    │
│                                                          │
│ 策略 4：抛错 + 报警（生产推荐）                           │
│   - 任何回拨都抛错并报警                                  │
│   - 强制人工介入排查                                      │
│   - 优点：避免静默错误                                    │
│   - 缺点：需要 7×24 运维响应                              │
└──────────────────────────────────────────────────────────┘
```

### 兜底

- **号段模式接管**：时钟回拨后，自动从雪花切换到号段模式（美团 Leaf 做法）
- **Worker 摘除**：连续回拨的 Worker 从注册表下线，不再分配新业务

### 真实案例

参见 `problem.md` 案例 1：Twitter Snowflake 2014 年时钟回拨事故。

---

## 2. Sequence 溢出

### 现象

```
错误日志：
  sequence overflow in 1704067201000, waiting next millisecond
  QPS 监控：发号延迟尖刺（> 10ms）
```

### 根因

```
12-bit sequence = 单毫秒 4096 个 ID

业务峰值：
  - 单毫秒瞬时 QPS = 5000（秒杀场景）
  - 超出 4096 → sequence 溢出
  - 必须 sleep 到下一毫秒 → 发号延迟尖刺
```

### 处理

```go
// 检测溢出
if s.sequence > sequenceMask {  // 4095
    // 等待下一毫秒
    for now <= s.lastTimestamp {
        now = time.Now().UnixMilli()
    }
}

// 或者扩展位分配
// 13-bit sequence = 8192/毫秒
// 22-bit sequence（百度 UidGenerator）= 4M/秒
```

### 预防

1. **监控 sequence 使用率**：每秒记录 max sequence，超过 50% 告警
2. **预留 buffer**：实际分配 11 bit（2048/毫秒），预留 1 bit 给回拨
3. **业务侧限流**：秒杀场景前置限流，避免瞬时打满发号器
4. **多 Worker 分摊**：相同业务用多个 worker 并行发号

---

## 3. Worker 重复注册 / Worker ID 冲突

### 现象

```
启动日志：
  WorkerNode already exists for host=10.0.1.23, port=9000
  WorkerID conflict: existing=5, requested=10
```

### 根因

1. **同一节点启动两次**：进程未 kill 干净，导致 host+port 重复
2. **VM 克隆**：克隆的 VM 有相同的 hostname/instance_id
3. **DB 残留**：Worker 表未清理历史记录
4. **并发注册**：两个节点同时启动，都拿到相同的 ID（极端）

### 检测

```sql
-- 启动时检查
SELECT * FROM worker_node
WHERE host = ? AND port = ? AND status = 1;
-- 命中 → 已注册，复用或报错
```

### 处理

```
1. 启动时检查 host+port 是否已注册
2. 已注册且 status=1 → 拒绝启动（或复用 token）
3. 已注册且 status=0（已下线）→ 复用旧 ID，状态置为 1
4. 完全未注册 → INSERT 拿新 ID

防止并发：
  - INSERT 加 UNIQUE KEY (host, port)
  - 冲突时 SELECT 现有记录
```

### Worker 状态机

```
   注册成功
      │
      ▼
  ┌────────┐  心跳正常   ┌────────┐
  │ Active │ ──────────→ │ Active │
  └────┬───┘             └────────┘
       │ 30s 无心跳
       ▼
  ┌─────────┐
  │Inactive │ → ID 可被新节点复用
  └─────────┘
       │ 主动 deregister
       ▼
  ┌────────┐
  │Released│ → ID 进入可分配池
  └────────┘
```

---

## 4. DB 不可用 / DB 抖动

### 现象

```
错误日志：
  segment update failed after 3 retries: connection timeout
  biz_tag=order 发号延迟 500ms+
```

### 根因

1. **MySQL 主从切换**：切换瞬间连接闪断
2. **MySQL 慢查询**：其他业务的慢查询占用连接池
3. **MySQL 宕机**：机房断电、网络分区
4. **网络抖动**：业务 → DB 网络延迟

### 处理流程

```
┌─────────────────────────────────────────────────────┐
│ 检测：号段加载连续 3 次失败                           │
│                                                     │
│ 步骤 1：本地缓存兜底                                 │
│   - 如果当前号段还有剩余，继续发号（不查 DB）         │
│   - 剩余 < 20% 时才尝试加载下一号段                  │
│                                                     │
│ 步骤 2：降级到雪花算法                               │
│   - 当前 worker 的雪花 ID 已经分配                   │
│   - 切换到雪花发号（无 DB 依赖）                     │
│   - 业务无感知                                       │
│                                                     │
│ 步骤 3：DB 恢复后的双写对比                         │
│   - DB 恢复后，继续用雪花                           │
│   - 同步标记号段 biz_tag 为"待切回"                 │
│   - 后台异步：号段 max_id 追上雪花 max(id)           │
│   - 下次重启时优先用号段                            │
└─────────────────────────────────────────────────────┘
```

### 真实案例

参见 `problem.md` 案例 2：美团 Leaf 早期号段模式大促 DB 抖动事故。

---

## 5. 号段浪费

### 现象

```
监控：
  biz_tag=order step=1000
  24h 内 segment 加载次数 = 5000
  实际使用 ID 数 = 2,500,000
  浪费率 = 50%（理论上）
```

### 根因

1. **Worker 故障重启**：Worker 加载号段后立即崩溃，号段浪费
2. **号段加载时机过早**：80% 阈值触发加载，但实际只用了 50%
3. **biz_tag 注册过多**：早期注册但未使用的 biz_tag 占用号段
4. **号段步长过大**：step=10000 但 QPS 只有 1000 → 浪费严重

### 优化

```
策略 1：动态步长
  - 根据历史 QPS 自动调整 step
  - 高 QPS 业务：step=10000
  - 低 QPS 业务：step=100
  - 减少 80% 的号段浪费

策略 2：Worker 重启时主动归还号段
  - ShutdownHook 里：UPDATE id_segment SET current_max_id = X WHERE biz_tag = ?
  - X = 实际发放的最大 ID（不是号段末端）
  - 归还后的号段可被新 Worker 使用

策略 3：号段合并
  - 定期扫描 worker_node 中已下线的 Worker
  - 它们持有的号段如果未用完，记录到"待回收"表
  - 下次加载时合并到新号段

策略 4：可接受浪费 + 监控
  - 浪费率 < 30% 不告警
  - 浪费率 > 50% 时报警，运维介入
  - 业务场景下，"号段浪费"远比"DB 抖动"代价小
```

---

## 6. 多机房时钟漂移导致 ID 错乱

### 现象

```
跨机房订单合并：
  - 机房 A 生成 ID：1704067201000123456（worker_id=5）
  - 机房 B 生成 ID：1704067199000234567（worker_id=10，时间戳更早）
  - 合并后发现：机房 B 的 ID 反而更小
```

### 根因

```
机房 A 时钟：1704067201000
机房 B 时钟：1704067199000 （慢 1 秒）

ID 拼接：
  - 41-bit 时间戳占大头
  - 时钟差异直接反映在 ID 大小上
  - 即使 worker_id 不同，时钟差异也会导致跨机房 ID 顺序错乱
```

### 处理

```
方案 1：统一时间源
  - 所有机房用同一 NTP 服务器（顶级 Stratum 1）
  - 时钟差异控制在 50ms 以内
  - 优点：简单
  - 缺点：依赖外部服务

方案 2：机房内位分配
  - 雪花 64-bit 中，datacenter_id 占 5-6 bit
  - ID 大小对比时，优先比 datacenter_id
  - 业务按 datacenter 分区，避免跨机房合并
  - 优点：无外部依赖
  - 缺点：业务改造

方案 3：物理时钟 + 逻辑时钟（Hybrid）
  - 物理时钟用作"大致排序"
  - 机房内逻辑时钟保证严格递增
  - 跨机房接受 0-100ms 误差
  - 优点：实用
  - 缺点：实现复杂

方案 4：业务侧容忍
  - "趋势递增"本就不要求严格递增
  - 业务用 created_at 字段排序，不用 ID
  - 优点：最简单
  - 缺点：依赖业务改造

生产推荐：方案 4 + 监控跨机房时钟差异
```

---

## 7. ID 重复（极端情况）

### 现象

```
告警：
  Duplicate ID detected: 1704067201000123456 already exists
  数据不一致：DB 中两条订单 ID 相同
```

### 根因（极端组合）

1. **时钟严重回拨 + 错误的回拨处理**：扩展 sequence 用完，仍然继续发号
2. **Worker ID 分配冲突 + 时钟回拨**：两个 Worker 生成相同时间戳 + 相同 worker_id + 相同 sequence
3. **号段 DB 并发更新失败**：version 没递增，导致两个 Worker 拿到相同号段
4. **手动改号段 max_id**：运维误操作把 max_id 改小

### 处理

```
防御：
  1. Worker ID 分配加 UNIQUE 约束
  2. 号段 DB 更新加乐观锁（version）
  3. 时钟回拨检测 + 抛错
  4. 不允许手动修改 id_segment 表
  5. 雪花算法 sequence 随机化（防止秒级重复）

检测：
  1. DB 主键 UNIQUE 约束 → 重复时直接报错
  2. 定期任务：扫表检测 ID 重复
  3. 业务侧 DB 插入时捕获 DuplicateKeyException

恢复：
  - 重复 ID 数据手工修复（理论上不应该出现）
  - 根因排查：哪个 Worker、什么时间段、为什么
```

---

## 8. 失败模式 × 处理策略 一览

| 失败模式 | 检测方法 | 处理策略 | 兜底方案 |
|---------|---------|---------|---------|
| 时钟回拨 | now < lastTimestamp | wait / extend_seq / 抛错 | 切换号段模式 |
| Sequence 溢出 | sequence > 4095 | wait 下一毫秒 | 扩展 bit 或多 worker |
| Worker ID 冲突 | UNIQUE 约束 | 拒绝启动 / 复用旧 ID | 强制清理 DB |
| DB 不可用 | 3 次重试失败 | 降级雪花 / 缓存兜底 | 报警人工介入 |
| 号段浪费 | 浪费率监控 | 动态步长 / 归还 | 接受浪费 |
| 跨机房时钟漂移 | 时钟差异监控 | 业务侧 created_at 排序 | 接受趋势递增 |
| ID 重复 | UNIQUE 约束 | 抛错 + 排查 | 业务侧捕获异常 |

---

## 9. 故障演练清单

```
- [ ] 模拟 NTP 时钟回拨（用 `date -s` 或 `chronyc tracking`）
- [ ] 模拟单毫秒 5000 QPS（压测工具发号）
- [ ] 模拟 MySQL 主从切换（kill master）
- [ ] 模拟 Worker 进程崩溃（kill -9）
- [ ] 模拟 Worker 重复启动
- [ ] 模拟号段 version 冲突（手动改 DB）
- [ ] 模拟跨机房时钟差异（两地 ping 时钟）
- [ ] 模拟网络分区（业务 → IDGen 断网）
```
