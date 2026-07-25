"""
手写 zip。

考点：
- 并行迭代多个可迭代对象。
- 默认以最短序列为准（strict=False）。
- 提供 strict 模式：长度不一致时抛出 ValueError。
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import Any, TypeVar

T = TypeVar("T")


class Zip:
    """Teaching implementation of ``zip``."""

    def __init__(self, *iterables: Iterable[Any], strict: bool = False) -> None:
        self._iterables = iterables
        self._strict = strict

    def __iter__(self) -> "ZipIterator":
        return ZipIterator(*self._iterables, strict=self._strict)


class ZipIterator(Iterator[tuple[Any, ...]]):
    def __init__(self, *iterables: Iterable[Any], strict: bool = False) -> None:
        self._iterators = [iter(it) for it in iterables]
        self._strict = strict

    def __iter__(self) -> "ZipIterator":
        return self

    def __next__(self) -> tuple[Any, ...]:
        if not self._iterators:
            raise StopIteration

        values: list[Any] = []
        exhausted = 0
        for it in self._iterators:
            try:
                values.append(next(it))
            except StopIteration:
                exhausted += 1

        if exhausted:
            if self._strict and exhausted != len(self._iterators):
                raise ValueError(
                    f"zip() has arguments with different lengths: "
                    f"{len(self._iterators) - exhausted} still had values"
                )
            raise StopIteration

        return tuple(values)


if __name__ == "__main__":
    print(list(Zip([1, 2, 3], ["a", "b"])))  # [(1, 'a'), (2, 'b')]
    print(list(Zip([1, 2], ["a", "b"], strict=True)))  # [(1, 'a'), (2, 'b')]
    try:
        list(Zip([1, 2, 3], ["a", "b"], strict=True))
    except ValueError as e:
        print("strict raised:", e)
