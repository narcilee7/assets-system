# 模型：threading + socket
import socket
import threading
import time

class HTTPServer:
    def __init__(self):
        self.sock = None

    def listen_and_serve(self, host, port):
        # TODO: 创建 TCP socket，bind，listen
        # TODO: accept 循环，每个连接一个线程处理
        # TODO: 处理连接时支持 Keep-Alive（循环读取多个请求）
        pass

    def handle_conn(self, conn):
        # TODO: 循环解析 HTTP 请求
        #       1. 读取请求行
        #       2. 读取 headers 直到空行
        #       3. 根据 Content-Length 读取 body
        #       4. 调用路由处理
        #       5. 发送响应
        #       6. 如果 Connection: close 则退出循环
        pass

    def serve_http(self, method, path, headers, body):
        # TODO: GET /hello -> 200 "Hello, World!"
        # TODO: POST /echo -> 200 body
        # TODO: 其他 -> 404
        pass

def http_client(addr, method, path, body=""):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2)
    s.connect(addr)
    req = f"{method} {path} HTTP/1.1\r\nHost: {addr[0]}:{addr[1]}\r\n"
    if body:
        req += f"Content-Length: {len(body)}\r\n"
    req += "\r\n" + body
    s.sendall(req.encode())

    # 简化读取响应
    data = b""
    while True:
        try:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
        except socket.timeout:
            break
    s.close()
    # 解析状态码和 body（简化）
    text = data.decode()
    lines = text.split("\r\n")
    status = int(lines[0].split()[1]) if lines else 0
    body_start = text.find("\r\n\r\n")
    resp_body = text[body_start + 4:] if body_start != -1 else ""
    return status, resp_body

def main():
    server = HTTPServer()
    # TODO: 启动 server 并获取实际地址
    # 简化：请补全 server 启动逻辑和测试验证
    print("PASS / FAIL 请在实现 HTTPServer.listen_and_serve 后运行")

if __name__ == "__main__":
    main()
