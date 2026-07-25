"""
手写 timer 装饰器。

考点：
- 用闭包包装原函数。
- 使用 functools.wraps 保留元信息。
- 记录并打印执行耗时。
"""

from __future__ import annotations

import functools
import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def timer(func: Callable[..., T]) -> Callable[..., T]:
    """Print the wall-clock time of each call."""

    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> T:
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"[timer] {func.__name__} took {elapsed:.6f}s")
        return result

    return wrapper


if __name__ == "__main__":
    @timer
    def slow_add(a: int, b: int) -> int:
        time.sleep(0.01)
        return a + b

    print(slow_add(1, 2))
    # [timer] slow_add took 0.01xxxxs
    # 3
