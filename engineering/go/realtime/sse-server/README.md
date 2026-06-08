# Go Server-Sent Events (SSE)

Server-Sent Events (SSE) 是 HTTP 之上的单向服务器推送技术，标准化于 HTML5。相比 WebSocket，SSE 基于纯 HTTP，天然支持自动重连、事件 ID 和断线恢复，且更容易穿透企业防火墙和代理。Go 的标准库 `net/http` 足以实现高性能的 SSE 服务，无需额外依赖。

## 核心概念

SSE 通过设置 `Content-Type: text/event-stream` 和保持连接不关闭来实现持续推送。消息格式为纯文本，字段包括 `id:`（事件 ID）、`event:`（事件类型）、`data:`（消息体）和 `retry:`（重连间隔）。浏览器端的 `EventSource` API 会自动处理重连，并在请求头中携带 `Last-Event-ID`，服务端据此恢复断线期间的消息。

Go 实现 SSE 的核心是 `http.Flusher` 接口，它允许在响应写入后立即刷新缓冲区，将数据推送到客户端。每个 SSE 连接需要一个独立的 goroutine 监听事件并写入响应。

## 代码实现

```go
// sse.go
package sse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
)

// Event 表示 SSE 事件
type Event struct {
	ID    string
	Event string
	Data  interface{}
	Retry int // 毫秒
}

func (e *Event) Bytes() []byte {
	var buf bytes.Buffer
	if e.ID != "" {
		fmt.Fprintf(&buf, "id: %s\n", e.ID)
	}
	if e.Event != "" {
		fmt.Fprintf(&buf, "event: %s\n", e.Event)
	}
	if e.Retry > 0 {
		fmt.Fprintf(&buf, "retry: %d\n", e.Retry)
	}

	// data 字段支持多行
	switch v := e.Data.(type) {
	case string:
		fmt.Fprintf(&buf, "data: %s\n", v)
	case []byte:
		fmt.Fprintf(&buf, "data: %s\n", string(v))
	default:
		b, _ := json.Marshal(v)
		fmt.Fprintf(&buf, "data: %s\n", string(b))
	}

	buf.WriteString("\n")
	return buf.Bytes()
}

// Broker 管理 SSE 连接和广播
type Broker struct {
	clients   map[chan Event]bool
	rooms     map[string]map[chan Event]bool
	mu        sync.RWMutex
}

func NewBroker() *Broker {
	return &Broker{
		clients: make(map[chan Event]bool),
		rooms:   make(map[string]map[chan Event]bool),
	}
}

func (b *Broker) Subscribe(roomID string) chan Event {
	ch := make(chan Event, 10)
	b.mu.Lock()
	b.clients[ch] = true
	if roomID != "" {
		if b.rooms[roomID] == nil {
			b.rooms[roomID] = make(map[chan Event]bool)
		}
		b.rooms[roomID][ch] = true
	}
	b.mu.Unlock()
	return ch
}

func (b *Broker) Unsubscribe(ch chan Event, roomID string) {
	b.mu.Lock()
	delete(b.clients, ch)
	close(ch)
	if roomID != "" {
		delete(b.rooms[roomID], ch)
	}
	b.mu.Unlock()
}

func (b *Broker) Broadcast(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.clients {
		select {
		case ch <- event:
		default:
			// 客户端消费慢，丢弃消息
		}
	}
}

func (b *Broker) BroadcastToRoom(roomID string, event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	clients := b.rooms[roomID]
	for ch := range clients {
		select {
		case ch <- event:
		default:
		}
	}
}
```

```go
// handler.go
package sse

import (
	"fmt"
	"net/http"
	"time"
)

// SSEHandler 处理 SSE 连接
func (b *Broker) SSEHandler(w http.ResponseWriter, r *http.Request) {
	// 检查 Flusher 支持
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// 设置 SSE 响应头
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*") // CORS

	roomID := r.URL.Query().Get("room")
	lastID := r.Header.Get("Last-Event-ID")

	// 如果有 lastID，尝试恢复历史消息（需接入消息存储）
	if lastID != "" {
		// replayEvents(w, flusher, roomID, lastID)
	}

	ch := b.Subscribe(roomID)
	defer b.Unsubscribe(ch, roomID)

	// 通知客户端连接成功
	fmt.Fprint(w, ":ok\n\n")
	flusher.Flush()

	// 心跳 ticker
	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	// 监听客户端断开
	notify := r.Context().Done()

	for {
		select {
		case event, ok := <-ch:
			if !ok {
				return
			}
			if _, err := w.Write(event.Bytes()); err != nil {
				return
			}
			flusher.Flush()

		case <-heartbeat.C:
			// 发送注释作为心跳保持连接
			if _, err := fmt.Fprint(w, ":heartbeat\n\n"); err != nil {
				return
			}
			flusher.Flush()

		case <-notify:
			return
		}
	}
}

// PublishHandler HTTP API 发布事件
func (b *Broker) PublishHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var event Event
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	roomID := r.URL.Query().Get("room")
	if roomID != "" {
		b.BroadcastToRoom(roomID, event)
	} else {
		b.Broadcast(event)
	}

	w.WriteHeader(http.StatusAccepted)
}
```

```go
// main.go
package main

import (
	"log"
	"net/http"
	"myapp/sse"
)

func main() {
	broker := sse.NewBroker()

	http.HandleFunc("/events", broker.SSEHandler)
	http.HandleFunc("/publish", broker.PublishHandler)

	// 演示：定时推送系统消息
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		counter := 0
		for range ticker.C {
			counter++
			broker.Broadcast(sse.Event{
				ID:    fmt.Sprintf("sys-%d", counter),
				Event: "system",
				Data: map[string]interface{}{
					"time":    time.Now().Format(time.RFC3339),
					"message": "Server heartbeat",
				},
				Retry: 5000,
			})
		}
	}()

	log.Println("SSE server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>SSE Demo</title>
</head>
<body>
    <div id="events"></div>
    <script>
        const evtSource = new EventSource("/events?room=general");
        
        evtSource.addEventListener("system", (e) => {
            const data = JSON.parse(e.data);
            document.getElementById("events").innerHTML += `<p>[${data.time}] ${data.message}</p>`;
        });

        evtSource.onmessage = (e) => {
            console.log("Default event:", e.data);
        };

        evtSource.onerror = (e) => {
            console.error("SSE error, reconnecting...");
        };
    </script>
</body>
</html>
```

## 选型对比

| 技术 | 方向 | 协议 | 自动重连 | 浏览器支持 | 适用场景 |
| --- | --- | --- | --- | --- | --- |
| SSE | 服务端->客户端 | HTTP | ✅ 原生 | 现代浏览器 | 股票行情、日志流、通知 |
| WebSocket | 双向 | WS/WSS | ❌ 需手动 | 广泛 | 聊天、游戏、协作编辑 |
| Long Polling | 客户端->服务端 | HTTP | ❌ | 全部 | 旧系统兼容 |
| WebTransport | 双向 | HTTP/3 | ❌ | Chrome | 未来替代方案 |

## 最佳实践

- **使用事件 ID**：每个消息设置唯一 ID，客户端断线重连时通过 `Last-Event-ID` 恢复
- **心跳保活**：发送注释行（`:heartbeat`）保持连接，防止 NAT/代理超时断开
- **连接数限制**：浏览器对同一域名的 SSE 连接数有限制（通常 6 个），使用单一连接 + 事件路由
- **优雅关闭**：客户端断开时及时清理 channel，防止 goroutine 泄漏
- **消息缓冲**：使用带缓冲的 channel，避免慢消费客户端阻塞广播
- **Nginx 配置**：设置 `proxy_buffering off` 和 `proxy_read_timeout`，确保 SSE 流正常通过
