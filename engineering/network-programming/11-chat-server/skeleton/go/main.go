package main

import (
	"fmt"
	"net"
	"time"
)

// ChatServer TCP 聊天服务器。
// TODO: 维护用户名->连接的映射，支持广播和在线列表。
type ChatServer struct {
	// TODO: 用户映射、互斥锁、listener
}

func NewChatServer() *ChatServer {
	return &ChatServer{}
}

func (s *ChatServer) ListenAndServe(addr string) error {
	// TODO: 监听 TCP，accept 循环
	return fmt.Errorf("not implemented")
}

func (s *ChatServer) handleConn(conn net.Conn) {
	// TODO:
	// 1. 读取用户名注册
	// 2. 将用户加入在线列表
	// 3. 循环读取消息：
	//    - 如果以 "/list" 开头，返回在线用户列表
	//    - 否则广播给其他用户
	// 4. 断开时移除用户并广播离开消息
}

func (s *ChatServer) broadcast(sender string, msg string) {
	// TODO: 遍历在线用户，发送格式化消息（跳过发送者）
}

func main() {
	server := NewChatServer()
	go server.ListenAndServe("127.0.0.1:0")
	time.Sleep(100 * time.Millisecond)

	// TODO: 启动多个 client，注册用户名，发送消息，验证广播和在线列表
	fmt.Println("PASS / FAIL 请在实现 ChatServer 后运行")
}
