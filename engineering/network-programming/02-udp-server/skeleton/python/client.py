import socket

def run_udp_client(host='127.0.0.1', port=8081):
    client_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    server_address = (host, port)
    
    try:
        message = "Hello, UDP Server! This is a single datagram."
        print(f"[*] Sending message to {server_address}")
        
        # UDP 不需要 connect，直接指定地址发送
        client_socket.sendto(message.encode('utf-8'), server_address)
        
        # 接收响应
        data, server = client_socket.recvfrom(65535)
        print(f"[<-] Server response: {data.decode('utf-8')}")
    finally:
        client_socket.close()

if __name__ == "__main__":
    run_udp_client()
