package main

import (
	"bufio"
	"fmt"
	"net"
	"net/textproto"
	"strings"
	"time"
)

// HTTPServer 极简 HTTP/1.1 服务器。
// TODO: 基于原始 TCP socket 实现请求解析和响应生成。
type HTTPServer struct {
	listener net.Listener
}

func NewHTTPServer() *HTTPServer {
	return &HTTPServer{}
}

func (s *HTTPServer) ListenAndServe(addr string) error {
	// TODO: 监听 TCP，accept 循环，每个连接一个 goroutine
	return fmt.Errorf("not implemented")
}

func (s *HTTPServer) handleConn(conn net.Conn) {
	defer conn.Close()
	// TODO: 循环读取 HTTP 请求（支持 Keep-Alive）
	//       1. 读取请求行：METHOD PATH HTTP/1.1
	//       2. 读取 headers 直到空行
	//       3. 如果有 Content-Length，读取 body
	//       4. 根据 PATH 和 METHOD 生成响应
	//       5. 如果 Connection: close 或出错，跳出循环
}

func (s *HTTPServer) ServeHTTP(method, path string, headers map[string]string, body string) (status int, responseBody string) {
	// TODO: 路由处理
	// GET /hello -> 200, "Hello, World!"
	// POST /echo -> 200, body
	// 其他 -> 404
	return 404, "Not Found"
}

// HTTPClient 极简 HTTP client（用于自测）。
func HTTPClient(addr, method, path, body string) (status int, respBody string, err error) {
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return 0, "", err
	}
	defer conn.Close()

	req := fmt.Sprintf("%s %s HTTP/1.1\r\nHost: %s\r\n", method, path, addr)
	if body != "" {
		req += fmt.Sprintf("Content-Length: %d\r\n", len(body))
	}
	req += "\r\n" + body
	conn.Write([]byte(req))

	reader := bufio.NewReader(conn)
	line, _ := reader.ReadString('\n')
	parts := strings.Fields(line)
	if len(parts) >= 2 {
		fmt.Sscanf(parts[1], "%d", &status)
	}

	// 跳过 headers
	tp := textproto.NewReader(reader)
	for {
		header, _ := tp.ReadLine()
		if header == "" {
			break
		}
	}

	// 读取 body（简化：直接读到 EOF 或固定大小）
	buf := make([]byte, 4096)
	n, _ := reader.Read(buf)
	return status, string(buf[:n]), nil
}

func main() {
	server := NewHTTPServer()
	go server.ListenAndServe("127.0.0.1:0")
	time.Sleep(100 * time.Millisecond)

	// 获取实际地址（骨架中暂时写死 127.0.0.1:0 无法获取，请在实现中打印或使用同步通道）
	// 简化：直接让 server 打印地址，或使用共享变量
	fmt.Println("PASS / FAIL 请在实现 HTTPServer.ListenAndServe 后运行")
}
