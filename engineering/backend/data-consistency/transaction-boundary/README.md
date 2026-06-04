# Transaction Boundary + Idempotency Key

## 目标

训练后端架构中两个最核心的一致性决策：
1. **事务边界判断**：哪些操作必须在同一事务，哪些可以最终一致
2. **幂等键设计**：防止重复执行，同时处理并发冲突（reject vs wait）

## 场景

你在设计一个转账系统：
- 扣减 A 账户余额、增加 B 账户余额：必须在同一事务（强一致）
- 发送通知、更新统计：可以异步，最终一致即可
- 用户可能因为网络超时而重试转账请求：需要幂等键保证同一笔转账只执行一次

## 核心考点

- 幂等状态机：`none → processing → completed/failed`
- 并发冲突：两个请求同时携带相同幂等键，一个正在处理，另一个怎么办？
- TTL 管理：幂等结果不能永久缓存，需要过期清理
- 事务边界判断：写操作数量 × 强一致性要求 = 是否需要事务
- 失败恢复：`failed` 状态是否允许重试？（本实现允许，因为失败可能是瞬时的）

## 边界条件

- **空操作列表**：无需事务
- **只读操作**：无需事务边界（简化模型，实际 Repeatable Read 下需防幻读）
- **单个写操作**：天然原子，不需要显式跨实体事务
- **多个强一致写**：必须在同一事务
- **多个写但无强一致要求**：可用 Saga / 最终一致
- **幂等 processing 冲突**：`reject` 策略返回 409；`wait` 策略阻塞等待结果
- **幂等 wait 超时**：防止无限阻塞
- **TTL 过期**：清理记录，释放内存，允许"真正的新请求"复用旧 key

## 实现思路

### IdempotencyKeyStore
1. 用 `Map` 做内存存储（教学），生产环境应使用 Redis + SETNX
2. `execute(key, fn, options)` 入口：
   - 查记录 → `completed` 直接返回缓存
   - `processing` → 根据 `onConflict` 策略 reject 或 wait
   - `failed` 或无记录 → 创建 `processing`，执行 `fn`
3. Wait 策略：用事件通知（回调数组）而非轮询，避免 CPU 空转
4. 执行完成后通知所有 waiter，更新记录状态
5. `cleanup()` 扫描过期记录

### TransactionBoundary Analyzer
1. 过滤出写操作和强一致操作
2. 规则引擎：
   - 0 写 → 无边界
   - 1 写 → 无边界（天然原子）
   - ≥2 写 + 强一致 → 需要事务边界
   - ≥2 写 + 无强一致 → 最终一致

### 幂等键生成
- 生产：`sha256(clientId + operation + canonicalParams + nonce)`
- 教学：`clientId:operation:hash(params)`
- 关键：参数必须按固定顺序序列化，否则同一请求生成不同 key

## 复杂度

- **IdempotencyStore**：时间 O(1)（Map 查找），空间 O(n)（活跃记录数）
- **Transaction Analyzer**：时间 O(m)（操作数），空间 O(1)

## 面试追问

- 如果服务是无状态的，幂等键存储放在哪里？（答：Redis / 分布式缓存，用 SETNX 实现 processing 锁。）
- 幂等键的 TTL 应该设多长？（答：大于用户最大重试窗口，通常 5-24 小时；支付类场景可更长。）
- 如果 processing 状态的服务实例挂了，记录永远停留在 processing 怎么办？（答：TTL 过期自动清理；或配一个 watchdog 任务扫描长时间 processing 的记录。）
- 分布式事务（Saga）和本地事务怎么选？（答：同一服务内多表用本地事务；跨服务用 Saga + 补偿；本资产的重点是识别边界。）
- 为什么 failed 状态允许重试？如果业务不支持重试怎么办？（答：本实现默认允许，因为失败可能是瞬时的；不可重试的业务可以在 `retryable` 层控制，或把 failed 视为终态。）

## 工程迁移

- **Stripe API**：幂等键通过 `Idempotency-Key` 请求头传递，行为与本实现一致
- **AWS Lambda 幂等**：用 DynamoDB 存储幂等状态，TTL 自动清理
- **数据库事务**：本实现的 `transactionBoundary` 分析结果对应到 `BEGIN ... COMMIT` 的包裹范围
- **Saga 模式**：最终一致的操作可用 Outbox + 消息队列实现，见 `backend/data-consistency/outbox-pattern/`
