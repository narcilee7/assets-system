const net = require('net');

class SSEServer {
    constructor() {
        this.events = [];
        this.server = null;
    }

    listenAndServe(port, host) {
        return new Promise((resolve, reject) => {
            // TODO: 创建 server，处理 GET /events
            // TODO: 发送 SSE 响应头，支持 Last-Event-ID
            // TODO: 持续推送事件和心跳
        });
    }

    addEvent(data) {
        // TODO: 追加事件，返回 ID
        return this.events.length;
    }
}

class SSEClient {
    constructor(serverAddr) {
        this.serverAddr = serverAddr;
        this.lastID = -1;
    }

    async connect() {
        // TODO: 连接 server，发送 GET /events（带 Last-Event-ID）
        // TODO: 解析事件流，返回 async iterable
        // TODO: 断线后重连
        return {
            async *[Symbol.asyncIterator]() {
                yield 'not implemented';
            }
        };
    }
}

async function main() {
    const server = new SSEServer();
    // TODO: 启动 server，client 测试断线恢复
    console.log("PASS / FAIL 请在实现 SSEServer 和 SSEClient 后运行");
}

main().catch(console.error);
