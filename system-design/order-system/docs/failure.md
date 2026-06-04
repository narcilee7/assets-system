# Failure Mode

## F1: 库存超卖

### 场景

并发下单，库存为负数。

### 应对

乐观锁 + 库存扣减条件：

```sql
UPDATE inventory SET stock = stock - ? WHERE sku_id = ? AND stock >= ?
```

---

## F2: 重复下单

### 场景

用户双击按钮，生成两个订单。

### 应对

幂等 token 或唯一键约束。

---

## F3: 订单状态不一致

### 场景

支付回调重复或丢失。

### 应对

幂等 + 状态机校验。
