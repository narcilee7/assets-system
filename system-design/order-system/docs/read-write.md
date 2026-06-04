# Read & Write Path

## 下单流程

```
用户下单
  │
  ▼
预占库存（乐观锁）
  │
  ▼
创建订单（待支付）
  │
  ▼
等待支付
  │
  ▼
支付成功 → 真正扣减库存
超时 → 回滚预占
```

## 库存扣减（乐观锁）

```go
UPDATE inventory
SET stock = stock - quantity
WHERE sku_id = ? AND stock >= quantity
```

## 状态机

```
pending → paid → shipped → completed
    ↓
cancelled（超时/用户取消）
    ↓
refunded（退款）
```
