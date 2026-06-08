# 数据库设计

## 1. 范式与反范式

```
第一范式 (1NF)：属性原子性
  ├── 每个字段不可再分
  └── ❌ {name: "张三", phones: ["138", "139"]} → ✅ 拆分为多条记录或单独表

第二范式 (2NF)：消除部分依赖
  ├── 非主属性完全依赖于主键
  └── 适用于复合主键场景

第三范式 (3NF)：消除传递依赖
  ├── 非主属性不依赖于其他非主属性
  └── ❌ 用户表含 {city_name, city_code} → ✅ 拆分为城市表

BCNF：消除主属性对键的依赖
  ├── 每个决定因素都是候选键
  └── 更严格的 3NF

反范式：有意引入冗余以提升查询性能
  ├── 冗余字段减少 JOIN
  ├── 汇总表加速统计
  └── 物化视图缓存复杂查询
```

```sql
-- 规范化示例

-- 3NF 设计
CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  city_id INT,
  FOREIGN KEY (city_id) REFERENCES cities(id)
);

CREATE TABLE cities (
  id INT PRIMARY KEY,
  name VARCHAR(50),
  code VARCHAR(10)
);

-- 反范式：为高频查询冗余 city_name
CREATE TABLE users_denormalized (
  id BIGINT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  city_id INT,
  city_name VARCHAR(50),  -- 冗余
  INDEX idx_city (city_name)
);

-- 数据同步触发器或应用层维护冗余
```

## 2. 索引策略

```sql
-- B+Tree 索引（默认）
CREATE INDEX idx_user_email ON users(email);
CREATE UNIQUE INDEX idx_user_phone ON users(phone);

-- 复合索引（最左前缀原则）
CREATE INDEX idx_user_status_created 
  ON users(status, created_at);
-- WHERE status = 'active' ✓
-- WHERE status = 'active' AND created_at > '2024-01-01' ✓
-- WHERE created_at > '2024-01-01' ✗（不命中）

-- 覆盖索引
CREATE INDEX idx_user_covering 
  ON users(status, created_at, id, name);
-- SELECT id, name FROM users WHERE status = 'active' AND created_at > '2024-01-01'
-- 不需要回表，索引即数据

-- 前缀索引（长文本）
CREATE INDEX idx_user_bio ON users(bio(100));

-- 函数索引（PostgreSQL/MySQL 8.0+）
CREATE INDEX idx_user_email_lower ON users(LOWER(email));

-- 倒排索引（全文搜索）
CREATE FULLTEXT INDEX idx_article_content ON articles(content);

-- 位图索引（OLAP，低基数列）
-- PostgreSQL 通过 BRIN 近似支持
```

```
索引设计原则
├── 高选择性列建索引（区分度 > 10%）
├── WHERE / JOIN / ORDER BY 字段建索引
├── 避免过多索引（写放大、空间占用）
├── 覆盖索引减少回表
├── 定期分析慢查询优化索引
└── 删除未使用索引

索引失效场景
├── 对索引列做函数运算：WHERE YEAR(created_at) = 2024
├── 隐式类型转换：WHERE phone = 13800138000（phone 是 varchar）
├── 范围查询后列不命中：INDEX(a,b,c)，WHERE a=1 AND b>2 AND c=3（c 不命中）
├── LIKE '%xxx' 前缀模糊
├── OR 条件未全部索引
└── 数据分布不均导致优化器放弃索引
```

## 3. 分区表

```sql
-- MySQL 范围分区
CREATE TABLE logs (
  id BIGINT AUTO_INCREMENT,
  message TEXT,
  created_at DATETIME,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2022 VALUES LESS THAN (2023),
  PARTITION p2023 VALUES LESS THAN (2024),
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION pfuture VALUES LESS THAN MAXVALUE
);

-- 分区裁剪
EXPLAIN SELECT * FROM logs WHERE created_at >= '2024-01-01';
-- 只扫描 p2024 和 pfuture 分区

-- PostgreSQL 声明式分区
CREATE TABLE measurements (
  city_id INT,
  logdate DATE,
  peaktemp INT
) PARTITION BY RANGE (logdate);

CREATE TABLE measurements_y2024m01 
  PARTITION OF measurements
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- 自动分区（pg_partman / TimescaleDB）
```

| 分区类型 | 适用场景 | 注意 |
|----------|----------|------|
| RANGE | 时间序列、按日期归档 | 需定期添加新分区 |
| LIST | 按类别（地区、状态） | 类别数量可控 |
| HASH | 均匀分布、避免热点 | 不易清理历史数据 |
| 复合 | RANGE + HASH | 时间 + 用户 ID |

## 4. ER 建模实战

```
电商系统 ER 建模

users (用户)
  ├── id PK
  ├── username
  ├── email
  ├── created_at
  └── 1:N orders

products (商品)
  ├── id PK
  ├── name
  ├── price
  ├── stock
  ├── category_id FK
  └── N:M orders (via order_items)

categories (分类)
  ├── id PK
  ├── name
  └── parent_id (自引用，树结构)

orders (订单)
  ├── id PK
  ├── user_id FK
  ├── status (pending/paid/shipped)
  ├── total_amount
  ├── created_at
  └── 1:N order_items

order_items (订单项)
  ├── id PK
  ├── order_id FK
  ├── product_id FK
  ├── quantity
  ├── unit_price (快照，反范式)
  └── subtotal

inventory (库存)
  ├── product_id PK/FK
  ├── quantity
  ├── reserved
  └── version (乐观锁)
```

```sql
-- 关键约束设计
CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled') DEFAULT 'pending',
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_orders_user 
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT,  -- 禁止删除有订单的用户
  
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status_created (status, created_at)
) ENGINE=InnoDB;

-- 乐观锁防止超卖
CREATE TABLE inventory (
  product_id BIGINT PRIMARY KEY,
  quantity INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0,
  
  CONSTRAINT chk_quantity CHECK (quantity >= reserved),
  
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 扣减库存（乐观锁）
UPDATE inventory 
SET quantity = quantity - ?, 
    reserved = reserved + ?,
    version = version + 1
WHERE product_id = ? 
  AND version = ? 
  AND quantity - reserved >= ?;
-- 影响行数为 0 表示并发冲突
```
