# SQL 场景题

这里的题目按真实业务场景组织，既考察 SQL 基本功，也考察对事务、索引、性能和高可用的深度理解。

---

## 场景一：电商订单系统

### 表结构

```sql
CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  product_id BIGINT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL,
  INDEX idx_stock (stock)
);

CREATE TABLE orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled') NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status_created (status, created_at)
);

CREATE TABLE order_items (
  item_id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  INDEX idx_order (order_id)
);
```

### 题目

#### 1. 查询用户最近 10 笔订单及每笔订单的商品数量

```sql
SELECT
  o.order_id,
  o.status,
  o.total_amount,
  o.created_at,
  COUNT(oi.item_id) AS item_count
FROM orders o
LEFT JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.user_id = ?
GROUP BY o.order_id
ORDER BY o.created_at DESC
LIMIT 10;
```

**追问**：
- 为什么 `GROUP BY o.order_id` 能工作？（MySQL 5.7+ 默认启用 ONLY_FULL_GROUP_BY，需要所有 SELECT 非聚合列都在 GROUP BY 中；这里其他列都函数依赖于 order_id。）
- `LEFT JOIN` 换成 `JOIN` 结果会不同吗？（如果订单一定包含商品，则结果相同；JOIN 通常性能更好。）

#### 2. 下单减库存

```sql
BEGIN;
SELECT stock FROM products WHERE product_id = ? FOR UPDATE;
-- 业务层判断 stock >= quantity
UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?;
INSERT INTO orders ...;
INSERT INTO order_items ...;
COMMIT;
```

**追问**：
- `FOR UPDATE` 是什么锁？（行级排他锁，阻止其他事务同时修改该行。）
- 如果大量用户抢同一商品，会出现什么问题？（锁冲突、并发度低、可能死锁。）
- 如何优化秒杀场景？（库存扣减放到 Redis 做令牌桶/预扣，再异步落库；或把 `UPDATE stock WHERE stock >= qty` 作为乐观锁，失败重试。）

#### 3. 统计每个用户过去 30 天的消费总额和订单数

```sql
SELECT
  user_id,
  COUNT(*) AS order_count,
  SUM(total_amount) AS total_spent
FROM orders
WHERE status IN ('paid', 'shipped')
  AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY user_id;
```

**追问**：
- 如果数据量很大，这个查询如何优化？（按 `created_at` 分区、增加覆盖索引 `(status, created_at, user_id, total_amount)`、或走列存/OLAP。）
- 为什么覆盖索引能加速？（索引包含所有查询字段，无需回表。）

---

## 场景二：社交网络好友与动态

### 表结构

```sql
CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(50) NOT NULL
);

CREATE TABLE friendships (
  user_id BIGINT NOT NULL,
  friend_id BIGINT NOT NULL,
  status ENUM('pending', 'accepted') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  INDEX idx_friend (friend_id)
);

CREATE TABLE posts (
  post_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at)
);

CREATE TABLE likes (
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id)
);
```

### 题目

#### 4. 查询用户的好友列表（双向关系）

```sql
SELECT friend_id AS user_id
FROM friendships
WHERE user_id = ? AND status = 'accepted'
UNION
SELECT user_id AS friend_id
FROM friendships
WHERE friend_id = ? AND status = 'accepted';
```

**追问**：
- 为什么用 `UNION` 而不是 `UNION ALL`？（为了避免当 A→B 和 B→A 同时存在时产生重复。）
- 如何设计表结构让查询更简单？（只存单向关系并约定 `user_id < friend_id`，但查询时仍需两个方向。）

#### 5. 分页查询用户的时间线（按时间倒序）

```sql
SELECT p.*
FROM posts p
WHERE p.user_id IN (
  SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted'
  UNION
  SELECT user_id FROM friendships WHERE friend_id = ? AND status = 'accepted'
)
ORDER BY p.created_at DESC
LIMIT ? OFFSET ?;
```

**追问**：
- 深分页 `OFFSET` 很大时有什么问题？（需要扫描并丢弃大量行，越来越慢。）
- 如何优化？（游标分页：用 `WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`；需要唯一排序键。）

#### 6. 查询每条动态的点赞数，并返回前 10 条最热门的动态

```sql
SELECT
  p.post_id,
  p.user_id,
  p.content,
  COUNT(l.user_id) AS like_count
FROM posts p
LEFT JOIN likes l ON p.post_id = l.post_id
GROUP BY p.post_id
ORDER BY like_count DESC
LIMIT 10;
```

**追问**：
- 数据量大时 `ORDER BY like_count` 为什么慢？（需要全表分组排序。）
- 工程上如何优化？（维护 `posts.like_count` 字段，点赞时 `UPDATE posts SET like_count = like_count + 1`；或引入 Redis 计数 + 定时回写。）

---

## 场景三：金融对账与排行榜

### 表结构

```sql
CREATE TABLE transactions (
  txn_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  amount DECIMAL(18, 4) NOT NULL,
  txn_type ENUM('deposit', 'withdraw', 'transfer') NOT NULL,
  status ENUM('success', 'failed', 'pending') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_status_created (status, created_at)
);
```

### 题目

#### 7. 计算每个用户每日余额变动

```sql
SELECT
  user_id,
  DATE(created_at) AS txn_date,
  SUM(CASE WHEN txn_type IN ('deposit', 'transfer') THEN amount ELSE -amount END) AS daily_change
FROM transactions
WHERE status = 'success'
GROUP BY user_id, DATE(created_at)
ORDER BY user_id, txn_date;
```

**追问**：
- 如果 `transfer` 需要区分转入转出，表结构如何调整？（增加 `direction` 或拆成 `from_user_id` / `to_user_id`。）
- 如何计算累计余额？（窗口函数 `SUM(...) OVER (PARTITION BY user_id ORDER BY txn_date ROWS UNBOUNDED PRECEDING)`。）

#### 8. 使用窗口函数计算用户累计余额

```sql
SELECT
  txn_id,
  user_id,
  created_at,
  amount,
  SUM(
    CASE WHEN txn_type IN ('deposit', 'transfer') THEN amount ELSE -amount END
  ) OVER (
    PARTITION BY user_id
    ORDER BY created_at, txn_id
    ROWS UNBOUNDED PRECEDING
  ) AS running_balance
FROM transactions
WHERE status = 'success';
```

**追问**：
- `ROWS` 和 `RANGE` 的区别？（`ROWS` 按物理行，`RANGE` 按逻辑值；相同时间戳下 `RANGE` 会把同值行一起算。）
- 窗口函数是在哪一步执行的？（在 `WHERE` 之后、`ORDER BY` 之前。）

#### 9. 查找连续 3 天以上有交易的用户

```sql
WITH daily AS (
  SELECT DISTINCT user_id, DATE(created_at) AS txn_date
  FROM transactions
  WHERE status = 'success'
),
numbered AS (
  SELECT
    user_id,
    txn_date,
    DATE_SUB(txn_date, INTERVAL ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY txn_date) DAY) AS grp
  FROM daily
)
SELECT user_id
FROM numbered
GROUP BY user_id, grp
HAVING COUNT(*) >= 3;
```

**追问**：
- 这种“连续日期”问题的核心技巧是什么？（构造等差分组：日期减去行号，连续日期会得到相同的 grp。）
- 如果按自然周分组，SQL 如何写？（用 `YEARWEEK(txn_date)` 或 `DATE_TRUNC('week', txn_date)`。）

---

## 场景四：组织架构与递归查询

### 表结构

```sql
CREATE TABLE employees (
  employee_id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  manager_id BIGINT,
  department VARCHAR(50),
  salary DECIMAL(12, 2),
  INDEX idx_manager (manager_id)
);
```

### 题目

#### 10. 查询某员工的所有下属（递归 CTE）

```sql
WITH RECURSIVE subordinates AS (
  SELECT employee_id, name, manager_id, 0 AS depth
  FROM employees
  WHERE employee_id = ?
  UNION ALL
  SELECT e.employee_id, e.name, e.manager_id, s.depth + 1
  FROM employees e
  INNER JOIN subordinates s ON e.manager_id = s.employee_id
)
SELECT * FROM subordinates;
```

**追问**：
- 递归 CTE 如何避免环？（MySQL 8.0 会默认检测环并报错；也可在表中维护 `path` 列做显式检测。）
- 如果层级很深，递归的性能如何？（层级深时递归 CTE 可能栈深过大；可改用闭包表或路径枚举。）

#### 11. 查询每个部门薪资排名前 3 的员工

```sql
SELECT *
FROM (
  SELECT
    employee_id,
    name,
    department,
    salary,
    DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rnk
  FROM employees
) ranked
WHERE rnk <= 3;
```

**追问**：
- `ROW_NUMBER`、`RANK`、`DENSE_RANK` 的区别？（ROW_NUMBER 不重复；RANK 跳号；DENSE_RANK 不跳号。）
- 并列薪资时如何决定前三？（取决于业务：DENSE_RANK 取所有并列，ROW_NUMBER 取固定 3 条。）

---

## 场景五：库存与仓库多对多

### 表结构

```sql
CREATE TABLE warehouses (
  warehouse_id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE inventory (
  product_id BIGINT NOT NULL,
  warehouse_id BIGINT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, warehouse_id)
);
```

### 题目

#### 12. 查询所有仓库总库存小于安全库存的商品

```sql
SELECT
  product_id,
  SUM(quantity) AS total_qty
FROM inventory
GROUP BY product_id
HAVING total_qty < ?;
```

**追问**：
- 如果某些商品在某些仓库没有记录，如何处理？（`LEFT JOIN warehouses` 并用 COALESCE 补 0，或业务上保证有 0 记录。）
- 如何快速判断“任意仓库缺货”？（`GROUP BY product_id, warehouse_id HAVING quantity < ?`。）

---

## 深度追问汇总

### 索引

1. 什么情况下索引会失效？
   - 对索引列做函数计算、`LIKE '%xxx'`、类型隐式转换、OR 条件不走同一个索引、不符合最左前缀。
2. 覆盖索引和回表是什么？
   - 覆盖索引：查询所需列全在索引中，无需访问聚簇索引。
   - 回表：先查二级索引拿到主键，再查聚簇索引取完整行。
3. 联合索引 `(a, b, c)` 能支持哪些查询？
   - `a` / `a,b` / `a,b,c` 最左前缀；`a,c` 只能用到 `a`；`b,c` 无法使用。

### 事务

1. 四种隔离级别分别解决什么问题？
   - 读未提交：无；读已提交：解决脏读；可重复读：解决不可重复读；串行化：解决幻读。
2. MySQL 默认隔离级别是什么？如何解决幻读？
   - 可重复读（RR）；通过 MVCC + 间隙锁（Gap Lock）解决幻读。
3. 什么是 MVCC？
   - 多版本并发控制：每行记录保存创建版本号和删除版本号，事务读取符合其可见性规则的版本，避免读写阻塞。

### 性能

1. 慢查询优化的标准流程？
   - 开启慢日志 → EXPLAIN 分析 → 确认索引 → 确认 SQL 写法 → 确认数据量和分页方式 → 分库分表或引入缓存/OLAP。
2. 大表分页怎么做？
   - 游标分页（推荐）；或子查询先定位 id 再 JOIN。
3. 分库分表后全局排序/聚合怎么做？
   - 各分片局部排序/聚合，中间层归并；或把聚合结果写入宽表/OLAP。

### 高可用

1. 主从延迟会导致什么问题？
   - 读写分离时读到旧数据；需要业务容忍或强制走主库。
2. 分库分表策略有哪些？
   - 按用户 ID 取模、按时间范围、按地域、按业务维度；常用分片键 + 映射表。
3. 分布式事务的常用方案？
   - 2PC、TCC、Saga、本地消息表 / Outbox；根据一致性和性能要求选择。

---

## 场景六：日志与埋点分析

### 表结构

```sql
CREATE TABLE events (
  event_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_name VARCHAR(50) NOT NULL,
  properties JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name_time (event_name, created_at),
  INDEX idx_user_time (user_id, created_at)
);
```

### 题目

#### 13. 计算某事件每日 UV 和 PV

```sql
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS pv,
  COUNT(DISTINCT user_id) AS uv
FROM events
WHERE event_name = 'page_view'
GROUP BY DATE(created_at)
ORDER BY day;
```

**深度分析**：
- `COUNT(DISTINCT user_id)` 在数据量大时需要去重，消耗内存；可维护每日 UV 预聚合表。
- 如果按分钟级聚合，基数爆炸；可分层聚合：分钟 → 小时 → 天。
- JSON 字段上的过滤通常无法使用索引；高频过滤字段应抽成独立列。

#### 14. 漏斗分析：从首页到支付页的转化

```sql
WITH funnel AS (
  SELECT
    user_id,
    MAX(CASE WHEN event_name = 'home_view' THEN created_at END) AS t1,
    MAX(CASE WHEN event_name = 'product_view' THEN created_at END) AS t2,
    MAX(CASE WHEN event_name = 'pay_click' THEN created_at END) AS t3
  FROM events
  WHERE event_name IN ('home_view', 'product_view', 'pay_click')
    AND created_at >= '2024-01-01'
    AND created_at < '2024-01-08'
  GROUP BY user_id
)
SELECT
  COUNT(*) AS home_view_users,
  COUNT(t2) AS product_view_users,
  COUNT(t3) AS pay_click_users,
  COUNT(t3) / COUNT(*) AS conversion_rate
FROM funnel;
```

**追问**：
- 如何限定时间窗口内完成？（加 `WHERE t2 >= t1 AND t3 >= t2` 在最终 SELECT 中。）
- 大数据量下如何优化？（预计算漏斗中间表，或导入 ClickHouse/Doris 等 OLAP。）

---

## 场景七：A/B 实验平台

### 表结构

```sql
CREATE TABLE experiments (
  exp_id BIGINT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP
);

CREATE TABLE experiment_users (
  exp_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  variant CHAR(1) NOT NULL, -- 'A' or 'B'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exp_id, user_id),
  INDEX idx_variant (exp_id, variant)
);

CREATE TABLE experiment_metrics (
  exp_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  metric_value DECIMAL(18, 4) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exp_id, user_id, metric_name),
  INDEX idx_metric (exp_id, metric_name)
);
```

### 题目

#### 15. 统计每个实验分组的均值和人数

```sql
SELECT
  eu.variant,
  em.metric_name,
  COUNT(DISTINCT em.user_id) AS user_count,
  AVG(em.metric_value) AS avg_value,
  SUM(em.metric_value) AS total_value
FROM experiment_users eu
LEFT JOIN experiment_metrics em
  ON eu.exp_id = em.exp_id AND eu.user_id = em.user_id
WHERE eu.exp_id = ?
GROUP BY eu.variant, em.metric_name;
```

**深度分析**：
- 必须 `JOIN ON exp_id + user_id`，否则不同实验的用户会错配。
- `LEFT JOIN` 保留未产生指标的用户，便于计算转化率分母。
- 置信区间和显著性检验通常在应用层或 Python/R 中计算，SQL 只负责聚合。

#### 16. 找出只进入实验 A 组但产生了 B 组指标的数据异常

```sql
SELECT DISTINCT em.user_id
FROM experiment_metrics em
WHERE em.exp_id = ?
  AND em.user_id NOT IN (
    SELECT user_id FROM experiment_users
    WHERE exp_id = ? AND variant = 'A'
  );
```

**追问**：
- `NOT IN` 有什么风险？（子查询返回 NULL 时结果为空；应用 `NOT EXISTS` 更安全。）
- 如何写更安全的版本？

```sql
SELECT DISTINCT em.user_id
FROM experiment_metrics em
WHERE em.exp_id = ?
  AND NOT EXISTS (
    SELECT 1 FROM experiment_users eu
    WHERE eu.exp_id = em.exp_id AND eu.user_id = em.user_id AND eu.variant = 'A'
  );
```

---

## 场景八：订阅与账单系统

### 表结构

```sql
CREATE TABLE subscriptions (
  sub_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status ENUM('active', 'cancelled', 'expired') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  INDEX idx_user (user_id),
  INDEX idx_dates (start_date, end_date)
);
```

### 题目

#### 17. 查询某月活跃订阅数和总收入

```sql
SELECT
  COUNT(*) AS active_subs,
  SUM(amount) AS monthly_revenue
FROM subscriptions
WHERE status = 'active'
  AND start_date <= LAST_DAY(?)
  AND (end_date IS NULL OR end_date >= ?);
```

**深度分析**：
- 时间区间重叠查询是经典场景：A 区间与 B 区间重叠的条件是 `A.start <= B.end AND A.end >= B.start`。
- 如果 end_date 可能为 NULL 表示无限期，必须用 `IS NULL OR` 处理。
- 可维护月度汇总表，避免每次扫描全表。

#### 18. 查询每个用户的订阅历史窗口（LEAD / LAG）

```sql
SELECT
  sub_id,
  user_id,
  start_date,
  end_date,
  LAG(end_date) OVER (PARTITION BY user_id ORDER BY start_date) AS prev_end_date,
  DATEDIFF(start_date, LAG(end_date) OVER (PARTITION BY user_id ORDER BY start_date)) AS gap_days
FROM subscriptions;
```

**追问**：
- 如何找出有断档的用户？（`WHERE gap_days > 1`。）
- `LEAD` 和 `LAG` 的默认行为？（默认取当前分区排序后的前后行，NULL 可设默认值。）

---

## 场景九：网约车订单与派单

### 表结构

```sql
CREATE TABLE rides (
  ride_id BIGINT PRIMARY KEY,
  passenger_id BIGINT NOT NULL,
  driver_id BIGINT,
  status ENUM('requested', 'assigned', 'ongoing', 'completed', 'cancelled') NOT NULL,
  pickup_lng DECIMAL(10, 7) NOT NULL,
  pickup_lat DECIMAL(10, 7) NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_status_requested (status, requested_at),
  INDEX idx_driver (driver_id, requested_at)
);
```

### 题目

#### 19. 计算每个司机每日完成单量和收入

```sql
SELECT
  driver_id,
  DATE(completed_at) AS day,
  COUNT(*) AS completed_rides,
  SUM(fare) AS daily_fare
FROM rides
WHERE status = 'completed'
  AND completed_at >= ? AND completed_at < ?
GROUP BY driver_id, DATE(completed_at);
```

**追问**：
- 司机 ID 为 NULL 的订单怎么处理？（未派单的订单会被过滤或单独统计。）
- 如何发现刷单？（同一乘客+司机组合高频出现、短时间密集完单。）

#### 20. 地理围栏：查询某点 5km 内的待接单司机

```sql
-- 先用经纬度范围粗筛，再用 Haversine 公式精算
SELECT
  driver_id,
  lng,
  lat,
  6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(lat - ?) / 2), 2) +
    COS(RADIANS(?)) * COS(RADIANS(lat)) *
    POWER(SIN(RADIANS(lng - ?) / 2), 2)
  )) AS distance_km
FROM drivers
WHERE status = 'available'
  AND lng BETWEEN ? AND ?
  AND lat BETWEEN ? AND ?
HAVING distance_km <= 5
ORDER BY distance_km
LIMIT 10;
```

**深度分析**：
- 直接用 Haversine 全表扫描不可扩展；先用 BBOX 粗筛减少计算量。
- 生产环境用 GeoHash、PostGIS、Redis Geo 或 Elasticsearch Geo 查询。
- MySQL 8.0 支持 Spatial 索引，可替代手写距离计算。

---

## 场景十：内容审核与风控

### 表结构

```sql
CREATE TABLE content (
  content_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content_text TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_created (status, created_at)
);

CREATE TABLE content_reviews (
  review_id BIGINT PRIMARY KEY,
  content_id BIGINT NOT NULL,
  reviewer_id BIGINT NOT NULL,
  decision ENUM('approved', 'rejected') NOT NULL,
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content (content_id),
  INDEX idx_reviewer (reviewer_id, reviewed_at)
);
```

### 题目

#### 21. 计算审核员的日均处理量和准确率

```sql
WITH daily AS (
  SELECT
    reviewer_id,
    DATE(reviewed_at) AS day,
    COUNT(*) AS total_reviews,
    SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END) AS rejections
  FROM content_reviews
  WHERE reviewed_at >= ? AND reviewed_at < ?
  GROUP BY reviewer_id, DATE(reviewed_at)
)
SELECT
  reviewer_id,
  AVG(total_reviews) AS avg_daily_volume,
  SUM(rejections) / SUM(total_reviews) AS rejection_rate
FROM daily
GROUP BY reviewer_id;
```

**追问**：
- 如何关联后续申诉结果来评估准确率？（需要申诉表，按 content_id JOIN。）
- 审核员之间差异大如何发现？（用标准差或箱线图识别异常。）

#### 22. 找出多次发布违规内容的用户

```sql
SELECT
  c.user_id,
  COUNT(*) AS rejected_count,
  MAX(c.created_at) AS last_rejected_at
FROM content c
WHERE c.status = 'rejected'
GROUP BY c.user_id
HAVING COUNT(*) >= 3
ORDER BY rejected_count DESC;
```

**追问**：
- 如果内容先通过后被申诉下架，如何调整查询？（需要看 content_reviews 最新决策，或维护 content.status 的变更历史。）
- 如何防止误伤正常用户？（结合时间窗口、申诉成功率、内容相似度。）

---

## SQL 反模式与重构

### 反模式 1：SELECT *

```sql
-- 坏
SELECT * FROM orders WHERE user_id = ?;

-- 好
SELECT order_id, status, total_amount, created_at
FROM orders
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 20;
```

### 反模式 2：隐式类型转换

```sql
-- 坏：phone 是字符串，传入数字导致索引失效
SELECT * FROM users WHERE phone = 13800138000;

-- 好
SELECT * FROM users WHERE phone = '13800138000';
```

### 反模式 3：大 IN 列表

```sql
-- 坏：IN 列表过长（>1000）导致解析和执行计划劣化
SELECT * FROM orders WHERE order_id IN (?, ?, ?, ...);

-- 好：拆成临时表或 JOIN
SELECT o.*
FROM orders o
JOIN tmp_order_ids t ON o.order_id = t.order_id;
```

### 反模式 4：分页用 OFFSET 深翻页

```sql
-- 坏
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10 OFFSET 100000;

-- 好：游标分页
SELECT * FROM orders
WHERE created_at < ? OR (created_at = ? AND order_id < ?)
ORDER BY created_at DESC, order_id DESC
LIMIT 10;
```

### 反模式 5：子查询相关列未索引

```sql
-- 坏：b.user_id 无索引
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM blacklists b WHERE b.user_id = u.user_id);

-- 好：确保 blacklists.user_id 有索引
```

---

## 索引设计工作坊

### 案例：电商订单表

```sql
CREATE TABLE orders (
  order_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  country_code CHAR(2) NOT NULL
);
```

**常见查询**：
1. `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10;`
   - 索引：`(user_id, created_at)`
2. `SELECT COUNT(*), SUM(total_amount) FROM orders WHERE status = ? AND created_at >= ? AND created_at < ?;`
   - 索引：`(status, created_at, total_amount)` 覆盖索引
3. `SELECT * FROM orders WHERE country_code = ? AND status = ? ORDER BY created_at DESC;`
   - 索引：`(country_code, status, created_at)`

**设计原则**：
- 等值查询列放前面，范围查询列放后面。
- 排序列加入索引可避免 filesort。
- 频繁查询的列组合考虑覆盖索引。
- 索引不是越多越好，写操作需要维护索引。

---

## 事务与锁实验

### 实验 1：脏读

| 时刻 | 事务 A | 事务 B |
| --- | --- | --- |
| T1 | BEGIN; UPDATE accounts SET balance = 900 WHERE id = 1; | |
| T2 | | BEGIN; SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SELECT balance FROM accounts WHERE id = 1; -- 读到 900 |
| T3 | ROLLBACK; | |

**结论**：READ UNCOMMITTED 会出现脏读；生产环境禁用。

### 实验 2：不可重复读

| 时刻 | 事务 A | 事务 B |
| --- | --- | --- |
| T1 | BEGIN; SELECT balance FROM accounts WHERE id = 1; -- 1000 | |
| T2 | | BEGIN; UPDATE accounts SET balance = 900 WHERE id = 1; COMMIT; |
| T3 | SELECT balance FROM accounts WHERE id = 1; -- READ COMMITTED 读到 900，REPEATABLE READ 读到 1000 | |

**结论**：RR 通过 MVCC 保证同一事务内多次读取一致。

### 实验 3：幻读

| 时刻 | 事务 A | 事务 B |
| --- | --- | --- |
| T1 | BEGIN; SELECT * FROM accounts WHERE balance > 500; -- 2 条 | |
| T2 | | BEGIN; INSERT INTO accounts (id, balance) VALUES (3, 800); COMMIT; |
| T3 | SELECT * FROM accounts WHERE balance > 500; -- RR + 间隙锁仍 2 条；RC 可能 3 条 | |

**结论**：MySQL InnoDB 在 RR 下通过间隙锁 + MVCC 解决幻读。

### 实验 4：死锁

```sql
-- 事务 A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- 事务 B
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 2;
-- 事务 A
UPDATE accounts SET balance = balance + 100 WHERE id = 2; -- 等待 B
-- 事务 B
UPDATE accounts SET balance = balance + 100 WHERE id = 1; -- 等待 A，死锁
```

**避免死锁**：
- 固定加锁顺序。
- 一次性获取所有锁。
- 设置锁等待超时，失败重试。
- 减少事务长度。

---

## 执行计划解读

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 10;
```

关键字段：

| 字段 | 含义 |
| --- | --- |
| type | 访问类型：system > const > eq_ref > ref > range > index > ALL |
| key | 实际使用的索引 |
| rows | 预估扫描行数 |
| Extra | Using index（覆盖索引）、Using where、Using filesort（需要避免）、Using temporary |

**优化目标**：
- type 至少达到 range。
- 避免 Using filesort 和 Using temporary。
- rows 尽量小。

---

## 分库分表后的 SQL 改写

### 按 user_id 取模分 16 库

原始 SQL：

```sql
SELECT * FROM orders WHERE order_id = ?;
```

问题：order_id 不是分片键，需要广播到 16 个库。

优化方案：
1. 建立 `order_id → user_id` 映射表，先查 user_id，再路由到具体分片。
2. 或在 order_id 中嵌入 user_id 分片信息。

### 跨分片聚合

原始 SQL：

```sql
SELECT status, COUNT(*) FROM orders GROUP BY status;
```

改写：
1. 每个分片执行 `SELECT status, COUNT(*) AS c FROM orders GROUP BY status`。
2. 中间层汇总：`SELECT status, SUM(c) FROM shard_results GROUP BY status`。

### 跨分片排序分页

原始 SQL：

```sql
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10 OFFSET 20;
```

改写：
1. 每个分片取 TOP (offset + limit) = TOP 30。
2. 中间层归并排序后取 21-30。
3. 深分页时代价极高，应改用游标分页并限制跨分片排序场景。

---

## 开放设计题

1. 设计一个支持 10 亿订单的订单表，要求支持按用户查询、按时间范围统计、按订单 ID 查询，写出 schema 和核心索引。
2. 设计一个实时排行榜，要求支持全服排名、好友排名、日榜/周榜/月榜，讨论 SQL + 缓存方案。
3. 设计一个 IM 消息系统，要求支持单聊、群聊、历史消息漫游、未读数，写出核心表结构。
4. 设计一个电商库存系统，要求支持多仓库、预售、秒杀，讨论扣库存的 SQL 和一致性方案。
5. 设计一个内容推荐系统的用户行为表，要求支持实时特征拼接和离线分析，讨论表结构和存储选型。

---

## 面试应答框架

遇到 SQL 场景题时，按以下结构回答：

1. **确认需求**：边界条件、数据量、并发量、一致性要求。
2. **设计 schema**：主键、索引、字段类型、是否需要分区。
3. **写 SQL**：先写能跑通的版本，再谈优化。
4. **谈索引**：加什么索引、为什么、覆盖索引是否可行。
5. **谈事务**：是否需要事务、隔离级别、锁范围、死锁风险。
6. **谈扩展**：数据量增长后的演进（分库分表、缓存、OLAP）。
7. **谈陷阱**：NULL、隐式转换、深分页、大 IN 列表、N+1 查询。

---

## SQL 速查表

### 字符串与日期

| 需求 | MySQL | PostgreSQL |
| --- | --- | --- |
| 当前时间 | `NOW()` | `NOW()` |
| 日期格式化 | `DATE_FORMAT(created_at, '%Y-%m')` | `TO_CHAR(created_at, 'YYYY-MM')` |
| 字符串拼接 | `CONCAT(a, b)` | `a \|\| b` |
| 子串 | `SUBSTRING(str, 1, 5)` | `SUBSTRING(str FROM 1 FOR 5)` |
| 判断 NULL | `IFNULL(col, 0)` | `COALESCE(col, 0)` |
| 条件判断 | `IF(cond, a, b)` | `CASE WHEN cond THEN a ELSE b END` |

### 聚合与窗口

```sql
-- 累计和
SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at)

-- 排名
ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC)
RANK() OVER (PARTITION BY dept ORDER BY salary DESC)
DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC)

-- 前/后行
LAG(col, 1, default) OVER (ORDER BY ts)
LEAD(col, 1, default) OVER (ORDER BY ts)

-- 分桶
NTILE(4) OVER (ORDER BY score)
```

### 递归 CTE

```sql
WITH RECURSIVE cte AS (
  SELECT ... FROM ... WHERE ...           -- 锚点
  UNION ALL
  SELECT ... FROM ... JOIN cte ON ...     -- 递归
)
SELECT * FROM cte;
```

### JSON 操作

```sql
-- MySQL
SELECT JSON_EXTRACT(properties, '$.sku') FROM events;
SELECT * FROM events WHERE JSON_CONTAINS(properties, '"mobile"', '$.tags');

-- PostgreSQL
SELECT properties ->> 'sku' FROM events;
SELECT * FROM events WHERE properties -> 'tags' ? 'mobile';
```

---

## MySQL vs PostgreSQL 选型对比

| 维度 | MySQL（InnoDB） | PostgreSQL |
| --- | --- | --- |
| 默认隔离级别 | RR | RC |
| 窗口函数 / CTE | 8.0+ 支持 | 原生强力支持 |
| JSON | JSON / JSONB 较弱 | JSONB 索引、GIN 索引 |
| GIS | Spatial 扩展 | PostGIS 业界最强 |
| 全文检索 | MyISAM / InnoDB 有限 | 内置 + 多语言 |
| 扩展性 | 插件少 | 扩展丰富 |
| 主从复制 | 成熟、文档多 | 物理/逻辑复制 |
| 写入性能 | 通常更高 | 功能多但略重 |
| 复杂查询 | 够用 | 更优 |

**选型建议**：
- 高并发 OLTP、简单查询、团队熟悉 → MySQL。
- 复杂分析、JSON/GIS/全文检索、需要高级类型 → PostgreSQL。

---

## 什么时候 SQL 不够？

| 场景 | 问题 | 方案 |
| --- | --- | --- |
| 超高并发 KV | 行锁竞争激烈 | Redis / Memcached |
| 海量日志分析 | 聚合慢、存储贵 | ClickHouse / Doris / BigQuery |
| 图关系查询 | 多层 JOIN 爆炸 | Neo4j / Dgraph |
| 文档型数据 | schema 灵活度高 | MongoDB / ElasticSearch |
| 时序数据 | 时间范围查询多 | InfluxDB / TimescaleDB |
| 搜索 | 分词、相关性排序 | ElasticSearch / Meilisearch |

---

## 高频面试题应答脚本

### Q1：慢查询怎么优化？

1. 确认是否真的慢：看 QPS、RT 分布、是否偶发。
2. 看执行计划：重点看 type、key、rows、Extra。
3. 确认索引：是否符合最左前缀，是否需要覆盖索引。
4. 改写 SQL：避免 SELECT *、大 IN、函数计算、隐式转换。
5. 优化分页：深分页改游标分页。
6. 架构层优化：读写分离、缓存、OLAP、分库分表。

### Q2：MySQL 如何解决幻读？

1. 隔离级别 RR 下，快照读通过 MVCC 保证一致性视图。
2. 当前读（`FOR UPDATE` / `LOCK IN SHARE MODE`）通过间隙锁和 next-key lock 锁定范围，阻止幻行插入。
3. 注意：纯 SELECT（快照读）不会阻塞插入；只有当前读才会加间隙锁。

### Q3：分库分表后怎么保证唯一 ID？

1. 自增 ID 分段：不同分片起始值不同，但扩展性差。
2. 雪花算法：时间戳 + 机器号 + 序列号，趋势递增。
3. 数据库号段：批量取号，性能高但有单点。
4. UUID：无序，索引性能差，不推荐做主键。
5. 推荐：雪花算法或号段模式，视业务对连续性和性能的要求。

### Q4：大表 DDL 怎么做？

1. MySQL 5.6+ 支持 Online DDL，但大表仍可能锁表或复制延迟。
2. 使用 pt-online-schema-change 或 gh-ost：建新表、加触发器同步、切表。
3. 双写方案：应用同时写旧表和新表，验证后切换读流量。
4. 提前在低峰期执行，监控主从延迟。

### Q5：为什么叫覆盖索引？

1. 查询所需的所有字段都在二级索引中。
2. 引擎只需扫描索引树，不需要回表查聚簇索引。
3. 可以减少随机 IO，显著提升查询性能。
4. 代价是索引变大，写操作维护成本增加。

---

## 学习路径

```text
基础语法 → JOIN / 子查询 → 聚合与 GROUP BY → 窗口函数 → CTE 递归
  → 索引原理 → 执行计划 → 事务隔离 → 锁与死锁 → 慢查询优化
    → 分区 → 主从复制 → 分库分表 → OLAP / NoSQL 选型
```

建议配合实际数据库动手跑每个场景的 SQL，用 `EXPLAIN` 验证索引是否生效。
