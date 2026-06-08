// 并发模型：async/await
const State = {
    CLOSED: 0,
    OPEN: 1,
    HALF_OPEN: 2
};

class CircuitBreaker {
    constructor({ failureThreshold, recoveryTimeout, halfOpenMaxCalls }) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.halfOpenMaxCalls = halfOpenMaxCalls;
        // TODO: 添加状态、失败计数、成功计数、最后失败时间、半开探测计数等
    }

    async call(fn) {
        // TODO: 检查状态，决定是否允许执行
        // TODO: 执行 fn，根据结果更新状态
        return fn();
    }
}

async function main() {
    const cb = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 200,
        halfOpenMaxCalls: 1
    });

    const failFn = async () => { throw new Error("service down"); };
    const okFn = async () => "ok";

    for (let i = 0; i < 5; i++) {
        try { await cb.call(failFn); } catch (e) { /* ignore */ }
    }

    try {
        await cb.call(okFn);
        console.log("FAIL: expected rejection when circuit is open");
        return;
    } catch (e) {
        // expected
    }

    await new Promise(r => setTimeout(r, 250));

    try {
        await cb.call(okFn);
    } catch (e) {
        console.log(`FAIL: expected success on half-open probe, got ${e.message}`);
        return;
    }

    try {
        await cb.call(okFn);
    } catch (e) {
        console.log(`FAIL: expected success after recovery, got ${e.message}`);
        return;
    }

    console.log("PASS: circuit breaker state transitions correct");
}

main().catch(console.error);
