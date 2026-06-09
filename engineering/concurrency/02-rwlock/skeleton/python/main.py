# 并发模型：threading
import threading
import time

class MyRWMutex:
    def __init__(self):
        self._mu = threading.Lock()
        # TODO: 添加 reader_count, writer_waiting, writer_active 等状态
        # TODO: 添加条件变量

    def rlock(self):
        with self._mu:
            # TODO: 如果有活跃写者，条件等待；否则增加 reader_count
            pass

    def runlock(self):
        with self._mu:
            # TODO: 减少 reader_count，如果是最后一个读者且有写者等待，唤醒写者
            pass

    def lock(self):
        with self._mu:
            # TODO: 标记有写者等待；如果有活跃读者或写者，条件等待；否则获取写锁
            pass

    def unlock(self):
        with self._mu:
            # TODO: 释放写锁，唤醒等待的读者或写者
            pass

def reader(rw, active, max_r, mu, rid):
    rw.rlock()
    with mu:
        active[0] += 1
        if active[0] > max_r[0]:
            max_r[0] = active[0]
    time.sleep(0.02)
    with mu:
        active[0] -= 1
    rw.runlock()

def writer(rw, active, mu, wid):
    rw.lock()
    with mu:
        if active[0] != 0:
            print(f"FAIL: writer {wid} sees activeReaders={active[0]}")
    time.sleep(0.02)
    rw.unlock()

def main():
    rw = MyRWMutex()
    active = [0]
    max_r = [0]
    mu = threading.Lock()
    threads = []

    for i in range(10):
        t = threading.Thread(target=reader, args=(rw, active, max_r, mu, i))
        threads.append(t)
        t.start()

    for i in range(2):
        t = threading.Thread(target=writer, args=(rw, active, mu, i))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    print(f"PASS: max concurrent readers = {max_r[0]}")

if __name__ == "__main__":
    main()
