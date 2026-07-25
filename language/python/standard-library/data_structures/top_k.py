"""
手写 Top K。

考点：
- 使用小顶堆维护前 K 大元素，堆大小不超过 K。
- 时间复杂度 O(n log K)，空间复杂度 O(K)。
"""

from __future__ import annotations

import heapq
from collections.abc import Iterable
from typing import Callable, TypeVar

T = TypeVar("T")


def top_k(
    iterable: Iterable[T],
    k: int,
    *,
    key: Callable[[T], float] | None = None,
) -> list[T]:
    """Return the ``k`` largest items.

    Args:
        iterable: Input sequence.
        k: Number of largest items to return.
        key: Optional function returning a comparable score.

    Returns:
        The ``k`` largest items in ascending order (smallest of the top k
        comes first).
    """
    if k <= 0:
        return []

    score_key = key or (lambda x: x)  # type: ignore[arg-type, return-value]

    # Min-heap of size k: store (score, item).
    heap: list[tuple[float, T]] = []

    for item in iterable:
        score = score_key(item)
        if len(heap) < k:
            heapq.heappush(heap, (score, item))
        elif score > heap[0][0]:
            heapq.heapreplace(heap, (score, item))

    return [item for _, item in sorted(heap, key=lambda x: x[0])]


if __name__ == "__main__":
    nums = [3, 1, 5, 12, 2, 11]
    print(top_k(nums, 3))  # [5, 11, 12]

    words = ["apple", "banana", "cherry", "date"]
    print(top_k(words, 2, key=len))  # ['banana', 'cherry']
