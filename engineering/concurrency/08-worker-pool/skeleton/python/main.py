# 并发模型：threading + queue
import threading
import queue
from typing import Callable, Tuple, Any

class WorkerPool:
    def __init__(self, worker_count: int):
        self.worker_count = worker_count
        # TODO: 初始化任务队列、结果队列、worker 线程列表、关闭标志

    def submit(self, task: Callable[[], Tuple[Any, ...]]) -> bool:
        # TODO: 如果已关闭返回 False；否则将任务放入队列
        return False

    def result(self):
        # TODO: 从结果队列取出一个结果（阻塞）
        pass

    def shutdown(self):
        # TODO: 标记关闭、向队列发送结束信号、等待所有 worker 结束
        pass

def worker_main(task_queue, result_queue, stop_event):
    # TODO: 循环从任务队列取任务；如果取到特殊结束标记则退出；执行任务并将结果放入结果队列
    pass

def main():
    pool = WorkerPool(4)
    num_tasks = 20
    expected_sum = 0

    for i in range(num_tasks):
        expected_sum += i * i
        pool.submit(lambda n=i: (n * n, None))

    pool.shutdown()

    actual_sum = 0
    for _ in range(num_tasks):
        value, err = pool.result()
        if err is not None:
            print(f"FAIL: task error: {err}")
            return
        actual_sum += value

    if actual_sum == expected_sum:
        print(f"PASS: sum = {actual_sum} (expected {expected_sum})")
    else:
        print(f"FAIL: sum = {actual_sum} (expected {expected_sum})")

    # 验证关闭后不能再提交
    if pool.submit(lambda: (0, None)):
        print("FAIL: expected error after shutdown")
    else:
        print("PASS: shutdown correctly rejects new tasks")

if __name__ == "__main__":
    main()
