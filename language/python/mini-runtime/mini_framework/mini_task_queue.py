"""
手写 mini task queue。

考点：
- worker 池消费任务。
- 支持重试、ack、失败记录。
- 优雅关闭。
"""

from __future__ import annotations

import queue
import threading
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Task:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    payload: Any = None
    attempts: int = 0


class MiniTaskQueue:
    """Thread pool task queue with retry and dead-letter tracking."""

    def __init__(
        self,
        handler: Callable[[Any], None],
        *,
        workers: int = 2,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ) -> None:
        self._handler = handler
        self._max_retries = max_retries
        self._retry_delay = retry_delay
        self._queue: queue.Queue[Task] = queue.Queue()
        self._workers: list[threading.Thread] = []
        self._stopped = threading.Event()
        self._dead_letter: list[Task] = []
        self._lock = threading.Lock()

        for _ in range(workers):
            t = threading.Thread(target=self._run, daemon=True)
            t.start()
            self._workers.append(t)

    def submit(self, payload: Any) -> str:
        task = Task(payload=payload)
        self._queue.put(task)
        return task.id

    def stop(self, wait: bool = True) -> list[Task]:
        self._stopped.set()
        if wait:
            self._queue.join()
        for _ in self._workers:
            self._queue.put(Task(payload=None))  # sentinel
        if wait:
            for t in self._workers:
                t.join()
        with self._lock:
            return list(self._dead_letter)

    def _run(self) -> None:
        while True:
            task = self._queue.get()
            if task.payload is None and task.attempts == 0:
                self._queue.task_done()
                break

            try:
                self._handler(task.payload)
            except Exception:
                task.attempts += 1
                if task.attempts <= self._max_retries:
                    time.sleep(self._retry_delay)
                    self._queue.put(task)
                else:
                    with self._lock:
                        self._dead_letter.append(task)
            finally:
                self._queue.task_done()


if __name__ == "__main__":
    processed = []

    def handle(x):
        if x == 2:
            raise ValueError("fail")
        processed.append(x)

    q = MiniTaskQueue(handle, workers=1, max_retries=1, retry_delay=0.01)
    for i in range(5):
        q.submit(i)
    dlq = q.stop()
    print("processed:", processed)
    print("dead letter payloads:", [t.payload for t in dlq])
