# 模型：threading
import socket
import threading
import time
from datetime import datetime, timezone

def run_server():
    # TODO: 创建 UDP socket，绑定 0 端口
    # TODO: 在后台线程中循环 recvfrom，根据内容回复
    # TODO: 返回实际地址 (host, port)
    pass

def run_client(addr, messages):
    # TODO: 创建 UDP socket，逐条发送并接收回复
    # TODO: 返回回复列表
    pass

def main():
    addr = run_server()
    time.sleep(0.1)

    messages = ["ping", "time"]
    replies = run_client(addr, messages)

    ok = True
    if len(replies) != 2 or replies[0] != "pong":
        ok = False
    try:
        from datetime import datetime
        datetime.fromisoformat(replies[1].replace('Z', '+00:00'))
    except Exception:
        ok = False

    if ok:
        print("PASS: udp server correct")
    else:
        print(f"FAIL: expected ['pong', <time>], got {replies}")

if __name__ == "__main__":
    main()
