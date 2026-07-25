"""
手写 chain。

考点：
- 把多个可迭代对象按顺序拼接成一个迭代器。
- 惰性消费，当前迭代器耗尽后才进入下一个。
- 支持 ``from_iterable`` 类方法，接收嵌套可迭代对象。
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import Any


class Chain:
    """Teaching implementation of ``itertools.chain``."""

    def __init__(self, *iterables: Iterable[Any]) -> None:
        self._iterables = iterables

    @classmethod
    def from_iterable(cls, iterable: Iterable[Iterable[Any]]) -> "Chain":
        """Chain from an iterable of iterables."""
        return cls(*iterable)

    def __iter__(self) -> "ChainIterator":
        return ChainIterator(self._iterables)


class ChainIterator(Iterator[Any]):
    def __init__(self, iterables: tuple[Iterable[Any], ...]) -> None:
        self._outer = iter(iterables)
        self._inner: Iterator[Any] | None = None

    def __iter__(self) -> "ChainIterator":
        return self

    def __next__(self) -> Any:
        while True:
            if self._inner is not None:
                try:
                    return next(self._inner)
                except StopIteration:
                    self._inner = None

            try:
                self._inner = iter(next(self._outer))
            except StopIteration:
                raise StopIteration


if __name__ == "__main__":
    print(list(Chain([1, 2], (3, 4), {5, 6})))  # [1, 2, 3, 4, 5, 6]
    print(list(Chain.from_iterable([["a", "b"], ["c"], ["d", "e"]])))
    # ['a', 'b', 'c', 'd', 'e']

    # Lazy: the second iterable is not touched until the first is exhausted.
    gen = Chain([1, 2], [3, 4])
    print(next(iter(gen)))  # 1
