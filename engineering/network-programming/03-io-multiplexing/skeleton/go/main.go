package main

import (
	"fmt"
	"net"
	"time"
)

// runServer 启动单 goroutine TCP echo server（使用 net + channel 模拟多路复用）。
func runServer() (string, error) {
	// TODO: 监听 TCP 0 端口
	// TODO: 在单个 goroutine 中：
	//       1. 使用 listener.Accept() 获取新连接（设置 deadline 避免永久阻塞）
	//       2. 维护一个连接列表
	//       3. 对列表中的每个连接，尝试读取数据（设置 read deadline）
	//       4. 如果有数据，echo 回去；如果连接关闭，从列表中移除
	//       5. 循环直到收到退出信号
	return "", fmt.Errorf("not implemented")
}

// runClient 连接 server，发送 msg，等待回复。
func runClient(addr string, msg string) (string, error) {
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	if _, err := conn.Write([]byte(msg)); err != nil {
		return "", err
	}
	buf := make([]byte, 1024)
	conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	n, err := conn.Read(buf)
	if err != nil {
		return "", err
	}
	return string(buf[:n]), nil
}

func main() {
	addr, err := runServer()
	if err != nil {
		fmt.Printf("FAIL: server start: %v\n", err)
		return
	}
	time.Sleep(100 * time.Millisecond)

	// 并发启动 3 个 client
	results := make(chan string, 3)
	for i := 0; i < 3; i++ {
		go func(id int) {
			msg := fmt.Sprintf("client%d", id)
			reply, err := runClient(addr, msg)
			if err != nil {
				results <- fmt.Sprintf("FAIL client%d: %v", id, err)
				return
			}
			if reply != msg {
				results <- fmt.Sprintf("FAIL client%d: expected %q got %q", id, msg, reply)
				return
			}
			results <- "OK"
		}(i)
	}

	for i := 0; i < 3; i++ {
		r := <-results
		if r != "OK" {
			fmt.Println(r)
			return
		}
	}
	fmt.Println("PASS: multiplexed echo server correct")
}
