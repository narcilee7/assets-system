package main

import (
	"fmt"
	"time"
)

// runServer 启动 UDP Server，返回地址。
func runServer() (string, error) {
	// TODO: 创建 UDP socket，绑定 0 端口
	// TODO: 在 goroutine 中循环 recvfrom
	//       如果收到 "ping"，回复 "pong"
	//       如果收到 "time"，回复当前时间字符串
	return "", fmt.Errorf("not implemented")
}

// runClient 向 addr 发送 messages，返回回复列表。
func runClient(addr string, messages []string) ([]string, error) {
	// TODO: 创建 UDP socket
	// TODO: 对每个 message，sendto 到 server，recvfrom 读取回复
	return nil, fmt.Errorf("not implemented")
}

func main() {
	addr, err := runServer()
	if err != nil {
		fmt.Printf("FAIL: server start: %v\n", err)
		return
	}
	time.Sleep(100 * time.Millisecond)

	messages := []string{"ping", "time"}
	replies, err := runClient(addr, messages)
	if err != nil {
		fmt.Printf("FAIL: client: %v\n", err)
		return
	}

	if len(replies) != 2 {
		fmt.Printf("FAIL: expected 2 replies, got %d\n", len(replies))
		return
	}
	if replies[0] != "pong" {
		fmt.Printf("FAIL: reply[0]=%q, expected pong\n", replies[0])
		return
	}
	if _, err := time.Parse(time.RFC3339, replies[1]); err != nil {
		fmt.Printf("FAIL: reply[1]=%q is not valid RFC3339 time\n", replies[1])
		return
	}
	fmt.Println("PASS: udp server correct")
}
