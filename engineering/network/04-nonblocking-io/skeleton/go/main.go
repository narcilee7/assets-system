package main

import (
	"fmt"
	"net"
	"time"
)

// dialWithTimeout 使用非阻塞方式连接 addr，超时返回错误。
// TODO: 使用 net.Dialer 自定义 Control 函数设置非阻塞，或使用 syscall 直接操作。
func dialWithTimeout(addr string, timeout time.Duration) (net.Conn, error) {
	// TODO: 实现非阻塞 connect + select/poll 等待 + SO_ERROR 检查
	return nil, fmt.Errorf("not implemented")
}

func main() {
	// 先启动一个正常 server
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Printf("FAIL: listen: %v\n", err)
		return
	}
	defer ln.Close()
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				buf := make([]byte, 1024)
				n, _ := c.Read(buf)
				c.Write(buf[:n])
			}(conn)
		}
	}()

	// 测试 1：正常连接应在超时内成功
	conn, err := dialWithTimeout(ln.Addr().String(), 2*time.Second)
	if err != nil {
		fmt.Printf("FAIL: normal connect: %v\n", err)
		return
	}
	conn.Write([]byte("ping"))
	buf := make([]byte, 1024)
	conn.SetReadDeadline(time.Now().Add(time.Second))
	conn.Read(buf)
	conn.Close()

	// 测试 2：连接不可达端口应在超时内失败
	_, err = dialWithTimeout("127.0.0.1:1", 200*time.Millisecond)
	if err == nil {
		fmt.Println("FAIL: expected timeout error for unreachable port")
		return
	}

	fmt.Println("PASS: non-blocking dial with timeout correct")
}
