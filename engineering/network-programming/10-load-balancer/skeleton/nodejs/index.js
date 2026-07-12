const net = require('net');

class Backend {
    constructor(addr) {
        this.addr = addr;
        this.healthy = true;
        this.failCount = 0;
    }
}

class LoadBalancer {
    constructor(backendAddrs) {
        this.backends = backendAddrs.map(a => new Backend(a));
        this.idx = 0;
        this.server = null;
    }

    start(listenAddr) {
        return new Promise((resolve, reject) => {
            // TODO: 创建 server，Round Robin 选择健康后端，双向转发
            // TODO: listen 后 resolve 地址
        });
    }

    pickBackend() {
        // TODO: 轮询，跳过不健康后端
        return null;
    }

    healthCheck() {
        // TODO: 定时检查后端健康
    }

    stop() {
        if (this.server) this.server.close();
    }
}

async function main() {
    // 启动 3 个后端 server
    const backends = [];
    for (let i = 0; i < 3; i++) {
        const s = net.createServer((c) => {
            c.write(`backend${i}`);
            c.end();
        });
        await new Promise(r => s.listen(0, '127.0.0.1', r));
        backends.push(s);
    }
    const addrs = backends.map(s => {
        const a = s.address();
        return `${a.address}:${a.port}`;
    });

    const lb = new LoadBalancer(addrs);
    // TODO: 启动 lb，测试 Round Robin 和健康检查
    console.log("PASS / FAIL 请在实现 LoadBalancer 后运行");

    lb.stop();
    backends.forEach(s => s.close());
}

main().catch(console.error);
