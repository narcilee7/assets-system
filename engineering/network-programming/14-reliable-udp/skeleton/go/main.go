package main

import (
	"fmt"
	"net"
)

// Packet 简化协议包。
// TODO: 定义包格式（seq + ack + flags + payload）。
type Packet struct {
	Seq     uint32
	Ack     uint32
	Flags   uint8 // 0x01=DATA, 0x02=ACK, 0x04=FIN
	Payload []byte
}

// Marshal 将 Packet 编码为字节。
func (p *Packet) Marshal() []byte {
	// TODO: 序列化（如：4 bytes seq + 4 bytes ack + 1 byte flags + 2 bytes len + payload）
	return nil
}

// Unmarshal 从字节解码 Packet。
func Unmarshal(data []byte) (*Packet, error) {
	// TODO: 反序列化
	return nil, fmt.Errorf("not implemented")
}

// ReliableSender 可靠发送方。
type ReliableSender struct {
	conn   *net.UDPConn
	addr   *net.UDPAddr
	window int
}

func NewReliableSender(conn *net.UDPConn, addr *net.UDPAddr) *ReliableSender {
	return &ReliableSender{conn: conn, addr: addr, window: 1}
}

func (s *ReliableSender) Send(data []byte) error {
	// TODO:
	// 1. 将 data 分片（每片不超过 1024 字节含 header）
	// 2. 发送每个包，启动定时器等待 ACK
	// 3. 超时未收到 ACK 则重传
	// 4. 收到所有 ACK 后返回
	return fmt.Errorf("not implemented")
}

// ReliableReceiver 可靠接收方。
type ReliableReceiver struct {
	conn *net.UDPConn
}

func NewReliableReceiver(conn *net.UDPConn) *ReliableReceiver {
	return &ReliableReceiver{conn: conn}
}

func (r *ReliableReceiver) Receive() ([]byte, error) {
	// TODO:
	// 1. 循环接收包
	// 2. 按 seq 排序，去重
	// 3. 对每个收到的包发送 ACK
	// 4. 收到 FIN 包后，重组所有 payload 并返回
	return nil, fmt.Errorf("not implemented")
}

func main() {
	// 创建两个 UDP socket 模拟发送方和接收方
	sendAddr, _ := net.ResolveUDPAddr("udp", "127.0.0.1:0")
	recvAddr, _ := net.ResolveUDPAddr("udp", "127.0.0.1:0")

	sendConn, _ := net.ListenUDP("udp", sendAddr)
	recvConn, _ := net.ListenUDP("udp", recvAddr)
	defer sendConn.Close()
	defer recvConn.Close()

	// TODO: 启动 receiver goroutine，sender 发送数据，验证完整性
	fmt.Println("PASS / FAIL 请在实现 ReliableSender/Receiver 后运行")
}
