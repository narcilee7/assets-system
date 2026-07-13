import socket

def run_client(host="127.0.0.1", port=8000):
  client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

  try:
    client_socket.connect((host, port))
    print(f"[*] Connected to server {host}: {port}")

    message = "Hello, Python Network Programming..."
    client_socket.sendall((message.encode('utf-8')))

    response = client_socket.recv(1024)
    print(f"[<-] Server response: {response.decode('utf-8')}")

  finally:
    client_socket.close()

if __name__ == "__main__":
  run_client()
