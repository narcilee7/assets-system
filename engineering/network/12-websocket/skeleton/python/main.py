# 模型：socket + hashlib
import socket
import hashlib
import base64
import struct

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

class WebSocketServer:
    def __init__(self):
        self.sock = None

    def listen_and_serve(self, host, port):
        # TODO: 创建 socket，bind，listen，accept 循环
        # TODO: 处理 HTTP Upgrade 握手
        pass

    def handle_conn(self, conn):
        # TODO:
        # 1. 读取 HTTP 头，提取 Sec-WebSocket-Key
        # 2. 计算 accept = base64(sha1(key + GUID))
        # 3. 发送 101 响应
        # 4. 循环解析帧，处理文本帧和关闭帧
        pass

    @staticmethod
    def compute_accept(key):
        # TODO: base64(sha1(key + GUID))
        pass

    @staticmethod
    def read_frame(conn):
        # TODO: 解析 WebSocket 帧头，解码 payload
        pass

    @staticmethod
    def write_text_frame(conn, payload):
        # TODO: 构造文本帧（不 mask）并发送
        pass

def main():
    server = WebSocketServer()
    # TODO: 启动 server，使用 client 测试
    print("PASS / FAIL 请在实现 WebSocketServer 后运行")

if __name__ == "__main__":
    main()
