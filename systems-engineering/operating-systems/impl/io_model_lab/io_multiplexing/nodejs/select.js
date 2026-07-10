// Node.js并没有在JavaScript层直接实现select或epoll，而是通过libuv，将I/O多路复用封装成为了Event Loop
//
//
/**
 * 上层的伪select代码
 */

const net = require("net");

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    console.log("get data", data.toString());
  });
});

server.listen(7777);
