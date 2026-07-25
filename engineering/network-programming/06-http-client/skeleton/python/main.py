# 模型：socket + threading
import socket
import time
import random

class HTTPClient:
    def __init__(self):
        pass

    def do(self, method, host, port, path, body="", timeout=5, max_retries=3, retry_delay=0.5):
        # TODO:
        # 1. 建立 TCP 连接（带超时）
        # 2. 发送 HTTP 请求
        # 3. 读取响应（带超时）
        # 4. 如果可重试且幂等，指数退避后重试
        # 5. 返回 (status_code, body)
        pass

    @staticmethod
    def is_idempotent(method):
        # TODO: GET/HEAD/PUT/DELETE/OPTIONS 为幂等
        return False

def main():
    # 请使用 05-http-server 中的 server 或 mock server 进行测试
    print("PASS / FAIL 请在实现 HTTPClient.do 后，配合 mock server 测试")

if __name__ == "__main__":
    main()
