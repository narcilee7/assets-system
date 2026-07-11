import os
import socket
import multiprocessing


def worker_process(client_pipe):
  print(f"sub process {os.getgid()} is running , waiting task FD...")

  while True:
    from multiprocessing.reduction import recv_handle
    fd = recv_handle(client_pipe)

    client_sock = socket.fromfd(fd, socket.AF_INET, socket.SOCK_STREAM)
    client_sock.sendall(f"HTTP/1.1 200 ok\r\n\r\nHello from Process {os.getpid()}".encode())
    client_sock.close()
    os.close(fd) # clear fd


if __name__ == "__main__":
  master_pipe, worker_pipe = multiprocessing.Pipe()

  p = multiprocessing.Process(target=worker_process, args=(worker_pipe, ))
  p.start()

  server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  server.bind(("127.0.0.1", 8000))
  server.listen(5)
  print(f"Master process {os.getpid()} is listening 8000 port...")

  try:
    client_conn, addr = server.accept()
    print(f"Master 收到连接，正在将 FD {client_conn.fileno()} 物理派发给子进程...")

    from multiprocessing.reduction import send_handle
    send_handle(master_pipe, client_conn.fileno(), p.pid)
    client_conn.close()

  finally:
    p.terminate()
    server.close()
