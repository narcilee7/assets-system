# Outbox Pattern：可靠事件发布

## 目标

训练在同一个事务内完成数据变更和事件发布的原子操作。解决"先 commit 再发消息"导致的丢失问题，以及"先发消息再 commit"导致的回滚不一致问题。

## 场景

你需要在用户注册成功后：
1. 插入用户记录（commit）
2. 发布 `user.created` 事件到消息队列

如果先 commit 再发消息，消息发出去之前服务崩溃，用户记录已持久化但事件丢失。
如果先发消息再 commit，消息已发出但用户记录回滚，消息消费者看到不存在的用户。

## 核心考点

- **事务内双写**：业务表 + outbox 表在同一事务
- **事件发布**：后台轮询 outbox 表，发布后标记已发送
- **幂等消费**：消费者根据事件 ID 去重
- **at-least-once**：发布方保证至少一次，消费者自行去重
- **Exactly-once 的代价**：如果需要精确一次，需要消费者侧去重 + 幂等

## 边界条件

- **事务失败**：outbox 记录和业务数据一起回滚，无脏数据
- **发布失败**：outbox 记录保留，后台 worker 重试
- **重复发布**：outbox 记录有唯一 ID，消费者去重
- **worker 崩溃**：重启后从上次位置继续，不漏不重
- **批量发布**：多个事件一次发布，提高吞吐

## 实现思路

### Outbox 表结构
```sql
CREATE TABLE outbox (
  id TEXT PRIMARY KEY,        -- 事件唯一 ID（用于幂等）
  aggregate_type TEXT NOT NULL, -- 聚合类型（如 "User"）
  aggregate_id TEXT NOT NULL,  -- 聚合 ID
  event_type TEXT NOT NULL,    -- 事件类型（如 "UserCreated"）
  payload TEXT NOT NULL,       -- JSON 事件负载
  created_at INTEGER NOT NULL, -- 事件创建时间
  published_at INTEGER,        -- 发布时间（NULL = 未发布）
  retry_count INTEGER DEFAULT 0
);
```

### 事务内双写
1. 业务操作（插入用户）
2. 插入 outbox 记录（同一事务）
3. commit
4. （事务外）后台 worker 轮询 outbox，发布到队列，标记 published_at

### Worker 轮询
1. 查询 `published_at IS NULL ORDER BY created_at LIMIT batchSize`
2. 按 ID 分组批量发布到消息队列
3. 批量更新 `published_at = now() WHERE id IN (...)`
4. 间隔重试，失败增加 retry_count，超过阈值标记为死信

## 复杂度

- **写路径**：时间 O(1)，空间 O(1)（额外一次 INSERT）
- **发布路径**：时间 O(n)，空间 O(1)（轮询本身是 O(1) 但批量发布 O(n)）
- **存储代价**：outbox 表随时间增长，需要定期清理（根据业务可接受的回溯窗口）

## 面试追问

- 为什么不用分布式事务（2PC）？
  （答：2PC 代价高、锁定时间长、降低可用性。Outbox 是最终一致的折中，在大多数场景更实用。）
- Outbox 表膨胀怎么办？
  （答：定期清理已发布事件（保留 N 天）；或分区表按时间分桶。）
- 如果消费者没收到消息怎么办？
  （答：worker 轮询重发，at-least-once；消费者根据事件 ID 去重，实现幂等。）
- 如何实现 exactly-once？
  （答：Outbox 只保证 at-least-once；exactly-once 需要消费者侧去重 + 事务性处理。）
- 如果业务需要实时通知怎么办？
  （答：Outbox + Change Data Capture（CDC）如 Debezium，兼顾可靠和实时。）

## 工程迁移

- **MongoDB / PostgreSQL**：单库 Outbox 直接可用
- **MySQL**：利用表或额外表存储 Outbox，配合事件表轮询
- **RabbitMQ / Kafka**：Outbox 事件发布到 Topic，消费者订阅
- **Debezium**：数据库 CDC 方案，监听 binlog 替代 Outbox 轮询
- **EventStore**：专用事件存储，Append 操作天然原子

## 相关模式

- `transaction-boundary/`：事务边界分析，Outbox 是事务边界的一个具体实现
- `saga/`：长事务的补偿模式，事件驱动 Saga 常用 Outbox 保证事件可靠