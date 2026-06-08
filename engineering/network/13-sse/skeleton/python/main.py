# 模型：socket + threading
import socket
import threading
import time

class SSEServer:
    def __init__(self):
        self.events = []
        self.lock = threading.Lock()
        self.sock = None

    def listen_and_serve(self, host, port):
        # TODO: 创建 socket，bind，listen
        # TODO: 处理 GET /events，发送 SSE 响应头
        # TODO: 支持 Last-Event-ID，从指定位置开始推送
        # TODO: 持续推送新事件和心跳
        pass

    def add_event(self, data):
        # TODO: 追加事件，返回 ID
        pass

    def get_events_from(self, event_id):
        # TODO: 返回从 event_id 之后的事件列表
        pass

class SSEClient:
    def __init__(self, server_addr):
        self.server_addr = server_addr
        self.last_id = -1

    def connect(self):
        # TODO: 连接 server，发送 GET /events（带 Last-Event-ID）
        # TODO: 解析事件流，返回生成器或列表
        # TODO: 断线后支持重连
        pass

def main():
    server = SSEServer()
    # TODO: 启动 server，client 测试断线恢复
    print("PASS / FAIL 请在实现 SSEServer 和 SSEClient 后运行")

if __name__ == "__main__":
    main()
