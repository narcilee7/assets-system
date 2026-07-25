const dgram = require('dgram');

function runServer() {
    return new Promise((resolve, reject) => {
        // TODO: 创建 UDP socket，绑定 0 端口
        // TODO: 收到消息时：ping -> pong，其他 -> 当前时间 ISO 字符串
        // TODO: resolve 返回地址
    });
}

function runClient(addr, messages) {
    return new Promise((resolve, reject) => {
        // TODO: 创建 UDP socket，逐条发送并接收回复
        // TODO: resolve 回复列表
    });
}

async function main() {
    const addr = await runServer();
    await new Promise(r => setTimeout(r, 100));

    const messages = ["ping", "time"];
    const replies = await runClient(addr, messages);

    let ok = replies.length === 2 && replies[0] === "pong";
    if (ok) {
        const d = new Date(replies[1]);
        ok = !isNaN(d.getTime());
    }
    console.log(ok ? "PASS: udp server correct" : `FAIL: got ${JSON.stringify(replies)}`);
}

main().catch(console.error);
