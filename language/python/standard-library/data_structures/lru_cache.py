"""
手写 LRU Cache。

考点：
- 哈希表提供 O(1) 查找。
- 双向链表维护使用顺序，O(1) 移动/删除。
- get / put 都要更新最近使用位置。
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Generic, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class _Node(Generic[K, V]):
    __slots__ = ("key", "value", "prev", "next")

    def __init__(self, key: K, value: V) -> None:
        self.key = key
        self.value = value
        self.prev: _Node[K, V] | None = None
        self.next: _Node[K, V] | None = None


class LRUCache(Generic[K, V]):
    """Teaching implementation of an LRU cache."""

    def __init__(self, capacity: int) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self._capacity = capacity
        self._cache: dict[K, _Node[K, V]] = {}
        self._head = _Node(K, V)  # type: ignore[arg-type]
        self._tail = _Node(K, V)  # type: ignore[arg-type]
        self._head.next = self._tail
        self._tail.prev = self._head

    def get(self, key: K) -> V:
        if key not in self._cache:
            raise KeyError(key)
        node = self._cache[key]
        self._move_to_head(node)
        return node.value

    def put(self, key: K, value: V) -> None:
        if key in self._cache:
            node = self._cache[key]
            node.value = value
            self._move_to_head(node)
            return

        node = _Node(key, value)
        self._cache[key] = node
        self._add_to_head(node)

        if len(self._cache) > self._capacity:
            removed = self._remove_tail()
            del self._cache[removed.key]

    def __contains__(self, key: K) -> bool:
        return key in self._cache

    def __len__(self) -> int:
        return len(self._cache)

    def __iter__(self) -> Iterator[K]:
        node = self._head.next
        while node is not None and node is not self._tail:
            yield node.key
            node = node.next

    def _add_to_head(self, node: _Node[K, V]) -> None:
        node.prev = self._head
        node.next = self._head.next
        assert self._head.next is not None
        self._head.next.prev = node
        self._head.next = node

    def _remove(self, node: _Node[K, V]) -> None:
        assert node.prev is not None and node.next is not None
        node.prev.next = node.next
        node.next.prev = node.prev

    def _move_to_head(self, node: _Node[K, V]) -> None:
        self._remove(node)
        self._add_to_head(node)

    def _remove_tail(self) -> _Node[K, V]:
        assert self._tail.prev is not None and self._tail.prev is not self._head
        node = self._tail.prev
        self._remove(node)
        return node


if __name__ == "__main__":
    cache: LRUCache[int, str] = LRUCache(2)
    cache.put(1, "a")
    cache.put(2, "b")
    print(list(cache))  # [2, 1]
    cache.get(1)
    print(list(cache))  # [1, 2]
    cache.put(3, "c")  # evicts 2
    print(2 in cache)  # False
    print(list(cache))  # [3, 1]
