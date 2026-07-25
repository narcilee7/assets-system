const dgram = require('dgram');

// 1. 创建 UDP Socket 客户端
const client = dgram.createSocket('udp4');

const SERVER_PORT = 41234;
const SERVER_HOST = '127.0.0.1'; // 对应服务端的 IP

// 准备要发送的数据
const message = Buffer.from('你好，我是 UDP 客户端！');

// 2. 发送数据包给服务端
// UDP 发送不需要提前建立连接，直接指定目标地址和端口扔过去
client.send(message, 0, message.length, SERVER_PORT, SERVER_HOST, (err) => {
  if (err) {
    console.error(`数据发送失败: ${err.stack}`);
    client.close();
    return;
  }
  console.log(`成功向 ${SERVER_HOST}:${SERVER_PORT} 发送了数据包`);
});

// 3. 监听服务端的“回信”
// 因为 UDP 是对等的，客户端只要暴露了端口，也能像服务端一样监听 message 事件
client.on('message', (msg, rinfo) => {
  console.log(`收到来自服务端的响应 [${rinfo.address}:${rinfo.port}]: ${msg.toString()}`);
  
  // 收到回执后，通常测试就可以结束了，关闭 socket 释放端口
  console.log('测试完成，关闭客户端连接。');
  client.close();
});

// 4. 监听错误事件
client.on('error', (err) => {
  console.error(`客户端异常:\n${err.stack}`);
  client.close();
});