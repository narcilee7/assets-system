import socket
import select

def run_select_server(host='127.0.0.1', port=8082):
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind((host, port))
    server_socket.listen(5)
    
    # 关键点 1：将服务端 Socket 设为非阻塞模式
    server_socket.setblocking(False)
    print(f"[*] Select Server listening on {host}:{port}")

    # 我们要监测的读就绪列表，初始包含服务端 Socket（用来监听新连接）
    inputs = [server_socket]
    # 我们要监测的写就绪列表（通常在有数据要发送时才加入）
    outputs = []
    # 存储客户端发送数据的缓冲区 {socket: data_queue}
    message_queues = {}

    try:
        while True:
            # 关键点 2：调用 select 阻塞等待，直到 inputs 或 outputs 列表中有 Socket 就绪
            # 返回的 readable, writable, exceptional 是当前真正可操作的 Socket 集合
            readable, writable, exceptional = select.select(inputs, outputs, inputs)

            # 处理可读事件
            for s in readable:
                if s is server_socket:
                    # 如果是服务端 Socket 可读，代表有新的客户端连接请求（accept 不会阻塞）
                    client_socket, client_address = s.accept()
                    print(f"[+] Accepted connection from {client_address}")
                    client_socket.setblocking(False)
                    
                    inputs.append(client_socket) # 纳入监视范围
                    message_queues[client_socket] = bytearray()
                else:
                    # 如果是普通客户端 Socket 可读，代表对方发来了数据（recv 不会阻塞）
                    data = s.recv(1024)
                    if data:
                        print(f"[->] Received {len(data)} bytes from {s.getpeername()}")
                        message_queues[s].extend(data)
                        if s not in outputs:
                            outputs.append(s) # 收到数据后，把该客户端加入写监视列表，准备 Echo 回去
                    else:
                        # 收到空字节，代表对端关闭了连接 (EOF)
                        print(f"[-] Client {s.getpeername()} disconnected.")
                        # 清理工作：从监视列表和缓冲区中移除
                        if s in outputs:
                            outputs.remove(s)
                        inputs.remove(s)
                        s.close()
                        del message_queues[s]

            # 处理可写事件
            for s in writable:
                if s in message_queues and message_queues[s]:
                    # 缓冲区有数据，将其发送出去（send 不会阻塞）
                    # 生产环境应当检查 send 返回的字节数，这里做简化
                    s.sendall(message_queues[s])
                    message_queues[s].clear()
                
                # 数据发完了，把它从写监视列表中移除，否则下一次循环它依然会触发可写事件
                outputs.remove(s)

            # 处理异常事件
            for s in exceptional:
                print(f"[!] Exception condition on {s.getpeername()}")
                inputs.remove(s)
                if s in outputs:
                    outputs.remove(s)
                s.close()
                del message_queues[s]

    except KeyboardInterrupt:
        print("\n[*] Shutting down select server.")
    finally:
        server_socket.close()

if __name__ == "__main__":
    run_select_server()