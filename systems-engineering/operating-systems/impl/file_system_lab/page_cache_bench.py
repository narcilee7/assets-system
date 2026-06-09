#!/usr/bin/env python3
"""
Page Cache vs O_DIRECT Benchmark — Chain OS L3 Lab

测量 buffered I/O、O_DIRECT 和 fsync 延迟，验证 page cache 的作用。

运行：
    python3 page_cache_bench.py --file /tmp/test_io.bin

注意：
    - O_DIRECT 需要 512B 或 4KB 对齐的缓冲区
    - macOS 不支持 O_DIRECT，会跳过该测试
"""

import argparse
import os
import statistics
import sys
import time

# O_DIRECT 仅在 Linux 上可用
try:
    os.O_DIRECT
    HAS_ODIRECT = True
except AttributeError:
    HAS_ODIRECT = False


def align_buffer(size, alignment=4096):
    """创建对齐的缓冲区（O_DIRECT 要求）。"""
    import mmap
    return mmap.mmap(-1, size + alignment, access=mmap.ACCESS_WRITE)


def bench_write_buffered(path, size_mb=100, block_kb=4):
    """Buffered 写入测试。"""
    block_size = block_kb * 1024
    num_blocks = (size_mb * 1024 * 1024) // block_size
    data = b"X" * block_size

    # 预热：先创建文件
    with open(path, "wb") as f:
        f.write(data)
    os.unlink(path)

    start = time.perf_counter()
    with open(path, "wb") as f:
        for _ in range(num_blocks):
            f.write(data)
    elapsed = time.perf_counter() - start
    os.unlink(path)

    return {
        "total_sec": elapsed,
        "throughput_mbps": size_mb / elapsed,
        "latency_ms_per_block": (elapsed / num_blocks) * 1000,
    }


def bench_write_odirect(path, size_mb=100, block_kb=4):
    """O_DIRECT 写入测试（Linux only）。"""
    if not HAS_ODIRECT:
        return None

    block_size = block_kb * 1024
    num_blocks = (size_mb * 1024 * 1024) // block_size

    # O_DIRECT 需要对齐的缓冲区
    import mmap
    buf = mmap.mmap(-1, block_size, access=mmap.ACCESS_WRITE)
    buf.write(b"X" * block_size)
    buf.seek(0)

    # 预热
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_DIRECT)
    os.write(fd, buf)
    os.close(fd)
    os.unlink(path)

    start = time.perf_counter()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_DIRECT)
    for _ in range(num_blocks):
        buf.seek(0)
        os.write(fd, buf.read(block_size))
    os.close(fd)
    elapsed = time.perf_counter() - start
    os.unlink(path)
    buf.close()

    return {
        "total_sec": elapsed,
        "throughput_mbps": size_mb / elapsed,
        "latency_ms_per_block": (elapsed / num_blocks) * 1000,
    }


def bench_fsync_latency(path, block_kb=4, iterations=100):
    """测量 fsync 延迟。"""
    block_size = block_kb * 1024
    data = b"X" * block_size

    with open(path, "wb") as f:
        f.write(data)

    latencies = []
    with open(path, "r+b") as f:
        for _ in range(iterations):
            f.write(data)
            start = time.perf_counter()
            os.fsync(f.fileno())
            latencies.append((time.perf_counter() - start) * 1000)

    os.unlink(path)
    return {
        "mean_ms": statistics.mean(latencies),
        "p50_ms": statistics.median(latencies),
        "p99_ms": sorted(latencies)[int(len(latencies) * 0.99)],
        "max_ms": max(latencies),
    }


def bench_read_cache(path, size_mb=100, block_kb=4):
    """测量首次读取（冷缓存）vs 二次读取（热缓存）的延迟差异。"""
    block_size = block_kb * 1024
    num_blocks = (size_mb * 1024 * 1024) // block_size
    data = b"X" * block_size

    # 准备文件
    with open(path, "wb") as f:
        for _ in range(num_blocks):
            f.write(data)
    os.sync()

    # 清除 page cache（需要 root，Linux only）
    if sys.platform.startswith("linux") and os.geteuid() == 0:
        os.system("echo 3 > /proc/sys/vm/drop_caches")

    # 冷缓存读取
    start = time.perf_counter()
    with open(path, "rb") as f:
        for _ in range(num_blocks):
            f.read(block_size)
    cold_elapsed = time.perf_counter() - start

    # 热缓存读取（同进程，page cache 仍在）
    start = time.perf_counter()
    with open(path, "rb") as f:
        for _ in range(num_blocks):
            f.read(block_size)
    hot_elapsed = time.perf_counter() - start

    os.unlink(path)

    return {
        "cold_sec": cold_elapsed,
        "hot_sec": hot_elapsed,
        "speedup": cold_elapsed / hot_elapsed if hot_elapsed > 0 else 0,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="/tmp/os_lab_io_test.bin")
    parser.add_argument("--size-mb", type=int, default=100)
    parser.add_argument("--block-kb", type=int, default=4)
    args = parser.parse_args()

    print(f"[*] File: {args.file}, Size: {args.size_mb}MB, Block: {args.block_kb}KB")
    print("[*] Benchmarking buffered write...")
    buf_res = bench_write_buffered(args.file, args.size_mb, args.block_kb)

    print("[*] Benchmarking O_DIRECT write...")
    odir_res = bench_write_odirect(args.file, args.size_mb, args.block_kb)

    print("[*] Benchmarking fsync latency...")
    fsync_res = bench_fsync_latency(args.file, args.block_kb)

    print("[*] Benchmarking read cache (cold vs hot)...")
    cache_res = bench_read_cache(args.file, args.size_mb, args.block_kb)

    print("\n" + "=" * 65)
    print("File I/O Benchmark Results")
    print("=" * 65)

    print("\n--- Write Throughput ---")
    print(f"Buffered I/O:  {buf_res['throughput_mbps']:.1f} MB/s ({buf_res['latency_ms_per_block']:.3f} ms/block)")
    if odir_res:
        print(f"O_DIRECT:      {odir_res['throughput_mbps']:.1f} MB/s ({odir_res['latency_ms_per_block']:.3f} ms/block)")
        print(f"Buffered advantage: {odir_res['throughput_mbps'] / buf_res['throughput_mbps']:.1f}x")
    else:
        print("O_DIRECT:      N/A (not supported on this platform)")

    print("\n--- fsync Latency ---")
    print(f"Mean: {fsync_res['mean_ms']:.3f} ms")
    print(f"P50:  {fsync_res['p50_ms']:.3f} ms")
    print(f"P99:  {fsync_res['p99_ms']:.3f} ms")
    print(f"Max:  {fsync_res['max_ms']:.3f} ms")

    print("\n--- Read Cache Effect ---")
    print(f"Cold cache: {cache_res['cold_sec']:.3f} s")
    print(f"Hot cache:  {cache_res['hot_sec']:.3f} s")
    print(f"Speedup:    {cache_res['speedup']:.1f}x")

    print("\n💡 Insight:")
    if odir_res:
        print("   Buffered I/O 通常比 O_DIRECT 快，因为内核合并写和预读。")
        print("   但数据库用 O_DIRECT 是为了精确控制刷盘和避免双重缓存。")
    print("   fsync P99 显著高于 P50，因为磁盘控制器缓存 flush 有长尾。")
    print("   Page cache 可以让二次读取提速 10-1000x（取决于内存大小）。")
    print("=" * 65)


if __name__ == "__main__":
    main()
