import selectors
from socket import AF_INET, SO_REUSEADDR, SOCK_STREAM, SOL_SOCKET, socket

HOST = "0.0.0.0"
PORT = 8000


sel = selectors.DefaultSelector()


def read(conn: socket):
    try:
        data = conn.recv(1024)
        if data:
            conn.send(data)  # echo back
        else:
            print(f"Closed {conn.getpeername()}")
            sel.unregister(conn)
            conn.close()

    except OSError:
        sel.unregister(conn)
        conn.close()


def accept(socket: socket, mask):
    conn, addr = socket.accept()
    print(f"Accepted {addr}")
    conn.setblocking(False)
    sel.register(conn, selectors.EVENT_READ, read)


def main():
    lsock = socket(AF_INET, SOCK_STREAM)
    lsock.setsockopt(SOL_SOCKET, SO_REUSEADDR, 1)
    lsock.bind((HOST, PORT))
    lsock.listen()
    lsock.setblocking(False)
    sel.register(lsock, selectors.EVENT_READ, accept)

    print(f"epoll echo server on: {PORT}")

    while True:
        events = sel.select()
        for k, mask in events:
            callback = k.data
            callback(k.fileobj, mask)


if __name__ == "__main__":
    main()
