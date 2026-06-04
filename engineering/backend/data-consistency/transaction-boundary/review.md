# Review

## 我一开始容易写错什么

1. **幂等 wait 用轮询而不是事件通知**：早期实现用 `while + sleep` 轮询，测试不稳定且浪费 CPU。改为 waiter 回调数组后，等待变为事件驱动，响应更快且资源友好。
2. **忘记清理 waiter**：如果 wait 超时了，但原任务后来完成了，回调仍然会被调用，可能导致未处理的 Promise reject。需要在超时回调里从 waiter 列表移除自己。
3. **processing 记录没有 TTL**：如果服务在 processing 阶段崩溃，记录会永远残留。加入 `expiresAt` 和 `cleanup()` 后，过期记录会自动释放。
4. **事务边界判断过于粗糙**：最初版本只按"是否有多个写"判断，忽略了"是否要求强一致"。加入 `strongConsistency` 标志后，模型更贴近真实决策。

## 这个实现为什么成立

- **幂等的本质是"状态机 + 锁"**：`processing` 就是一把分布式锁，`completed` 是缓存结果，`failed` 是释放锁允许重试。
- **事件通知优于轮询**：在单进程教学中用回调数组，在分布式环境中对应 Redis Pub/Sub 或数据库变更通知。
- **事务边界的核心是"写操作 × 一致性要求"**：不是有多个操作就要事务，而是"多个写 + 强一致"才需要。
- **TTL 是生产必须的**：没有 TTL 的幂等存储就是内存泄漏。

## 和标准库 / 框架实现的差距

| 特性 | 本实现 | Stripe API | AWS Lambda Powertools |
|------|--------|------------|----------------------|
| 内存存储 | ✅（教学） | Redis / PostgreSQL | DynamoDB |
| processing 锁 | ✅ | ✅（数据库唯一约束） | ✅（DynamoDB 条件写入） |
| wait 策略 | ✅（事件回调） | 隐式（客户端重试） | ❌ |
| TTL 清理 | ✅ | ✅ | ✅ |
| 分布式状态同步 | ❌ | ✅ | ✅ |
| 事务边界分析 | ✅（简化规则） | N/A | N/A |

- Stripe 的幂等实现是最接近生产标杆的：数据库唯一约束保证 processing 互斥，事务保证状态更新原子。
- AWS Lambda Powertools Idempotency 用 DynamoDB TTL 做自动清理，和本实现的 `cleanup()` 等价。

## 工程里怎么取舍

- **面试 / 教学**：本实现完整展示状态机和事件通知，200 行以内可手写。
- **Node.js 生产**：
  - 单实例：用本实现 + Redis 替换 Map
  - 多实例：Redis + Redlock 保证 processing 互斥，或数据库唯一约束（`UNIQUE(idempotency_key, status)`）
- **Java 生产**：直接用数据库的 `INSERT ... ON CONFLICT DO NOTHING` 实现 processing 锁。
- **不可重试的 failed 状态**：支付扣款失败不能自动重试时，把 failed 视为终态，需要人工介入或补偿流程。
- **长事务的替代**：如果事务边界分析结果显示需要跨库事务，优先用 Saga（本仓库 `backend/data-consistency/saga-workflow/`）替代 2PC。

## 下次复习重点

1. 能现场画出幂等状态机（none → processing → completed/failed）。
2. 能解释 `reject` 和 `wait` 策略分别适合什么场景：
   - reject：客户端有能力自己重试（如 Web 前端）
   - wait：服务端内部调用需要同步等待结果（如微服务间调用）
3. 能快速判断一组操作的事务边界：数写操作 + 看强一致要求。
4. 能迁移到：Redis SETNX、数据库唯一约束、Stripe 幂等设计、Saga 补偿。
