# 数据湖与大数据

## 1. 数据湖架构

```
数据湖 vs 数据仓库

数据仓库（Data Warehouse）
├── Schema-on-Write：先定义结构再写入
├── 结构化数据为主
├── 高质量、高一致性
├── 查询性能好
├── 示例：Snowflake、BigQuery、Redshift
└── 适用：BI 报表、已知的分析需求

数据湖（Data Lake）
├── Schema-on-Read：先存储再解析
├── 结构化 + 半结构化 + 非结构化
├── 原始数据保留
├── 存储成本低（对象存储）
├── 示例：S3 + Athena、Delta Lake、Iceberg
└── 适用：探索性分析、机器学习、数据科学

湖仓一体（Lakehouse）
├── 数据湖的存储成本 + 数据仓库的查询性能
├── 事务支持（ACID）
├── Schema 演进
├── 示例：Databricks、Starburst
└── 适用：现代数据平台
```

## 2. 数据湖表格式

```
三大开源表格式

Apache Iceberg
├── Netflix 开源
├── 隐藏分区、分区演进
├── 时间旅行（Time Travel）
├── 多引擎支持（Spark、Flink、Trino）
└── 适用：大规模分析、云原生

Delta Lake
├── Databricks 开源
├── ACID 事务、乐观并发控制
├── 自动数据布局优化
├── 与 Spark 深度集成
└── 适用：Spark 生态

Apache Hudi
├── Uber 开源
├── 增量处理、流式摄取
├── Copy-on-Write / Merge-on-Read
├── 近实时分析
└── 适用：CDC、近实时数仓

对比
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   特性      │   Iceberg   │  Delta Lake │    Hudi     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ ACID        │     ✓       │     ✓       │     ✓       │
│ 时间旅行    │     ✓       │     ✓       │     ✓       │
│ 隐藏分区    │     ✓       │     ✗       │     ✗       │
│ 流式摄取    │     △       │     △       │     ✓       │
│ 引擎支持    │    多       │  Spark 为主 │  Spark 为主 │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

```sql
-- Iceberg 示例（Spark SQL）
-- 创建表
CREATE TABLE iceberg_db.events (
    event_id STRING,
    event_time TIMESTAMP,
    user_id STRING,
    event_type STRING
) USING iceberg
PARTITIONED BY (days(event_time));

-- 时间旅行
SELECT * FROM iceberg_db.events TIMESTAMP AS OF '2024-06-01 00:00:00';
SELECT * FROM iceberg_db.events VERSION AS OF 123456;

-- 优化（压缩小文件）
CALL iceberg.system.rewrite_data_files('iceberg_db.events');
```

## 3. 大数据处理引擎

```
Apache Spark
├── 批流一体（Spark Streaming / Structured Streaming）
├── SQL / DataFrame / Dataset API
├── 内存计算（比 MapReduce 快 10-100x）
├── Catalyst 优化器、Tungsten 执行引擎
├── 部署：Standalone / YARN / Kubernetes
└── 适用：ETL、机器学习、图计算

Apache Flink
├── 真正的流处理（毫秒级延迟）
├── 事件时间处理、Watermark
├── Checkpoint / Savepoint（精确一次）
├── 状态管理（RocksDB / Heap）
├── Table API / SQL
└── 适用：实时风控、实时监控、实时推荐

对比
┌─────────────┬─────────────┬─────────────┐
│   维度      │    Spark    │    Flink    │
├─────────────┼─────────────┼─────────────┤
│ 延迟        │   秒级/分钟 │   毫秒级    │
│ 处理模型    │  微批/流    │  纯流       │
│ 状态管理    │   一般      │   优秀      │
│ SQL 支持    │   很好      │   好        │
│ 生态        │   更丰富    │   流处理强  │
│ 适用        │  批处理为主 │  流处理为主 │
└─────────────┴─────────────┴─────────────┘
```

```python
# Spark 示例
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("ETL").getOrCreate()

# 读取
df = spark.read.parquet("s3://bucket/raw/")

# 转换
df_filtered = df.filter(df.amount > 100)
df_agg = df_filtered.groupBy("category").agg({"amount": "sum"})

# 写入 Iceberg
df_agg.writeTo("iceberg_db.sales_summary").overwritePartitions()
```

```python
# Flink 示例
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment

env = StreamExecutionEnvironment.get_execution_environment()
t_env = StreamTableEnvironment.create(env)

# Kafka 源
t_env.execute_sql("""
CREATE TABLE events (
    user_id STRING,
    event_type STRING,
    event_time TIMESTAMP(3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'events',
    'properties.bootstrap.servers' = 'kafka:9092',
    'format' = 'json'
)
""")

# 窗口聚合
t_env.execute_sql("""
CREATE TABLE event_counts AS
SELECT
    event_type,
    TUMBLE_START(event_time, INTERVAL '1' MINUTE) as window_start,
    COUNT(*) as cnt
FROM events
GROUP BY
    event_type,
    TUMBLE(event_time, INTERVAL '1' MINUTE)
""")
```

## 4. HDFS 与对象存储

```
HDFS（Hadoop Distributed File System）
├── 主从架构：NameNode（元数据）+ DataNode（数据块）
├── 块大小：128MB / 256MB
├── 三副本容错
├── 一次写入、多次读取
└── 适用：批处理、大文件

对象存储（现代替代）
├── S3（AWS）、GCS（Google）、OSS（阿里云）、MinIO
├── 无限扩展、按量计费
├── 与计算分离（存算分离）
├── 适用：数据湖、云原生大数据
└── 缺点：小文件性能差、延迟高于 HDFS

文件格式
├── Parquet：列式、压缩高、谓词下推
├── ORC：Hadoop 生态、索引丰富
├── Avro：行式、Schema 演化
├── JSON/CSV：仅用于摄取
└── 推荐：分析用 Parquet，交换用 Avro
```

## 5. Lambda vs Kappa 架构

```
Lambda 架构
┌─────────────┐     ┌─────────────┐
│  Speed Layer│     │ Batch Layer │
│  (Flink)    │     │  (Spark)    │
│  实时视图    │     │ 全量历史    │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └─────────┬─────────┘
                 ▼
          ┌─────────────┐
          │ Serving Layer│
          │  合并查询    │
          └─────────────┘
├── 优点：容错好、数据完整
├── 缺点：两套代码、维护成本高
└── 适用：金融等对一致性要求高的场景

Kappa 架构
┌─────────────┐
│ Stream Layer│
│   (Flink)   │
│  唯一数据源  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Serving Layer│
└─────────────┘
├── 优点：一套代码、简单
├── 缺点：流处理容错复杂、重放成本高
└── 适用：大多数实时分析场景

现代趋势：Kappa + 湖仓一体
├── Kafka/Pulsar 作为实时数据源
├── Flink 处理写入 Iceberg/Delta
├── Spark/Trino 统一查询
└── 历史数据在湖中，实时数据在流中
```
