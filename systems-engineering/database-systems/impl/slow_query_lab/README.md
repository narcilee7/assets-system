# Slow Query Lab — Chain-1

MySQL 慢查询诊断可运行实验。

## 快速开始

```bash
# 1. 启动 MySQL
docker compose up -d

# 2. 等待初始化完成（约 10s）
sleep 10

# 3. 生成慢查询
pip install mysql-connector-python
python3 python/load_generator.py

# 4. 自动诊断
python3 python/diagnose.py
```

## 实验内容

| 场景 | 产生的问题 | 诊断方式 |
|---|---|---|
| 无索引全表扫描 | `type=ALL` | `sys.statements_with_full_table_scans` |
| 深分页 | `LIMIT offset` 过大 | EXPLAIN + `rows` 估算 |
| 锁竞争 | `FOR UPDATE` 等待 | `performance_schema.data_lock_waits` |
| 大 JOIN | 笛卡尔积或缺失索引 | EXPLAIN `rows` 乘积爆炸 |

## 清理

```bash
docker compose down -v
```

## 依赖

- Docker + Docker Compose
- Python 3 + `mysql-connector-python`
