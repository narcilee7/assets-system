# 迁移与备份

## 1. Schema 迁移

```
迁移工具对比
├── Flyway
│   ├── 基于 SQL 脚本，版本命名 V1__description.sql
│   ├── 支持 Java 回调
│   └── 社区版免费
├── Liquibase
│   ├── 基于 XML/YAML/JSON/SQL changelog
│   ├── 支持数据库无关的变更
│   └── 功能更丰富（标签、上下文）
└── 自研
    ├── 基于代码的版本控制
    └── 灵活但维护成本高
```

```sql
-- Flyway 迁移脚本示例
-- V1__create_users_table.sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- V2__add_user_profile.sql
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN bio TEXT;

-- V3__create_orders_table.sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- V4__add_order_index.sql
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);
```

```yaml
# Flyway 配置
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    baseline-version: 0
    validate-on-migrate: true
    out-of-order: false  # 禁止非顺序执行
```

```sql
-- 在线 DDL 工具（pt-online-schema-change）
-- 原理：创建新表 → 触发器同步增量 → 全量拷贝 → 切换表名

pt-online-schema-change \
  --alter "ADD COLUMN phone VARCHAR(20)" \
  --execute \
  --max-load Threads_running=25 \
  --critical-load Threads_running=50 \
  --chunk-size=1000 \
  D=mydb,t=users

-- MySQL 8.0+ Online DDL（InnoDB）
-- ALGORITHM=INPLACE, LOCK=NONE
ALTER TABLE users ADD COLUMN phone VARCHAR(20), 
  ALGORITHM=INPLACE, LOCK=NONE;
```

## 2. 数据迁移

```
数据迁移策略
├── 停机迁移
│   ├── 优点：简单、一致性好
│   └── 缺点：业务中断、时间窗口限制
├── 双写迁移
│   ├── 新旧系统同时写入
│   ├── 历史数据后台同步
│   ├── 验证后切换读流量
│   └── 优点：零停机、可回滚
├── CDC（Change Data Capture）
│   ├── Debezium 捕获 binlog
│   ├── 实时同步到目标库
│   └── 优点：实时、对业务无侵入
└── 增量迁移
    ├── 全量快照 + 增量追平
    ├── 适用于大数据量
    └── 需要记录迁移位点
```

```bash
# 双写迁移流程

# Phase 1: 开启双写
# 应用层同时写入旧库和新库
# 旧库为主，新库为备

# Phase 2: 历史数据迁移
mysqldump --single-transaction --quick mydb users | mysql newdb

# 或使用 pt-archiver 分批迁移
pt-archiver \
  --source h=old-host,D=mydb,t=users \
  --dest h=new-host,D=newdb,t=users \
  --where "created_at < '2024-06-01'" \
  --limit 1000 \
  --progress 10000 \
  --statistics

# Phase 3: 验证数据一致性
pt-table-checksum h=old-host h=new-host --databases=mydb

# Phase 4: 切换读流量
# 灰度切换，监控异常

# Phase 5: 停止双写，清理旧库
```

## 3. 备份策略

```
备份类型
├── 全量备份（Full Backup）
│   ├── 完整数据副本
│   ├── 恢复简单但耗时
│   └── 频率：周级别
├── 增量备份（Incremental Backup）
│   ├── 只备份变化的数据
│   ├── 基于上次全量或增量
│   └── 频率：日级别
├── 差异备份（Differential Backup）
│   ├── 基于上次全量的所有变化
│   ├── 恢复只需全量 + 一次差异
│   └── 频率：日级别
└── 日志备份（Log Backup）
    ├── binlog / WAL 归档
    ├── 支持时间点恢复（PITR）
    └── 频率：分钟级别

3-2-1 备份原则
├── 3 份数据副本
├── 2 种不同存储介质
└── 1 份异地备份
```

```bash
# MySQL 备份

# 物理备份（Percona XtraBackup）
xtrabackup --backup --target-dir=/backup/full/$(date +%Y%m%d)

# 增量备份
xtrabackup --backup --target-dir=/backup/inc1 \
  --incremental-basedir=/backup/full/20240601

# 恢复
xtrabackup --prepare --apply-log-only --target-dir=/backup/full/20240601
xtrabackup --prepare --target-dir=/backup/full/20240601 \
  --incremental-dir=/backup/inc1
xtrabackup --copy-back --target-dir=/backup/full/20240601

# 逻辑备份（mysqldump）
mysqldump --single-transaction --routines --triggers \
  --master-data=2 mydb > /backup/mydb_$(date +%Y%m%d).sql

# PostgreSQL 备份
pg_dump -Fc mydb > /backup/mydb_$(date +%Y%m%d).dump

# 连续归档（PITR）
# postgresql.conf
archive_mode = on
archive_command = 'cp %p /archive/%f'

# 恢复
cp /backup/base.tar $PGDATA/
pg_ctl start
# 恢复至指定时间点
pg_waldump --timeline=1 --start=0/01000000
```

## 4. 灾难恢复

```
RTO（Recovery Time Objective）：恢复时间目标
RPO（Recovery Point Objective）：恢复点目标

灾备等级
├── 级别 0：无备份（RPO = 全部数据，RTO = 无限）
├── 级别 1：本地备份（RPO = 备份间隔，RTO = 小时级）
├── 级别 2：异地备份（RPO = 备份间隔，RTO = 小时级）
├── 级别 3：热备（RPO = 分钟级，RTO = 分钟级）
└── 级别 4：多活（RPO ≈ 0，RTO ≈ 0）

故障演练
├── 定期执行灾难恢复演练
├── 验证备份可恢复性
├── 记录 RTO/RPO 实际值
└── 优化恢复流程
```

```bash
# 自动化备份检查脚本
#!/bin/bash

BACKUP_DIR="/backup"
DB_NAME="mydb"
ALERT_EMAIL="ops@example.com"

# 检查最新备份
latest_backup=$(ls -t ${BACKUP_DIR}/${DB_NAME}_*.sql 2>/dev/null | head -1)

if [ -z "$latest_backup" ]; then
  echo "ERROR: No backup found" | mail -s "Backup Alert" $ALERT_EMAIL
  exit 1
fi

# 检查备份时效（24 小时内）
backup_time=$(stat -c %Y "$latest_backup")
current_time=$(date +%s)
max_age=$((24 * 3600))

if [ $((current_time - backup_time)) -gt $max_age ]; then
  echo "ERROR: Latest backup is older than 24h: $latest_backup" | \
    mail -s "Backup Alert" $ALERT_EMAIL
  exit 1
fi

# 验证备份完整性（尝试恢复到一个临时库）
mysql -e "DROP DATABASE IF EXISTS test_restore; CREATE DATABASE test_restore;"
if ! mysql test_restore < "$latest_backup"; then
  echo "ERROR: Backup verification failed: $latest_backup" | \
    mail -s "Backup Alert" $ALERT_EMAIL
  exit 1
fi

mysql -e "DROP DATABASE test_restore;"
echo "Backup check passed: $latest_backup"
```
