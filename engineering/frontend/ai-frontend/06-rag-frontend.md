# RAG 前端实现

## 1. 向量检索前端化

```typescript
// 前端向量数据库（基于 IndexDB + 向量运算）

class VectorStore {
  private db: IDBDatabase | null = null;
  private dimension: number;

  constructor(dimension = 384) {
    this.dimension = dimension;
  }

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('vector-store', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('vectors')) {
          const store = db.createObjectStore('vectors', { keyPath: 'id' });
          store.createIndex('collection', 'collection', { unique: false });
        }
      };
    });
  }

  async add(id: string, vector: Float32Array, metadata: Record<string, unknown>, collection = 'default') {
    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: ${vector.length} != ${this.dimension}`);
    }

    return this._transaction('vectors', 'readwrite', (store) => {
      return store.put({ id, vector: Array.from(vector), metadata, collection });
    });
  }

  async search(query: Float32Array, topK = 5, collection?: string): Promise<SearchResult[]> {
    if (query.length !== this.dimension) {
      throw new Error(`Query dimension mismatch: ${query.length} != ${this.dimension}`);
    }

    // 获取所有向量
    const allVectors = await this._getAll(collection);

    // 计算余弦相似度
    const scored = allVectors.map((item) => ({
      ...item,
      score: cosineSimilarity(query, new Float32Array(item.vector)),
    }));

    // 排序取 topK
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private _getAll(collection?: string): Promise<any[]> {
    return this._transaction('vectors', 'readonly', (store) => {
      if (collection) {
        const index = store.index('collection');
        return index.getAll(collection);
      }
      return store.getAll();
    });
  }

  private _transaction<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.db) throw new Error('Database not initialized');
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// 余弦相似度
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

## 2. 文档分块与嵌入

```typescript
// 文本分块策略

class DocumentChunker {
  private chunkSize: number;
  private overlap: number;

  constructor(chunkSize = 500, overlap = 50) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  // 按段落分割
  chunkByParagraph(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let current = '';

    for (const para of paragraphs) {
      if (current.length + para.length > this.chunkSize && current.length > 0) {
        chunks.push(current.trim());
        current = para;
      } else {
        current += '\n\n' + para;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  // 滑动窗口分割
  chunkBySlidingWindow(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += this.chunkSize - this.overlap;
    }

    return chunks;
  }

  // 按语义分割（使用句子边界）
  chunkBySentence(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length > this.chunkSize && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += ' ' + sentence;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}

// 完整 RAG 流程
class FrontendRAG {
  private embedder: TransformersPipeline;
  private vectorStore: VectorStore;
  private chunker: DocumentChunker;

  constructor() {
    this.embedder = new TransformersPipeline();
    this.vectorStore = new VectorStore(384);
    this.chunker = new DocumentChunker();
  }

  async init() {
    await this.vectorStore.init();
    await this.embedder.loadTask('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async addDocument(id: string, content: string, metadata?: Record<string, unknown>) {
    const chunks = this.chunker.chunkByParagraph(content);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.embedder.embed(chunk);

      await this.vectorStore.add(
        `${id}-chunk-${i}`,
        embedding[0],
        {
          ...metadata,
          docId: id,
          chunkIndex: i,
          content: chunk,
        }
      );
    }
  }

  async query(question: string, topK = 3): Promise<RAGResult> {
    // 1. 嵌入查询
    const queryEmbedding = await this.embedder.embed(question);

    // 2. 检索相关文档
    const results = await this.vectorStore.search(queryEmbedding[0], topK);

    // 3. 构建上下文
    const context = results.map((r) => r.metadata.content).join('\n\n---\n\n');

    return {
      context,
      sources: results.map((r) => ({
        docId: r.metadata.docId,
        chunkIndex: r.metadata.chunkIndex,
        score: r.score,
        content: r.metadata.content,
      })),
    };
  }
}
```

## 3. RAG + LLM 集成

```typescript
// 完整的 RAG Chat

class RAGChat {
  private rag: FrontendRAG;
  private llm: BrowserLLM;
  private conversationManager: ConversationManager;

  constructor() {
    this.rag = new FrontendRAG();
    this.llm = new BrowserLLM('Phi-3-mini-4k-instruct-q4f16_1-MLC');
    this.conversationManager = new ConversationManager();
  }

  async init() {
    await this.rag.init();
    await this.llm.init();
  }

  async ingestDocuments(documents: Array<{ id: string; content: string }>) {
    for (const doc of documents) {
      await this.rag.addDocument(doc.id, doc.content);
    }
  }

  async *chat(message: string, conversationId: string) {
    // 1. RAG 检索
    const ragResult = await this.rag.query(message);

    // 2. 构建增强提示
    const systemPrompt = `你是一个基于文档的问答助手。使用以下上下文回答用户问题。
如果上下文不足以回答问题，请明确说明。

上下文：
${ragResult.context}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationManager.getMessages(conversationId),
      { role: 'user', content: message },
    ];

    // 3. 流式生成
    let fullResponse = '';
    for await (const chunk of this.llm.streamChat(messages)) {
      fullResponse += chunk;
      yield {
        type: 'content' as const,
        content: chunk,
      };
    }

    // 4. 返回来源
    yield {
      type: 'sources' as const,
      sources: ragResult.sources,
    };

    // 5. 保存对话
    this.conversationManager.addMessage(conversationId, { role: 'user', content: message });
    this.conversationManager.addMessage(conversationId, { role: 'assistant', content: fullResponse });
  }
}

// React Hook
function useRAGChat() {
  const [ragChat] = useState(() => new RAGChat());
  const [messages, setMessages] = useState<Array<{ role: string; content: string; sources?: Source[] }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const init = useCallback(async (docs: Array<{ id: string; content: string }>) => {
    await ragChat.init();
    await ragChat.ingestDocuments(docs);
  }, [ragChat]);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);

    let assistantContent = '';
    let sources: Source[] = [];

    for await (const chunk of ragChat.chat(content, 'default')) {
      if (chunk.type === 'content') {
        assistantContent += chunk.content;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          }
          return [...prev, { role: 'assistant', content: assistantContent }];
        });
      } else if (chunk.type === 'sources') {
        sources = chunk.sources;
      }
    }

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, sources }];
      }
      return prev;
    });

    setIsLoading(false);
  }, [ragChat]);

  return { messages, sendMessage, isLoading, init };
}
```

## 4. 混合 RAG（服务端 + 端侧）

```typescript
// 策略：简单查询端侧处理，复杂查询服务端处理

class HybridRAG {
  private frontendRAG: FrontendRAG;
  private apiEndpoint: string;

  constructor(apiEndpoint: string) {
    this.frontendRAG = new FrontendRAG();
    this.apiEndpoint = apiEndpoint;
  }

  async query(question: string, options: { useLocal?: boolean; topK?: number } = {}) {
    const { useLocal = true, topK = 5 } = options;

    // 本地检索
    let localResults: SearchResult[] = [];
    if (useLocal) {
      try {
        localResults = await this.frontendRAG.query(question, topK);
      } catch {
        // 本地检索失败，回退到服务端
      }
    }

    // 如果本地结果置信度不足，调用服务端
    const needsServer = !useLocal || localResults.length === 0 || localResults[0].score < 0.7;

    if (needsServer) {
      const response = await fetch(`${this.apiEndpoint}/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, topK, excludeIds: localResults.map((r) => r.metadata.docId) }),
      });

      const serverResults = await response.json();
      return this.mergeResults(localResults, serverResults);
    }

    return localResults;
  }

  private mergeResults(local: SearchResult[], server: SearchResult[]): SearchResult[] {
    const combined = [...local, ...server];
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, 5);
  }
}
```
