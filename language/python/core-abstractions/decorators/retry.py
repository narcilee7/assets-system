"""
手写 retry 装饰器。

考点：
- 捕获指定异常后重试。
- 支持最大重试次数、重试间隔、指数退避、jitter。
- 最后一次失败抛出的异常应保留上下文。
"""

from __future__ import annotations

import functools
import random
import time
from collections.abc import Callable, Sequence
from typing import TypeVar

T = TypeVar("T")


def retry(
    exceptions: type[BaseException] | tuple[type[BaseException], ...] = Exception,
    *,
    max_attempts: int = 3,
    delay: float = 0.0,
    backoff: float = 1.0,
    jitter: Callable[[], float] | float | None = None,
    on_error: Callable[[BaseException, int], None] | None = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Retry a function on specified exceptions.

    Args:
        exceptions: Exception types that trigger a retry.
        max_attempts: Maximum number of attempts (must be positive).
        delay: Initial delay between attempts.
        backoff: Multiplier applied to delay after each attempt.
        jitter: Fixed jitter amount or a callable returning a random jitter.
        on_error: Callback invoked after each failed attempt.
    """
    if max_attempts <= 0:
        raise ValueError("max_attempts must be positive")

    if not isinstance(exceptions, tuple):
        exceptions = (exceptions,)

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: object, **kwargs: object) -> T:
            current_delay = delay
            last_exception: BaseException | None = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    last_exception = exc
                    if on_error is not None:
                        on_error(exc, attempt)
                    if attempt == max_attempts:
                        break

                    sleep_time = current_delay
                    if jitter is not None:
                        if callable(jitter):
                            sleep_time += jitter()
                        else:
                            sleep_time += random.uniform(0, jitter)
                    if sleep_time > 0:
                        time.sleep(sleep_time)

                    current_delay *= backoff

            assert last_exception is not None
            raise last_exception

        return wrapper

    return decorator


if __name__ == "__main__":
    def _demo():
        attempt_count = 0

        @retry(ValueError, max_attempts=3, delay=0.05, backoff=2.0)
        def flaky() -> str:
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise ValueError("not yet")
            return "ok"

        print(flaky())  # ok after 2 failures

    _demo()
