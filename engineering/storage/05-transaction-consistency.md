# 事务与一致性

## 1. ACID 与隔离级别

```sql
-- MySQL 隔离级别
-- READ UNCOMMITTED：脏读、不可重复读、幻读
-- READ COMMITTED：不可重复读、幻读（Oracle 默认）
-- REPEATABLE READ：幻读（MySQL InnoDB 默认，通过 MVCC + Gap Lock 解决）
-- SERIALIZABLE：无并发问题，性能最差

-- 设置隔离级别
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 查看当前隔离级别
SELECT @@transaction_isolation;
```

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现机制 |
|----------|------|-----------|------|----------|
| READ UNCOMMITTED | ✓ | ✓ | ✓ | 无锁 |
| READ COMMITTED | ✗ | ✓ | ✓ | MVCC（每次读生成 ReadView）|
| REPEATABLE READ | ✗ | ✗ | ✗* | MVCC（事务开始时 ReadView）+ Gap Lock |
| SERIALIZABLE | ✗ | ✗ | ✗ | 所有操作加锁 |

*InnoDB 在 RR 下通过 Gap Lock 和 Next-Key Lock 解决了幻读（针对当前读）

```
MVCC（Multi-Version Concurrency Control）
├── 每行数据有隐藏列：
│   ├── DB_TRX_ID：最后修改的事务 ID
│   ├── DB_ROLL_PTR：回滚指针（指向 undo log）
│   └── DB_ROW_ID：行 ID（无主键时）
├── undo log 形成版本链
├── ReadView：活跃事务 ID 列表 + 最大/最小事务 ID
└── 快照读根据 ReadView 判断可见性

当前读 vs 快照读
├── 快照读：SELECT（不加锁），读取历史版本
└── 当前读：SELECT ... FOR UPDATE / IN SHARE MODE，读取最新版本并加锁
```

## 2. 分布式事务

```
分布式事务协议

2PC（Two-Phase Commit）
  ├── 阶段一（Prepare）：协调者询问所有参与者是否可以提交
  ├── 阶段二（Commit/Rollback）：协调者根据响应决定提交或回滚
  ├── 优点：强一致性
  └── 缺点：同步阻塞、单点故障、脑裂

3PC（Three-Phase Commit）
  ├── CanCommit → PreCommit → DoCommit
  ├── 引入超时机制减少阻塞
  └── 实现复杂，实际使用少

TCC（Try-Confirm-Cancel）
  ├── Try：预留资源（如冻结库存）
  ├── Confirm：确认执行（扣减库存）
  ├── Cancel：取消释放（解冻库存）
  ├── 优点：性能高、无全局锁
  └── 缺点：业务侵入大、需实现幂等

Saga
  ├── 长事务拆分为本地事务序列
  ├── 每个本地事务有对应的补偿操作
  ├── 编排式（Choreography）：事件驱动
  ├── 协调式（Orchestration）：中心协调器
  └── 优点：适合长事务、最终一致
      缺点：无隔离性、补偿复杂

本地消息表（ eventual consistency ）
  ├── 业务操作和消息记录在同一本地事务
  ├── 后台任务扫描消息表发送消息
  └── 优点：简单可靠，适合异步场景
```

```java
// TCC 实现示例
@Service
public class InventoryTccService {
    
    @Autowired private InventoryRepository inventoryRepo;
    @Autowired private InventoryFreezeRepository freezeRepo;
    
    // Try：预留库存
    @Transactional
    public boolean tryDeduct(String productId, int quantity, String xid) {
        // 检查是否已处理（幂等）
        if (freezeRepo.existsByXid(xid)) {
            return true;
        }
        
        // 检查库存
        Inventory inventory = inventoryRepo.findByProductId(productId);
        if (inventory.getAvailable() < quantity) {
            return false;
        }
        
        // 冻结库存
        inventory.setAvailable(inventory.getAvailable() - quantity);
        inventory.setFrozen(inventory.getFrozen() + quantity);
        inventoryRepo.save(inventory);
        
        // 记录冻结记录
        freezeRepo.save(new InventoryFreeze(xid, productId, quantity));
        return true;
    }
    
    // Confirm：确认扣减
    @Transactional
    public void confirm(String xid) {
        InventoryFreeze freeze = freezeRepo.findByXid(xid);
        if (freeze == null || freeze.getStatus() != FreezeStatus.PENDING) {
            return;
        }
        
        Inventory inventory = inventoryRepo.findByProductId(freeze.getProductId());
        inventory.setFrozen(inventory.getFrozen() - freeze.getQuantity());
        inventoryRepo.save(inventory);
        
        freeze.setStatus(FreezeStatus.CONFIRMED);
        freezeRepo.save(freeze);
    }
    
    // Cancel：释放库存
    @Transactional
    public void cancel(String xid) {
        InventoryFreeze freeze = freezeRepo.findByXid(xid);
        if (freeze == null || freeze.getStatus() != FreezeStatus.PENDING) {
            return;
        }
        
        Inventory inventory = inventoryRepo.findByProductId(freeze.getProductId());
        inventory.setAvailable(inventory.getAvailable() + freeze.getQuantity());
        inventory.setFrozen(inventory.getFrozen() - freeze.getQuantity());
        inventoryRepo.save(inventory);
        
        freeze.setStatus(FreezeStatus.CANCELLED);
        freezeRepo.save(freeze);
    }
}
```

## 3. 最终一致性模式

```
本地消息表模式
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  业务表      │     │  消息表      │     │  消息消费    │
│  (同一事务)  │────▶│  (status)   │────▶│  (下游服务)  │
└─────────────┘     └─────────────┘     └─────────────┘

实现步骤：
1. 业务操作和消息插入在同一本地事务
2. 后台定时任务扫描待发送消息
3. 发送成功后更新消息状态为"已发送"
4. 消费者处理并保证幂等
5. 超过重试次数进入死信队列
```

```sql
-- 本地消息表
CREATE TABLE outbox_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  aggregate_type VARCHAR(100) NOT NULL,    -- 'order'
  aggregate_id VARCHAR(100) NOT NULL,      -- 'order-123'
  event_type VARCHAR(100) NOT NULL,        -- 'OrderCreated'
  payload JSON NOT NULL,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status_created (status, created_at)
);

-- 生产者：同一事务写入业务表和消息表
BEGIN;
  INSERT INTO orders (id, user_id, total) VALUES ('order-123', 'user-1', 100);
  INSERT INTO outbox_messages (aggregate_type, aggregate_id, event_type, payload)
  VALUES ('order', 'order-123', 'OrderCreated', '{"orderId":"order-123","amount":100}');
COMMIT;

-- 消费者（定时任务或 CDC）
SELECT * FROM outbox_messages 
WHERE status = 'pending' AND created_at < NOW() - INTERVAL 5 SECOND
LIMIT 100;

-- 发送成功后
UPDATE outbox_messages SET status = 'sent' WHERE id = ?;
```

```java
// Saga 编排器
@Component
public class OrderSagaOrchestrator {
    
    public void startOrderSaga(CreateOrderRequest request) {
        SagaDefinition saga = SagaBuilder Saga()
            .step("deductInventory")
                .invoke(() -> inventoryService.deduct(request.getItems()))
                .compensate(() -> inventoryService.rollback(request.getItems()))
            .step("deductBalance")
                .invoke(() -> paymentService.deduct(request.getUserId(), request.getAmount()))
                .compensate(() -> paymentService.refund(request.getUserId(), request.getAmount()))
            .step("createOrder")
                .invoke(() -> orderService.create(request))
            .build();
        
        saga.execute();
    }
}
```
