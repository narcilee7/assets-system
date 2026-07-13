# RAG 面试深度问答

## 核心概念地图

1. **Chunking**：把长文档切分成适合 embedding 和检索的片段。
2. **Embedding**：把文本映射到向量空间，语义相似的文本向量距离近。
3. **Retriever**：根据 query 召回相关 chunk。
4. **Reranker**：对召回结果做精排，提升相关性。
5. **Generator**：基于检索内容生成带引用的回答。
6. **Citation**：让回答的每个 claim 都能追溯到来源。

## 架构与数据流

```text
Documents
  → Loader（PDF / 网页 / 数据库）
    → Chunker（切分策略）
      → Embedding Model
        → Vector Index（+ 元数据索引）
          → Retriever（top-k）
            → Reranker（精排）
              → Prompt Builder（context + query）
                → LLM Generator
                  → Answer with Citation
```

## 关键设计决策

### 1. Chunk 怎么切？

| 策略 | 优点 | 缺点 |
| --- | --- | --- |
| Fixed size | 简单、均匀 | 可能切断语义 |
| Semantic | 按语义边界切 | 需要模型或启发式 |
| Structural | 按标题/段落/表格切 | 保留文档结构 |
| Recursive | 大 → 小逐步切 | 灵活但复杂 |

**Overlap**：相邻 chunk 共享部分内容，保证边界信息不丢失。

### 2. Embedding 模型怎么选？

- 通用场景：OpenAI text-embedding-3、BGE、GTE。
- 垂直领域：领域数据微调效果更好。
- 多语言：mE5、BGE-M3。
- 维度：常见 384/768/1024/1536；维度越高越贵，但表达能力越强。

### 3. 向量索引怎么选？

| 索引 | 特点 | 适用 |
| --- | --- | --- |
| Flat | 精确、慢 | 数据量小 |
| IVF | 倒排 + 聚类 | 中等规模 |
| HNSW | 图索引、快、占用内存 | 大规模、高召回 |
| PQ / SQ | 量化压缩 | 内存受限 |

### 4. 什么是 Hybrid Search？

- 向量检索捕捉语义相似。
- 关键词检索（BM25）捕捉精确匹配（如产品型号、ID）。
- 两者结果通过 RRF（Reciprocal Rank Fusion）或 learned model 合并。
- 元数据过滤（如时间、分类）减少检索空间。

### 5. Citation 怎么做？

- 在 prompt 里给每个 chunk 编号。
- 要求模型在回答中引用编号。
- 回答后做 citation accuracy 检查：claim 是否被对应 chunk 支持。
- 对无法回答的问题，要求模型明确拒答。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| 检索不到相关文档 | chunk 太小、embedding 不准、索引未更新 | 调整 chunk 策略、换模型、加关键词索引 |
| 检索到但不相关 | top-k 太大、语义漂移 | 加 reranker、加 metadata filter |
| 回答 hallucination | 生成模型过度发挥 | 强制 citation、降低 temperature、拒答策略 |
| 答案不完整 | 关键信息被切到不同 chunk | 增大 chunk、加 overlap、用 parent chunk |
| 拒答过多 | 检索阈值太严 | 调阈值、hybrid search、fallback 到通用回答 |
| 更新延迟 | 新文档未入库 | 近实时索引 pipeline、增量更新 |
| 多文档冲突 | 不同来源信息矛盾 | 检索时带时间戳、优先级、让模型说明冲突 |

## 面试题与应答脚本

### Q1：RAG 和 Fine-tuning 的区别和适用场景？

**答**：
- **RAG**：把知识存在外部检索系统，模型只负责理解 query 和基于检索内容生成。适合知识频繁更新、需要可解释来源的场景。
- **Fine-tuning**：把知识压缩到模型参数里。适合需要改变模型行为、语气、格式的场景；不适合频繁变化的知识。

**追问**：
- 能不能结合？（可以：基础模型用 RAG 获取事实，再用 fine-tuned 模型生成特定格式。）
- 什么情况下 RAG 不如 fine-tuning？（知识高度结构化、需要复杂推理且检索成本高于训练时。）

### Q2：Chunk size 和 overlap 怎么选？

**答**：
- Chunk size 取决于文档类型和 embedding 模型上下文。
- 常规文本：256-512 tokens；代码/法律文档：可能更大。
- Overlap 一般 10%-20%，保证边界语义完整。
- 最终要通过 eval 调参，看 retrieval 和 answer quality。

**追问**：
- chunk 太大会怎样？（一个 chunk 包含多个主题，检索相关性下降。）
- chunk 太小会怎样？（丢失上下文，答案碎片化。）

### Q3：为什么需要 reranker？

**答**：
- Embedding retrieval 是近似最近邻，可能召回语义相关但不精确的结果。
- Reranker（通常是 cross-encoder）对 query 和文档做精细交互打分，top-k 相关性更高。
- 典型流程：先用向量召回 100 个，再用 reranker 选 top-5。

**追问**：
- reranker 的代价？（比 bi-encoder 慢，因为要做 pairwise 编码。）
- 什么时候不需要 reranker？（数据量小、对延迟敏感、recall@k 已经很高。）

### Q4：Hybrid search 怎么融合向量检索和关键词检索？

**答**：
- 分别用向量检索和 BM25 得到各自排序。
- 用 RRF 公式：`score = Σ 1/(k + rank)`，k 通常取 60。
- 也可以训练一个小模型做结果融合。
- 元数据过滤先执行，减少候选集。

**追问**：
- RRF 的优点？（不需要训练，对分数分布不敏感，适合异构排序。）
- 如果向量结果和关键词结果差异很大怎么办？（分析 bad case；可能某些 query 更适合关键词，可调权重。）

### Q5：如何处理检索不到的情况？

**答**：
- 设置置信度阈值，低于阈值则拒答。
- 返回「根据现有资料无法回答」。
- 或者 fallback 到通用模型回答，但要明确标注未引用知识库。
- 记录这类 query，补充文档或优化检索。

**追问**：
- 用户问的是常识性问题，但知识库里没有，怎么办？（可以允许用模型预训练知识回答，但要区分来源。）
- 拒答率太高怎么优化？（扩大检索范围、降低阈值、补充文档。）

### Q6：Citation 怎么做才可信？

**答**：
- 给 context 中每个 chunk 编号。
- Prompt 明确要求：「请基于以上内容回答，并在每个事实后标注来源编号。」
- 生成后做 citation validation：检查引用的 chunk 是否支持对应 claim。
- 对 unsupported claim，要么删除，要么改写。

**追问**：
- 模型不引用怎么办？（用 few-shot 示例、后处理强制加 citation、降低 temperature。）
- 引用错位怎么办？（citation validation 会 catch；也可训练模型输出 span-level citation。）

### Q7：RAG 系统的 Eval 指标有哪些？

**答**：
- **Retrieval**：recall@k、precision@k、MRR、NDCG。
- **Answer**：faithfulness、relevance、correctness、completeness。
- **Citation**：citation precision、citation recall、citation accuracy。
- **End-to-end**：task completion、user satisfaction。

**追问**：
- 哪个指标最能反映 RAG 好坏？（没有单一指标；retrieval 看 recall，answer 看 faithfulness，上线看用户满意度。）
- 指标冲突怎么办？（如 recall 高但 citation 低，需要权衡。）

### Q8：多模态 RAG 怎么做？

**答**：
- 图片：用 vision embedding 模型（CLIP）生成向量；或 OCR 提取文本。
- 表格：结构化解析后作为文本或 JSON chunk。
- 视频：抽帧 + ASR 文本，分别入向量库。
- 检索时按模态路由或统一向量空间。

**追问**：
- 图片里的文字怎么检索？（OCR + 文本 embedding；或直接用多模态模型。）
- 表格检索有什么特殊问题？（单元格被切分后丢失行列关系；可用 HTML/Markdown 保留结构。）

### Q9：RAG 怎么保证数据隐私？

**答**：
- 文档按 tenant / user 隔离，检索时加 filter。
- 敏感文档做访问控制，不进入公共向量库。
- PII 脱敏后再入 embedding。
- 审计检索日志。

**追问**：
- 多租户共用向量库会不会泄露？（会；必须加 namespace 或 metadata filter；或物理隔离。）
- 检索日志里能不能看到用户 query？（可以，但要加密存储并设置保留期。）

### Q10：RAG 系统的索引更新策略？

**答**：
- 新增/修改文档时重新 chunk 和 embedding。
- 删除文档时标记删除或物理删除对应向量。
- 高频更新场景用增量 pipeline，避免全量重建。
- 设置版本控制，支持回滚。

**追问**：
- 文档更新了但向量没更新，用户看到旧答案怎么办？（索引更新延迟；可显示文档版本时间，或做 staleness 检测。）
- 全量重建索引怎么做？（异步任务，双写切换，避免影响在线查询。）

## 开放设计题

1. **设计一个面向企业内部知识库的 RAG 系统**：支持 Word/PDF/网页，支持权限隔离，支持 citation。说明 chunk 策略、索引结构、检索流程、隐私控制。

2. **设计一个电商客服 RAG**：用户问「这款手机的续航怎么样」，系统需要从商品详情、用户评价、规格参数中综合回答。说明 hybrid search、reranker、答案生成策略。

3. **设计一个代码库问答 RAG**：用户问「这个函数在哪里被调用」。说明如何切分代码、embedding 选择、符号解析、跨文件引用处理。

## 与其他模块的关系

- **Agent Runtime**：Agent 可以调用 RAG 作为工具；RAG 也可以独立作为问答系统。
- **Memory**：长期记忆可视为个性化 RAG，检索用户相关历史。
- **Eval**：RAG 的 retrieval、answer、citation 都需要 eval。
- **Observability**：RAG 的检索结果、分数、延迟需要 trace。
- **Tool Calling**：RAG 可以封装成 `search_knowledge_base` 工具。
- **Model Serving**：Embedding 和 generation 模型的路由与配额由 Model Serving 管理。
