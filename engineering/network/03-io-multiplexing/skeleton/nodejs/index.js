const net = require('net');

function runServer() {
    return new Promise((resolve, reject) => {
        // TODO: 创建 TCP server
        // TODO: 手动维护 connections Set
        // TODO: 使用 server.on('connection') 添加新连接
        // TODO: 对每个连接，监听 'data' 事件并 echo 回去；监听 'close' 事件并从 Set 中移除
        // TODO: server.listen(0) 后 resolve 地址
        // 注意：虽然 Node.js 底层用了 epoll，但本题要求你显式管理连接集合
    });
}

function runClient(addr, msg) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection(addr, () => {
            client.write(msg);
        });
        client.on('data', (data) => {
            resolve(data.toString());
            client.end();
        });
        client.on('error', reject);
    });
}

async function main() {
    const addr = await runServer();
    await new Promise(r => setTimeout(r, 100));

    const clients = Array.from({ length: 3 }, (_, i) => runClient(addr, `client${i}`));
    const replies = await Promise.all(clients);

    for (let i = 0; i < 3; i++) {
        if (replies[i] !== `client${i}`) {
            console.log(`FAIL: expected client${i}, got ${replies[i]}`);
            return;
        }
    }
    console.log("PASS: multiplexed echo server correct");
}

main().catch(console.error);
