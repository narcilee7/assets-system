import socket

# 1. socket()
server = socket.socket()

# 2. bind
server.bind(("0.0.0.0", 8888))

# 3. listen
server.listen()

def main():
  while True:
    # 4. accept()
    conn, addr = server.accept()

    while True:
      # 5. recv
      data = conn.recv(1024)

      if not data:
        break

      # 6. send
      conn.sendall(data)

    # 7. close
    conn.close()

if __name__ == "__main__":
  main()