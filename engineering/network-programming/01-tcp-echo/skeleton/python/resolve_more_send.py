import struct
import socket

def send_msg(sock: socket.socket, msg_bytes: bytes) -> None:
  # 使用 struct将长度打包为4个字节网络字节序(大端) 整型 '!I'
  header = struct.pack('!I', len(msg_bytes))
  print(f"packed header {header}")
  sock.sendall(header + msg_bytes)

def recv_msg(sock: socket.socket):
  header = _recv_all(sock, 4)
  if not header:
    return None
  
  msg_len = struct.unpack('!I', header)[0]

  return _recv_all(sock, msg_len)

def _recv_all(sock: socket.socket, n: int) -> bytes | None:
  data = bytearray()

  while len(data) < n:
    packet = sock.recv(n - len(data))
    if not packet:
      return None
    data.extend(packet)

  return bytes(data)
