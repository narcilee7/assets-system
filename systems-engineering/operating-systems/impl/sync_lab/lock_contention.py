#!/usr/bin/env python3
"""
Lock Contention Benchmark — Chain OS L3 Lab

测量不同锁原语在高并发下的性能退化，验证锁竞争的影响。

运行：
    python3 lock_contention.py --workers 8 --iterations 100000
"""

import argparse
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor


def bench_mutex(workers=8, iterations=100000):
    """pthread-style mutex（threading.Lock）。"""
    lock = threading.Lock()
    counter = 0

    def worker():
        nonlocal counter
        for _ in range(iterations // workers):
            with lock:
                counter += 1

    start = time.perf_counter()
    threads = [threading.Thread(target=worker) for _ in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.perf_counter() - start

    return elapsed, counter


def bench_rwlock(workers=8, iterations=100000):
    """模拟读写锁：大部分是读，少量写。"""
    lock = threading.Lock()  # Python 没有原生 RWLock，用 Lock 模拟写锁
    read_lock = threading.Lock()  # 简化：实际应用 threading.RLock 或自定义
    data = {"value": 0, "reads": 0}

    def reader():
        for _ in range(iterations // workers):
            with lock:
                _ = data["value"]
                data["reads"] += 1

    start = time.perf_counter()
    threads = [threading.Thread(target=reader) for _ in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.perf_counter() - start

    return elapsed, data["reads"]


def bench_atomic_baseline(workers=8, iterations=100000):
    """无锁计数：验证锁本身的开销。"""
    # Python GIL 下，即使无显式锁，计数器操作也有 GIL 保护
    # 我们用单线程作为"理想无竞争"基线
    counter = 0
    start = time.perf_counter()
    for _ in range(iterations):
        counter += 1
    elapsed = time.perf_counter() - start
    return elapsed, counter


def bench_reduce_contention(workers=8, iterations=100000):
    """分片计数器：减少锁竞争（每个线程本地计数，最后合并）。"""
    local_counters = [0] * workers

    def worker(idx):
        for _ in range(iterations // workers):
            local_counters[idx] += 1

    start = time.perf_counter()
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    total = sum(local_counters)
    elapsed = time.perf_counter() - start

    return elapsed, total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--iterations", type=int, default=100000)
    args = parser.parse_args()

    print(f"[*] Workers: {args.workers}, Iterations: {args.iterations}")

    print("[*] Baseline (single-threaded, no lock)...")
    base_t, base_v = bench_atomic_baseline(1, args.iterations)

    print("[*] Mutex (high contention)...")
    mutex_t, mutex_v = bench_mutex(args.workers, args.iterations)

    print("[*] Read-mostly (simulated RWLock)...")
    rw_t, rw_v = bench_rwlock(args.workers, args.iterations)

    print("[*] Sharded counters (low contention)...")
    shard_t, shard_v = bench_reduce_contention(args.workers, args.iterations)

    print("\n" + "=" * 65)
    print("Lock Contention Benchmark")
    print("=" * 65)
    print(f"{'Strategy':<25} {'Time(ms)':<12} {'Ops/sec':<12} {'Slowdown':<12}")
    print("-" * 65)

    def fmt(name, t, ops):
        slowdown = t / base_t
        print(f"{name:<25} {t*1000:<12.2f} {ops:<12.0f} {slowdown:<12.1f}x")

    fmt("Baseline (single-thread)", base_t, args.iterations / base_t)
    fmt("Mutex (all threads)", mutex_t, args.iterations / mutex_t)
    fmt("Read-mostly", rw_t, args.iterations / rw_t)
    fmt("Sharded (no shared lock)", shard_t, args.iterations / shard_t)

    print("\n💡 Insight:")
    print("   - 高竞争下 mutex 吞吐量急剧下降（线程数越多越慢）。")
    print("   - 分片计数（每个线程本地累加）是无锁优化的基础思路。")
    print("   - Python GIL 会放大锁竞争影响；C/C++/Go 中差距更显著。")
    print("=" * 65)


if __name__ == "__main__":
    main()
