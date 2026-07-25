"""
手写 retry with backoff（工程版）。

考点：
- 面向对象的 retry 策略，可配置最大次数、退避、异常类型。
- 支持 sync 和 async 执行。
- 保留原始异常上下文。
"""

from __future__ import annotations

import asyncio
import random
import time
from collections.abc import Awaitable, Callable
from typing import Generic, TypeVar

T = TypeVar("T")


class RetryPolicy(Generic[T]):
    """Configurable retry policy."""

    def __init__(
        self,
        exceptions: type[BaseException] | tuple[type[BaseException], ...] = Exception,
        *,
        max_attempts: int = 3,
        base_delay: float = 0.0,
        backoff: float = 2.0,
        max_delay: float | None = None,
        jitter: Callable[[], float] | float | None = None,
    ) -> None:
        if max_attempts <= 0:
            raise ValueError("max_attempts must be positive")
        self.exceptions = exceptions if isinstance(exceptions, tuple) else (exceptions,)
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.backoff = backoff
        self.max_delay = max_delay
        self.jitter = jitter

    def _sleep_time(self, attempt: int) -> float:
        delay = self.base_delay * (self.backoff ** (attempt - 1))
        if self.max_delay is not None:
            delay = min(delay, self.max_delay)
        if self.jitter is not None:
            jitter = self.jitter() if callable(self.jitter) else random.uniform(0, self.jitter)
            delay += jitter
        return delay

    def run(self, func: Callable[[], T]) -> T:
        last_exception: BaseException | None = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                return func()
            except self.exceptions as exc:
                last_exception = exc
                if attempt == self.max_attempts:
                    break
                time.sleep(self._sleep_time(attempt))
        assert last_exception is not None
        raise last_exception

    async def run_async(self, func: Callable[[], Awaitable[T]]) -> T:
        last_exception: BaseException | None = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                return await func()
            except self.exceptions as exc:
                last_exception = exc
                if attempt == self.max_attempts:
                    break
                await asyncio.sleep(self._sleep_time(attempt))
        assert last_exception is not None
        raise last_exception


if __name__ == "__main__":
    attempts = 0

    def flaky():
        global attempts
        attempts += 1
        if attempts < 3:
            raise ValueError("fail")
        return "ok"

    policy = RetryPolicy(ValueError, max_attempts=3, base_delay=0.01, backoff=2.0)
    print(policy.run(flaky))
