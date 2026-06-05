# Message Delivery Semantics

## 目标

理解消息传递的三种语义（at-least-once, at-most-once, exactly-once）、适用场景、以及如何在系统设计中权衡。

## 场景

- 支付系统：扣款消息重复消费会怎样？
- 日志系统：丢失消息可以接受吗？
- 消息队列的选择：Kafka vs RabbitMQ vs Redis Stream
- 如何实现 exactly-once？

## 三种语义

### At-Most-Once（最多一次）

```
Producer -> Broker -> Consumer

发送后不确认，丢了不重发

Consumer：
  - 读取消息 -> 处理 -> 提交 offset
  - 如果处理时崩溃，没提交 offset，重启后会跳过该消息

特点：
  - 不重复
  - 可能丢失
```

### At-Least-Once（至少一次）

```
Producer -> Broker -> Consumer

发送后确认，重试确保到达

Consumer：
  - 读取消息 -> 处理 -> 提交 offset
  - 如果处理后崩溃，没提交 offset，重启后会重新消费该消息
  - 可能重复消费

特点：
  - 不丢失
  - 可能重复
```

### Exactly-Once（恰好一次）

```
Producer -> Broker -> Consumer

消息恰好被处理一次

Consumer：
  - 读取消息 -> 处理 -> 提交 offset（原子）
  - 失败：重新读，处理，提交（幂等保证不重复）

特点：
  - 既不丢失，也不重复
  - 实现代价高
```

## 实际系统中的语义

### Kafka

```
At-Least-Once（默认）：
  - Producer 发送后等待 ISR 确认
  - Consumer 手动提交 offset（先处理再提交）
  - 如果处理后提交前崩溃，会重复消费

Exactly-Once（配置开启）：
  - Producer 和 Consumer 都启用幂等
  - 事务 API：写入 Kafka 和下游系统原子提交
  - 代价：性能降低，需要下游支持幂等
```

### RabbitMQ

```
At-Least-Once：
  - 消息确认机制（ACK）
  - 消费者确认后删除消息
  - 如果消费后没确认，消息重新入队

幂等处理（业务层）：
  - 消费前检查：if processed(id) return
  - 写入去重表 / 状态机幂等
```

### Redis Stream

```
At-Least-Once：
  - XREAD 读取消息
  - XACK 确认消息
  - 客户端崩溃，未 ACK 的消息重新投递

消费者组：
  - 每个消息只投递到一个消费者
  - 消费者崩溃，其 pending 消息重新投递给其他消费者
```

## 幂等处理

### 为什么需要幂等？

```
场景：支付系统扣款

非幂等：
  消费者：扣款 100 元 -> 处理成功 -> 提交 offset -> 崩溃
  重启后：再次扣款 100 元 -> 重复扣款！

幂等：
  消费者：扣款 100 元 -> 检查是否已处理 -> 已处理，跳过 -> 提交 offset
```

### 幂等实现方式

**1. 去重表**

```sql
-- 创建消息去重表
CREATE TABLE message_dedup (
  message_id VARCHAR(64) PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消费前检查
BEGIN;
SELECT * FROM message_dedup WHERE message_id = ? FOR UPDATE;
-- 如果存在，跳过
INSERT INTO message_dedup (message_id) VALUES (?);
COMMIT;
```

**2. 业务状态机**

```
订单状态：PENDING -> PAID -> COMPLETED

消费者处理：
  if (state == PAID) return; // 幂等：已扣款，跳过
  if (state != PENDING) return error; // 异常状态
  UPDATE state = PAID; // 状态转移
```

**3. 唯一键约束**

```
扣款记录表：
  UNIQUE (order_id, message_id)

INSERT ... ON CONFLICT DO NOTHING;
```

## 消息丢失的避免

### Producer 侧

```python
# Kafka: acks=all + retries
producer.send(msg, acks=all, retries=3)

# RabbitMQ: publisher confirms
channel.confirm_delivery()
```

### Broker 侧

```python
# Kafka: 复制因子 >= 3
# min.insync.replicas >= 2

# RabbitMQ: 镜像队列
```

### Consumer 侧

```python
# 手动提交 offset
consumer.poll()
# 处理消息
# 处理成功后提交 offset
consumer.commit()
```

## Exactly-Once 实现

### 事务 + 幂等

```
场景：从 Kafka 消费，写入 MySQL

步骤：
  1. 读取消息（Kafka）
  2. 开启 MySQL 事务
  3. 检查是否已处理（幂等）
  4. 写入数据
  5. 提交 Kafka offset（作为事务的一部分）
  6. 提交 MySQL 事务

原子性：
  - MySQL 事务 + Kafka 事务 绑定
  - 要么都成功，要么都回滚
```

### 数据库事务 + 消息队列

```sql
-- 消息表
CREATE TABLE outbox (
  id BIGINT PRIMARY KEY,
  message VARCHAR,
  status ENUM('pending', 'sent'),
  created_at TIMESTAMP
);

-- 消费消息：
BEGIN;
  UPDATE outbox SET status = 'processing' WHERE id = ?;
  INSERT INTO orders (...) VALUES (...);
  UPDATE outbox SET status = 'sent' WHERE id = ?;
COMMIT;
```

## 核心追问

1. **为什么没有"免费的" exactly-once？** 两阶段提交代价高；网络延迟可能导致重复，需要幂等处理
2. **Kafka 和 RabbitMQ 的消息语义区别？** Kafka 基于 offset 提交，灵活；RabbitMQ 基于 ACK，消息删除后不重复
3. **幂等处理和事务的区别？** 幂等：重复执行结果相同；事务：多个操作要么都成功，要么都失败
4. **如何选择消息语义？** 支付/订单用 exactly-once（日志要完整）；监控/日志用 at-least-once（可重复但不能丢）
5. **Redis Stream 和 Kafka 的语义对比？** 都是 at-least-once；Redis 有 pending 消息重新投递机制，Kafka 有 offset 提交机制

## 工程迁移

- **高可靠场景**：Kafka acks=all + 幂等消费
- **简单场景**：RabbitMQ + 业务幂等
- **事务场景**：数据库事务 + 消息表（outbox pattern）

## 状态

| 资产 | 状态 |
|---|---|
| Raft walkthrough | done |
| distributed lock critique | done |
| message delivery semantics | done |
| sharding and rebalance playbook | todo |
| consistency model comparison | todo |