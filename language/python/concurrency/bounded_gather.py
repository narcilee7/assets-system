"""
手写 bounded_gather。

考点：
- asyncio 并发限制：用 Semaphore 控制同时运行的协程数量。
- 收集所有结果，保持输入顺序。
- 支持超时和异常处理。
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Iterable
from typing import TypeVar

T = TypeVar("T")
R = TypeVar("R")


async def bounded_gather(
    coro_factory: Callable[[T], Awaitable[R]],
    items: Iterable[T],
    *,
    limit: int = 5,
    timeout: float | None = None,
    return_exceptions: bool = False,
) -> list[R]:
    """Run async tasks with bounded concurrency.

    Args:
        coro_factory: Async function applied to each item.
        items: Input sequence.
        limit: Maximum number of concurrent tasks.
        timeout: Optional timeout per task.
        return_exceptions: If True, exceptions are returned instead of raised.

    Returns:
        Results in the same order as ``items``.
    """
    if limit <= 0:
        raise ValueError("limit must be positive")

    semaphore = asyncio.Semaphore(limit)

    async def wrapped(item: T) -> R:
        async with semaphore:
            coro = coro_factory(item)
            if timeout is not None:
                coro = asyncio.wait_for(coro, timeout=timeout)
            return await coro

    tasks = [asyncio.create_task(wrapped(item)) for item in items]
    results = await asyncio.gather(*tasks, return_exceptions=return_exceptions)
    return results  # type: ignore[return-value]


if __name__ == "__main__":
    async def fetch(url: str) -> str:
        await asyncio.sleep(0.01)
        return f"data:{url}"

    async def main() -> None:
        urls = [f"url{i}" for i in range(10)]
        results = await bounded_gather(fetch, urls, limit=3)
        print(results)

    asyncio.run(main())
