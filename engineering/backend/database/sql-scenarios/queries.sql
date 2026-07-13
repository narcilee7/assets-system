-- SQL 场景题：核心查询汇总
-- 配合 schema.sql 使用

-- 1. 用户最近 10 笔订单及商品数量
SELECT
  o.order_id, o.status, o.total_amount, o.created_at,
  COUNT(oi.item_id) AS item_count
FROM orders o
LEFT JOIN order_items oi ON o.order_id = oi.order_id
WHERE o.user_id = ?
GROUP BY o.order_id
ORDER BY o.created_at DESC
LIMIT 10;

-- 2. 下单减库存（事务内）
BEGIN;
SELECT stock FROM products WHERE product_id = ? FOR UPDATE;
UPDATE products SET stock = stock - ?
WHERE product_id = ? AND stock >= ?;
INSERT INTO orders (order_id, user_id, status, total_amount) VALUES (?, ?, 'pending', ?);
INSERT INTO order_items (item_id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?);
COMMIT;

-- 3. 用户过去 30 天消费总额和订单数
SELECT
  user_id,
  COUNT(*) AS order_count,
  SUM(total_amount) AS total_spent
FROM orders
WHERE status IN ('paid', 'shipped')
  AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY user_id;

-- 4. 好友列表（双向）
SELECT friend_id AS user_id
FROM friendships
WHERE user_id = ? AND status = 'accepted'
UNION
SELECT user_id AS friend_id
FROM friendships
WHERE friend_id = ? AND status = 'accepted';

-- 5. 时间线分页（游标）
SELECT *
FROM posts
WHERE user_id IN (?, ?, ?)
  AND (created_at < ? OR (created_at = ? AND post_id < ?))
ORDER BY created_at DESC, post_id DESC
LIMIT 10;

-- 6. 动态点赞数 TOP 10
SELECT
  p.post_id, p.user_id, p.content,
  COUNT(l.user_id) AS like_count
FROM posts p
LEFT JOIN likes l ON p.post_id = l.post_id
GROUP BY p.post_id
ORDER BY like_count DESC
LIMIT 10;

-- 7. 用户每日余额变动
SELECT
  user_id,
  DATE(created_at) AS txn_date,
  SUM(CASE WHEN txn_type IN ('deposit', 'transfer') THEN amount ELSE -amount END) AS daily_change
FROM transactions
WHERE status = 'success'
GROUP BY user_id, DATE(created_at)
ORDER BY user_id, txn_date;

-- 8. 窗口函数累计余额
SELECT
  txn_id, user_id, created_at, amount,
  SUM(CASE WHEN txn_type IN ('deposit', 'transfer') THEN amount ELSE -amount END)
    OVER (PARTITION BY user_id ORDER BY created_at, txn_id ROWS UNBOUNDED PRECEDING) AS running_balance
FROM transactions
WHERE status = 'success';

-- 9. 连续 3 天以上有交易的用户
WITH daily AS (
  SELECT DISTINCT user_id, DATE(created_at) AS txn_date
  FROM transactions WHERE status = 'success'
),
numbered AS (
  SELECT
    user_id, txn_date,
    DATE_SUB(txn_date, INTERVAL ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY txn_date) DAY) AS grp
  FROM daily
)
SELECT user_id
FROM numbered
GROUP BY user_id, grp
HAVING COUNT(*) >= 3;

-- 10. 递归查询下属
WITH RECURSIVE subordinates AS (
  SELECT employee_id, name, manager_id, 0 AS depth
  FROM employees WHERE employee_id = ?
  UNION ALL
  SELECT e.employee_id, e.name, e.manager_id, s.depth + 1
  FROM employees e
  INNER JOIN subordinates s ON e.manager_id = s.employee_id
)
SELECT * FROM subordinates;

-- 11. 部门薪资前三
SELECT *
FROM (
  SELECT
    employee_id, name, department, salary,
    DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS rnk
  FROM employees
) ranked
WHERE rnk <= 3;

-- 12. 总库存低于安全库存的商品
SELECT product_id, SUM(quantity) AS total_qty
FROM inventory
GROUP BY product_id
HAVING total_qty < ?;

-- 13. 事件每日 UV/PV
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS pv,
  COUNT(DISTINCT user_id) AS uv
FROM events
WHERE event_name = 'page_view'
GROUP BY DATE(created_at)
ORDER BY day;

-- 14. 漏斗分析
WITH funnel AS (
  SELECT
    user_id,
    MAX(CASE WHEN event_name = 'home_view' THEN created_at END) AS t1,
    MAX(CASE WHEN event_name = 'product_view' THEN created_at END) AS t2,
    MAX(CASE WHEN event_name = 'pay_click' THEN created_at END) AS t3
  FROM events
  WHERE event_name IN ('home_view', 'product_view', 'pay_click')
    AND created_at >= '2024-01-01' AND created_at < '2024-01-08'
  GROUP BY user_id
)
SELECT
  COUNT(*) AS home_view_users,
  COUNT(t2) AS product_view_users,
  COUNT(t3) AS pay_click_users,
  COUNT(t3) / COUNT(*) AS conversion_rate
FROM funnel;

-- 15. 实验分组统计
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

-- 16. 异常指标数据（NOT EXISTS 版）
SELECT DISTINCT em.user_id
FROM experiment_metrics em
WHERE em.exp_id = ?
  AND NOT EXISTS (
    SELECT 1 FROM experiment_users eu
    WHERE eu.exp_id = em.exp_id AND eu.user_id = em.user_id AND eu.variant = 'A'
  );

-- 17. 某月活跃订阅数和收入
SELECT
  COUNT(*) AS active_subs,
  SUM(amount) AS monthly_revenue
FROM subscriptions
WHERE status = 'active'
  AND start_date <= LAST_DAY(?)
  AND (end_date IS NULL OR end_date >= ?);

-- 18. 订阅历史窗口
SELECT
  sub_id, user_id, start_date, end_date,
  LAG(end_date) OVER (PARTITION BY user_id ORDER BY start_date) AS prev_end_date,
  DATEDIFF(start_date, LAG(end_date) OVER (PARTITION BY user_id ORDER BY start_date)) AS gap_days
FROM subscriptions;

-- 19. 司机每日完成单量
SELECT
  driver_id,
  DATE(completed_at) AS day,
  COUNT(*) AS completed_rides,
  SUM(fare) AS daily_fare
FROM rides
WHERE status = 'completed'
  AND completed_at >= ? AND completed_at < ?
GROUP BY driver_id, DATE(completed_at);

-- 20. 地理围栏附近可用司机
SELECT
  driver_id, lng, lat,
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

-- 21. 审核员日均处理量
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

-- 22. 多次违规用户
SELECT
  c.user_id,
  COUNT(*) AS rejected_count,
  MAX(c.created_at) AS last_rejected_at
FROM content c
WHERE c.status = 'rejected'
GROUP BY c.user_id
HAVING COUNT(*) >= 3
ORDER BY rejected_count DESC;
