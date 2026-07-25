# MySQL 面试题清单

## 一、基础架构与存储引擎

### 1. MySQL 的逻辑架构分层？各层职责？
- **连接层**：连接处理、认证、安全
- **服务层**：查询解析、优化、缓存、内置函数
- **引擎层**：存储引擎（InnoDB、MyISAM 等）
- **存储层**：文件系统上的数据文件

### 2. InnoDB vs MyISAM 的核心区别？
| 特性 | InnoDB | MyISAM |
|------|--------|--------|
| 事务 | 支持 ACID | 不支持 |
| 行锁/表锁 | 行锁 + 表锁 | 表锁 |
| 外键 | 支持 | 不支持 |
| 崩溃恢复 | 支持（Redo Log） | 不支持 |
| 索引类型 | 聚簇索引 | 非聚簇索引 |
| 适用场景 | 高并发 OLTP | 读多写少、日志/报表 |

### 3. 为什么选 InnoDB 作为默认引擎？
事务安全、行级锁、MVCC、崩溃恢复、外键约束。

---

## 二、索引（重点）

### 4. B+ Tree 索引的结构和优势？
- 所有数据存在叶子节点，叶子节点通过链表连接
- 非叶子节点只存键值，不存数据，树更矮
- 范围查询只需遍历叶子节点链表，效率极高
- 相比 B-Tree：I/O 次数更少，顺序访问更友好

### 5. 聚簇索引 vs 非聚簇索引？
- **聚簇索引**：叶子节点存整行数据，InnoDB 主键索引就是聚簇索引。表数据按主键顺序物理存储。
- **非聚簇索引（二级索引）**：叶子节点存主键值，需要**回表**查主键索引拿完整数据。

### 6. 覆盖索引是什么？为什么效率高？
索引里已经包含了查询所需的所有字段，无需回表。`EXPLAIN` 中 `Extra` 列显示 `Using index`。

### 7. 最左前缀原则？
联合索引 `(a, b, c)`，查询条件必须从最左列开始连续使用，索引才能生效。
- `WHERE a=1 AND b=2` ✅
- `WHERE b=2 AND c=3` ❌（跳过了 a）
- `WHERE a=1 AND c=3` ✅ 但只用到了 a（b 缺失，c 无法使用）

### 8. 索引失效的常见场景？
1. 对索引列做函数运算（`WHERE YEAR(create_time) = 2024`）
2. 隐式类型转换（字符串字段传数字）
3. `LIKE '%xxx'` 左模糊
4. `OR` 条件中有一列没索引
5. `!=`、`<>`、`NOT IN`（有时失效，看数据分布）
6. 联合索引未遵循最左前缀

### 9. 索引下推（Index Condition Pushdown, ICP）？
MySQL 5.6 引入，在**存储引擎层**过滤索引列条件，减少回表次数。
- 例：索引 `(a, b)`，查询 `WHERE a=1 AND b LIKE '%x' AND c=1`
- 没有 ICP：引擎回表后把数据给 Server 层过滤
- 有 ICP：引擎在索引里先过滤 `b LIKE '%x'`，再回表

---

## 三、事务与锁

### 10. ACID 分别怎么实现？
| 特性 | 实现机制 |
|------|----------|
| Atomicity | Undo Log + 事务提交/回滚 |
| Consistency | 约束、触发器、外键 + 其他三个特性共同保证 |
| Isolation | MVCC + 锁 |
| Durability | Redo Log + Binlog + Force Log at Commit |

### 11. 事务隔离级别及各自问题？
| 级别 | 脏读 | 不可重复读 | 幻读 |
|------|------|------------|------|
| READ UNCOMMITTED | ✓ | ✓ | ✓ |
| READ COMMITTED | ✗ | ✓ | ✓ |
| REPEATABLE READ | ✗ | ✗ | ✗（InnoDB 通过 MVCC+Gap Lock 解决）|
| SERIALIZABLE | ✗ | ✗ | ✗ |

### 12. MVCC 的实现原理？
- 每行记录有隐藏字段：`DB_TRX_ID`（最近修改事务ID）、`DB_ROLL_PTR`（回滚指针指向 Undo Log）
- **Read View**：事务快照读时生成的一致性视图，包含：
  - `creator_trx_id`：创建该视图的事务 ID
  - `up_limit_id`：活跃事务中最小 ID
  - `low_limit_id`：下一个要分配的事务 ID
  - `trx_ids`：活跃事务 ID 列表
- 判断规则：根据 `DB_TRX_ID` 与 Read View 的关系，决定可见性

### 13. InnoDB 的锁类型？
- **共享锁（S）**：`SELECT ... LOCK IN SHARE MODE`
- **排他锁（X）**：`SELECT ... FOR UPDATE`、`UPDATE`、`DELETE`
- **意向锁（IS/IX）**：表级，表示事务意向，避免逐行检查
- **记录锁（Record Lock）**：锁定单个索引记录
- **间隙锁（Gap Lock）**：锁定索引记录之间的间隙，防止幻读
- **临键锁（Next-Key Lock）**：Record Lock + Gap Lock，RR 默认

### 14. 死锁怎么产生？怎么排查？
- **产生**：两个事务互相持有对方需要的锁
- **排查**：`SHOW ENGINE INNODB STATUS` 看 `LATEST DETECTED DEADLOCK`
- **预防**：按固定顺序加锁、减少事务粒度、使用乐观锁

---

## 四、日志与持久化

### 15. Redo Log vs Undo Log vs Binlog？
| 特性 | Redo Log | Undo Log | Binlog |
|------|----------|----------|--------|
| 层级 | 引擎层（InnoDB） | 引擎层 | Server 层 |
| 作用 | 崩溃恢复（物理日志） | 事务回滚、MVCC（逻辑日志） | 主从复制、数据恢复 |
| 写入方式 | 循环写（固定大小） | 随事务产生 | 追加写 |
| 格式 | 物理页修改 | 反向 SQL | Statement/Row/Mixed |

### 16. 两阶段提交（2PC）？
保证 Redo Log 和 Binlog 的一致性：
1. **Prepare 阶段**：写入 Redo Log，状态设为 `prepare`
2. **Commit 阶段**：写入 Binlog，然后 Redo Log 状态改为 `commit`

如果崩溃：
- 有 Redo 无 Binlog：回滚（主从不一致）
- 有 Binlog 无 Redo：不可能，因为 Binlog 在 Redo 之后写

### 17. Buffer Pool 是什么？
InnoDB 的内存缓冲池，缓存数据页和索引页。采用 LRU 改进算法（分 young/old 区，防止全表扫描刷掉热点数据）。

---

## 五、查询优化

### 18. EXPLAIN 关键字段含义？
| 字段 | 含义 |
|------|------|
| `id` | 执行顺序，id 大先执行，相同从上到下 |
| `select_type` | SIMPLE、PRIMARY、SUBQUERY、DERIVED 等 |
| `type` | 访问类型：**system > const > eq_ref > ref > range > index > ALL** |
| `key` | 实际使用的索引 |
| `rows` | 估算扫描行数 |
| `Extra` | `Using index`（覆盖索引）、`Using where`、`Using filesort`、`Using temporary` |

### 19. 慢查询优化思路？
1. 开启慢查询日志，定位慢 SQL
2. `EXPLAIN` 分析执行计划
3. 检查是否走索引、索引是否合理
4. 优化 SQL 写法（避免 `SELECT *`、大分页用覆盖索引+子查询）
5. 考虑分库分表、读写分离、缓存

### 20. `LIMIT 1000000, 10` 怎么优化？
- **延迟关联**：先查 id，再 JOIN 拿数据
  ```sql
  SELECT * FROM t 
  INNER JOIN (SELECT id FROM t ORDER BY id LIMIT 1000000, 10) tmp 
  ON t.id = tmp.id;
  ```
- **覆盖索引+子查询**
- 业务层限制翻页深度

### 21. `COUNT(*)` vs `COUNT(1)` vs `COUNT(列)`？
- `COUNT(*)`：统计行数，优化器会选最小索引扫描，**推荐**
- `COUNT(1)`：同 `COUNT(*)`，语义略差
- `COUNT(列)`：统计该列非 NULL 行数，可能更慢

---

## 六、高可用与架构

### 22. 主从复制原理？
1. Master 写 Binlog
2. Slave 的 IO Thread 读取 Binlog 写入 Relay Log
3. Slave 的 SQL Thread 重放 Relay Log

**复制模式**：异步（默认）、半同步、组复制（MGR）

### 23. 主从延迟怎么解决？
- 硬件层面：SSD、万兆网
- 架构层面：读写分离（延迟敏感读走主库）、分库分表
- 参数优化：`sync_binlog`、`innodb_flush_log_at_trx_commit` 权衡
- 业务层面：关键读强制走主库

### 24. 分库分表策略？
- **垂直拆分**：按业务模块拆分（用户库、订单库）
- **水平拆分**：按 ID/时间取模或范围
  - 分片键选择：避免热点（如时间字段导致最近分片压力大）
  - 常用策略：Hash 取模、一致性 Hash、Range 分片

### 25. 分库分表后怎么保证全局唯一 ID？
- 雪花算法（Snowflake）：时间戳 + 机器ID + 序列号
- 号段模式：从数据库批量取号段缓存
- UUID：无序、太长、不推荐做主键

---

## 七、实战场景题

### 26. 线上 CPU 100%，怎么排查？
1. `SHOW PROCESSLIST` 看正在执行的 SQL
2. 找到执行时间长、频率高的 SQL
3. `EXPLAIN` 分析，看是否全表扫描、索引失效
4. 考虑加索引、优化 SQL、限流

### 27. 大表加索引怎么做不锁表？
- MySQL 5.6+：`ALTER TABLE ... ADD INDEX ... ALGORITHM=INPLACE, LOCK=NONE;`（Online DDL）
- 更稳妥：pt-online-schema-change（Percona Toolkit），创建影子表同步数据后切换

### 28. 如何设计一个电商订单表？
```sql
CREATE TABLE orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_no VARCHAR(32) NOT NULL,  -- 业务单号，唯一索引
    user_id BIGINT NOT NULL,
    status TINYINT NOT NULL,          -- 枚举：待支付、已支付、已发货...
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_order_no (order_no),
    KEY idx_user_status (user_id, status, created_at)  -- 覆盖用户订单列表查询
) ENGINE=InnoDB;
```

### 29. 为什么 InnoDB 推荐用自增 ID 做主键？
- 自增 ID 是顺序写入，减少页分裂和碎片
- 聚簇索引数据按主键顺序排列，范围查询效率高
- 二级索引叶子节点存主键值，整型主键更省空间

### 30. 什么是 Change Buffer？什么时候用？
- 对**非唯一二级索引**的插入/更新，先缓存在 Change Buffer，减少随机 I/O
- 唯一索引不行（需要立即读页判断唯一性）
- 读密集场景收益不大，写密集场景收益大

---

## 八、延伸（校招加分项）

### 31. MySQL 8.0 的新特性？
- 窗口函数（`ROW_NUMBER()`、`RANK()` 等）
- 降序索引、不可见索引
- 公用表表达式（CTE，`WITH` 子句）
- 默认字符集 `utf8mb4`
- 原子 DDL（DDL 操作要么全成功要么全回滚）

### 32. 一条 SQL 的执行流程？
1. 连接器：认证、建立连接
2. 查询缓存（8.0 已移除）：命中直接返回
3. 分析器：词法分析、语法分析
4. 优化器：生成执行计划、选择索引
5. 执行器：调用存储引擎接口
6. 存储引擎：读写数据，返回结果

---

需要我把某个模块展开成**带答案的详细版**（比如 MVCC 底层实现、主从复制详细流程），或者出一份**自测 Checklist** 吗？