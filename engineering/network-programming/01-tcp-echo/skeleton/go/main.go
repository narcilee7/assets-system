package main

import (
	"fmt"
	"time"
)

// runServer 启动 Echo Server，返回 listener 地址。
func runServer() (string, error) {
	// TODO: 监听 TCP，端口设为 0（让 OS 分配）
	// TODO: 在 goroutine 中 accept 循环，每个连接一个 goroutine 处理
	// 处理逻辑：逐行读取，如果不是 "quit" 则回写；是 "quit" 则关闭连接
	return "", fmt.Errorf("not implemented")
}

// runClient 连接 addr，发送 messages，返回 server 的回复列表。
func runClient(addr string, messages []string) ([]string, error) {
	// TODO: 连接 server
	// TODO: 逐行发送 messages，逐行读取回复
	// TODO: 发送 "quit" 并关闭连接
	return nil, fmt.Errorf("not implemented")
}

func main() {
	addr, err := runServer()
	if err != nil {
		fmt.Printf("FAIL: server start: %v\n", err)
		return
	}
	time.Sleep(100 * time.Millisecond) // 给 server 一点时间启动

	messages := []string{"hello", "world", "quit"}
	replies, err := runClient(addr, messages)
	if err != nil {
		fmt.Printf("FAIL: client: %v\n", err)
		return
	}

	// 期望 replies 为 ["hello", "world"]（quit 不回显）
	expected := []string{"hello", "world"}
	if len(replies) != len(expected) {
		fmt.Printf("FAIL: expected %d replies, got %d\n", len(expected), len(replies))
		return
	}
	for i := range expected {
		if replies[i] != expected[i] {
			fmt.Printf("FAIL: reply[%d]=%q, expected %q\n", i, replies[i], expected[i])
			return
		}
	}
	fmt.Println("PASS: tcp echo correct")
}
