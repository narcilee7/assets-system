import sys
import threading
import time


def cpu_heavy_bound():
    """纯 CPU 密集型计算：会死死咬住 GIL 不放，直到强制超时"""
    count = 0
    start = time.perf_counter()
    while time.perf_counter() - start < 1.0:
        count += 1


def io_friendly_bound():
    """I/O 密集型操作：在执行 time.sleep 时，CPython C 层面会自动释放 GIL"""
    start = time.perf_counter()
    while time.perf_counter() - start < 1.0:
        # time.sleep 内部通过 Py_BEGIN_ALLOW_THREADS 宏将 GIL 让给别人
        time.sleep(0.001)


def monitor_thread_latency():
    """监控线程：每隔一段时间尝试执行一个微小的动作，记录自己被 GIL 堵塞了多久"""
    latencies = []
    for _ in range(5):
        t0 = time.perf_counter()
        time.sleep(0.1)  # 醒来后开始重新抢夺 GIL
        t1 = time.perf_counter()
        # 理想情况下，醒来应该恰好过去 0.1 秒。多出来的延迟就是被别的线程死锁 GIL 导致自己挂起的时间
        latencies.append((t1 - t0) - 0.1)

    avg_latency = sum(latencies) / len(latencies)
    print(f"  [Monitor] 抢锁平均由于 GIL 导致的排队延迟: {avg_latency * 1000:.2f} ms")


if __name__ == "__main__":
    print("=== [GIL 专家级压测开始] ===")

    # 1. 设置极端的 GIL 检查间隔：1 秒释放一次锁（让护航效应最大化）
    sys.setswitchinterval(1.0)
    print("已将全局 GIL 切换阈值强行拉长至 1.0 秒\n")

    # ---- 场景 A：与纯 CPU 计算线程同台竞技 ----
    print("场景 A：当 Monitor 线程遭遇 [CPU 密集型] 线程...")
    t_cpu = threading.Thread(target=cpu_heavy_bound)
    t_monitor_a = threading.Thread(target=monitor_thread_latency)

    t_cpu.start()
    t_monitor_a.start()

    t_cpu.join()
    t_monitor_a.join()

    # ---- 场景 B：与 I/O 友好型线程同台竞技 ----
    print("\n场景 B：当 Monitor 线程遭遇 [I/O 友好释放型] 线程...")
    t_io = threading.Thread(target=io_friendly_bound)
    t_monitor_b = threading.Thread(target=monitor_thread_latency)

    t_io.start()
    t_monitor_b.start()

    t_io.join()
    t_monitor_b.join()
