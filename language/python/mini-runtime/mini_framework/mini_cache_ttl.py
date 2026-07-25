"""
手写 mini cache with TTL。

考点：
- dict + TTL 记录。
- 惰性过期检查 + 后台清理线程。
- 线程安全。
- 可选 max_size 做 LRU 驱逐。
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Any, Generic, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class MiniCacheTTL(Generic[K, V]):
    """Thread-safe in-memory cache with TTL and optional LRU eviction."""

    def __init__(
        self,
        *,
        default_ttl: float,
        max_size: int | None = None,
        cleanup_interval: float = 60.0,
    ) -> None:
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._store: OrderedDict[K, tuple[V, float]] = OrderedDict()
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()

    def get(self, key: K) -> V:
        with self._lock:
            if key not in self._store:
                raise KeyError(key)
            value, expires = self._store[key]
            if time.monotonic() > expires:
                del self._store[key]
                raise KeyError(key)
            self._store.move_to_end(key)
            return value

    def set(self, key: K, value: V, *, ttl: float | None = None) -> None:
        expires = time.monotonic() + (ttl if ttl is not None else self._default_ttl)
        with self._lock:
            self._store[key] = (value, expires)
            self._store.move_to_end(key)
            if self._max_size is not None and len(self._store) > self._max_size:
                self._store.popitem(last=False)

    def delete(self, key: K) -> None:
        with self._lock:
            del self._store[key]

    def stop(self) -> None:
        self._stop.set()

    def _cleanup_loop(self) -> None:
        while not self._stop.wait(cleanup_interval := self._default_ttl / 2):
            now = time.monotonic()
            with self._lock:
                expired = [k for k, (_, exp) in self._store.items() if now > exp]
                for k in expired:
                    del self._store[k]


if __name__ == "__main__":
    cache: MiniCacheTTL[str, int] = MiniCacheTTL(default_ttl=0.2, max_size=2)
    cache.set("a", 1)
    print(cache.get("a"))  # 1
    time.sleep(0.25)
    try:
        print(cache.get("a"))
    except KeyError:
        print("expired")
    cache.stop()
