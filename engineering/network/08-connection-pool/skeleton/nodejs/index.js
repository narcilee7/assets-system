const net = require('net');

class TCPPool {
    constructor({ serverAddr, maxConns = 5, dialTimeout = 2000, idleTimeout = 5000 }) {
        this.serverAddr = serverAddr;
        this.maxConns = maxConns;
        this.dialTimeout = dialTimeout;
        this.idleTimeout = idleTimeout;
        // TODO: 添加可用连接数组、使用中 Set、等待队列等
    }

    async get(timeout) {
        // TODO: 获取可用连接或创建新连接
        // TODO: 如果池满，放入等待队列
    }

    put(conn) {
        // TODO: 归还连接
    }

    close() {
        // TODO: 关闭所有连接
    }
}

async function main() {
    // 启动后端 server
    const server = net.createServer();
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const addr = server.address();

    const pool = new TCPPool({ serverAddr: `${addr.address}:${addr.port}` });
    // TODO: 实现测试逻辑
    console.log("PASS / FAIL 请在实现 TCPPool 后运行");
    server.close();
}

main().catch(console.error);
