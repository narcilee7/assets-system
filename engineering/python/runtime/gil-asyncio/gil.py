import threading
import time
from multiprocessing import Pool


# 多线程 CPU 密集型：比单线程还慢（因为 GIL 切换开销）
def cpu_task(n: int) -> int:
    count = 0
    for i in range(n):
        count += 1
    return count


# 多线程版本
def multi_thread_cpu(n: int) -> None:
    threads = []
    for _ in range(4):
        t = threading.Thread(target=cpu_task, args=(10_000_000,))
        threads.append(t)
        t.start()
    for t in threads:
        # join 等待线程结束
        t.join()


# 多进程版本利用多核
def multi_process_cpu():
    with Pool(4) as p:
        p.map(cpu_task, [10_000_000] * 4)
