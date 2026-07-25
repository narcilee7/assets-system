const net = require('net');

class TCPProxy {
    constructor(listenAddr, backendAddr) {
        this.listenAddr = listenAddr;
        this.backendAddr = backendAddr;
        this.server = null;
    }

    start() {
        return new Promise((resolve, reject) => {
            // TODO: 创建 server，对每个连接 dial backend
            // TODO: 使用 pipe 双向转发数据
            // TODO: 一端关闭时关闭另一端
        });
    }

    stop() {
        if (this.server) this.server.close();
    }
}

async function main() {
    // 启动后端 echo server
    const backend = net.createServer((c) => {
        c.on('data', (data) => c.write(data));
    });
    await new Promise(r => backend.listen(0, '127.0.0.1', r));
    const backendAddr = backend.address();

    // 启动代理
    const proxy = new TCPProxy('127.0.0.1:0', `${backendAddr.address}:${backendAddr.port}`);
    await proxy.start();

    // TODO: 通过代理测试 echo
    console.log("PASS / FAIL 请在实现 TCPProxy 后运行");

    proxy.stop();
    backend.close();
}

main().catch(console.error);
