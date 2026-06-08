# 并发模型：threading
import threading
from collections import deque

class BoundedBuffer:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.buffer = deque()
        # TODO: 添加互斥锁和两个条件变量（not_full, not_empty）

    def produce(self, item):
        # TODO: 获取锁；若缓冲区满，等待 not_full；放入元素；通知 not_empty；释放锁
        pass

    def consume(self):
        # TODO: 获取锁；若缓冲区空，等待 not_empty；取出元素；通知 not_full；释放锁
        return 0

def producer(buffer, pid, count):
    for i in range(count):
        buffer.produce(pid * count + i)

def consumer(buffer, count, result, mu):
    s = 0
    for _ in range(count):
        s += buffer.consume()
    with mu:
        result[0] += s

def main():
    capacity = 10
    num_producers = 5
    num_consumers = 3
    items_per_producer = 100

    buffer = BoundedBuffer(capacity)
    threads = []
    result = [0]
    mu = threading.Lock()

    for i in range(num_producers):
        t = threading.Thread(target=producer, args=(buffer, i, items_per_producer))
        threads.append(t)
        t.start()

    items_per_consumer = (num_producers * items_per_producer) // num_consumers
    for i in range(num_consumers):
        t = threading.Thread(target=consumer, args=(buffer, items_per_consumer, result, mu))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    total_items = num_producers * items_per_producer
    expected = (total_items - 1) * total_items // 2
    if result[0] == expected:
        print(f"PASS: sum = {result[0]} (expected {expected})")
    else:
        print(f"FAIL: sum = {result[0]} (expected {expected})")

if __name__ == "__main__":
    main()
