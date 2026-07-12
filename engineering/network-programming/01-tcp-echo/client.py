import socket

client = socket.socket()

client.connect(("127.0.0.1", 8888))

while True:
  msg = input("> ")

  client.sendall(msg.encode())

  print(client.recv(1024).decode())
