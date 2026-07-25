"""
手写 chunk。

考点：
- 将可迭代对象按固定大小分块。
- 处理最后一块不足 size 的情况（是否丢弃或保留）。
- 惰性生成器实现，避免一次性占用大量内存。
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import TypeVar

T = TypeVar("T")


def chunk(
    iterable: Iterable[T],
    size: int,
    *,
    fill: T | None = None,
) -> Iterator[list[T]]:
    """Yield successive chunks of ``size`` from ``iterable``.

    Args:
        iterable: Input sequence.
        size: Chunk size (must be positive).
        fill: If provided, the last chunk is padded with this value
            to reach ``size``. If ``None``, the last chunk may be shorter.

    Raises:
        ValueError: If ``size`` is not positive.
    """
    if size <= 0:
        raise ValueError("size must be positive")

    iterator = iter(iterable)

    while True:
        batch: list[T] = []
        try:
            for _ in range(size):
                batch.append(next(iterator))
        except StopIteration:
            if not batch:
                return
            if fill is not None:
                while len(batch) < size:
                    batch.append(fill)
            yield batch
            return

        yield batch


if __name__ == "__main__":
    data = [1, 2, 3, 4, 5, 6, 7]
    print(list(chunk(data, 3)))  # [[1, 2, 3], [4, 5, 6], [7]]
    print(list(chunk(data, 3, fill=0)))  # [[1, 2, 3], [4, 5, 6], [7, 0, 0]]

    # Lazy: only consumes what is iterated.
    gen = chunk(range(10**9), 5)
    print(next(gen))  # [0, 1, 2, 3, 4]
