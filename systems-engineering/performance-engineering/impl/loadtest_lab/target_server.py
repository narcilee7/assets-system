#!/usr/bin/env python3
"""
Load Test Target Server — Chain-1 L3 Lab

模拟一个真实的微服务节点，提供多种延迟模式的端点，
用于验证压测工具是否能正确捕捉瓶颈。

运行：
    pip install aiohttp
    python3 target_server.py --port 8080

端点：
    /health          -> 健康检查（<1ms）
    /api/fast        -> 快速响应（~1ms）
    /api/slow        -> 慢查询模拟（~100ms）
    /api/cpu         -> CPU 密集型（~30ms）
    /api/error       -> 50% 错误率
    /api/variable    -> 随机延迟（10-200ms）
    /api/timeout     -> 偶尔超时（P10 为 3s，其余 <10ms）
"""

import argparse
import asyncio
import random
import time

from aiohttp import web

# ---- CPU bound workload ---------------------------------------------------

def fib(n: int) -> int:
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

# ---- Handlers --------------------------------------------------------------

async def health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


async def fast(request: web.Request) -> web.Response:
    await asyncio.sleep(0.001)  # 1ms
    return web.json_response({"latency_ms": 1})


async def slow(request: web.Request) -> web.Response:
    # 模拟数据库查询：100ms ± 20ms
    delay = 0.1 + random.gauss(0, 0.02)
    await asyncio.sleep(max(delay, 0.05))
    return web.json_response({"latency_ms": round(delay * 1000, 1)})


async def cpu_bound(request: web.Request) -> web.Response:
    # 在线程池中运行 CPU 密集型任务，避免阻塞 event loop
    loop = asyncio.get_event_loop()
    start = time.perf_counter()
    await loop.run_in_executor(None, fib, 30)
    elapsed = (time.perf_counter() - start) * 1000
    return web.json_response({"fib30_ms": round(elapsed, 2)})


async def error_prone(request: web.Request) -> web.Response:
    if random.random() < 0.5:
        return web.json_response({"error": " simulated failure"}, status=500)
    return web.json_response({"status": "ok"})


async def variable_delay(request: web.Request) -> web.Response:
    # 指数分布延迟，更贴近真实长尾延迟
    delay = random.expovariate(1 / 0.05)  # 均值 50ms
    delay = min(delay, 0.5)  # 上限 500ms
    await asyncio.sleep(delay)
    return web.json_response({"latency_ms": round(delay * 1000, 1)})


async def occasional_timeout(request: web.Request) -> web.Response:
    # 10% 概率 3s 延迟（触发压测侧超时），其余 <10ms
    if random.random() < 0.1:
        await asyncio.sleep(3.0)
        return web.json_response({"latency_ms": 3000})
    await asyncio.sleep(0.005)
    return web.json_response({"latency_ms": 5})


# ---- Metrics endpoint (for observability) ----------------------------------

request_count = 0
request_latency_total = 0.0


@web.middleware
async def metrics_middleware(request: web.Request, handler):
    global request_count, request_latency_total
    start = time.perf_counter()
    try:
        response = await handler(request)
    except Exception:
        response = web.json_response({"error": "internal"}, status=500)
    latency = time.perf_counter() - start
    request_count += 1
    request_latency_total += latency
    response.headers["X-Response-Time-Ms"] = str(round(latency * 1000, 3))
    return response


async def metrics(request: web.Request) -> web.Response:
    avg = (request_latency_total / request_count * 1000) if request_count else 0
    return web.json_response({
        "request_count": request_count,
        "avg_latency_ms": round(avg, 3),
    })


# ---- Main ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Load test target server")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    app = web.Application(middlewares=[metrics_middleware])
    app.router.add_get("/health", health)
    app.router.add_get("/api/fast", fast)
    app.router.add_get("/api/slow", slow)
    app.router.add_get("/api/cpu", cpu_bound)
    app.router.add_get("/api/error", error_prone)
    app.router.add_get("/api/variable", variable_delay)
    app.router.add_get("/api/timeout", occasional_timeout)
    app.router.add_get("/metrics", metrics)

    print(f"[*] Target server listening on http://localhost:{args.port}")
    print("[*] Endpoints: /health /api/fast /api/slow /api/cpu /api/error /api/variable /api/timeout")
    web.run_app(app, host="0.0.0.0", port=args.port, print=None)


if __name__ == "__main__":
    main()
