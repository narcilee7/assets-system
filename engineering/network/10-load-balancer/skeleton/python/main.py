# 模型：threading
import socket
import threading
import time

class Backend:
    def __init__(self, addr):
        self.addr = addr
        self.healthy = True
        self.fail_count = 0

class LoadBalancer:
    def __init__(self, backend_addrs):
        self.backends = [Backend(addr) for addr in backend_addrs]
        self.idx = 0
        self.mu = threading.Lock()
        self.sock = None

    def start(self, host, port):
        # TODO: 监听 TCP，accept 循环
        # TODO: Round Robin 选择健康后端，建立连接并双向转发
        pass

    def pick_backend(self):
        # TODO: 轮询，跳过不健康后端
        return None

    def health_check(self):
        # TODO: 定时检查后端健康状态
        pass

    def stop(self):
        if self.sock:
            self.sock.close()

def main():
    # 启动 3 个后端 server
    backends = []
    addrs = []
    for i in range(3):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(("127.0.0.1", 0))
        s.listen(5)
        addrs.append(s.getsockname())
        backends.append(s)

    def serve(sock, bid):
        while True:
            try:
                conn, _ = sock.accept()
            except OSError:
                return
            conn.sendall(f"backend{bid}".encode())
            conn.close()

    for i, s in enumerate(backends):
        threading.Thread(target=serve, args=(s, i), daemon=True).start()

    lb = LoadBalancer(addrs)
    # TODO: 启动 lb，测试 Round Robin 和健康检查
    print("PASS / FAIL 请在实现 LoadBalancer 后运行")

if __name__ == "__main__":
    main()
