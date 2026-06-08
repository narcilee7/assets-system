# Go Realtime Chat Case Study

基于 WebSocket + Redis Pub/Sub 的水平扩展实时聊天系统。

## 架构

```
Client → Load Balancer → Go Server (WebSocket)
                              ↓
                         Redis Pub/Sub
                              ↓
                    Go Server 2 (WebSocket)
```

## 核心实现

```go
// chat_server.go
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
var redisClient *redis.Client

// Hub 管理所有连接
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan Message
	room string
}

type Message struct {
	Room    string `json:"room"`
	User    string `json:"user"`
	Content string `json:"content"`
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			// 本地广播 + Redis 发布
			for client := range h.clients {
				if client.room == message.Room {
					select {
					case client.send <- message:
					default:
						close(client.send)
						delete(h.clients, client)
					}
				}
			}
			// Redis Pub/Sub 跨实例广播
			data, _ := json.Marshal(message)
			redisClient.Publish(context.Background(), "chat:"+message.Room, data)
		}
	}
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	room := r.URL.Query().Get("room")
	conn, _ := upgrader.Upgrade(w, r, nil)
	client := &Client{hub: hub, conn: conn, send: make(chan Message, 256), room: room}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() { c.hub.unregister <- c }()
	for {
		var msg Message
		if err := c.conn.ReadJSON(&msg); err != nil {
			break
		}
		msg.Room = c.room
		c.hub.broadcast <- msg
	}
}

func (c *Client) writePump() {
	for msg := range c.send {
		c.conn.WriteJSON(msg)
	}
}
```
