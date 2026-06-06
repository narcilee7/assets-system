#!/usr/bin/env python3
"""
End-to-End Latency Tracer — Chain-1 L3 Lab

对一个真实 URL 进行多次采样，使用 aiohttp 的 TraceConfig
拆解请求各阶段耗时，生成延迟 Budget 报告。

运行：
    # 追踪真实 API（默认 100 次采样）
    python3 trace_request.py --url https://httpbin.org/get --samples 50

    # 追踪本地服务
    python3 trace_request.py --url http://localhost:8080/api/slow --samples 100

输出字段：
    - DNS Lookup      : 域名解析时间
    - TCP Connect     : TCP 三次握手时间
    - TLS Handshake   : TLS 握手时间（HTTPS）
    - Send Request    : 发送请求头时间
    - Wait TTFB       : 首字节等待时间（服务器处理时间）
    - Receive Body    : 下载响应体时间
    - Total           : 总耗时
"""

import argparse
import asyncio
import statistics
import sys
import time
from dataclasses import dataclass, field
from typing import List, Optional

import aiohttp


@dataclass
class Sample:
    total_ms: float
    dns_ms: Optional[float]
    connect_ms: Optional[float]  # TCP + TLS（aiohttp 合并统计）
    ttfb_ms: Optional[float]     # Time To First Byte = 从连接完成到收到第一个字节
    receive_ms: Optional[float]
    status: int
    error: Optional[str] = None


def percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    k = (len(sorted_vals) - 1) * p / 100.0
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_vals) else f
    if f == c:
        return sorted_vals[f]
    return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)


async def trace_single(session: aiohttp.ClientSession, url: str) -> Sample:
    """执行一次带追踪的请求，返回各阶段延迟。"""
    timings = {
        "dns_start": None,
        "dns_end": None,
        "tcp_start": None,
        "tcp_end": None,
        "tls_start": None,
        "tls_end": None,
        "send_start": None,
        "send_end": None,
        "ttfb": None,
        "receive_end": None,
    }

    async def on_dns_start(session, trace_config_ctx, params):
        trace_config_ctx.trace_dns_start = time.perf_counter()

    async def on_dns_end(session, trace_config_ctx, params):
        trace_config_ctx.trace_dns_end = time.perf_counter()

    async def on_connection_create_start(session, trace_config_ctx, params):
        trace_config_ctx.trace_tcp_start = time.perf_counter()

    async def on_connection_create_end(session, trace_config_ctx, params):
        trace_config_ctx.trace_tcp_end = time.perf_counter()

    async def on_request_start(session, trace_config_ctx, params):
        trace_config_ctx.trace_send_start = time.perf_counter()

    async def on_request_end(session, trace_config_ctx, params):
        trace_config_ctx.trace_send_end = time.perf_counter()

    async def on_response_chunk_received(session, trace_config_ctx, params):
        if trace_config_ctx.trace_ttfb is None:
            trace_config_ctx.trace_ttfb = time.perf_counter()

    # 注意：aiohttp 的 TraceConfig 需要在 ClientSession 创建时传入，
    # 但我们已经在 session 里了。为了简化，这里直接用 time.perf_counter()
    # 在外层计算 total，内层用 aiohttp 的 trace 获取阶段时间。
    # 实际上更好的方式是每次请求前创建新的 TraceConfig。
    # 为了代码简洁，这里我们直接用新的 session 做追踪。
    raise RuntimeError("Use trace_sample_with_new_session instead")


async def trace_sample_with_new_session(url: str) -> Sample:
    """为每次采样创建独立 session，确保连接不复用，能测到完整 TCP/TLS 握手。"""
    timings = {}

    trace_config = aiohttp.TraceConfig()

    @trace_config.on_dns_resolvehost_start
    async def on_dns_start(session, trace_config_ctx, params):
        timings["dns_start"] = time.perf_counter()

    @trace_config.on_dns_resolvehost_end
    async def on_dns_end(session, trace_config_ctx, params):
        timings["dns_end"] = time.perf_counter()

    @trace_config.on_connection_create_start
    async def on_tcp_start(session, trace_config_ctx, params):
        timings["tcp_start"] = time.perf_counter()

    @trace_config.on_connection_create_end
    async def on_tcp_end(session, trace_config_ctx, params):
        timings["tcp_end"] = time.perf_counter()

    @trace_config.on_connection_reuseconn
    async def on_reuse(session, trace_config_ctx, params):
        timings["reused"] = True

    @trace_config.on_response_chunk_received
    async def on_chunk(session, trace_config_ctx, params):
        if "ttfb" not in timings:
            timings["ttfb"] = time.perf_counter()

    # 禁用连接池复用，确保每次都能测到完整握手
    connector = aiohttp.TCPConnector(limit=1, limit_per_host=1, enable_cleanup_closed=True, force_close=True)
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        trace_configs=[trace_config],
    ) as session:
        total_start = time.perf_counter()
        try:
            async with session.get(url) as resp:
                body = await resp.read()
                total_end = time.perf_counter()

                dns_ms = _diff_ms(timings, "dns_start", "dns_end")
                connect_ms = _diff_ms(timings, "tcp_start", "tcp_end")
                # aiohttp 没有单独的 TLS trace 事件，connect_ms 已包含 TLS（HTTPS 时）
                ttfb_ms = _diff_ms(timings, "tcp_end", "ttfb")
                receive_ms = max(0.0, (total_end - timings["ttfb"]) * 1000) if "ttfb" in timings else None
                total_ms = (total_end - total_start) * 1000

                # 如果是连接复用，connect 时间为 0，TTFB 从请求排队开始算
                if timings.get("reused"):
                    connect_ms = 0.0
                    ttfb_ms = _diff_ms(timings, "dns_end", "ttfb")

                return Sample(
                    total_ms=total_ms,
                    dns_ms=dns_ms,
                    connect_ms=connect_ms,
                    ttfb_ms=ttfb_ms,
                    receive_ms=receive_ms,
                    status=resp.status,
                )
        except Exception as e:
            total_end = time.perf_counter()
            return Sample(
                total_ms=(total_end - total_start) * 1000,
                dns_ms=None, connect_ms=None,
                ttfb_ms=None, receive_ms=None,
                status=0, error=str(e),
            )


def _diff_ms(timings: dict, start_key: str, end_key: str) -> Optional[float]:
    s = timings.get(start_key)
    e = timings.get(end_key)
    if s is not None and e is not None:
        return max(0.0, (e - s) * 1000)
    return None


async def run_traces(url: str, samples: int, concurrency: int = 5) -> List[Sample]:
    """并发采样，但限制并发数以避免成为 DoS。"""
    semaphore = asyncio.Semaphore(concurrency)

    async def one(i: int) -> Sample:
        async with semaphore:
            # 每次采样间隔 50ms，避免触发速率限制
            if i > 0:
                await asyncio.sleep(0.05)
            return await trace_sample_with_new_session(url)

    tasks = [one(i) for i in range(samples)]
    return await asyncio.gather(*tasks)


def build_report(samples: List[Sample], url: str) -> dict:
    ok_samples = [s for s in samples if s.error is None]
    errors = [s for s in samples if s.error is not None]

    def stats(getter):
        vals = sorted([getter(s) for s in ok_samples if getter(s) is not None])
        if not vals:
            return {"p50": None, "p90": None, "p99": None, "mean": None, "min": None, "max": None}
        return {
            "p50": round(percentile(vals, 50), 3),
            "p90": round(percentile(vals, 90), 3),
            "p99": round(percentile(vals, 99), 3),
            "mean": round(statistics.mean(vals), 3),
            "min": round(vals[0], 3),
            "max": round(vals[-1], 3),
        }

    report = {
        "url": url,
        "total_samples": len(samples),
        "success": len(ok_samples),
        "errors": len(errors),
        "components": {
            "DNS Lookup": stats(lambda s: s.dns_ms),
            "TCP+TLS Connect": stats(lambda s: s.connect_ms),
            "Wait TTFB": stats(lambda s: s.ttfb_ms),
            "Receive Body": stats(lambda s: s.receive_ms),
            "Total": stats(lambda s: s.total_ms),
        },
    }
    return report


def print_report(report: dict) -> None:
    print("\n" + "=" * 75)
    print(f"End-to-End Latency Trace: {report['url']}")
    print("=" * 75)
    print(f"Samples: {report['total_samples']} (success: {report['success']}, errors: {report['errors']})")
    print("-" * 75)
    print(f"{'Component':<18} {'Min':<10} {'Mean':<10} {'P50':<10} {'P90':<10} {'P99':<10}")
    print("-" * 75)

    for name, s in report["components"].items():
        if s["mean"] is None:
            print(f"{name:<18} {'N/A':<10} {'N/A':<10} {'N/A':<10} {'N/A':<10} {'N/A':<10}")
            continue
        print(f"{name:<18} {s['min']:<10.2f} {s['mean']:<10.2f} {s['p50']:<10.2f} {s['p90']:<10.2f} {s['p99']:<10.2f}")

    print("=" * 75)

    # Budget analysis
    total = report["components"]["Total"]
    ttfb = report["components"]["Wait TTFB"]
    connect = report["components"]["TCP+TLS Connect"]
    dns = report["components"]["DNS Lookup"]
    if total["mean"] and ttfb["mean"]:
        ttfb_pct = round(ttfb["mean"] / total["mean"] * 100, 1)
        connect_pct = round(connect["mean"] / total["mean"] * 100, 1) if connect["mean"] else 0
        print(f"\n📊 Budget Insight:")
        print(f"   TTFB (server processing)  : {ttfb_pct}% of total mean latency")
        print(f"   TCP+TLS Connect           : {connect_pct}% of total mean latency")
        if ttfb_pct > 50:
            print("   -> Server is the dominant bottleneck. Optimize application logic.")
        elif connect_pct > 40:
            print("   -> Connection setup is heavy. Consider keep-alive / connection pool / session resumption.")
        elif dns["mean"] and dns["mean"] > 20:
            print("   -> DNS lookup is slow. Consider DNS prefetching or local cache.")
        else:
            print("   -> Latency is distributed. Check network path and payload size.")
    print()


async def main_async():
    parser = argparse.ArgumentParser(description="End-to-End Latency Tracer")
    parser.add_argument("--url", required=True, help="Target URL")
    parser.add_argument("--samples", type=int, default=100, help="Number of samples")
    parser.add_argument("--concurrency", type=int, default=5, help="Concurrent requests")
    parser.add_argument("--output", type=str, default="", help="Save JSON report")
    args = parser.parse_args()

    print(f"[*] Tracing {args.url} with {args.samples} samples (concurrency={args.concurrency})...")
    samples = await run_traces(args.url, args.samples, args.concurrency)
    report = build_report(samples, args.url)
    print_report(report)

    if args.output:
        import json
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[*] Report saved to {args.output}")


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
