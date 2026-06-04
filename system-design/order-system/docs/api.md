# API

## Order API

### 创建订单

```http
POST /v1/orders
Content-Type: application/json

{
  "items": [
    {"sku_id": "sku-001", "quantity": 2}
  ],
  "address_id": "addr-abc",
  "payment_method": "alipay"
}
```

### 查询订单

```http
GET /v1/orders/{order_id}
```

### 取消订单

```http
DELETE /v1/orders/{order_id}
```

### 支付回调

```http
POST /v1/orders/{order_id}/pay
Content-Type: application/json

{
  "trade_no": "alipay-trade-no"
}
```

## Event Contract

| Event | 触发时机 |
|-------|---------|
| `order.created` | 订单创建 |
| `order.paid` | 支付成功 |
| `order.cancelled` | 订单取消 |
| `order.refunded` | 退款完成 |
