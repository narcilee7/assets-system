# 模型：socket（UDP）
import socket
import struct
import random

class DNSResolver:
    def __init__(self, server="8.8.8.8", port=53):
        self.server = server
        self.port = port

    def resolve_a(self, domain):
        # TODO:
        # 1. 构造 DNS 查询报文
        #    - Header: struct.pack('!HHHHHH', txid, flags, 1, 0, 0, 0)
        #    - Question: 域名编码 + QTYPE=1 + QCLASS=1
        # 2. UDP 发送并接收响应
        # 3. 解析 Answer Section，提取 TYPE=1 的 RData
        # 4. 返回 IPv4 地址字符串列表
        pass

    @staticmethod
    def encode_domain(domain):
        # TODO: 将域名编码为 DNS 格式（长度前缀标签）
        # 例如 "example.com" -> b'\x07example\x03com\x00'
        pass

def main():
    resolver = DNSResolver()
    ips = resolver.resolve_a("example.com")
    if not ips:
        print("FAIL: no A records found")
        return
    for ip in ips:
        parts = ip.split('.')
        if len(parts) != 4 or not all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
            print(f"FAIL: invalid IPv4: {ip}")
            return
    print(f"PASS: resolved {len(ips)} A records: {ips}")

if __name__ == "__main__":
    main()
