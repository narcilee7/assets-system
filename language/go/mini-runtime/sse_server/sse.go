package minisse

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// Event SSE 事件
type Event struct {
	ID    string // 可选，用于断线重连
	Event string // 事件类型，如 "message", "update"
	Data  []byte // 消息体
	Retry int    // 客户端重连间隔（毫秒）
}

// Encode 编码为 SSE 格式
func (e Event) Encode() []byte {
	var buf []byte
	if e.ID != "" {
		buf = append(buf, fmt.Sprintf("id: %s\n", e.ID)...)
	}
	if e.Event != "" {
		buf = append(buf, fmt.Sprintf("event: %s\n", e.Event)...)
	}
	if e.Retry > 0 {
		buf = append(buf, fmt.Sprintf("retry: %d\n", e.Retry)...)
	}
	// data 可能有多行，每行前面加 data:
	lines := splitLines(e.Data)
	for _, line := range lines {
		buf = append(buf, fmt.Sprintf("data: %s\n", line)...)
	}
	buf = append(buf, '\n') // 空行表示事件结束
	return buf
}

func splitLines(b []byte) []string {
	if len(b) == 0 {
		return []string{""}
	}
	var out []string
	start := 0
	for i := 0; i < len(b); i++ {
		if b[i] == '\n' {
			out = append(out, string(b[start:i]))
			start = i + 1
		}
	}
	if start < len(b) {
		out = append(out, string(b[start:]))
	}
	return out
}

// ===== Broker 广播中心 =====

type Broker struct {
	mu        sync.RWMutex
	clients   map[chan Event]struct{}
	closed    bool
	heartbeat time.Duration
}

func NewBroker(heartbeat time.Duration) *Broker {
	if heartbeat <= 0 {
		heartbeat = 30 * time.Second
	}
	b := &Broker{
		clients:   make(map[chan Event]struct{}),
		heartbeat: heartbeat,
	}
	go b.heartbeatLoop()
	return b
}

// Subscribe 注册新客户端，返回接收 channel
func (b *Broker) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event, 64)

	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()

	unsub := func() {
		b.mu.Lock()
		delete(b.clients, ch)
		b.mu.Unlock()
		close(ch)
	}

	return ch, unsub
}

// Publish 广播到所有客户端
// 慢的客户端 channel 满则丢弃（不阻塞广播）
func (b *Broker) Publish(e Event) {
	b.mu.RLock()
	clients := make([]chan Event, 0, len(b.clients))
	for ch := range b.clients {
		clients = append(clients, ch)
	}
	b.mu.RUnlock()

	for _, ch := range clients {
		select {
		case ch <- e:
		default:
			// channel 满，丢弃
		}
	}
}

// PublishTo 发送给特定客户端（通过返回的 channel 匹配）
func (b *Broker) PublishTo(ch chan<- Event, e Event) bool {
	select {
	case ch <- e:
		return true
	default:
		return false
	}
}

// Close 关闭所有客户端连接
func (b *Broker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return
	}
	b.closed = true
	for ch := range b.clients {
		close(ch)
		delete(b.clients, ch)
	}
}

// heartbeatLoop 定时发送心跳注释（:heartbeat）
func (b *Broker) heartbeatLoop() {
	ticker := time.NewTicker(b.heartbeat)
	defer ticker.Stop()
	for range ticker.C {
		b.Publish(Event{Data: []byte(":heartbeat")})
	}
}

// ===== HTTP Handler =====

// Handler SSE 连接处理器
func (b *Broker) Handler(w http.ResponseWriter, r *http.Request) {
	// 1. SSE 响应头
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// 2. 获取 Flusher
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	// 3. 订阅
	events, unsub := b.Subscribe()
	defer unsub()

	// 4. 发送初始连接成功事件
	_ = writeEvent(w, flusher, Event{Event: "connected", Data: []byte(`{"status":"ok"}`)})

	// 5. 主循环：监听事件 / context /客户端断开
	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			// 客户端断开或 context 取消
			return
		case e, ok := <-events:
			if !ok {
				return // broker 关闭
			}
			if err := writeEvent(w, flusher, e); err != nil {
				return // 写失败，连接已断
			}
		}
	}
}

// writeEvent 写入并立即刷新
func writeEvent(w io.Writer, flusher http.Flusher, e Event) error {
	if _, err := w.Write(e.Encode()); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}

// ===== 便捷方法：JSON 事件 =====

func JSONEvent(event string, v any) Event {
	b, _ := json.Marshal(v)
	return Event{Event: event, Data: b}
}