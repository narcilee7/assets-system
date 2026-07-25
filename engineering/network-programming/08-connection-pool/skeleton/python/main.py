# 模型：threading + queue
import socket
import threading
import queue
import time

class TCPPool:
    def __init__(self, server_addr, max_conns=5, dial_timeout=2, idle_timeout=5):
        self.server_addr = server_addr
        self.max_conns = max_conns
        self.dial_timeout = dial_timeout
        self.idle_timeout = idle_timeout
        # TODO: 添加可用队列、使用中集合、锁、条件变量等

    def get(self, timeout=None):
        # TODO: 获取可用连接或创建新连接（不超过上限）
        # TODO: 检查连接健康（如发送空数据或检查是否可读）
        # TODO: 如果池满，阻塞等待
        pass

    def put(self, conn):
        # TODO: 归还连接到池中
        pass

    def close(self):
        # TODO: 关闭所有连接
        pass

def main():
    # 启动后端 server
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(5)
    addr = server.getsockname()

    def serve():
        while True:
            try:
                conn, _ = server.accept()
            except OSError:
                return
            threading.Thread(target=lambda c: c.close() or None, args=(conn,), daemon=True).start()

    threading.Thread(target=serve, daemon=True).start()

    # TODO: 实现测试逻辑
    print("PASS / FAIL 请在实现 TCPPool 后运行")

if __name__ == "__main__":
    main()
