import socket

def run_udp_server(host='127.0.0.1', port=8081):
    # SOCK_DGRAM 代表 UDP 协议
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    server_socket.bind((host, port))
    print(f"[*] UDP Server listening on {host}:{port}")

    try:
        while True:
            # recvfrom 会同时返回数据和客户端的 (ip, port) 地址
            data, client_address = server_socket.recvfrom(65535) # 65535 是 UDP 数据包的最大理论长度
            print(f"[+] Received {len(data)} bytes from {client_address}")
            print(f"[->] Data: {data.decode('utf-8', errors='ignore')}")
            
            # 原路返回（Echo）
            server_socket.sendto(data, client_address)
    except KeyboardInterrupt:
        print("\n[*] Shutting down UDP server.")
    finally:
        server_socket.close()

if __name__ == "__main__":
    run_udp_server()