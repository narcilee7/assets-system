# Go AI Streaming Gateway

Go 的高性能和低延迟使其成为 AI Streaming Gateway 的优选语言。

## SSE 流式输出

```go
// sse_handler.go
package main

import (
	"fmt"
	"net/http"
	"time"
)

func chatStreamHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	messages := []string{"Hello", ",", " this", " is", " streaming", " from", " Go", "!"}
	for _, msg := range messages {
		fmt.Fprintf(w, "data: %s\n\n", msg)
		flusher.Flush()
		time.Sleep(100 * time.Millisecond)
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func main() {
	http.HandleFunc("/chat", chatStreamHandler)
	http.ListenAndServe(":8080", nil)
}
```

## 调用 OpenAI API

```go
// openai_client.go
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type ChatRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func streamChat(apiKey string, messages []Message) error {
	reqBody, _ := json.Marshal(ChatRequest{
		Model:    "gpt-4o",
		Messages: messages,
		Stream:   true,
	})

	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(reqBody))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "data: [DONE]" {
			break
		}
		if len(line) > 6 {
			fmt.Print(line[6:]) // remove "data: " prefix
		}
	}

	return scanner.Err()
}
```
