# 存储性能优化

## 1. 查询优化

```sql
-- EXPLAIN 分析执行计划
EXPLAIN ANALYZE
SELECT u.name, o.total
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
  AND o.created_at > '2024-01-01'
ORDER BY o.created_at DESC
LIMIT 10;

-- 关键字段解读
-- type: ALL（全表扫描）→ index（索引扫描）→ range（范围扫描）→ ref（索引查找）→ eq_ref（唯一索引）→ const（主键/唯一）
-- rows: 扫描行数（越小越好）
-- key: 实际使用的索引
-- Extra: Using where / Using index（覆盖索引）/ Using filesort（需优化）/ Using temporary（需优化）
```

```sql
-- 慢查询治理
-- 1. 开启慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;  -- 超过 1 秒记录
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 2. 分析慢查询
SELECT * FROM mysql.slow_log 
WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 DAY)
ORDER BY query_time DESC
LIMIT 20;

-- 3. 常用优化手段
-- 添加复合索引
ALTER TABLE orders ADD INDEX idx_user_created (user_id, created_at);

-- 覆盖索引避免回表
ALTER TABLE users ADD INDEX idx_status_name (status, name);

-- 分页优化（深分页）
-- 差：SELECT * FROM orders LIMIT 1000000, 10;  -- 扫描 1000010 行
-- 好：SELECT * FROM orders WHERE id > 1000000 ORDER BY id LIMIT 10;
-- 好：SELECT * FROM orders INNER JOIN (SELECT id FROM orders LIMIT 1000000, 10) t USING(id);

-- 子查询优化
-- 差：SELECT * FROM orders WHERE user_id IN (SELECT id FROM users WHERE status = 'inactive');
-- 好：SELECT o.* FROM orders o JOIN users u ON o.user_id = u.id WHERE u.status = 'inactive';

-- 避免 SELECT *
-- 差：SELECT * FROM users WHERE id = 1;
-- 好：SELECT id, name, email FROM users WHERE id = 1;
```

## 2. 连接池优化

```
连接池参数调优
├── 最小连接数（minIdle）：维持的最小空闲连接
├── 最大连接数（maxActive）：最大并发连接
├── 连接超时（maxWait）：获取连接最大等待时间
├── 空闲检测（timeBetweenEvictionRunsMillis）：检测间隔
├── 连接最大存活时间（maxLifetime）：防止连接泄漏
└── 连接验证（validationQuery）：连接有效性检查

HikariCP 推荐配置
├── connectionTimeout = 30000（30 秒）
├── idleTimeout = 600000（10 分钟）
├── maxLifetime = 1800000（30 分钟）
├── maximumPoolSize = CPU * 2 + 有效磁盘数
├── minimumIdle = 与 maximumPoolSize 相同（固定连接池）
└── leakDetectionThreshold = 60000（连接泄漏检测）

PostgreSQL 连接公式
max_connections = (CPU cores * 2) + effective_spindle_count
实际应用：Web 应用 20-50，批处理 5-10
```

```yaml
# HikariCP 配置
spring:
  datasource:
    hikari:
      pool-name: PrimaryHikariPool
      minimum-idle: 10
      maximum-pool-size: 50
      idle-timeout: 300000
      max-lifetime: 1200000
      connection-timeout: 20000
      leak-detection-threshold: 60000
      connection-test-query: SELECT 1
      data-source-properties:
        cachePrepStmts: true
        prepStmtCacheSize: 250
        prepStmtCacheSqlLimit: 2048
        useServerPrepStmts: true
```

## 3. 批量操作

```sql
-- 批量插入
-- 差：1000 次单条 INSERT
-- 好：单条 INSERT 多 VALUES
INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com'),
  ('Charlie', 'charlie@example.com');

-- 更好：LOAD DATA INFILE（MySQL）
LOAD DATA INFILE '/tmp/users.csv'
INTO TABLE users
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
(name, email);

-- COPY（PostgreSQL）
COPY users(name, email) FROM '/tmp/users.csv' WITH CSV;
```

```java
// JDBC 批量操作
public void batchInsert(List<User> users) {
    String sql = "INSERT INTO users (name, email) VALUES (?, ?)";
    
    try (Connection conn = dataSource.getConnection();
         PreparedStatement ps = conn.prepareStatement(sql)) {
        
        conn.setAutoCommit(false);
        
        for (int i = 0; i < users.size(); i++) {
            ps.setString(1, users.get(i).getName());
            ps.setString(2, users.get(i).getEmail());
            ps.addBatch();
            
            // 每 1000 条执行一次
            if (i % 1000 == 0) {
                ps.executeBatch();
                conn.commit();
            }
        }
        
        ps.executeBatch();
        conn.commit();
    }
}

// MyBatis-Plus 批量
userService.saveBatch(users, 1000);
```

## 4. 读写优化 checklist

```
写入优化
├── 批量插入（batch size 100-1000）
├── 禁用索引后批量导入（导入完成再重建）
├── 延迟写入（Write-Behind 缓存）
├── 异步写入（消息队列削峰）
├── 避免不必要索引
├── 使用 REPLACE INTO / INSERT ON DUPLICATE KEY UPDATE
└── 分库分表分散写入压力

读取优化
├── 索引优化（覆盖索引、最左前缀）
├── 查询结果缓存
├── 读写分离
├── 预编译语句（PreparedStatement）
├── 避免大事务长查询
├── 使用连接池
├── 分页优化（游标/延迟关联）
└── 物化视图/汇总表
```
