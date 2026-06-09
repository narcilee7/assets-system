# 并发模型：threading
import threading
import time

NUM_PHILOSOPHERS = 5

class Chopstick:
    def __init__(self):
        self._lock = threading.Lock()

    def acquire(self):
        self._lock.acquire()

    def release(self):
        self._lock.release()

class Philosopher:
    def __init__(self, pid, left, right):
        self.id = pid
        self.left = left
        self.right = right

    def dine(self, eat_count, mu):
        for _ in range(10):
            time.sleep(0.001)
            # TODO: 实现就餐逻辑，避免死锁
            self.left.acquire()
            self.right.acquire()
            with mu:
                eat_count[0] += 1
            time.sleep(0.001)
            self.right.release()
            self.left.release()

def main():
    chopsticks = [Chopstick() for _ in range(NUM_PHILOSOPHERS)]
    philosophers = [
        Philosopher(i, chopsticks[i], chopsticks[(i + 1) % NUM_PHILOSOPHERS])
        for i in range(NUM_PHILOSOPHERS)
    ]

    eat_count = [0]
    mu = threading.Lock()
    threads = []

    for p in philosophers:
        t = threading.Thread(target=p.dine, args=(eat_count, mu))
        threads.append(t)
        t.start()

    for t in threads:
        t.join(timeout=5)

    still_alive = any(t.is_alive() for t in threads)
    expected = NUM_PHILOSOPHERS * 10
    if not still_alive and eat_count[0] == expected:
        print(f"PASS: all {eat_count[0]} meals completed without deadlock")
    elif still_alive:
        print("FAIL: timeout, likely deadlock")
    else:
        print(f"FAIL: eat_count={eat_count[0]} (expected {expected})")

if __name__ == "__main__":
    main()
