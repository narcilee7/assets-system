package main

import (
	"fmt"
	"time"
)

// HTTPClient 生产级 HTTP 客户端。
// TODO: 基于 TCP socket 实现，支持超时、重试、取消。
type HTTPClient struct {
	// TODO: 配置参数
}

// RequestConfig 单次请求配置。
type RequestConfig struct {
	Method      string
	URL         string
	Body        string
	Timeout     time.Duration // 总超时
	MaxRetries  int           // 最大重试次数
	RetryDelay  time.Duration // 基础退避间隔
}

// Response HTTP 响应。
type Response struct {
	StatusCode int
	Body       string
}

// Do 发送 HTTP 请求，支持超时、重试、取消。
func (c *HTTPClient) Do(cfg RequestConfig) (*Response, error) {
	// TODO:
	// 1. 解析 URL 获取 host 和 path
	// 2. 建立 TCP 连接（带连接超时）
	// 3. 发送 HTTP 请求
	// 4. 读取响应（带读取超时）
	// 5. 如果状态码 >= 500 或是网络错误，且方法幂等，则指数退避重试
	// 6. 如果总超时到达，返回错误
	return nil, fmt.Errorf("not implemented")
}

// isIdempotent 判断 HTTP 方法是否幂等。
func isIdempotent(method string) bool {
	// TODO
	return false
}

func main() {
	// 请使用 05-http-server 中的 server 或 mock server 进行测试
	fmt.Println("PASS / FAIL 请在实现 HTTPClient.Do 后，配合 mock server 测试")
}
