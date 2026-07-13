"""
手写 mini pubsub。

考点：
- 订阅/发布解耦。
- fan-out 给所有订阅者。
- 慢消费者不阻塞发布者（channel 满则丢弃）。
- 优雅关闭。
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any


class MiniPubSub:
    """Async pub/sub broker with bounded channels."""

    def __init__(self, max_queue_size: int = 64) -> None:
        self._max_queue_size = max_queue_size
        self._subscribers: dict[str, list[asyncio.Queue[Any]]] = {}

    def subscribe(self, topic: str) -> asyncio.Queue[Any]:
        queue: asyncio.Queue[Any] = asyncio.Queue(maxsize=self._max_queue_size)
        self._subscribers.setdefault(topic, []).append(queue)
        return queue

    def publish(self, topic: str, message: Any) -> None:
        for queue in list(self._subscribers.get(topic, [])):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass  # Drop message for slow consumers.

    def unsubscribe(self, topic: str, queue: asyncio.Queue[Any]) -> None:
        if topic in self._subscribers:
            self._subscribers[topic] = [q for q in self._subscribers[topic] if q is not queue]

    async def close(self) -> None:
        self._subscribers.clear()


async def subscribe_iter(pubsub: MiniPubSub, topic: str) -> AsyncIterator[Any]:
    queue = pubsub.subscribe(topic)
    try:
        while True:
            yield await queue.get()
    finally:
        pubsub.unsubscribe(topic, queue)


if __name__ == "__main__":
    async def main():
        pubsub = MiniPubSub()
        queue = pubsub.subscribe("news")
        pubsub.publish("news", "hello")
        pubsub.publish("news", "world")
        print(await queue.get())
        print(await queue.get())

    asyncio.run(main())
