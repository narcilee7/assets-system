const net = require('net');

// Node.js 的 net.Socket 默认就是非阻塞的（由 libuv 管理）。
// 本题要求你显式设置非阻塞标志并手动管理超时。
function dialWithTimeout(host, port, timeoutMs) {
    return new Promise((resolve, reject) => {
        // TODO: 创建 socket，设置非阻塞模式（如有必要）
        // TODO: 使用 setTimeout 作为超时机制
        // TODO: connect 成功后 clearTimeout 并 resolve
        // TODO: 超时或出错时 destroy socket 并 reject
    });
}

async function main() {
    // 启动正常 server
    const server = net.createServer((conn) => {
        conn.on('data', (data) => conn.write(data));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const addr = server.address();

    // 测试 1：正常连接
    try {
        const socket = await dialWithTimeout(addr.address, addr.port, 2000);
        socket.write("ping");
        const data = await new Promise((res, rej) => {
            socket.once('data', res);
            socket.once('error', rej);
            setTimeout(() => rej(new Error("read timeout")), 1000);
        });
        socket.end();
    } catch (e) {
        console.log(`FAIL: normal connect: ${e.message}`);
        server.close();
        return;
    }

    // 测试 2：不可达端口
    try {
        await dialWithTimeout("127.0.0.1", 1, 200);
        console.log("FAIL: expected timeout error");
        server.close();
        return;
    } catch (e) {
        // expected
    }

    console.log("PASS: non-blocking dial with timeout correct");
    server.close();
}

main().catch(console.error);
