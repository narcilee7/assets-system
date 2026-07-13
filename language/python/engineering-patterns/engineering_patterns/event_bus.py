"""
手写 event bus。

考点：
- 发布订阅模式解耦模块。
- 支持同步和异步 handler。
- handler 异常不中断其他 handler。
"""

from __future__ import annotations

import asyncio
import inspect
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any


class EventBus:
    """In-memory publish/subscribe event bus."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable[[Any], Any]]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable[[Any], Any]) -> Callable[[], None]:
        """Register a handler and return an unsubscribe function."""
        self._handlers[event_type].append(handler)

        def unsubscribe() -> None:
            self._handlers[event_type].remove(handler)

        return unsubscribe

    def publish(self, event_type: str, payload: Any) -> list[Any]:
        """Publish synchronously and return handler results."""
        results: list[Any] = []
        for handler in list(self._handlers.get(event_type, [])):
            try:
                result = handler(payload)
                results.append(result)
            except Exception as exc:
                results.append(exc)
        return results

    async def publish_async(self, event_type: str, payload: Any) -> list[Any]:
        """Publish asynchronously, awaiting async handlers."""
        results: list[Any] = []
        for handler in list(self._handlers.get(event_type, [])):
            try:
                if asyncio.iscoroutinefunction(handler):
                    result = await handler(payload)
                else:
                    result = handler(payload)
                results.append(result)
            except Exception as exc:
                results.append(exc)
        return results


if __name__ == "__main__":
    bus = EventBus()

    def on_user_created(user):
        print(f"user created: {user}")

    bus.subscribe("user.created", on_user_created)
    bus.publish("user.created", {"id": 1, "name": "Ada"})
