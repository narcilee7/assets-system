class HTTPClient {
    constructor() {
        // TODO
    }

    async do({ method, host, port, path, body = "", timeout = 5000, maxRetries = 3, retryDelay = 500 }) {
        // TODO:
        // 1. 建立 TCP 连接（net.createConnection）
        // 2. 发送 HTTP 请求
        // 3. 读取响应
        // 4. 如果可重试且幂等，指数退避后重试
        // 5. 如果超时，destroy socket 并 reject
        return { statusCode: 0, body: "" };
    }

    static isIdempotent(method) {
        // TODO
        return false;
    }
}

async function main() {
    // 请使用 05-http-server 中的 server 或 mock server 进行测试
    console.log("PASS / FAIL 请在实现 HTTPClient.do 后，配合 mock server 测试");
}

main().catch(console.error);
