# 并发模型：threading
import threading
import time

class Barrier:
    def __init__(self, n: int):
        self._n = n
        # TODO: 添加 count, generation, condition variable

    def wait(self):
        # TODO:
        # 1. 记录当前代
        # 2. 增加到达计数
        # 3. 如果是最后一个到达：重置计数、增加代、唤醒所有等待者
        # 4. 否则：循环等待，直到代发生变化
        pass

def worker(barrier, arrival_times, wid):
    for phase in range(3):
        time.sleep(wid * 0.01)
        barrier.wait()
        arrival_times[wid][phase] = time.time()

def main():
    n = 5
    phases = 3
    barrier = Barrier(n)
    arrival_times = [[0.0 for _ in range(phases)] for _ in range(n)]
    threads = []

    for i in range(n):
        t = threading.Thread(target=worker, args=(barrier, arrival_times, i))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    pass_flag = True
    for phase in range(phases):
        max_diff = 0
        for i in range(1, n):
            diff = abs(arrival_times[i][phase] - arrival_times[0][phase])
            if diff > max_diff:
                max_diff = diff
        if max_diff > 0.05:
            print(f"FAIL: phase {phase} max arrival diff = {max_diff:.4f}s")
            pass_flag = False

    if pass_flag:
        print("PASS: all phases synchronized")

if __name__ == "__main__":
    main()
