# 并发模型：threading（真多线程）
import threading

class SafeCounter:
    def __init__(self):
        self._count = 0
        # TODO: 在此添加必要的同步原语

    def inc(self):
        # TODO: 获取锁、递增、释放锁
        self._count += 1

    def value(self):
        # TODO: 获取锁、读取、释放锁
        return self._count

def worker(counter: SafeCounter, m: int):
    for _ in range(m):
        counter.inc()

def main():
    n, m = 100, 1000
    counter = SafeCounter()
    threads = []

    for _ in range(n):
        t = threading.Thread(target=worker, args=(counter, m))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    expected = n * m
    actual = counter.value()
    if actual == expected:
        print(f"PASS: count = {actual} (expected {expected})")
    else:
        print(f"FAIL: count = {actual} (expected {expected})")

if __name__ == "__main__":
    main()
