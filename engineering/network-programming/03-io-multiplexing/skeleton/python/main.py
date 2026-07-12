# 模型：select.select（单线程多路复用）
import socket
import select
import threading
import time

def run_server():
    # TODO: 创建 TCP socket，绑定 0 端口，listen
    # TODO: 使用 select.select 监控 listener 和所有 client sockets
    # TODO: 新连接 -> accept 并加入监控列表
    # TODO: 可读连接 -> recv 数据，echo 回去；如果 recv 返回空 bytes，关闭并移除连接
    # TODO: 在后台线程中运行上述循环
    # TODO: 返回实际地址 (host, port)
    pass

def run_client(addr, msg):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    s.connect(addr)
    s.sendall(msg.encode())
    data = s.recv(1024)
    s.close()
    return data.decode()

def main():
    addr = run_server()
    time.sleep(0.1)

    results = []
    for i in range(3):
        msg = f"client{i}"
        reply = run_client(addr, msg)
        results.append((msg, reply))

    for msg, reply in results:
        if reply != msg:
            print(f"FAIL: expected {msg!r} got {reply!r}")
            return
    print("PASS: multiplexed echo server correct")

if __name__ == "__main__":
    main()
