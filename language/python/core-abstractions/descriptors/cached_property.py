"""
手写 cached_property 描述符。

考点：
- 第一次访问时调用 getter 并把结果缓存到实例 __dict__。
- 后续访问直接从 __dict__ 读取，不再调用 getter。
- 支持线程安全：加锁防止并发重复计算。
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from typing import Any


class cached_property:  # noqa: N801
    """Teaching implementation of ``functools.cached_property``."""

    def __init__(self, func: Callable[[Any], Any]) -> None:
        self.func = func
        self.name = func.__name__
        self.__doc__ = func.__doc__
        self.lock = threading.RLock()

    def __get__(self, instance: object | None, owner: type | None = None) -> Any:
        if instance is None:
            return self

        try:
            cache = instance.__dict__
        except AttributeError:
            raise TypeError(
                f"No '__dict__' attribute on {type(instance).__name__!r} "
                f"instance to cache {self.name!r} property."
            ) from None

        with self.lock:
            try:
                return cache[self.name]
            except KeyError:
                value = self.func(instance)
                cache[self.name] = value
                return value


if __name__ == "__main__":
    class Circle:
        def __init__(self, radius: float) -> None:
            self.radius = radius

        @cached_property
        def area(self) -> float:
            print("computing area...")
            return 3.1415926 * self.radius**2

    c = Circle(2)
    print(c.area)  # computing area... 12.566...
    print(c.area)  # 12.566... (no print)
