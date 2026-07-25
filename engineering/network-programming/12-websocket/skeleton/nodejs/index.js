const net = require('net');
const crypto = require('crypto');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WebSocketServer {
    constructor() {
        this.server = null;
    }

    listenAndServe(port, host) {
        return new Promise((resolve, reject) => {
            // TODO: 创建 server，处理 HTTP Upgrade 握手
            // TODO: 解析 WebSocket 帧，处理文本和关闭帧
            // TODO: listen 后 resolve 地址
        });
    }

    handleConn(socket) {
        // TODO:
        // 1. 读取 HTTP 头，提取 Sec-WebSocket-Key
        // 2. 计算 accept = base64(sha1(key + GUID))
        // 3. 发送 101 Switching Protocols
        // 4. 切换到帧解析模式
    }

    static computeAccept(key) {
        // TODO: crypto.createHash('sha1').update(key + WS_GUID).digest('base64')
        return '';
    }

    static readFrame(socket) {
        // TODO: 读取 2 字节头，解析 payload length，解码 mask，返回 { opcode, payload }
        return new Promise((resolve, reject) => {
            reject(new Error('not implemented'));
        });
    }

    static writeTextFrame(socket, payload) {
        // TODO: 构造文本帧（不 mask）并写入
        return new Promise((resolve, reject) => {
            reject(new Error('not implemented'));
        });
    }
}

async function main() {
    const server = new WebSocketServer();
    // TODO: 启动 server，使用 client 测试
    console.log("PASS / FAIL 请在实现 WebSocketServer 后运行");
}

main().catch(console.error);
