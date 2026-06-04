# Data Model

## 订单表

```sql
CREATE TABLE orders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    status ENUM('pending','paid','shipped','completed','cancelled','refunded'),

    total_amount DECIMAL(10,2),
    paid_at TIMESTAMP,

    INDEX idx_user (user_id),
    INDEX idx_status (status)
);
```

## 订单项表

```sql
CREATE TABLE order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64),
    sku_id VARCHAR(64),
    quantity INT
);
```

## 库存预占表

```sql
CREATE TABLE inventory_preorder (
    sku_id VARCHAR(64),
    quantity INT,
    reserved_until TIMESTAMP
);
```
