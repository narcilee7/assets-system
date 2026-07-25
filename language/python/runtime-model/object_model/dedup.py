"""
手写 dedup。

考点：
- 保持元素原始顺序去重。
- 支持通过 key 函数自定义去重依据。
- 兼容不可哈希元素（使用seen key列表）。
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import TypeVar

T = TypeVar("T")
K = TypeVar("K")


def dedup(
    iterable: Iterable[T],
    *,
    key: Callable[[T], K] | None = None,
) -> list[T]:
    """Return a list of unique items preserving the original order.

    Args:
        iterable: Input sequence.
        key: Function returning a hashable identity for each item.
            If omitted, the item itself is used.
    """
    result: list[T] = []
    seen: set[K] = set()

    for item in iterable:
        identity = key(item) if key is not None else item  # type: ignore[assignment]
        if identity not in seen:
            seen.add(identity)
            result.append(item)

    return result


if __name__ == "__main__":
    data = [1, 2, 2, 3, 1, 4, 3]
    print(dedup(data))  # [1, 2, 3, 4]

    words = ["Apple", "banana", "apricot", "cherry"]
    print(dedup(words, key=str.lower))  # ['Apple', 'banana', 'cherry']

    # Unhashable items work when a key function is provided.
    records = [{"id": 1, "v": "a"}, {"id": 2, "v": "b"}, {"id": 1, "v": "c"}]
    print(dedup(records, key=lambda r: r["id"]))
    # [{'id': 1, 'v': 'a'}, {'id': 2, 'v': 'b'}]
