const net = require('net');

class HTTPServer {
    constructor() {
        this.server = null;
    }

    listenAndServe(port, host) {
        return new Promise((resolve, reject) => {
            // TODO: 创建 TCP server
            // TODO: 对每个连接，手动解析 HTTP/1.1 请求（支持 Keep-Alive）
            // TODO: 路由：GET /hello -> 200 "Hello, World!"
            // TODO: 路由：POST /echo -> 200 body
            // TODO: 其他 -> 404
            // TODO: listen 后 resolve 实际地址
        });
    }

    handleConn(socket) {
        // TODO: 维护一个 buffer，解析 HTTP 请求
        // TODO: 根据 Content-Length 确定请求边界
        // TODO: 生成响应并写入 socket
        // TODO: 如果 Connection: close，结束处理
    }
}

function httpClient(addr, method, path, body = "") {
    return new Promise((resolve, reject) => {
        const [host, port] = addr.split(':');
        const socket = net.createConnection({ host, port: parseInt(port) }, () => {
            let req = `${method} ${path} HTTP/1.1\r\nHost: ${addr}\r\n`;
            if (body) req += `Content-Length: ${Buffer.byteLength(body)}\r\n`;
            req += `\r\n${body}`;
            socket.write(req);
        });
        let data = Buffer.alloc(0);
        socket.on('data', chunk => { data = Buffer.concat([data, chunk]); });
        socket.on('end', () => {
            const text = data.toString();
            const lines = text.split('\r\n');
            const status = parseInt(lines[0].split(' ')[1]) || 0;
            const bodyStart = text.indexOf('\r\n\r\n');
            const respBody = bodyStart !== -1 ? text.slice(bodyStart + 4) : '';
            resolve({ status, body: respBody });
        });
        socket.on('error', reject);
    });
}

async function main() {
    const server = new HTTPServer();
    // TODO: 启动 server 并获取地址
    // 简化：请补全 server 启动逻辑和测试验证
    console.log("PASS / FAIL 请在实现 HTTPServer.listenAndServe 后运行");
}

main().catch(console.error);
