# MySQL 工程化

## 1. 存储引擎选择

```
InnoDB（默认，推荐）
├── 支持事务（ACID）
├── 行级锁（并发高）
├── MVCC（非阻塞读）
├── 聚簇索引（主键顺序存储）
├── 外键约束
├── 崩溃恢复（redo log）
└── 适用：OLTP 绝大多数场景

MyISAM（已过时）
├── 表级锁（并发低）
├── 不支持事务
├── 不支持崩溃恢复
├── 全文索引（早期版本）
└── 适用：只读分析、日志归档

Memory
├── 数据存内存
├── 表级锁
├── 重启丢失
└── 适用：临时表、缓存

Archive
├── 高压缩存储
├── 只支持 INSERT/SELECT
└── 适用：日志归档
```

## 2. 复制架构

```
MySQL 复制模式

异步复制（Asynchronous）
├── 主库写 binlog，不等待从库
├── 优点：主库性能最好
├── 缺点：主库崩溃可能丢数据
└── 适用：读多写少，容忍延迟

半同步复制（Semi-Synchronous）
├── 主库等至少一个从库 ACK
├── 优点：数据更安全
├── 缺点：增加主库延迟
└── 适用：金融、订单等关键业务

组复制（Group Replication）
├── 多主或单主模式
├── Paxos 协议保证一致性
├── 自动故障转移
└── 适用：高可用集群

GTID（Global Transaction Identifier）
├── 全局唯一事务 ID
├── 简化主从切换、故障恢复
├── 避免 binlog 文件名/位置管理
└── 推荐：生产环境必开
```

```ini
# my.cnf 配置示例
[mysqld]
server-id = 1
log_bin = mysql-bin
binlog_format = ROW
binlog_row_image = FULL
gtid_mode = ON
enforce_gtid_consistency = ON

# 半同步
plugin-load = "rpl_semi_sync_master=semisync_master.so;rpl_semi_sync_slave=semisync_slave.so"
rpl_semi_sync_master_enabled = 1
rpl_semi_sync_slave_enabled = 1
rpl_semi_sync_master_timeout = 1000

# InnoDB
innodb_buffer_pool_size = 4G
innodb_log_file_size = 512M
innodb_flush_log_at_trx_commit = 1
innodb_flush_method = O_DIRECT
```

## 3. 分库分表

```
分库分表策略

垂直拆分
├── 按业务拆分（用户库、订单库、商品库）
├── 优点：降低单库压力、业务隔离
└── 缺点：跨库 JOIN 困难

水平拆分
├── 按数据量拆分（ID 取模、时间范围）
├── 分片键选择：
│   ├── 查询频率最高的字段
│   ├── 数据分布均匀（避免热点）
│   └── 避免跨分片查询
└── 策略：
    ├── Hash 取模：数据均匀，扩容需迁移
    ├── Range：扩容简单，可能存在热点
    └── 一致性 Hash：平滑扩容

中间件方案
├── ShardingSphere（Java）：JDBC/Proxy 双模式
├── Vitess（Go）：YouTube 开源，K8s 原生
├── MyCat（Java）：老牌 Proxy
└── 自研：基于 ORM 拦截

不分库分表的替代方案
├── 读写分离：一主多从
├── 归档历史数据：冷数据迁移
├── 增加缓存：Redis 分担读压力
└── 升级硬件：SSD、大内存
```

```sql
-- 分表示例：按用户 ID 取模分 16 张表
-- 表名：orders_00 ~ orders_15
-- 路由：orders_{user_id % 16}

-- 查询时
SET @shard = user_id % 16;
SET @sql = CONCAT('SELECT * FROM orders_', LPAD(@shard, 2, '0'), ' WHERE user_id = ?');
PREPARE stmt FROM @sql;
EXECUTE stmt USING @user_id;
```

## 4. 连接池与性能

```
连接池配置原则

为什么需要连接池
├── 建立连接开销大（TCP + TLS + 认证）
├── 避免频繁创建/销毁
└── 限制并发连接数，保护数据库

关键参数
├── max_connections：MySQL 最大连接（通常 1000-5000）
├── pool_size：应用连接池大小
│   └── 公式：connections = (core_count * 2) + effective_spindle_count
├── max_overflow：允许超出 pool_size 的连接数
├── timeout：获取连接的超时时间
├── idle_timeout：空闲连接回收时间
└── health_check：连接健康检查间隔

常见连接池
├── Java：HikariCP（最快）、Druid（监控丰富）
├── Go：sql.DB 内置、pgxpool
├── Node.js：mysql2 pool、pg-pool
└── Python：SQLAlchemy pool、psycopg2 pool
```

```java
// HikariCP 配置
HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
config.setUsername("user");
config.setPassword("pass");
config.setMaximumPoolSize(20);
config.setMinimumIdle(5);
config.setConnectionTimeout(30000);
config.setIdleTimeout(600000);
config.setMaxLifetime(1800000);
config.addDataSourceProperty("cachePrepStmts", "true");
config.addDataSourceProperty("prepStmtCacheSize", "250");
config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
HikariDataSource ds = new HikariDataSource(config);
```

## 5. 备份与恢复

```
备份策略

物理备份（推荐）
├── XtraBackup（Percona）：热备，不锁表
├── mysqlbackup（企业版）
├── 适用：大数据量、快速恢复
└── 缺点：跨版本恢复困难

逻辑备份
├── mysqldump：SQL 文件，可跨版本
├── mydumper：并行导出，更快
├── 适用：小数据量、部分表恢复
└── 缺点：大数据量慢、恢复时间长

增量备份
├── binlog：记录所有变更
├── 基于时间点的恢复（PITR）
└── 必须开启 binlog（row format）

备份策略
├── 全量：每周一次（XtraBackup）
├── 增量：每天一次（增量 XtraBackup）
├── binlog：实时同步到远程
└── 恢复演练：每季度一次
```

```bash
# XtraBackup 全量备份
xtrabackup --backup --target-dir=/backup/full

# 增量备份
xtrabackup --backup --target-dir=/backup/inc1 --incremental-basedir=/backup/full

# 准备恢复
xtrabackup --prepare --apply-log-only --target-dir=/backup/full
xtrabackup --prepare --target-dir=/backup/full

# 恢复
xtrabackup --copy-back --target-dir=/backup/full
```
