"""
手写 token bucket rate limiter。

考点：
- 令牌桶算法：固定速率补充令牌，桶容量限制突发。
- 并发安全：加锁保护令牌数量和上次补充时间。
- 支持阻塞等待（async）和非阻塞检查。
"""

from __future__ import annotations

import asyncio
import threading
import time
from collections import defaultdict
from typing import final


@final
class TokenBucket:
    """Thread-safe token bucket rate limiter."""

    def __init__(self, rate: float, capacity: float) -> None:
        if rate <= 0 or capacity <= 0:
            raise ValueError("rate and capacity must be positive")
        self._rate = rate
        self._capacity = capacity
        self._tokens = float(capacity)
        self._last_update = time.monotonic()
        self._lock = threading.Lock()

    def _replenish(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_update
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
        self._last_update = now

    def allow(self, tokens: float = 1.0) -> bool:
        with self._lock:
            self._replenish()
            if self._tokens >= tokens:
                self._tokens -= tokens
                return True
            return False

    def wait_time(self, tokens: float = 1.0) -> float:
        with self._lock:
            self._replenish()
            if self._tokens >= tokens:
                return 0.0
            return (tokens - self._tokens) / self._rate

    async def async_allow(self, tokens: float = 1.0) -> bool:
        while True:
            if self.allow(tokens):
                return True
            await asyncio.sleep(self.wait_time(tokens))


@final
class PerClientLimiter:
    """Rate limiter keyed by client identifier."""

    def __init__(self, rate: float, capacity: float) -> None:
        self._rate = rate
        self._capacity = capacity
        self._limiters: dict[str, TokenBucket] = defaultdict(
            lambda: TokenBucket(rate, capacity)
        )
        self._lock = threading.Lock()

    def get_limiter(self, client_id: str) -> TokenBucket:
        with self._lock:
            return self._limiters[client_id]


if __name__ == "__main__":
    bucket = TokenBucket(rate=10, capacity=5)
    print(bucket.allow())  # True
    print(bucket.allow())  # True ...

    limiter = PerClientLimiter(rate=2, capacity=2)
    print(limiter.get_limiter("user-1").allow())
    print(limiter.get_limiter("user-2").allow())
