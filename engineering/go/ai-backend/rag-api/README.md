# Go RAG API

Go 适合构建高性能的 RAG（检索增强生成）API 服务。

## 架构

```
Query → Embedding API → Vector Search (PGVector/Milvus) → Top-K → LLM Prompt → Stream Response
```

## 核心实现

```go
// rag_service.go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Document 表示向量化文档
type Document struct {
	ID      string    `json:"id"`
	Content string    `json:"content"`
	Embedding []float32 `json:"embedding"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// RAGService 检索服务
type RAGService struct {
	vectorStore VectorStore
	embedder    Embedder
}

type VectorStore interface {
	Search(ctx context.Context, embedding []float32, topK int) ([]Document, error)
}

type Embedder interface {
	Embed(ctx context.Context, text string) ([]float32, error)
}

func (s *RAGService) Query(ctx context.Context, question string) (*RAGResponse, error) {
	// 1. 生成 embedding
	embedding, err := s.embedder.Embed(ctx, question)
	if err != nil {
		return nil, err
	}

	// 2. 检索相关文档
	docs, err := s.vectorStore.Search(ctx, embedding, 5)
	if err != nil {
		return nil, err
	}

	// 3. 构建 prompt
	context := buildContext(docs)
	prompt := fmt.Sprintf(`Based on the following context, answer the question.
Context:
%s

Question: %s`, context, question)

	return &RAGResponse{
		Answer:    "",
		Documents: docs,
		Prompt:    prompt,
	}, nil
}

func buildContext(docs []Document) string {
	var context string
	for i, doc := range docs {
		context += fmt.Sprintf("[%d] %s\n", i+1, doc.Content)
	}
	return context
}

type RAGResponse struct {
	Answer    string     `json:"answer"`
	Documents []Document `json:"documents"`
	Prompt    string     `json:"prompt"`
}
```
