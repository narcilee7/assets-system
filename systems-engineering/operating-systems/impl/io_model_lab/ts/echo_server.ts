import net from "net";

/**
 * Node.js net echo server.
 * Under the hood, libuv uses epoll (Linux) / kqueue (macOS) / IOCP (Windows)
 * to multiplex I/O in a single event loop thread.
 */
const server = net.createServer((socket) => {
  console.log("Accepted", socket.remoteAddress, socket.remotePort);
  socket.on("data", (data) => {
    socket.write(data); // echo
  });
  socket.on("end", () => {
    console.log("Closing", socket.remoteAddress, socket.remotePort);
  });
});

server.listen(8080, () => {
  console.log("libuv echo server on :8080");
  console.log("libuv backend:", process.platform === "linux" ? "epoll" : process.platform === "darwin" ? "kqueue" : "iochcp");
});
