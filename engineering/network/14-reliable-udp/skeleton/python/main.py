# 模型：socket + threading
import socket
import struct
import threading
import time

class Packet:
    def __init__(self, seq=0, ack=0, flags=0, payload=b""):
        self.seq = seq
        self.ack = ack
        self.flags = flags  # 0x01=DATA, 0x02=ACK, 0x04=FIN
        self.payload = payload

    def marshal(self):
        # TODO: struct.pack + payload
        pass

    @staticmethod
    def unmarshal(data):
        # TODO: struct.unpack
        pass

class ReliableSender:
    def __init__(self, sock, addr):
        self.sock = sock
        self.addr = addr
        self.window = 1

    def send(self, data):
        # TODO: 分片、发送、等 ACK、超时重传
        pass

class ReliableReceiver:
    def __init__(self, sock):
        self.sock = sock

    def receive(self):
        # TODO: 接收、排序、去重、发 ACK、重组
        pass

def main():
    # 创建两个 UDP socket
    send_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    recv_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    send_sock.bind(("127.0.0.1", 0))
    recv_sock.bind(("127.0.0.1", 0))
    send_addr = send_sock.getsockname()
    recv_addr = recv_sock.getsockname()

    # TODO: 启动 receiver 线程，sender 发送数据，验证完整性
    print("PASS / FAIL 请在实现 ReliableSender/Receiver 后运行")

if __name__ == "__main__":
    main()
