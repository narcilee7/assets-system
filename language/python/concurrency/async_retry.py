"""
手写 async retry。

考点：
- 异步函数的重试与指数退避。
- 用 asyncio.sleep 替代 time.sleep。
- 支持 on_error 回调和最终异常保留。
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


def async_retry(
    exceptions: type[BaseException] | tuple[type[BaseException], ...] = Exception,
    *,
    max_attempts: int = 3,
    delay: float = 0.0,
    backoff: float = 1.0,
    jitter: Callable[[], float] | float | None = None,
    on_error: Callable[[BaseException, int], Awaitable[None] | None] | None = None,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """Retry an async function on specified exceptions."""
    if max_attempts <= 0:
        raise ValueError("max_attempts must be positive")

    if not isinstance(exceptions, tuple):
        exceptions = (exceptions,)

    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        async def wrapper(*args: object, **kwargs: object) -> T:
            current_delay = delay
            last_exception: BaseException | None = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as exc:
                    last_exception = exc
                    if on_error is not None:
                        maybe_coro = on_error(exc, attempt)
                        if asyncio.iscoroutine(maybe_coro):
                            await maybe_coro
                    if attempt == max_attempts:
                        break

                    sleep_time = current_delay
                    if jitter is not None:
                        if callable(jitter):
                            sleep_time += jitter()
                        else:
                            sleep_time += random.uniform(0, jitter)
                    if sleep_time > 0:
                        await asyncio.sleep(sleep_time)

                    current_delay *= backoff

            assert last_exception is not None
            raise last_exception

        return wrapper

    return decorator


if __name__ == "__main__":
    async def main():
        attempt_count = 0

        @async_retry(ValueError, max_attempts=3, delay=0.01, backoff=2.0)
        async def flaky() -> str:
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise ValueError("not yet")
            return "ok"

        print(await flaky())

    asyncio.run(main())
