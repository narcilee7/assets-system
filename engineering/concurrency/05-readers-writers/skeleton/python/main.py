# 并发模型：threading
import threading
import time

class ReadersWriters:
    def __init__(self):
        self._mu = threading.Lock()
        # TODO: 添加 reader_count, writer_waiting, writer_active 等状态
        # TODO: 添加条件变量

    def start_read(self):
        with self._mu:
            # TODO: 如果有写者等待或活跃，条件等待；否则增加 reader_count
            pass

    def end_read(self):
        with self._mu:
            # TODO: 减少 reader_count；如果是最后一个读者且有写者等待，唤醒写者
            pass

    def start_write(self):
        with self._mu:
            # TODO: 标记有写者等待；如果有读者或写者活跃，条件等待；否则标记 writer_active
            pass

    def end_write(self):
        with self._mu:
            # TODO: 取消 writer_active；优先唤醒等待的写者，否则唤醒所有等待的读者
            pass

def reader(rw, rid):
    for _ in range(10):
        rw.start_read()
        time.sleep(0.001)
        rw.end_read()

def writer(rw, flag):
    rw.start_write()
    flag[0] = True
    time.sleep(0.005)
    rw.end_write()

def main():
    rw = ReadersWriters()
    threads = []
    write_occurred = [False]

    for i in range(50):
        t = threading.Thread(target=reader, args=(rw, i))
        threads.append(t)
        t.start()

    t = threading.Thread(target=writer, args=(rw, write_occurred))
    threads.append(t)
    t.start()

    time.sleep(0.01)

    for t in threads:
        t.join()

    if write_occurred[0]:
        print("PASS: writer was not starved")
    else:
        print("FAIL: writer starved or error")

if __name__ == "__main__":
    main()
