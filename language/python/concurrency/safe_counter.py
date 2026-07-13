"""
手写线程安全计数器。

考点：
- GIL 保证单个字节码操作原子，但 += 不是原子操作（LOAD + ADD + STORE）。
- 用 threading.Lock 保护共享状态。
- 提供批量递增和读取接口。
"""

from __future__ import annotations

import threading
from typing import final


@final
class SafeCounter:
    """Thread-safe counter protected by a lock."""

    def __init__(self, initial: int = 0) -> None:
        self._value = initial
        self._lock = threading.Lock()

    def increment(self, n: int = 1) -> int:
        with self._lock:
            self._value += n
            return self._value

    def decrement(self, n: int = 1) -> int:
        with self._lock:
            self._value -= n
            return self._value

    @property
    def value(self) -> int:
        with self._lock:
            return self._value


if __name__ == "__main__":
    counter = SafeCounter()
    threads = [
        threading.Thread(target=lambda: [counter.increment() for _ in range(1000)])
        for _ in range(10)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    print(counter.value)  # 10000
