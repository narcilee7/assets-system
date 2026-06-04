# Observability

## 核心指标

```prometheus
# 订单量
order_created_total 12345
order_paid_total 12300
order_cancelled_total 45

# 库存
inventory_stock_out_total 10  # 库存售罄

# 延迟
order_create_latency_seconds{quantile="0.99"} 0.023
```

## 告警

| 告警 | 条件 |
|-------|------|
| 库存不足 | stock < 10 |
| 下单失败率 | > 1% |
