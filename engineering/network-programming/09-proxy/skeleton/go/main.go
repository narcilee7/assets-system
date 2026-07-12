package main

import (
	"fmt"
	"io"
	"net"
	"time"
)

// TCPProxy TCP 反向代理。
// TODO: 基于原始 TCP socket 实现双向转发。
type TCPProxy struct {
	listenAddr string
	backendAddr string
	listener   net.Listener
}

func NewTCPProxy(listenAddr, backendAddr string) *TCPProxy {
	return &TCPProxy{
		listenAddr:  listenAddr,
		backendAddr: backendAddr,
	}
}

func (p *TCPProxy) Start() error {
	// TODO: 监听 listenAddr
	// TODO: accept 循环：对每个 client conn，dial backend，启动双向复制
	return fmt.Errorf("not implemented")
}

func (p *TCPProxy) handleConn(clientConn net.Conn) {
	// TODO: dial backend
	// TODO: 启动两个 goroutine：client->backend 复制 和 backend->client 复制
	// TODO: 使用 sync.WaitGroup 等待两者完成，然后关闭两端
}

func (p *TCPProxy) Stop() {
	if p.listener != nil {
		p.listener.Close()
	}
}

func main() {
	// 启动后端 echo server
	backendLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Printf("FAIL: backend listen: %v\n", err)
		return
	}
	defer backendLn.Close()
	go func() {
		for {
			conn, err := backendLn.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				io.Copy(c, c)
			}(conn)
		}
	}()

	// 启动代理
	proxy := NewTCPProxy("127.0.0.1:0", backendLn.Addr().String())
	go proxy.Start()
	time.Sleep(100 * time.Millisecond)

	// TODO: 通过代理连接后端，发送消息，验证 echo
	fmt.Println("PASS / FAIL 请在实现 TCPProxy 后运行")
}
