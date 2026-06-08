# 并发模型：threading
import threading

class Call:
    def __init__(self):
        # TODO: 添加条件变量、结果、错误、完成标记
        pass

class Group:
    def __init__(self):
        self._mu = threading.Lock()
        self._m = {}

    def do(self, key, fn):
        with self._mu:
            if key in self._m:
                c = self._m[key]
                # TODO: 释放锁后等待 c 完成，返回共享结果
                return "", None
            c = Call()
            self._m[key] = c

        # TODO: 在持有 c 的锁或不持有全局锁的情况下执行 fn
        # TODO: 保存结果、标记完成、唤醒所有等待者
        # TODO: 从 self._m 中删除 key
        return "", None

def main():
    g = Group()
    exec_count = [0]
    mu = threading.Lock()
    n = 100
    threads = []

    def task():
        def fn():
            with mu:
                exec_count[0] += 1
            return "result"
        v, err = g.do("key", fn)
        if err is not None or v != "result":
            print(f"FAIL: unexpected result {v!r} err={err}")

    for _ in range(n):
        t = threading.Thread(target=task)
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    if exec_count[0] == 1:
        print(f"PASS: {n} concurrent requests deduped to {exec_count[0]} execution")
    else:
        print(f"FAIL: exec_count={exec_count[0]} (expected 1)")

if __name__ == "__main__":
    main()
