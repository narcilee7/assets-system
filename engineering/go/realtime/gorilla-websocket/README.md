# Go WebSocket：Gorilla WebSocket

Gorilla WebSocket 是 Go 生态最成熟、使用最广泛的 WebSocket 库。它提供了完整的 RFC 6455 实现，支持客户端和服务端，API 设计简洁且性能优异。相比标准库 `golang.org/x/net/websocket`，Gorilla 提供了更好的并发安全性、更灵活的消息类型控制和更完善的扩展支持。

## 核心概念

WebSocket 是全双工通信协议，在单个 TCP 连接上提供双向数据流。Go 的并发模型（goroutine + channel）与 WebSocket 天然契合：每个连接可以启动独立的 goroutine 处理读写，通过 channel 进行协程间通信。Gorilla WebSocket 的 `Conn` 类型支持文本消息（TextMessage）、二进制消息（BinaryMessage）、关闭帧（CloseMessage）等，并提供了 `ReadMessage`/`WriteMessage` 和更底层的 `NextReader`/`NextWriter` API。

在生产环境中，WebSocket 服务需要处理连接管理（注册/注销）、心跳保活（ping/pong）、广播消息、速率限制和优雅关闭等复杂问题。Go 的 `sync.RWMutex` 和 `sync.Map` 是实现这些功能的利器。

## 代码实现

```go
// hub.go
package ws

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Client 代表一个 WebSocket 连接
type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	UserID   string
	RoomID   string
}

// Hub 维护所有活跃连接
type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan Message
	mu         sync.RWMutex
}

type Message struct {
	RoomID  string          `json:"room_id"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
	From    string          `json:"from"`
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan Message, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			if client.RoomID != "" {
				if h.rooms[client.RoomID] == nil {
					h.rooms[client.RoomID] = make(map[*Client]bool)
				}
				h.rooms[client.RoomID][client] = true
			}
			h.mu.Unlock()
			log.Printf("Client connected: user=%s room=%s", client.UserID, client.RoomID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if client.RoomID != "" {
					delete(h.rooms[client.RoomID], client)
					if len(h.rooms[client.RoomID]) == 0 {
						delete(h.rooms, client.RoomID)
					}
				}
				close(client.Send)
			}
			h.mu.Unlock()
			client.Conn.Close()
			log.Printf("Client disconnected: user=%s", client.UserID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := h.rooms[msg.RoomID]
			h.mu.RUnlock()

			data, _ := json.Marshal(msg)
			for client := range clients {
				select {
				case client.Send <- data:
				default:
					// 客户端发送缓冲区满，关闭连接
					close(client.Send)
					delete(clients, client)
				}
			}
		}
	}
}
```

```go
// client.go
package ws

import (
	"bytes"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024 // 512KB
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // 生产环境应做域名校验
	},
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		message = bytes.TrimSpace(bytes.Replace(message, []byte{'\n'}, []byte{' '}, -1))

		// 处理客户端消息
		var msg Message
		if err := json.Unmarshal(message, &msg); err == nil {
			msg.From = c.UserID
			c.Hub.broadcast <- msg
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// 批量发送队列中的消息
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ServeWs 处理 HTTP 升级到 WebSocket
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	roomID := r.URL.Query().Get("room_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	client := &Client{
		Hub:    hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID,
		RoomID: roomID,
	}
	client.Hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}
```

```go
// server.go
package main

import (
	"net/http"
	"myapp/ws"
)

func main() {
	hub := ws.NewHub()
	go hub.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(hub, w, r)
	})

	// HTTP API 向房间广播
	http.HandleFunc("/api/broadcast", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var msg ws.Message
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		hub.broadcast <- msg
		w.WriteHeader(http.StatusOK)
	})

	log.Println("WebSocket server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

## 选型对比

| 库 | 特点 | 适用场景 |
| --- | --- | --- |
| gorilla/websocket | 最成熟，文档完善，RFC 6455 完整实现 | **通用首选** |
| nhooyr/websocket | 现代化 API，Context 支持好 | 新项目，偏好简洁 API |
| gobwas/ws | 零拷贝，性能极致 | 高频交易，游戏服务器 |
| golang.org/x/net/websocket | 标准库实验包 | 不推荐生产使用 |

## 最佳实践

- **每连接双 goroutine**：一个读（ReadPump），一个写（WritePump），通过 channel 解耦
- **心跳机制**：服务端发 Ping，客户端回 Pong，超时时自动清理死连接
- **消息大小限制**：`SetReadLimit` 防止恶意客户端发送超大消息导致 OOM
- **发送缓冲区**：`Send` channel 应有缓冲（256-1024），满了则丢弃或关闭连接
- **优雅关闭**：捕获信号后先关闭 Hub 的 broadcast channel，等待所有 client 退出
- **连接数限制**：使用 `semaphore.Weighted` 限制最大并发连接数
