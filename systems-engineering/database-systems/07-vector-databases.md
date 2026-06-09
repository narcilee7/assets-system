# 向量数据库

## 1. 向量检索基础

```
向量数据库核心概念

Embedding（嵌入向量）
├── 将文本/图像/音频转化为高维向量
├── 语义相近的向量距离近
├── 维度：384（MiniLM）、768（BERT）、1536（OpenAI）
└── 工具：sentence-transformers、OpenAI API

相似度度量
├── 欧氏距离（L2）：||a - b||₂，越小越近
├── 余弦相似度：cos(θ)，[-1, 1]，越大越近
├── 内积（IP）：a·b，越大越近
└── 选择：语义搜索用余弦，推荐系统用内积

ANN（Approximate Nearest Neighbor）
├── 牺牲少量精度换取大幅速度提升
├── 召回率（Recall）：返回的结果中有多少是真实的最近邻
└── 目标：Recall@10 > 95%，查询 < 10ms
```

## 2. 向量索引算法

```
HNSW（Hierarchical Navigable Small World）
├── 图算法，多层跳表结构
├── 每层是导航图，上层粗粒度，下层细粒度
├── 构建：逐层插入节点，连接最近邻
├── 查询：从顶层开始，逐层向下导航
├── 优点：高召回率、查询快
├── 缺点：内存占用大、构建慢
└── 适用：内存充足、高召回率场景

IVF（Inverted File Index）
├── 聚类算法，先 K-Means 分桶
├── 查询：找最近几个桶，桶内暴力搜索
├── 参数：nlist（桶数）、nprobe（查询桶数）
├── 优点：内存小、构建快
├── 缺点：召回率低于 HNSW、边缘点问题
└── 适用：大数据集、内存受限

Flat（暴力搜索）
├── 全量比较，最精确
├── 优点：100% 召回
├── 缺点：慢，O(N)
└── 适用：小数据集、基准测试

索引选择
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   算法      │   召回率    │  查询速度   │  内存占用   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ Flat        │   100%      │    慢       │    低       │
│ IVF         │   90-95%    │    快       │    中       │
│ HNSW        │   95-99%    │    很快     │    高       │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

## 3. 向量数据库产品

```
专用向量数据库
├── Milvus：开源、分布式、云原生
├── Pinecone：托管、易用、贵
├── Weaviate：GraphQL 接口、模块化
├── Qdrant：Rust 实现、过滤查询强
└── LanceDB：无服务器、嵌入友好

关系型扩展
├── PgVector：PostgreSQL 扩展
├── Redis Vector：RediSearch 模块
└── ClickHouse：近似搜索

对象存储方案
├── Lance 格式：列式向量存储
└── Parquet + S3 + 内存索引
```

```sql
-- PgVector 示例
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1536)
);

-- HNSW 索引
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 语义搜索
SELECT id, content, 1 - (embedding <=> :query_embedding) as similarity
FROM documents
WHERE embedding <=> :query_embedding < 0.3
ORDER BY embedding <=> :query_embedding
LIMIT 10;
```

```python
# LanceDB 示例
import lancedb
import numpy as np

# 创建/连接数据库
db = lancedb.connect("./lance_db")

# 创建表
data = [
    {"vector": np.random.randn(128), "text": "hello world", "id": 1},
    {"vector": np.random.randn(128), "text": "goodbye world", "id": 2},
]
table = db.create_table("vectors", data=data)

# 搜索
results = table.search(np.random.randn(128)).limit(2).to_pandas()

# 过滤搜索
results = (table.search(np.random.randn(128))
           .where("id > 1")
           .limit(2)
           .to_pandas())
```

## 4. 混合检索

```
混合检索 = 向量检索 + 关键词检索

问题：纯向量检索
├── 对特定词汇不敏感（如产品型号、ID）
├── 无法理解精确匹配需求
└── 冷启动问题（新文档无 embedding）

解决方案
├── RRF（Reciprocal Rank Fusion）：融合两种排序
├── 两阶段：关键词过滤 + 向量重排
├── 加权评分：score = α * vector_score + β * bm25_score
└── 工具：Elasticsearch + PgVector、Weaviate 原生支持
```

```python
# RRF 融合示例
def rrf_fuse(vector_results, keyword_results, k=60):
    """Reciprocal Rank Fusion"""
    scores = {}

    for rank, doc in enumerate(vector_results):
        doc_id = doc['id']
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)

    for rank, doc in enumerate(keyword_results):
        doc_id = doc['id']
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)

    return sorted(scores.items(), key=lambda x: -x[1])
```
