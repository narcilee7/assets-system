# 模型：threading
import socket
import threading
import time

def handle_client(conn, addr):
    # TODO: 逐行读取客户端数据；如果不是 "quit" 则回写；否则关闭连接
    pass

def run_server():
    # TODO: 创建 TCP socket，绑定 0 端口，listen
    # TODO: 在后台线程中 accept 循环
    # TODO: 返回实际监听的地址 (host, port)
    pass

def run_client(addr, messages):
    # TODO: 连接 server，逐行发送 messages，逐行读取回复
    # TODO: 返回回复列表（不包含 quit 的回复）
    pass

def main():
    addr = run_server()
    time.sleep(0.1)

    messages = ["hello", "world", "quit"]
    replies = run_client(addr, messages)

    expected = ["hello", "world"]
    if replies == expected:
        print("PASS: tcp echo correct")
    else:
        print(f"FAIL: expected {expected}, got {replies}")

if __name__ == "__main__":
    main()
