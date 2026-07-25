# 模型：socket + select（非阻塞 IO）
import socket
import select
import errno
import time

def dial_with_timeout(host, port, timeout):
    # TODO: 创建非阻塞 socket
    # TODO: 调用 connect（会立即返回 EINPROGRESS）
    # TODO: 使用 select.select 等待可写
    # TODO: 使用 getsockopt(SO_ERROR) 检查连接是否成功
    # TODO: 如果超时，关闭 socket 并抛出 TimeoutError
    pass

def main():
    # 启动正常 server
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    addr = server.getsockname()

    def serve():
        conn, _ = server.accept()
        data = conn.recv(1024)
        conn.sendall(data)
        conn.close()

    import threading
    threading.Thread(target=serve, daemon=True).start()

    # 测试 1：正常连接
    try:
        s = dial_with_timeout(addr[0], addr[1], 2)
        s.sendall(b"ping")
        s.settimeout(1)
        data = s.recv(1024)
        s.close()
    except Exception as e:
        print(f"FAIL: normal connect: {e}")
        return

    # 测试 2：不可达端口
    try:
        dial_with_timeout("127.0.0.1", 1, 0.2)
        print("FAIL: expected timeout error")
        return
    except TimeoutError:
        pass
    except Exception:
        pass

    print("PASS: non-blocking dial with timeout correct")

if __name__ == "__main__":
    main()
