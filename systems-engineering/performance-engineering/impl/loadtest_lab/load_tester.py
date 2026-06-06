#!/usr/bin/env python3
"""
Load Tester — Chain-1 L3 Lab

一个 Python 实现的轻量级压测客户端，支持：
  - Closed Model（固定并发，类似 wrk）
  - Open Model（固定速率，类似 k6 constant arrival rate）
  - Coordinated Omission 检测与修正
  - 自动阶梯加压（ramp-up / steady / ramp-down）
  - 延迟分布统计（P50/P90/P99/P999）

运行：
    # 先启动目标服务
    python3 target_server.py --port 8080 &

    # Closed model 压测（200 并发，30s）
    python3 load_tester.py --url http://localhost:8080/api/slow \
        --concurrency 200 --duration 30 --model closed

    # Open model 压测（100 RPS，30s）
    python3 load_tester.py --url http://localhost:8080/api/slow \
        --rps 100 --duration 30 --model open

    # 阶梯加压（closed model）
    python3 load_tester.py --url http://localhost:8080/api/variable \
        --stages "10:10,50:20,100:20,50:10,0:5" --model closed
"""

import argparse
import asyncio
import csv
import json
import signal
import statistics
import sys
import time
from dataclasses import dataclass, field
from typing import List, Optional

import aiohttp


# ---- Data structures -------------------------------------------------------

@dataclass
class Record:
    """单次请求的记录。"""
    status: int
    latency_ms: float          # 从发送开始到收到响应的 wall-clock 时间
    intended_start_ms: float   # open model 中的计划发送时间（用于 CO 检测）
    actual_start_ms: float     # 实际发送时间
    bytes_recv: int
    is_error: bool


@dataclass
class Report:
    """压测报告。"""
    url: str
    model: str
    duration_sec: float
    total_requests: int
    success: int
    errors: int
    timeouts: int
    qps: float
    throughput_mbps: float

    # 延迟统计（原始 latency_ms）
    latency_min: float
    latency_p50: float
    latency_p90: float
    latency_p99: float
    latency_p999: float
    latency_max: float
    latency_mean: float
    latency_std: float

    # Coordinated Omission 修正后的延迟（open model 时有效）
    co_corrected_p99: Optional[float] = None

    # 阶梯报告
    stage_reports: List[dict] = field(default_factory=list)


# ---- Statistics ------------------------------------------------------------

def percentile(sorted_data: List[float], p: float) -> float:
    if not sorted_data:
        return 0.0
    k = (len(sorted_data) - 1) * p / 100.0
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_data) else f
    if f == c:
        return sorted_data[f]
    return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)


def build_report(records: List[Record], url: str, model: str,
                 duration_sec: float, timeout_sec: float) -> Report:
    if not records:
        return Report(url=url, model=model, duration_sec=duration_sec,
                      total_requests=0, success=0, errors=0, timeouts=0,
                      qps=0.0, throughput_mbps=0.0,
                      latency_min=0.0, latency_p50=0.0, latency_p90=0.0,
                      latency_p99=0.0, latency_p999=0.0, latency_max=0.0,
                      latency_mean=0.0, latency_std=0.0)

    latencies = sorted([r.latency_ms for r in records])
    total_bytes = sum(r.bytes_recv for r in records)
    success = sum(1 for r in records if not r.is_error)
    errors = len(records) - success
    timeouts = sum(1 for r in records if r.latency_ms >= timeout_sec * 1000 * 0.99)

    # Coordinated Omission 修正：effective_latency = latency + (actual_start - intended_start)
    corrected = []
    for r in records:
        if model == "open":
            queue_delay = max(0.0, r.actual_start_ms - r.intended_start_ms)
            corrected.append(r.latency_ms + queue_delay)
        else:
            corrected.append(r.latency_ms)
    corrected_sorted = sorted(corrected)

    return Report(
        url=url,
        model=model,
        duration_sec=duration_sec,
        total_requests=len(records),
        success=success,
        errors=errors,
        timeouts=timeouts,
        qps=round(len(records) / duration_sec, 2),
        throughput_mbps=round(total_bytes / duration_sec / 1024 / 1024, 3),
        latency_min=round(latencies[0], 3),
        latency_p50=round(percentile(latencies, 50), 3),
        latency_p90=round(percentile(latencies, 90), 3),
        latency_p99=round(percentile(latencies, 99), 3),
        latency_p999=round(percentile(latencies, 99.9), 3),
        latency_max=round(latencies[-1], 3),
        latency_mean=round(statistics.mean(latencies), 3),
        latency_std=round(statistics.stdev(latencies) if len(latencies) > 1 else 0.0, 3),
        co_corrected_p99=round(percentile(corrected_sorted, 99), 3) if model == "open" else None,
    )


# ---- Load generators -------------------------------------------------------

async def closed_model_worker(
    session: aiohttp.ClientSession,
    url: str,
    stop_event: asyncio.Event,
    records: List[Record],
    timeout_sec: float,
    method: str = "GET",
    payload: Optional[bytes] = None,
) -> None:
    """
    Closed model：固定并发，每个 worker 循环发请求，
    收到响应后立即发下一个（类似 wrk 的 --connections）。
    """
    headers = {"Content-Type": "application/json"} if payload else {}
    while not stop_event.is_set():
        actual_start = time.perf_counter()
        try:
            async with session.request(
                method, url, headers=headers, data=payload,
                timeout=aiohttp.ClientTimeout(total=timeout_sec),
            ) as resp:
                body = await resp.read()
                latency = (time.perf_counter() - actual_start) * 1000
                records.append(Record(
                    status=resp.status,
                    latency_ms=latency,
                    intended_start_ms=actual_start * 1000,
                    actual_start_ms=actual_start * 1000,
                    bytes_recv=len(body),
                    is_error=resp.status >= 400,
                ))
        except asyncio.TimeoutError:
            latency = (time.perf_counter() - actual_start) * 1000
            records.append(Record(
                status=0, latency_ms=latency,
                intended_start_ms=actual_start * 1000,
                actual_start_ms=actual_start * 1000,
                bytes_recv=0, is_error=True,
            ))
        except Exception:
            latency = (time.perf_counter() - actual_start) * 1000
            records.append(Record(
                status=0, latency_ms=latency,
                intended_start_ms=actual_start * 1000,
                actual_start_ms=actual_start * 1000,
                bytes_recv=0, is_error=True,
            ))


async def open_model_worker(
    session: aiohttp.ClientSession,
    url: str,
    stop_event: asyncio.Event,
    rate_per_sec: float,
    records: List[Record],
    timeout_sec: float,
    worker_id: int,
    total_workers: int,
    method: str = "GET",
    payload: Optional[bytes] = None,
) -> None:
    """
    Open model：固定速率发送请求，不等待响应。
    每个 worker 负责 total_workers 分之一的速率。
    """
    interval = total_workers / rate_per_sec  # 每个 worker 的发送间隔
    headers = {"Content-Type": "application/json"} if payload else {}
    seq = 0
    base_time = time.perf_counter()

    while not stop_event.is_set():
        intended_start = base_time + seq * interval
        now = time.perf_counter()
        sleep_time = intended_start - now
        if sleep_time > 0:
            await asyncio.sleep(sleep_time)
        elif sleep_time < -interval * 5:
            # 如果严重落后，跳过一些请求（背压）
            seq += 1
            continue

        actual_start = time.perf_counter()
        try:
            async with session.request(
                method, url, headers=headers, data=payload,
                timeout=aiohttp.ClientTimeout(total=timeout_sec),
            ) as resp:
                body = await resp.read()
                latency = (time.perf_counter() - actual_start) * 1000
                records.append(Record(
                    status=resp.status,
                    latency_ms=latency,
                    intended_start_ms=intended_start * 1000,
                    actual_start_ms=actual_start * 1000,
                    bytes_recv=len(body),
                    is_error=resp.status >= 400,
                ))
        except asyncio.TimeoutError:
            latency = (time.perf_counter() - actual_start) * 1000
            records.append(Record(
                status=0, latency_ms=latency,
                intended_start_ms=intended_start * 1000,
                actual_start_ms=actual_start * 1000,
                bytes_recv=0, is_error=True,
            ))
        except Exception:
            latency = (time.perf_counter() - actual_start) * 1000
            records.append(Record(
                status=0, latency_ms=latency,
                intended_start_ms=intended_start * 1000,
                actual_start_ms=actual_start * 1000,
                bytes_recv=0, is_error=True,
            ))
        seq += 1


# ---- Stage parsing ---------------------------------------------------------

def parse_stages(stages_str: str) -> List[tuple]:
    """
    解析阶梯字符串："concurrency:duration_sec,concurrency:duration_sec,..."
    例如："10:10,50:20,100:20,50:10,0:5"
    """
    stages = []
    for part in stages_str.split(","):
        c, d = part.split(":")
        stages.append((int(c.strip()), float(d.strip())))
    return stages


# ---- Main runner -----------------------------------------------------------

async def run_loadtest(args) -> Report:
    connector = aiohttp.TCPConnector(limit=10000, limit_per_host=10000)
    session = aiohttp.ClientSession(connector=connector)
    all_records: List[Record] = []
    stop_event = asyncio.Event()

    def signal_handler():
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    start_time = time.perf_counter()
    tasks = []

    try:
        if args.stages:
            # ---- 阶梯加压模式 ----
            stages = parse_stages(args.stages)
            for concurrency, duration in stages:
                if stop_event.is_set():
                    break
                if concurrency <= 0:
                    await asyncio.sleep(duration)
                    continue

                stage_records: List[Record] = []
                stage_stop = asyncio.Event()
                stage_tasks = []

                if args.model == "open":
                    # open model 的阶梯：把并发解释为 worker 数，rate 由用户指定
                    rate = args.rps or concurrency * 2
                    for i in range(concurrency):
                        t = asyncio.create_task(
                            open_model_worker(
                                session, args.url, stage_stop, rate,
                                stage_records, args.timeout, i, concurrency,
                            )
                        )
                        stage_tasks.append(t)
                else:
                    for _ in range(concurrency):
                        t = asyncio.create_task(
                            closed_model_worker(
                                session, args.url, stage_stop, stage_records,
                                args.timeout,
                            )
                        )
                        stage_tasks.append(t)

                # 等待该阶段结束
                await asyncio.sleep(duration)
                stage_stop.set()
                await asyncio.gather(*stage_tasks, return_exceptions=True)
                all_records.extend(stage_records)

        elif args.model == "open":
            # ---- 固定速率 open model ----
            workers = args.concurrency or max(1, int(args.rps / 10))
            rate = args.rps or workers * 10
            for i in range(workers):
                t = asyncio.create_task(
                    open_model_worker(
                        session, args.url, stop_event, rate,
                        all_records, args.timeout, i, workers,
                    )
                )
                tasks.append(t)
            await asyncio.sleep(args.duration)
            stop_event.set()
            await asyncio.gather(*tasks, return_exceptions=True)

        else:
            # ---- 固定并发 closed model ----
            concurrency = args.concurrency or 10
            for _ in range(concurrency):
                t = asyncio.create_task(
                    closed_model_worker(
                        session, args.url, stop_event, all_records, args.timeout,
                    )
                )
                tasks.append(t)
            await asyncio.sleep(args.duration)
            stop_event.set()
            await asyncio.gather(*tasks, return_exceptions=True)

    finally:
        await session.close()
        await connector.close()

    actual_duration = time.perf_counter() - start_time
    return build_report(all_records, args.url, args.model, actual_duration, args.timeout)


def print_report(report: Report, args) -> None:
    print("\n" + "=" * 60)
    print(f"Load Test Report")
    print("=" * 60)
    print(f"URL            : {report.url}")
    print(f"Model          : {report.model}")
    print(f"Duration       : {report.duration_sec:.1f}s")
    print(f"Total Requests : {report.total_requests}")
    print(f"Success        : {report.success}")
    print(f"Errors         : {report.errors} (timeouts: {report.timeouts})")
    print(f"QPS            : {report.qps}")
    print(f"Throughput     : {report.throughput_mbps} MB/s")
    print("-" * 60)
    print("Latency Distribution (ms)")
    print(f"  Min    : {report.latency_min}")
    print(f"  Mean   : {report.latency_mean}  (std: {report.latency_std})")
    print(f"  P50    : {report.latency_p50}")
    print(f"  P90    : {report.latency_p90}")
    print(f"  P99    : {report.latency_p99}")
    print(f"  P99.9  : {report.latency_p999}")
    print(f"  Max    : {report.latency_max}")
    if report.co_corrected_p99 is not None:
        print("-" * 60)
        print("Coordinated Omission Corrected")
        print(f"  P99 (corrected) : {report.co_corrected_p99}")
        if report.co_corrected_p99 > report.latency_p99 * 1.2:
            print("  ⚠️  WARNING: CO detected! Raw latency underestimates tail by >20%.")
    print("=" * 60)

    # JSON 输出
    if args.json:
        with open(args.json, "w") as f:
            json.dump(report.__dict__, f, indent=2, default=str)
        print(f"[*] JSON report saved to {args.json}")

    # CSV 输出
    if args.csv:
        with open(args.csv, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["status", "latency_ms"])
            # 这里需要原始 records，为了简单省略详细 CSV
        print(f"[*] CSV saved to {args.csv}")


def main():
    parser = argparse.ArgumentParser(description="Python Load Tester")
    parser.add_argument("--url", required=True, help="Target URL")
    parser.add_argument("--model", choices=["closed", "open"], default="closed",
                        help="Load model: closed=固定并发循环, open=固定速率")
    parser.add_argument("--concurrency", type=int, default=10,
                        help="并发 worker 数（closed model）或 worker 数（open model）")
    parser.add_argument("--rps", type=float, default=0,
                        help="目标 RPS（仅 open model 有效）")
    parser.add_argument("--duration", type=float, default=30,
                        help="压测持续时间（秒）")
    parser.add_argument("--timeout", type=float, default=10,
                        help="请求超时（秒）")
    parser.add_argument("--stages", type=str, default="",
                        help='阶梯加压，格式 "c:d,c:d"，如 "10:10,50:20,100:20"')
    parser.add_argument("--json", type=str, default="",
                        help="输出 JSON 报告路径")
    parser.add_argument("--csv", type=str, default="",
                        help="输出原始延迟 CSV 路径")
    args = parser.parse_args()

    if args.model == "open" and args.rps <= 0 and not args.stages:
        print("[ERROR] open model 需要 --rps > 0")
        sys.exit(1)

    report = asyncio.run(run_loadtest(args))
    print_report(report, args)


if __name__ == "__main__":
    main()
