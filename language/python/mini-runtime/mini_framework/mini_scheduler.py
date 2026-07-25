"""
手写 mini scheduler。

考点：
- asyncio 定时任务：一次性 / 周期性。
- 任务取消。
- 优雅停止。
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass(order=True)
class ScheduledTask:
    next_run: float
    interval: float | None = field(compare=False)
    coro: Callable[[], Awaitable[Any]] = field(compare=False)
    cancelled: bool = field(default=False, compare=False)


class MiniScheduler:
    """Async task scheduler supporting one-shot and periodic jobs."""

    def __init__(self) -> None:
        self._tasks: list[ScheduledTask] = []
        self._loop_task: asyncio.Task[Any] | None = None
        self._stop_event = asyncio.Event()

    def start(self) -> None:
        self._loop_task = asyncio.create_task(self._run())

    def schedule_once(self, delay: float, coro: Callable[[], Awaitable[Any]]) -> ScheduledTask:
        task = ScheduledTask(
            next_run=asyncio.get_event_loop().time() + delay,
            interval=None,
            coro=coro,
        )
        self._tasks.append(task)
        self._tasks.sort()
        return task

    def schedule_periodic(self, interval: float, coro: Callable[[], Awaitable[Any]]) -> ScheduledTask:
        task = ScheduledTask(
            next_run=asyncio.get_event_loop().time() + interval,
            interval=interval,
            coro=coro,
        )
        self._tasks.append(task)
        self._tasks.sort()
        return task

    async def stop(self) -> None:
        self._stop_event.set()
        if self._loop_task is not None:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            if not self._tasks:
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=1.0)
                except asyncio.TimeoutError:
                    pass
                continue

            now = asyncio.get_event_loop().time()
            task = self._tasks[0]
            if task.cancelled:
                self._tasks.pop(0)
                continue

            wait = task.next_run - now
            if wait > 0:
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=wait)
                except asyncio.TimeoutError:
                    pass
                continue

            self._tasks.pop(0)
            try:
                await task.coro()
            except Exception:
                pass

            if task.interval is not None and not task.cancelled:
                task.next_run = now + task.interval
                self._tasks.append(task)
                self._tasks.sort()


if __name__ == "__main__":
    async def main():
        scheduler = MiniScheduler()
        scheduler.start()

        async def tick():
            print("tick")

        scheduler.schedule_periodic(0.1, tick)
        await asyncio.sleep(0.25)
        await scheduler.stop()

    asyncio.run(main())
