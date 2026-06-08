# RAG API (Retrieval-Augmented Generation)

RAG 是 AI 应用的核心架构：先检索相关文档，再将上下文注入 LLM 提示词。

## 架构

```
[User Query] -> [Embedding] -> [Vector DB] -> [Top-K Chunks]
                                    |
                                    v
[LLM Prompt = System + Chunks + Query] -> [LLM] -> [Response + Citations]
```

## 核心实现

### 1. Embedding Service

```ts
// embedding.service.ts
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
});

export async function embedQuery(text: string): Promise<number[]> {
  return embeddings.embedQuery(text);
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embeddings.embedDocuments(texts);
}
```

### 2. Vector Store (PGVector)

```ts
// vector-store.ts
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';

export const vectorStore = await PGVectorStore.initialize(
  new OpenAIEmbeddings(),
  {
    postgresConnectionOptions: {
      connectionString: process.env.DATABASE_URL,
    },
    tableName: 'documents',
    columns: {
      idColumnName: 'id',
      vectorColumnName: 'embedding',
      contentColumnName: 'content',
      metadataColumnName: 'metadata',
    },
  }
);

export async function searchSimilar(query: string, k = 5) {
  return vectorStore.similaritySearch(query, k);
}
```

### 3. RAG Pipeline API

```ts
// rag.controller.ts
import { Request, Response } from 'express';
import OpenAI from 'openai';
import { searchSimilar } from './vector-store';

const openai = new OpenAI();

export async function ragChat(req: Request, res: Response) {
  const { query } = req.body;

  // 1. 检索相关文档
  const docs = await searchSimilar(query, 5);
  const context = docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join('\n\n');

  // 2. 构建提示词
  const messages = [
    {
      role: 'system' as const,
      content: `你是一个有帮助的助手。请基于以下参考资料回答问题，并在回答末尾标注引用编号。\n\n参考资料：\n${context}`,
    },
    { role: 'user' as const, content: query },
  ];

  // 3. 调用 LLM（支持 Streaming）
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true,
  });

  res.setHeader('Content-Type', 'text/event-stream');
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    res.write(`data: ${JSON.stringify({ content })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}
```

## 生产要点

- **分块策略**：按段落 / 语义 / 固定长度分块，块大小 200-500 tokens 为宜。
- **重排序（Rerank）**：先用向量检索 Top-20，再用重排序模型选 Top-5，精度提升显著。
- **引用溯源**：返回的 chunk 必须包含 source URL / document ID，方便用户验证。
- **ACL**：检索前过滤用户有权限访问的文档集合。
- **缓存**：热门查询的 embedding 和检索结果可缓存，减少 LLM 调用成本。
