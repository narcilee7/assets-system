#!/usr/bin/env python3
"""Linux epoll ET echo server using selectors (which uses epoll on Linux)."""

import selectors
import socket

HOST = "0.0.0.0"
PORT = 8080


def accept(sock: socket.socket, mask):
    conn, addr = sock.accept()
    print(f"Accepted {addr}")
    conn.setblocking(False)
    # selectors.EVENT_READ defaults to Level Trigger on epoll unless Edge Trigger is requested.
    # Here we demonstrate the standard LT mode.
    sel.register(conn, selectors.EVENT_READ, read)


def read(conn: socket.socket, mask):
    try:
        data = conn.recv(1024)
        if data:
            conn.send(data)  # echo
        else:
            print(f"Closing {conn.getpeername()}")
            sel.unregister(conn)
            conn.close()
    except OSError:
        sel.unregister(conn)
        conn.close()


sel = selectors.DefaultSelector()
lsock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
lsock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
lsock.bind((HOST, PORT))
lsock.listen()
lsock.setblocking(False)
sel.register(lsock, selectors.EVENT_READ, accept)

print(f"epoll echo server on :{PORT}")
while True:
    events = sel.select()
    for key, mask in events:
        callback = key.data
        callback(key.fileobj, mask)
