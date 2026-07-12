const net = require('net');

class ChatServer {
    constructor() {
        this.clients = new Map(); // username -> socket
        this.server = null;
    }

    listenAndServe(port, host) {
        return new Promise((resolve, reject) => {
            // TODO: 创建 server，处理连接：注册、消息路由、广播、在线列表
            // TODO: listen 后 resolve 地址
        });
    }

    broadcast(sender, msg) {
        // TODO: 发送给除 sender 外的所有客户端
    }

    getUserList() {
        // TODO: 返回在线用户名字符串
    }
}

async function main() {
    const server = new ChatServer();
    // TODO: 启动 server，多 client 测试
    console.log("PASS / FAIL 请在实现 ChatServer 后运行");
}

main().catch(console.error);
