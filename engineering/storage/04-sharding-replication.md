# 分片与复制

## 1. 分库分表策略

```
垂直分片（Vertical Sharding）
  ├── 按业务模块拆分
  │   ├── 用户库：users, profiles, auth
  │   ├── 订单库：orders, order_items, payments
  │   └── 商品库：products, categories, inventory
  ├── 优点：业务解耦、降低单库压力
  └── 缺点：跨库 JOIN 困难、分布式事务复杂

水平分片（Horizontal Sharding）
  ├── 按行拆分，同一表分到多个库/表
  │   ├── 用户表：user_0, user_1, user_2, user_3
  │   └── 订单表：order_2023, order_2024, order_2025
  ├── 分片键选择：
  │   ├── 用户 ID（最常用）
  │   ├── 时间（时序数据）
  │   └── 地理位置（地理数据）
  └── 分片算法：
      ├── 哈希分片：user_id % 4
      ├── 范围分片：ID 区间 [0-1M), [1M-2M)
      ├── 一致性哈希：节点变动影响最小
      └── 标签分片：按地区路由
```

```sql
-- 哈希分表示例
-- user_id = 123456
-- 表数 = 16
-- 分表 = user_123456 % 16 = user_8

-- 范围分表示例
-- order_2024_01, order_2024_02, ..., order_2024_12

-- 一致性哈希环
-- 每个物理节点虚拟出 150 个虚拟节点
-- 数据 key 哈希后定位到环上最近的节点
-- 节点增减只影响相邻数据
```

| 分片策略 | 优点 | 缺点 | 适用场景 |
|----------|------|------|----------|
| 哈希 | 数据均匀、无热点 | 范围查询困难、扩容需迁移 | 用户数据、均匀负载 |
| 范围 | 范围查询高效、扩容简单 | 可能热点（时间尾端） | 时序数据、日志 |
| 列表 | 灵活控制 | 维护成本高 | 地理分片、业务分片 |
| 复合 | 兼顾两者 | 复杂度高 | 大型综合系统 |

## 2. 主从复制

```
MySQL 主从复制
├── 异步复制（Asynchronous）
│   ├── 主库写 binlog，不等待从库确认
│   ├── 延迟小，吞吐高
│   └── 可能丢数据（主库 crash）
├── 半同步复制（Semi-Synchronous）
│   ├── 至少一个从库确认后才返回客户端
│   ├── 平衡性能与一致性
│   └── 默认 after_commit（MySQL 5.7）
│   └── after_sync（MySQL 5.7+，推荐）
└── 组复制（Group Replication）
    ├── 多主或单主，Paxos 协议
    ├── 自动故障检测和切换
    └── MySQL 8.0 InnoDB Cluster

复制延迟问题
├── 原因：从库单线程回放（5.6 前）/ 大事务 / 从库性能差
├── 监控：Seconds_Behind_Master
├── 解决：
│   ├── 并行复制（slave_parallel_workers）
│   ├── 读写分离（延迟大时读主库）
│   ├── 避免大事务拆分
│   └── 提升从库配置
```

```sql
-- 查看复制状态
SHOW SLAVE STATUS\G
-- 关键字段：
-- Slave_IO_Running: Yes
-- Slave_SQL_Running: Yes
-- Seconds_Behind_Master: 0
-- Last_SQL_Error: 

-- 并行复制配置
[mysqld]
slave_parallel_type = LOGICAL_CLOCK
slave_parallel_workers = 8
slave_preserve_commit_order = ON
```

## 3. 读写分离

```
读写分离架构

写请求 → 主库（Master）
  ↓
binlog → 从库（Slave 1, Slave 2, Slave N）
  ↓
读请求 → 负载均衡器 → 从库集群

实现方式：
├── 中间件代理：MyCat, ShardingSphere, Vitess
├── 应用层路由：Spring 动态数据源
├── DNS 轮询：多个只读域名
└── 云原生：AWS RDS Proxy, Alibaba Cloud PolarDB
```

```java
// Spring 动态数据源实现读写分离
@Configuration
public class DataSourceConfig {
    
    @Bean
    public DataSource routingDataSource(
            @Qualifier("masterDataSource") DataSource master,
            @Qualifier("slaveDataSource") DataSource slave) {
        
        DynamicRoutingDataSource routing = new DynamicRoutingDataSource();
        Map<Object, Object> targets = new HashMap<>();
        targets.put("master", master);
        targets.put("slave", slave);
        routing.setTargetDataSources(targets);
        routing.setDefaultTargetDataSource(master);
        return routing;
    }
}

// 注解切换
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ReadOnly {
}

@Aspect
@Component
public class DataSourceAspect {
    @Around("@annotation(ReadOnly)")
    public Object switchToSlave(ProceedingJoinPoint point) throws Throwable {
        try {
            DataSourceContext.set("slave");
            return point.proceed();
        } finally {
            DataSourceContext.clear();
        }
    }
}

// 使用
@Service
public class UserService {
    @ReadOnly
    public List<User> listUsers() {
        return userRepository.findAll();
    }
    
    public void createUser(User user) {
        userRepository.save(user);  // 默认走主库
    }
}
```

## 4. 分布式 ID

```
分布式 ID 要求
├── 全局唯一
├── 趋势递增（利于索引）
├── 高性能（低延迟生成）
├── 高可用
└── 信息安全（不暴露业务量）

方案对比
├── 数据库自增
│   ├── 单点、性能差、不适合分片
├── UUID / UUIDv7
│   ├── 无序、占用大（36字节）、索引性能差
│   ├── UUIDv7：时间前缀 + 随机，趋势递增
├── 雪花算法（Snowflake）
│   ├── 64位：1位符号 + 41位时间戳 + 10位机器ID + 12位序列号
│   ├── 毫秒级 4096 个 ID，单机每秒 409.6 万 ID
│   ├── 依赖时钟，时钟回拨问题
│   └── 实现：Twitter Snowflake, 美团 Leaf, 百度 UidGenerator
├── 数据库号段
│   ├── 批量获取 ID 段，内存分配
│   ├── Leaf-segment：双 buffer 优化
│   └── 趋势递增、性能好
└── 类雪花（Sonyflake, 美团 Leaf-snowflake）
```

```java
// 雪花算法实现
public class SnowflakeIdGenerator {
    private final long workerId;
    private final long datacenterId;
    
    private long sequence = 0L;
    private long lastTimestamp = -1L;
    
    // 起始时间戳（2024-01-01）
    private final long epoch = 1704067200000L;
    
    // 位数分配
    private final long workerIdBits = 5L;
    private final long datacenterIdBits = 5L;
    private final long sequenceBits = 12L;
    
    // 最大值
    private final long maxWorkerId = -1L ^ (-1L << workerIdBits);
    private final long maxDatacenterId = -1L ^ (-1L << datacenterIdBits);
    private final long sequenceMask = -1L ^ (-1L << sequenceBits);
    
    // 移位
    private final long workerIdShift = sequenceBits;
    private final long datacenterIdShift = sequenceBits + workerIdBits;
    private final long timestampShift = sequenceBits + workerIdBits + datacenterIdBits;
    
    public synchronized long nextId() {
        long timestamp = System.currentTimeMillis();
        
        if (timestamp < lastTimestamp) {
            throw new RuntimeException("Clock moved backwards");
        }
        
        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & sequenceMask;
            if (sequence == 0) {
                // 等待下一毫秒
                timestamp = tilNextMillis(lastTimestamp);
            }
        } else {
            sequence = 0L;
        }
        
        lastTimestamp = timestamp;
        
        return ((timestamp - epoch) << timestampShift)
            | (datacenterId << datacenterIdShift)
            | (workerId << workerIdShift)
            | sequence;
    }
    
    private long tilNextMillis(long lastTimestamp) {
        long timestamp = System.currentTimeMillis();
        while (timestamp <= lastTimestamp) {
            timestamp = System.currentTimeMillis();
        }
        return timestamp;
    }
}

// Leaf 号段模式
@Service
public class LeafSegmentService {
    @Autowired private SegmentDao segmentDao;
    
    private final Map<String, SegmentBuffer> buffers = new ConcurrentHashMap<>();
    
    public long getId(String bizTag) {
        SegmentBuffer buffer = buffers.computeIfAbsent(bizTag, k -> new SegmentBuffer());
        
        if (!buffer.isReady() || buffer.getCurrent().getRemain() < 0.1) {
            // 异步加载下一个号段
            loadNextSegment(buffer, bizTag);
        }
        
        return buffer.getCurrent().nextId();
    }
    
    @Transactional
    public void loadNextSegment(SegmentBuffer buffer, String bizTag) {
        // UPDATE leaf_alloc SET max_id = max_id + step WHERE biz_tag = ?
        Segment segment = segmentDao.updateMaxId(bizTag);
        buffer.setNext(new IdSegment(segment.getMaxId() - segment.getStep(), segment.getMaxId()));
    }
}
```
