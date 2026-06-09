# 并发模型：threading
import threading
import time

class Semaphore:
    def __init__(self, n: int):
        # TODO: 初始化信号量，初始值为 n
        pass

    def acquire(self):
        # TODO: 如果计数器为 0，条件等待；否则减 1
        pass

    def release(self):
        # TODO: 加 1，如果有等待者，唤醒一个
        pass

def worker(sem, current, max_observed, mu, wid):
    sem.acquire()
    with mu:
        current[0] += 1
        if current[0] > max_observed[0]:
            max_observed[0] = current[0]
    time.sleep(0.01)
    with mu:
        current[0] -= 1
    sem.release()

def main():
    max_concurrent = 5
    total_workers = 50
    sem = Semaphore(max_concurrent)
    current = [0]
    max_observed = [0]
    mu = threading.Lock()
    threads = []

    for i in range(total_workers):
        t = threading.Thread(target=worker, args=(sem, current, max_observed, mu, i))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    if max_observed[0] <= max_concurrent:
        print(f"PASS: max observed concurrency = {max_observed[0]} (limit = {max_concurrent})")
    else:
        print(f"FAIL: max observed concurrency = {max_observed[0]} (limit = {max_concurrent})")

if __name__ == "__main__":
    main()
