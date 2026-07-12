package main

import (
	"fmt"
	"net"
	"time"
)

// SSEServer Server-Sent Events 服务器。
// TODO: 基于原始 TCP socket 实现事件推送。
type SSEServer struct {
	events   []string // 存储所有事件数据
	listener net.Listener
}

func NewSSEServer() *SSEServer {
	return &SSEServer{events: make([]string, 0)}
}

func (s *SSEServer) ListenAndServe(addr string) error {
	// TODO: 监听 TCP，处理 HTTP GET /events 请求
	// TODO: 发送响应头：HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\r\n
	// TODO: 如果请求包含 Last-Event-ID，从该 ID 之后的事件开始推送
	// TODO: 持续推送新事件，定期发送 :heartbeat\n
	return fmt.Errorf("not implemented")
}

// AddEvent 添加一个新事件。
func (s *SSEServer) AddEvent(data string) int {
	// TODO: 追加到 events，返回事件 ID
	return 0
}

// SSEClient 简化版 SSE 客户端。
// TODO: 基于 TCP socket 实现事件接收和断线重连。
type SSEClient struct {
	serverAddr string
	lastID     int
}

func (c *SSEClient) Connect() (chan string, error) {
	// TODO: 连接 server，发送 GET /events（带 Last-Event-ID）
	// TODO: 启动 goroutine 解析事件流，通过 channel 返回 data 字段
	// TODO: 如果连接断开，等待一段时间后重连（带 Last-Event-ID）
	return nil, fmt.Errorf("not implemented")
}

func main() {
	server := NewSSEServer()
	go server.ListenAndServe("127.0.0.1:0")
	time.Sleep(100 * time.Millisecond)

	// TODO: 启动 client，接收事件，模拟断线，验证 Last-Event-ID 恢复
	fmt.Println("PASS / FAIL 请在实现 SSEServer 和 SSEClient 后运行")
}
