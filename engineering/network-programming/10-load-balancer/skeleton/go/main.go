package main

import (
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// Backend 后端服务器信息。
type Backend struct {
	Addr      string
	Healthy   atomic.Bool
	FailCount atomic.Int32
}

// LoadBalancer TCP 负载均衡器。
// TODO: 实现 Round Robin + 健康检查。
type LoadBalancer struct {
	mu        sync.Mutex
	backends  []*Backend
	idx       atomic.Int64
	listener  net.Listener
}

func NewLoadBalancer(backendAddrs []string) *LoadBalancer {
	backends := make([]*Backend, len(backendAddrs))
	for i, addr := range backendAddrs {
		backends[i] = &Backend{Addr: addr}
		backends[i].Healthy.Store(true)
	}
	return &LoadBalancer{backends: backends}
}

func (lb *LoadBalancer) Start(listenAddr string) error {
	// TODO: 监听 TCP
	// TODO: accept 循环：使用 Round Robin 选择一个健康后端，转发连接
	return fmt.Errorf("not implemented")
}

// pickBackend 使用 Round Robin 选择一个健康后端。
func (lb *LoadBalancer) pickBackend() *Backend {
	// TODO: 轮询，跳过不健康后端
	return nil
}

// healthCheck 定时对所有后端进行健康检查。
func (lb *LoadBalancer) healthCheck() {
	// TODO: 每隔一段时间尝试连接每个后端
	// TODO: 如果连接成功，标记健康；如果连续失败超过阈值，标记不健康
}

func (lb *LoadBalancer) Stop() {
	if lb.listener != nil {
		lb.listener.Close()
	}
}

func main() {
	// 启动 3 个后端 server，每个返回自己的标识
	backends := make([]net.Listener, 3)
	backendAddrs := make([]string, 3)
	for i := 0; i < 3; i++ {
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			fmt.Printf("FAIL: listen: %v\n", err)
			return
		}
		backends[i] = ln
		backendAddrs[i] = ln.Addr().String()
		go func(id int, l net.Listener) {
			for {
				conn, err := l.Accept()
				if err != nil {
					return
				}
				go func(c net.Conn) {
					defer c.Close()
					c.Write([]byte(fmt.Sprintf("backend%d", id)))
				}(conn)
			}
		}(i, ln)
	}

	lb := NewLoadBalancer(backendAddrs)
	go lb.Start("127.0.0.1:0")
	go lb.healthCheck()
	time.Sleep(100 * time.Millisecond)

	// TODO: 发送请求，验证 Round Robin 分发；关闭一个后端，验证故障转移
	fmt.Println("PASS / FAIL 请在实现 LoadBalancer 后运行")
}
