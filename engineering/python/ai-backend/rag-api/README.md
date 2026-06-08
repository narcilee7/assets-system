# Python RAG API

RAG（检索增强生成）是 AI 应用的核心架构，Python 生态有丰富的向量数据库和 LLM 集成方案。

## 架构

```
User Query → Embedding (OpenAI / HuggingFace) → Vector Search (PGVector / Milvus / Chroma) 
  → Top-K Documents → Prompt Engineering → LLM → Streaming Response
```

## 核心实现

```python
# rag_service.py
from typing import List
import openai
import numpy as np

class Document:
    def __init__(self, id: str, content: str, embedding: List[float], metadata: dict = None):
        self.id = id
        self.content = content
        self.embedding = embedding
        self.metadata = metadata or {}

class VectorStore:
    def __init__(self):
        self.documents: List[Document] = []
    
    def add(self, doc: Document):
        self.documents.append(doc)
    
    def search(self, query_embedding: List[float], top_k: int = 5) -> List[Document]:
        # 余弦相似度
        def cosine_similarity(a, b):
            return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
        
        scored = [(doc, cosine_similarity(query_embedding, doc.embedding)) 
                  for doc in self.documents]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, score in scored[:top_k]]

class RAGService:
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.client = openai.AsyncOpenAI()
    
    async def embed(self, text: str) -> List[float]:
        response = await self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding
    
    async def query(self, question: str) -> str:
        # 1. 向量化查询
        query_embedding = await self.embed(question)
        
        # 2. 检索相关文档
        docs = self.vector_store.search(query_embedding, top_k=3)
        
        # 3. 构建上下文
        context = "\n\n".join([f"[{i+1}] {doc.content}" for i, doc in enumerate(docs)])
        
        # 4. 生成回答
        prompt = f"""Based on the following context, answer the question. 
If the context doesn't contain enough information, say so.

Context:
{context}

Question: {question}

Answer:"""
        
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
        )
        
        return response.choices[0].message.content

# 使用
store = VectorStore()
store.add(Document("1", "Python 3.11 引入了更快的解释器和异常处理", [0.1, 0.2, ...]))
store.add(Document("2", "FastAPI 是一个现代的高性能 Web 框架", [0.3, 0.4, ...]))

rag = RAGService(store)
answer = asyncio.run(rag.query("什么是 FastAPI？"))
```

## PGVector 集成

```python
# pgvector_store.py
from sqlalchemy import create_engine, Column, Integer, String, Vector
from sqlalchemy.orm import declarative_base, Session

Base = declarative_base()

class DocumentModel(Base):
    __tablename__ = 'documents'
    id = Column(Integer, primary_key=True)
    content = Column(String)
    embedding = Column(Vector(1536))  # OpenAI embedding dimension

# 相似度搜索
session = Session(engine)
results = session.query(DocumentModel).order_by(
    DocumentModel.embedding.cosine_distance(query_vector)
).limit(5).all()
```
