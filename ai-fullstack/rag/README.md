# RAG

RAG 主线训练从文档到可引用答案的完整链路。

## 模块

| 模块 | 关键点 |
| --- | --- |
| Loader | 文件、网页、数据库、知识库 |
| Chunker | chunk size、overlap、结构化切分 |
| Embedding | model、batch、cache |
| Index | vector、metadata、namespace |
| Retriever | top k、filter、hybrid search |
| Reranker | 相关性重排 |
| Generator | citation、grounding、拒答 |
| Eval | recall、faithfulness、answer quality |

## 第一阶段资产

- simple document RAG。
- citation answer。
- retrieval eval set。
- chunk strategy comparison。

