"""
手写 enumerate。

考点：
- 同时迭代索引和值。
- 支持自定义 start 偏移。
- 使用迭代器协议而非一次性构造列表。
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import TypeVar

T = TypeVar("T")


class Enumerate:
    """Teaching implementation of ``enumerate``."""

    def __init__(self, iterable: Iterable[T], start: int = 0) -> None:
        self._iterable = iterable
        self._start = start

    def __iter__(self) -> "EnumerateIterator[T]":
        return EnumerateIterator(iter(self._iterable), self._start)


class EnumerateIterator(Iterator[tuple[int, T]]):
    def __init__(self, iterator: Iterator[T], start: int) -> None:
        self._iterator = iterator
        self._index = start

    def __iter__(self) -> "EnumerateIterator[T]":
        return self

    def __next__(self) -> tuple[int, T]:
        value = next(self._iterator)
        index = self._index
        self._index += 1
        return index, value


if __name__ == "__main__":
    words = ["a", "b", "c"]
    print(list(Enumerate(words)))  # [(0, 'a'), (1, 'b'), (2, 'c')]
    print(list(Enumerate(words, start=10)))  # [(10, 'a'), (11, 'b'), (12, 'c')]
