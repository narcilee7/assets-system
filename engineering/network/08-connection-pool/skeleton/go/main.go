package main

import (
	"fmt"
	"net"
	"sync"
	"time"
)

// PooledConn 池中的连接。
type PooledConn struct {
	net.Conn
	lastUsed time.Time
}

// TCPPool TCP 连接池。
// TODO: 添加可用连接列表、最大连接数、互斥锁、条件变量等。
type TCPPool struct {
	mu sync.Mutex
	// TODO
}

// PoolConfig 连接池配置。
type PoolConfig struct {
	MaxConns     int
	DialTimeout  time.Duration
	IdleTimeout  time.Duration
	ServerAddr   string
}

func NewTCPPool(cfg PoolConfig) *TCPPool {
	// TODO: 初始化
	return &TCPPool{}
}

// Get 从池中获取一个连接。如果池满，阻塞等待直到有连接释放或超时。
func (p *TCPPool) Get(timeout time.Duration) (*PooledConn, error) {
	// TODO: 如果有可用连接，检查健康状态和空闲时间，返回或关闭后创建新连接
	// TODO: 如果当前连接数 < MaxConns，创建新连接
	// TODO: 否则条件等待，直到有连接释放或超时
	return nil, fmt.Errorf("not implemented")
}

// Put 将连接归还池中。
func (p *TCPPool) Put(conn *PooledConn) {
	// TODO: 更新 lastUsed，放回可用列表，唤醒等待者
}

// Close 关闭连接池，关闭所有连接。
func (p *TCPPool) Close() error {
	// TODO: 标记关闭，关闭所有连接，唤醒等待者
	return nil
}

func main() {
	// 启动后端 server
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
				for {
					n, err := c.Read(buf)
					if err != nil {
						return
					}
					c.Write(buf[:n])
				}
			}(conn)
		}
	}()

	pool := NewTCPPool(PoolConfig{
		MaxConns:    3,
		DialTimeout: 2 * time.Second,
		IdleTimeout: 5 * time.Second,
		ServerAddr:  ln.Addr().String(),
	})
	defer pool.Close()

	// TODO: 并发获取连接发送消息，验证复用和上限
	fmt.Println("PASS / FAIL 请在实现 TCPPool 后运行")
}
