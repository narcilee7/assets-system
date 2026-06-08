const dgram = require('dgram');

// 包格式：seq(4) + ack(4) + flags(1) + len(2) + payload
class Packet {
    constructor(seq = 0, ack = 0, flags = 0, payload = Buffer.alloc(0)) {
        this.seq = seq;
        this.ack = ack;
        this.flags = flags;
        this.payload = payload;
    }

    marshal() {
        // TODO: Buffer.alloc + writeUInt32BE + writeUInt8 + writeUInt16BE + copy payload
        return Buffer.alloc(0);
    }

    static unmarshal(buf) {
        // TODO: 解析 Buffer
        return new Packet();
    }
}

class ReliableSender {
    constructor(socket, addr) {
        this.socket = socket;
        this.addr = addr;
        this.window = 1;
    }

    async send(data) {
        // TODO: 分片、发送、等待 ACK、超时重传
    }
}

class ReliableReceiver {
    constructor(socket) {
        this.socket = socket;
    }

    async receive() {
        // TODO: 接收、排序、去重、发 ACK、重组数据
    }
}

async function main() {
    const sendSock = dgram.createSocket('udp4');
    const recvSock = dgram.createSocket('udp4');

    sendSock.bind({ address: '127.0.0.1', port: 0 });
    recvSock.bind({ address: '127.0.0.1', port: 0 });

    await new Promise(r => sendSock.once('listening', r));
    await new Promise(r => recvSock.once('listening', r));

    const sendAddr = sendSock.address();
    const recvAddr = recvSock.address();

    // TODO: 启动 receiver，sender 发送数据，验证完整性
    console.log("PASS / FAIL 请在实现 ReliableSender/Receiver 后运行");

    sendSock.close();
    recvSock.close();
}

main().catch(console.error);
