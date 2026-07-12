package main

import (
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"net"
)

const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

// WebSocketServer 简化版 WebSocket 服务器。
type WebSocketServer struct {
	listener net.Listener
}

func NewWebSocketServer() *WebSocketServer {
	return &WebSocketServer{}
}

func (s *WebSocketServer) ListenAndServe(addr string) error {
	// TODO: 监听 TCP，处理 HTTP Upgrade 请求
	return fmt.Errorf("not implemented")
}

func (s *WebSocketServer) handleConn(conn net.Conn) {
	defer conn.Close()
	// TODO:
	// 1. 读取 HTTP 请求头，提取 Sec-WebSocket-Key
	// 2. 计算 Sec-WebSocket-Accept = base64(sha1(key + GUID))
	// 3. 发送 101 Switching Protocols 响应
	// 4. 循环解析 WebSocket 帧
	//    - 读取前 2 字节，判断 payload length 长度
	//    - 如果 MASK=1，读取 4 字节 masking key
	//    - 读取 payload，用 masking key XOR 解码
	//    - 根据 opcode 处理（0x1 文本帧，0x8 关闭帧）
	// 5. 对文本帧回显回复
}

// computeAccept 计算 Sec-WebSocket-Accept。
func computeAccept(key string) string {
	h := sha1.New()
	h.Write([]byte(key + wsGUID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// readFrame 读取并解析一个 WebSocket 帧，返回 opcode 和 payload。
func readFrame(conn net.Conn) (opcode byte, payload []byte, err error) {
	// TODO: 实现帧解析
	return 0, nil, fmt.Errorf("not implemented")
}

// writeTextFrame 写入一个文本帧（服务器不 mask）。
func writeTextFrame(conn net.Conn, payload []byte) error {
	// TODO: 构造帧头（FIN=1, opcode=0x1, MASK=0, payload length）并发送
	return fmt.Errorf("not implemented")
}

func main() {
	server := NewWebSocketServer()
	go server.ListenAndServe("127.0.0.1:0")
	// TODO: 使用 WebSocket client 连接测试
	fmt.Println("PASS / FAIL 请在实现 WebSocketServer 后运行")
}
