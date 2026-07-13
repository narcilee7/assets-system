const dgram = require("dgram");

const server = dgram.createSocket("udp4");

const PORT = 41234;

const HOST = '127.0.0.1';

server.on("error", (err) => {
  console.error("Server Error:\n", error);
  server.close();
})

server.on("message", (msg, rinfo) => {
  console.log(`收到来自 ${rinfo.address}:${rinfo.port} 的消息: ${msg.toString()}`);

  const response = Buffer.from(`[Server Echo] 收到你的消息了: ${msg}`);

  server.send(response, 0, response.length, rinfo.port, rinfo.address, (e) => {
    if (e) {
      console.error(`发送echo失败: ${e.message}`)
    }
  })
})

server.on('listening', () => {
  const address = server.address();
  console.log(`UDP 服务端已启动，正在监听 ${address.address}:${address.port}`);
});

server.bind(PORT, HOST);
