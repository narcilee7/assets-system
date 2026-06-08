// 并发模型：async/await（单线程事件循环中，锁可简化为同步代码）
class TokenBucket {
    constructor(capacity, rate) {
        // TODO: 初始化容量、速率、当前令牌数、上次填充时间戳
    }

    allow() {
        // TODO:
        // 1. 根据当前时间和上次填充时间计算应添加的令牌数
        // 2. 更新状态
        // 3. 如果令牌数 >= 1，减 1 并返回 true；否则返回 false
        return false;
    }
}

function main() {
    const tb = new TokenBucket(5, 2);

    let allowed = 0;
    for (let i = 0; i < 10; i++) {
        if (tb.allow()) allowed++;
    }
    if (allowed === 5) {
        console.log(`PASS: burst allowed = ${allowed} (capacity = 5)`);
    } else {
        console.log(`FAIL: burst allowed = ${allowed} (expected 5)`);
    }

    // Node.js 中同步 sleep 不常见，这里用忙等或 setTimeout 模拟
    // 为简化，用 Date.now() 差值测试更合理
    const start = Date.now();
    while (Date.now() - start < 1000) { /* busy wait for demo */ }

    allowed = 0;
    for (let i = 0; i < 10; i++) {
        if (tb.allow()) allowed++;
    }
    if (allowed === 2) {
        console.log(`PASS: sustained allowed = ${allowed} (rate = 2/sec)`);
    } else {
        console.log(`FAIL: sustained allowed = ${allowed} (expected 2)`);
    }
}

main();
