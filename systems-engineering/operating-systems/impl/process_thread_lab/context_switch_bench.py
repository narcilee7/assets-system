#!/usr/bin/env python3
"""
Process / Thread / Goroutine Context Switch Benchmark — Chain OS L3 Lab

测量不同并发原语的创建开销和上下文切换开销。

运行：
    python3 context_switch_bench.py --mode all

参考数字（macOS M1 / Linux x86-64）：
    - 进程创建：~1-5 ms
    - 线程创建：~50-200 μs
    - 协程/绿色线程创建：~1-10 μs
    - 线程上下文切换：~1-5 μs（内核）
    - 协程上下文切换：~100-500 ns（用户态）
"""

import argparse
import multiprocessing
import os
import statistics
import sys
import threading
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


# ---- Utilities -----------------------------------------------------------

def measure(func, iterations=100):
    """测量函数执行 iterations 次的平均延迟（μs）。"""
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        func()
        end = time.perf_counter()
        times.append((end - start) * 1e6)
    return {
        "mean": statistics.mean(times),
        "median": statistics.median(times),
        "min": min(times),
        "max": max(times),
    }


def pipe_ping_pong(iterations=1000):
    """两个进程通过 pipe  ping-pong，测量进程间上下文切换。"""
    parent_recv, child_send = multiprocessing.Pipe(duplex=False)
    child_recv, parent_send = multiprocessing.Pipe(duplex=False)

    def child():
        for _ in range(iterations):
            child_send.send(1)
            child_recv.recv()

    p = multiprocessing.Process(target=child)
    p.start()

    start = time.perf_counter()
    for _ in range(iterations):
        parent_recv.recv()
        parent_send.send(1)
    elapsed = time.perf_counter() - start

    p.join()
    return elapsed / (iterations * 2) * 1e6  # μs per context switch


def thread_ping_pong(iterations=10000):
    """两个线程通过 Condition 变量 ping-pong，测量线程上下文切换。"""
    import threading

    ready_a = threading.Condition()
    ready_b = threading.Condition()
    state = {"turn": "a", "done": False}

    def thread_b():
        with ready_b:
            for _ in range(iterations):
                while state["turn"] != "b":
                    ready_b.wait()
                state["turn"] = "a"
                with ready_a:
                    ready_a.notify()

    t = threading.Thread(target=thread_b)
    t.start()

    start = time.perf_counter()
    with ready_a:
        for _ in range(iterations):
            state["turn"] = "b"
            with ready_b:
                ready_b.notify()
            while state["turn"] != "a":
                ready_a.wait()
    elapsed = time.perf_counter() - start

    t.join()
    return elapsed / (iterations * 2) * 1e6


def coro_ping_pong(iterations=100000):
    """两个协程通过 asyncio 事件循环 ping-pong。"""
    import asyncio

    async def run():
        a_to_b = asyncio.Queue(maxsize=1)
        b_to_a = asyncio.Queue(maxsize=1)

        async def coro_b():
            for _ in range(iterations):
                await a_to_b.get()
                await b_to_a.put(1)

        task = asyncio.create_task(coro_b())
        start = time.perf_counter()
        for _ in range(iterations):
            await a_to_b.put(1)
            await b_to_a.get()
        elapsed = time.perf_counter() - start
        await task
        return elapsed / (iterations * 2) * 1e6

    return asyncio.run(run())


def bench_creation():
    """测量创建开销。"""
    results = {}

    # 进程创建
    def spawn_process():
        p = multiprocessing.Process(target=lambda: None)
        p.start()
        p.join()

    results["process_create"] = measure(spawn_process, iterations=20)

    # 线程创建
    def spawn_thread():
        t = threading.Thread(target=lambda: None)
        t.start()
        t.join()

    results["thread_create"] = measure(spawn_thread, iterations=100)

    # 协程创建（asyncio Task）
    import asyncio

    def spawn_coro():
        async def noop():
            pass
        asyncio.run(noop())

    results["coro_create"] = measure(spawn_coro, iterations=200)

    return results


def bench_context_switch():
    """测量上下文切换开销。"""
    results = {}
    print("[*] Measuring process context switch (pipe ping-pong)...")
    results["process_ctx_switch"] = pipe_ping_pong(iterations=500)

    print("[*] Measuring thread context switch (condition ping-pong)...")
    results["thread_ctx_switch"] = thread_ping_pong(iterations=2000)

    print("[*] Measuring coroutine context switch (asyncio queue)...")
    results["coro_ctx_switch"] = coro_ping_pong(iterations=20000)

    return results


def print_results(creation, ctx_switch):
    print("\n" + "=" * 65)
    print("Concurrency Primitive Benchmark")
    print("=" * 65)
    print("\n--- Creation Overhead (lower is better) ---")
    print(f"{'Primitive':<20} {'Mean(μs)':<12} {'Min(μs)':<12} {'Max(μs)':<12}")
    print("-" * 56)
    for name, stats in creation.items():
        label = name.replace("_", " ").title()
        print(f"{label:<20} {stats['mean']:<12.2f} {stats['min']:<12.2f} {stats['max']:<12.2f}")

    print("\n--- Context Switch Overhead (lower is better) ---")
    print(f"{'Primitive':<20} {'Latency(μs)':<15}")
    print("-" * 35)
    for name, val in ctx_switch.items():
        label = name.replace("_", " ").title()
        print(f"{label:<20} {val:<15.3f}")

    print("\n💡 Insight:")
    ratio_proc_thread = creation["process_create"]["mean"] / creation["thread_create"]["mean"]
    ratio_thread_coro = creation["thread_create"]["mean"] / creation["coro_create"]["mean"]
    print(f"   Process create / Thread create  = {ratio_proc_thread:.1f}x")
    print(f"   Thread create / Coroutine create = {ratio_thread_coro:.1f}x")
    print(f"   Thread ctx switch / Coro ctx switch = {ctx_switch['thread_ctx_switch']/ctx_switch['coro_ctx_switch']:.1f}x")
    print("=" * 65)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["creation", "ctx_switch", "all"], default="all")
    args = parser.parse_args()

    creation = {}
    ctx_switch = {}

    if args.mode in ("creation", "all"):
        creation = bench_creation()
    if args.mode in ("ctx_switch", "all"):
        ctx_switch = bench_context_switch()

    print_results(creation, ctx_switch)


if __name__ == "__main__":
    main()
