# 模型：threading
import socket
import threading

class ChatServer:
    def __init__(self):
        self.clients = {}  # username -> conn
        self.lock = threading.Lock()
        self.sock = None

    def listen_and_serve(self, host, port):
        # TODO: 创建 socket，bind，listen，accept 循环
        pass

    def handle_conn(self, conn):
        # TODO: 读取用户名，注册，循环处理消息
        # TODO: /list -> 返回在线列表；其他 -> 广播
        # TODO: 断开时清理
        pass

    def broadcast(self, sender, msg):
        # TODO: 发送给除 sender 外的所有客户端
        pass

    def get_user_list(self):
        # TODO: 返回在线用户名字符串
        pass

def main():
    server = ChatServer()
    # TODO: 启动 server，多 client 测试
    print("PASS / FAIL 请在实现 ChatServer 后运行")

if __name__ == "__main__":
    main()
