package main

import (
	"fmt"
	"net"
)

// DNSResolver 简化版 DNS 解析器。
// TODO: 使用 UDP socket 向 DNS 服务器发送查询并解析响应。
type DNSResolver struct {
	server string // 如 "8.8.8.8:53"
}

func NewDNSResolver(server string) *DNSResolver {
	return &DNSResolver{server: server}
}

// ResolveA 查询 domain 的 A 记录，返回 IPv4 地址列表。
func (r *DNSResolver) ResolveA(domain string) ([]net.IP, error) {
	// TODO:
	// 1. 构造 DNS 查询报文（12 字节 Header + Question）
	//    - Transaction ID: 随机 2 字节
	//    - Flags: 0x0100 (标准查询)
	//    - QDcount: 1
	//    - 其余计数器: 0
	//    - Question: 域名编码 + QTYPE=A(1) + QCLASS=IN(1)
	// 2. 通过 UDP 发送到 DNS 服务器
	// 3. 接收响应，解析 Header、Question、Answer
	// 4. 提取 A 记录（TYPE=1）的 RData（4 字节 IP）
	return nil, fmt.Errorf("not implemented")
}

func main() {
	resolver := NewDNSResolver("8.8.8.8:53")
	ips, err := resolver.ResolveA("example.com")
	if err != nil {
		fmt.Printf("FAIL: %v\n", err)
		return
	}
	if len(ips) == 0 {
		fmt.Println("FAIL: no A records found")
		return
	}
	for _, ip := range ips {
		if ip.To4() == nil {
			fmt.Printf("FAIL: expected IPv4, got %v\n", ip)
			return
		}
	}
	fmt.Printf("PASS: resolved %d A records: %v\n", len(ips), ips)
}
