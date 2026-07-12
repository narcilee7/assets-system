# 模型：threading
import socket
import threading

class TCPProxy:
    def __init__(self, listen_addr, backend_addr):
        self.listen_addr = listen_addr
        self.backend_addr = backend_addr
        self.sock = None

    def start(self):
        # TODO: 创建监听 socket，accept 循环
        # TODO: 对每个 client，连接 backend，启动两个线程双向转发
        pass

    def _pipe(self, src, dst):
        # TODO: 从 src 读取，写入 dst，直到 EOF 或出错
        pass

    def stop(self):
        if self.sock:
            self.sock.close()

def main():
    # 启动后端 echo server
    backend = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    backend.bind(("127.0.0.1", 0))
    backend.listen(5)
    backend_addr = backend.getsockname()

    def serve():
        while True:
            try:
                conn, _ = backend.accept()
            except OSError:
                return
            threading.Thread(target=lambda c: (c.sendall(c.recv(4096)), c.close()), args=(conn,), daemon=True).start()

    threading.Thread(target=serve, daemon=True).start()

    # TODO: 启动代理，通过代理测试 echo
    print("PASS / FAIL 请在实现 TCPProxy 后运行")

if __name__ == "__main__":
    main()
