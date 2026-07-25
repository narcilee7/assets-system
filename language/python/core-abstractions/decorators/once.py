"""
手写 once 装饰器。

考点：
- 保证函数只执行一次，后续调用直接返回第一次结果。
- 线程安全：防止并发时重复执行。
- 如果第一次执行抛异常，后续调用应继续尝试还是直接抛？这里选择"失败即记住异常"。
"""

from __future__ import annotations

import functools
import threading
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def once(func: Callable[..., T]) -> Callable[..., T]:
    """Ensure ``func`` is executed at most once.

    The first return value is cached and returned for all subsequent calls.
    If the first call raises an exception, that exception is re-raised for
    every later call.
    """
    lock = threading.Lock()
    called = False
    result: T
    exception: BaseException | None = None

    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> T:
        nonlocal called, result, exception

        if called and exception is None:
            return result

        with lock:
            if called:
                if exception is not None:
                    raise exception
                return result

            try:
                result = func(*args, **kwargs)
                called = True
                return result
            except BaseException as exc:
                exception = exc
                called = True
                raise

    return wrapper


if __name__ == "__main__":
    def _demo():
        calls = 0

        @once
        def init_resource() -> int:
            nonlocal calls
            calls += 1
            print("initializing...")
            return 42

        print(init_resource())  # initializing... 42
        print(init_resource())  # 42 (no print)
        print(f"calls: {calls}")  # 1

    _demo()
