"""
手写 memoize 装饰器。

考点：
- 缓存函数调用结果，避免重复计算。
- 支持最大缓存大小（LRU）。
- 处理不可哈希参数（转换为字符串作为 key）。
- 线程安全：加锁保护缓存。
"""

from __future__ import annotations

import functools
import threading
from collections import OrderedDict
from collections.abc import Callable, Hashable
from typing import TypeVar

T = TypeVar("T")


def memoize(
    maxsize: int | None = 128,
    *,
    typed: bool = False,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """LRU memoization decorator.

    Args:
        maxsize: Maximum number of cached entries. ``None`` means unbounded.
        typed: If True, arguments of different types are cached separately.
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        cache: OrderedDict[tuple[object, ...], T] = OrderedDict()
        lock = threading.Lock()

        @functools.wraps(func)
        def wrapper(*args: object, **kwargs: object) -> T:
            key = _make_key(args, kwargs, typed)

            with lock:
                if key in cache:
                    cache.move_to_end(key)
                    return cache[key]

            result = func(*args, **kwargs)

            with lock:
                cache[key] = result
                cache.move_to_end(key)
                if maxsize is not None and len(cache) > maxsize:
                    cache.popitem(last=False)

            return result

        # Expose cache for introspection/tests.
        wrapper.cache = cache  # type: ignore[attr-defined]
        wrapper.lock = lock  # type: ignore[attr-defined]
        return wrapper

    return decorator


def _make_key(
    args: tuple[object, ...],
    kwargs: dict[str, object],
    typed: bool,
) -> tuple[object, ...]:
    key_parts: list[object] = []
    for arg in args:
        key_parts.append((type(arg) if typed else None, _hashable(arg)))
    for name, value in sorted(kwargs.items()):
        key_parts.append((name, type(value) if typed else None, _hashable(value)))
    return tuple(key_parts)


def _hashable(value: object) -> Hashable:
    try:
        hash(value)
        return value  # type: ignore[return-value]
    except TypeError:
        return repr(value)


if __name__ == "__main__":
    def _demo():
        calls = 0

        @memoize(maxsize=2)
        def fib(n: int) -> int:
            nonlocal calls
            calls += 1
            if n < 2:
                return n
            return fib(n - 1) + fib(n - 2)

        print(fib(10))  # 55
        print(f"calls: {calls}")  # much smaller than naive recursion
        print(f"cache size: {len(fib.cache)}")  # 2 (LRU)

    _demo()
