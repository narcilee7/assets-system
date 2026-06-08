const net = require('net');

function runServer() {
    return new Promise((resolve, reject) => {
        // TODO: 创建 TCP server，监听 0 端口
        // TODO: 对每个连接，逐行处理数据：非 "quit" 则回写，否则关闭
        // TODO: resolve 返回实际监听的地址
    });
}

function runClient(addr, messages) {
    return new Promise((resolve, reject) => {
        // TODO: 连接 server，逐行发送 messages，收集回复
        // TODO: 发送 quit 后关闭连接，resolve 回复列表
    });
}

async function main() {
    const addr = await runServer();
    await new Promise(r => setTimeout(r, 100));

    const messages = ["hello", "world", "quit"];
    const replies = await runClient(addr, messages);

    const expected = ["hello", "world"];
    if (JSON.stringify(replies) === JSON.stringify(expected)) {
        console.log("PASS: tcp echo correct");
    } else {
        console.log(`FAIL: expected ${JSON.stringify(expected)}, got ${JSON.stringify(replies)}`);
    }
}

main().catch(console.error);
