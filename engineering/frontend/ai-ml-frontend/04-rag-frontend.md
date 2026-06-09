# RAG 前端架构

## 1. RAG 流程

```
用户Query
  ↓
[Query Embedding] → 向量
  ↓
[Vector Search] → 相似文档Top-K
  ↓
[Prompt构建] → "基于以下文档回答问题：\n{docs}\n\n问题：{query}"
  ↓
[LLM生成] → 回答
  ↓
[结果展示]
```

## 2. 前端 Embedding

```javascript
// 使用 Transformers.js 生成 Embedding
import { pipeline } from '@huggingface/transformers';

class EmbeddingService {
  constructor() {
    this.extractor = null;
    this.cache = new Map();  // 文本 → embedding 缓存
  }

  async init(model = 'Xenova/all-MiniLM-L6-v2') {
    this.extractor = await pipeline('feature-extraction', model, {
      dtype: 'fp16',
    });
  }

  async embed(text) {
    // 检查缓存
    const cached = this.cache.get(text);
    if (cached) return cached;

    const result = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(result.data);
    this.cache.set(text, embedding);
    return embedding;
  }

  async embedBatch(texts, batchSize = 32) {
    const results = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...embeddings);
    }
    return results;
  }
}
```

## 3. 向量检索

```javascript
// 余弦相似度
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 暴力搜索（小规模数据 < 1万条）
class BruteForceVectorStore {
  constructor() {
    this.documents = [];  // { id, text, embedding, metadata }
  }

  add(doc) {
    this.documents.push(doc);
  }

  search(queryEmbedding, topK = 5) {
    const scores = this.documents.map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

// 分层导航小世界图（HNSW，大规模数据）
// 实际使用 hnswlib-js 或类似库
```

## 4. 文档处理与分块

```javascript
class DocumentProcessor {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 512;
    this.chunkOverlap = options.chunkOverlap || 50;
  }

  // 文本分块
  chunkText(text) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      const chunk = text.slice(start, end);

      chunks.push({
        id: `chunk-${chunks.length}`,
        text: chunk,
        start,
        end,
      });

      start = end - this.chunkOverlap;
      if (start >= end) start = end;
    }

    return chunks;
  }

  // 递归字符文本分割（更智能）
  recursiveChunk(text, separators = ['\n\n', '\n', '. ', ' ']) {
    if (text.length <= this.chunkSize) {
      return [{ text, id: 'chunk-0' }];
    }

    for (const sep of separators) {
      const parts = text.split(sep);
      if (parts.length > 1) {
        const chunks = [];
        let current = '';

        for (const part of parts) {
          const candidate = current ? current + sep + part : part;
          if (candidate.length > this.chunkSize && current) {
            chunks.push(current);
            current = part;
          } else {
            current = candidate;
          }
        }

        if (current) chunks.push(current);

        // 递归处理超长的 chunk
        return chunks.flatMap((c, i) =>
          c.length > this.chunkSize
            ? this.recursiveChunk(c, separators.slice(1))
            : [{ text: c, id: `chunk-${i}` }]
        );
      }
    }

    // 最后手段：固定长度切分
    return this.chunkText(text);
  }

  // PDF 文本提取
  async extractPDF(arrayBuffer) {
    // 使用 pdf.js
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');
      pages.push({ page: i, text });
    }

    return pages;
  }
}
```

## 5. 前端 RAG 完整流程

```javascript
class FrontendRAG {
  constructor() {
    this.embedding = new EmbeddingService();
    this.vectorStore = new BruteForceVectorStore();
    this.docProcessor = new DocumentProcessor();
  }

  async init() {
    await this.embedding.init();
  }

  // 添加文档
  async addDocument(text, metadata = {}) {
    const chunks = this.docProcessor.recursiveChunk(text);

    for (const chunk of chunks) {
      const embedding = await this.embedding.embed(chunk.text);
      this.vectorStore.add({
        id: chunk.id,
        text: chunk.text,
        embedding,
        metadata: { ...metadata, chunkIndex: chunk.id },
      });
    }
  }

  // 查询
  async query(question, topK = 3) {
    const queryEmbedding = await this.embedding.embed(question);
    const relevantDocs = this.vectorStore.search(queryEmbedding, topK);

    const context = relevantDocs
      .map((d) => `[${d.metadata.source || 'doc'}] ${d.text}`)
      .join('\n\n');

    const prompt = `基于以下文档回答问题。如果文档中没有相关信息，请说明。

文档：
${context}

问题：${question}

回答：`;

    return { prompt, sources: relevantDocs };
  }

  // 持久化到 IndexedDB
  async saveToIndexedDB(dbName = 'rag-store') {
    const db = await openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore('documents', { keyPath: 'id' });
        db.createObjectStore('embeddings', { keyPath: 'id' });
      },
    });

    for (const doc of this.vectorStore.documents) {
      await db.put('documents', { id: doc.id, text: doc.text, metadata: doc.metadata });
      await db.put('embeddings', { id: doc.id, embedding: doc.embedding });
    }
  }

  async loadFromIndexedDB(dbName = 'rag-store') {
    const db = await openDB(dbName, 1);
    const docs = await db.getAll('documents');
    const embeddings = await db.getAll('embeddings');

    const embeddingMap = new Map(embeddings.map((e) => [e.id, e.embedding]));

    for (const doc of docs) {
      this.vectorStore.add({
        id: doc.id,
        text: doc.text,
        embedding: embeddingMap.get(doc.id),
        metadata: doc.metadata,
      });
    }
  }
}
```
