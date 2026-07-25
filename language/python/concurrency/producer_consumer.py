"""
手写生产者消费者。

考点：
- 用 queue.Queue 解耦生产与消费。
- 使用 sentinel 值通知消费者结束。
- 优雅关闭：停止生产者后等待消费者处理完队列。
"""

from __future__ import annotations

import queue
import threading
from collections.abc import Callable, Iterable
from typing import TypeVar

T = TypeVar("T")
R = TypeVar("R")


class ProducerConsumer:
    """Thread pool that consumes items from a shared queue."""

    def __init__(
        self,
        worker: Callable[[T], R],
        num_workers: int = 2,
        maxsize: int = 0,
    ) -> None:
        self._worker = worker
        self._queue: queue.Queue[T | None] = queue.Queue(maxsize=maxsize)
        self._results: list[R] = []
        self._result_lock = threading.Lock()
        self._workers: list[threading.Thread] = []
        self._stopped = False

        for _ in range(num_workers):
            t = threading.Thread(target=self._run, daemon=True)
            t.start()
            self._workers.append(t)

    def submit(self, item: T) -> None:
        if self._stopped:
            raise RuntimeError("producer consumer is stopped")
        self._queue.put(item)

    def submit_many(self, items: Iterable[T]) -> None:
        for item in items:
            self.submit(item)

    def stop(self, wait: bool = True) -> list[R]:
        if self._stopped:
            return list(self._results)
        self._stopped = True
        for _ in self._workers:
            self._queue.put(None)
        if wait:
            for t in self._workers:
                t.join()
        with self._result_lock:
            return list(self._results)

    def _run(self) -> None:
        while True:
            item = self._queue.get()
            if item is None:
                self._queue.task_done()
                break
            try:
                result = self._worker(item)
                with self._result_lock:
                    self._results.append(result)
            finally:
                self._queue.task_done()


if __name__ == "__main__":
    pool = ProducerConsumer(lambda x: x * x, num_workers=4)
    pool.submit_many(range(10))
    results = pool.stop()
    print(sorted(results))  # [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
