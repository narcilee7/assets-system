# 并发模型：threading + Event
import threading
import time

class CancelContext:
    def __init__(self):
        # TODO: 初始化取消事件和线程计数器/锁
        pass

    def cancel(self):
        # TODO: 设置取消事件，等待所有子线程结束
        pass

    def go(self, f):
        # TODO: 增加计数器，启动线程，传入取消事件；线程退出时减少计数器
        pass

def worker(event, wid):
    # 示例 worker 函数
    try:
        while not event.is_set():
            time.sleep(0.05)
        print(f"worker {wid} cancelled")
    finally:
        pass  # TODO: 确保退出时通知 context

def main():
    ctx = CancelContext()
    active = [0]
    mu = threading.Lock()

    for i in range(5):
        def make_worker(wid):
            def w():
                with mu:
                    active[0] += 1
                try:
                    while not ctx._event.is_set():  # 直接访问 event 仅为示例
                        time.sleep(0.05)
                    print(f"worker {wid} cancelled")
                finally:
                    with mu:
                        active[0] -= 1
            return w
        ctx.go(make_worker(i))

    time.sleep(0.1)
    ctx.cancel()

    if active[0] == 0:
        print("PASS: all workers exited after cancellation")
    else:
        print(f"FAIL: {active[0]} workers still active after cancellation")

if __name__ == "__main__":
    main()
