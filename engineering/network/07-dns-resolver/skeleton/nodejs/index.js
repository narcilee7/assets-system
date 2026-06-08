const dgram = require('dgram');

class DNSResolver {
    constructor(server = '8.8.8.8', port = 53) {
        this.server = server;
        this.port = port;
    }

    resolveA(domain) {
        return new Promise((resolve, reject) => {
            // TODO:
            // 1. 构造 DNS 查询报文（Buffer）
            //    - Header: 12 bytes
            //    - Question: 域名编码 + QTYPE=1 + QCLASS=1
            // 2. UDP socket sendto DNS server
            // 3. 接收响应，解析 Answer Section
            // 4. resolve IPv4 地址列表
            reject(new Error("not implemented"));
        });
    }

    static encodeDomain(domain) {
        // TODO: 将域名编码为 DNS 格式
        // 例如 "example.com" -> Buffer [7, e, x, a, m, p, l, e, 3, c, o, m, 0]
        return Buffer.alloc(0);
    }
}

async function main() {
    const resolver = new DNSResolver();
    try {
        const ips = await resolver.resolveA('example.com');
        if (ips.length === 0) {
            console.log("FAIL: no A records found");
            return;
        }
        for (const ip of ips) {
            if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
                console.log(`FAIL: invalid IPv4: ${ip}`);
                return;
            }
        }
        console.log(`PASS: resolved ${ips.length} A records: ${ips.join(', ')}`);
    } catch (e) {
        console.log(`FAIL: ${e.message}`);
    }
}

main().catch(console.error);
