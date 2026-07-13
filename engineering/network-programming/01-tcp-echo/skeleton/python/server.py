import socket

def run_blocking_server(host="127.0.0.1", port=8000):
  server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

  server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

  server_socket.bind((host, port))
  server_socket.listen(5) # 半连接&全连接queue的最大缓冲数
  print(f"[*] Server is listening on {host}: {port}")

  try:
    while True:
      client_socket, client_address = server_socket.accept()
      print(f"[*] Accepted connection from {client_address}")
      handle_client(client_socke=client_socket)
  except KeyboardInterrupt:
    print("\n [*] Shutting down server.")

  finally:
    server_socket.close()


def handle_client(client_socke: socket.socket):
  with client_socke:
    while True:
      data = client_socke.recv(1024)

      if not data:
        print("[-] Client disconnected.")
        break

      print(f"[->] Received: {data.decode('utf-8')}")

      # echo
      client_socke.sendall(data)


if __name__ == "__main__":
  run_blocking_server()