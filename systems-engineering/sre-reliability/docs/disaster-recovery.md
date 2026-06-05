# Disaster Recovery Checklist

## 目标

掌握灾备的核心概念：RTO/RPO、备份策略、故障切换、演练。

## 场景

- 数据库崩溃怎么恢复？
- 云厂商 Region 挂了怎么办？
- 如何验证灾备能正常工作？
- RTO 和 RPO 如何影响架构选择？

## 核心指标

### RTO（Recovery Time Objective）

```
恢复时间目标：系统从故障到恢复可用的最长时间

例子：
  - RTO = 1 小时：故障后 1 小时内必须恢复服务
  - RTO = 0：零停机，需要双活/多活

RTO 越短，成本越高（多活架构、热备、自动化切换）
```

### RPO（Recovery Point Objective）

```
恢复点目标：数据恢复的时间点（允许丢失多长时间的数据）

例子：
  - RPO = 0：不允许数据丢失（同步复制）
  - RPO = 1 小时：允许丢失 1 小时的数据（每小时备份）
  - RPO = 24 小时：允许丢失 1 天的数据（每日备份）

RPO 越短，成本越高（同步复制、实时备份）
```

### RTO/RPO 决策

| 业务场景 | RTO | RPO | 架构要求 |
|---|---|---|---|
| 核心支付 | < 15 分钟 | 0 | 双活 + 同步复制 |
| 电商核心 | < 1 小时 | < 5 分钟 | 主备 + 异步复制 |
| 后台任务 | < 4 小时 | < 1 小时 | 备份 + 人工恢复 |
| 数据分析 | < 24 小时 | < 24 小时 | 备份恢复 |

## 备份策略

### 备份类型

```
完整备份（Full Backup）：
  - 备份所有数据
  - 恢复简单，但备份时间长
  - 建议：每周一次

增量备份（Incremental Backup）：
  - 只备份上次备份后的增量
  - 备份快，恢复慢（需要逐个恢复）
  - 建议：每天一次

差异备份（Differential Backup）：
  - 备份上次完整备份后的增量
  - 介于完整和增量之间
  - 建议：每天一次

连续备份（Continuous Backup / WAL）：
  - 基于 Write-Ahead Log 的实时备份
  - 可以恢复到任意时间点（PITR）
  - 例子：PostgreSQL 的 WAL archivation
```

### 数据库备份

```sql
-- MySQL 备份
mysqldump --single-transaction --routines --triggers --all-databases > backup.sql

-- PostgreSQL 备份
pg_dump -Fc -f backup.dump

-- 增量备份（WAL）
# PostgreSQL: 配置 wal_level = replica, archive_mode = on
# WAL 持续归档到对象存储（S3）
```

### Kubernetes 备份

```bash
# Velero 备份
velero backup create <backup-name> \
  --include-namespaces <namespace> \
  --storage-location default

# 恢复
velero restore create --from-backup <backup-name>

# 定时备份
velero schedule create <schedule-name> \
  --schedule="0 2 * * *" \
  --include-namespaces <namespace>
```

## 故障切换

### 切换条件

```
触发切换：
  1. 主服务不可达（超时/错误率激增）
  2. 机房/Region 不可用
  3. 数据损坏/丢失

切换决策：
  - 自动切换：适合 RTO 极短的核心服务
  - 人工确认：适合非核心服务，避免误判
```

### DNS 切换

```bash
# DNS 切换步骤
1. 确认主站点故障
2. 修改 DNS 记录（降低 TTL 预热）
   - 旧：api.example.com -> 1.2.3.4 (Primary)
   - 新：api.example.com -> 5.6.7.8 (Secondary)
3. 等待 DNS 传播（TTL 时间内生效）
4. 验证流量切换成功

DNS TTL 设置：
  - 正常：300-3600 秒
  - 灾备切换前：降低到 60 秒
```

### 数据库切换

```sql
-- 主从切换步骤（PostgreSQL）
1. 确认从库追上主库（replication lag = 0）
2. 停止主库写入
3. 等待从库应用完所有 WAL
4. 提升从库为主库（pg_ctl promote）
5. 更新连接字符串
6. 验证写入成功

-- MySQL 切换
1. SHOW SLAVE STATUS\G（确认从库追上）
2. STOP SLAVE;
3. RESET SLAVE ALL;
4. 自动或手动提升从库为主库
```

### Kubernetes 切换

```bash
# 切换到备用集群
# 1. 更新 kubeconfig 指向备用集群
kubectl config use-context <backup-cluster>

# 2. 恢复 Deployment/StatefulSet
kubectl apply -f backup-manifests/

# 3. 验证
kubectl get pods -n <namespace>
kubectl get svc -n <namespace>

# 4. 更新 Ingress/DNS
```

## 恢复流程

### 数据库恢复

```bash
# PostgreSQL PITR（Point-In-Time Recovery）
1. 停止 PostgreSQL
2. 恢复最新基础备份
3. 配置 recovery.conf:
   restore_command = 'cp /archive/%f %p'
   recovery_target_time = '2024-01-01 12:00:00 UTC'
4. 启动 PostgreSQL
5. 验证数据

# MySQL 恢复
1. 停止 MySQL
2. 恢复最新备份
3. 应用 binlog：
   mysqlbinlog --stop-datetime="2024-01-01 12:00:00" binlog.* | mysql
4. 启动 MySQL
```

### Kubernetes 恢复

```bash
# 使用 Velero 恢复
velero restore create --from-backup <backup-name> --namespace-mappings default:restored

# 手动恢复
kubectl apply -f <backup-dir>/deployments.yaml
kubectl apply -f <backup-dir>/services.yaml
kubectl apply -f <backup-dir>/configmaps.yaml

# 验证
kubectl get all -n <namespace>
kubectl logs <pod>
```

## 演练

### 演练计划

```
演练频率：
  - 核心系统：每季度一次
  - 重要系统：每半年一次
  - 一般系统：每年一次

演练内容：
  1. 备份恢复（不影响生产）
  2. 故障切换（切换到备用环境）
  3. 数据完整性检查
  4. RTO/RPO 验证
```

### 演练检查清单

```
□ 备份是否可正常执行
□ 备份恢复时间是否满足 RTO
□ 恢复的数据是否完整（RPO 验证）
□ DNS 切换是否正常工作
□ 数据库主从切换是否成功
□ 应用是否能在新环境正常运行
□ 监控告警是否正常工作
□ 通信流程是否清晰
□ 人员是否了解灾备流程
```

## 核心追问

1. **RTO 和 RPO 的区别？** RTO 是恢复时间（服务中断多久），RPO 是数据恢复点（允许丢失多少数据）
2. **备份应该多久做一次？** 取决于 RPO：RPO=0 需要同步复制，RPO=1h 需要至少每小时备份
3. **什么是 PITR？** Point-In-Time Recovery，基于 WAL 的任意时间点恢复，PostgreSQL 支持
4. **为什么灾备需要演练？** 不演练等于没做灾备；实际故障时才发现备份损坏、切换流程有问题，会措手不及
5. **多活和主备的区别？** 多活：多个站点同时服务，实时同步，RTO=0；主备：只有主站点服务，备站点冷备，切换需要时间

## 状态

| 资产 | 状态 |
|---|---|
| SLO worksheet | done |
| incident response playbook | done |
| error budget policy | done |
| capacity planning worksheet | done |
| disaster recovery checklist | done |