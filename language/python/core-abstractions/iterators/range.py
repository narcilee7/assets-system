"""
手写 range。

考点：
- 实现迭代器协议 __iter__ + __next__。
- 支持 start / stop / step，负数 step。
- 惰性计算，不一次性生成列表。
"""

from __future__ import annotations


class Range:
    """Teaching implementation of a lazy integer range."""

    def __init__(self, start: int, stop: int | None = None, step: int = 1) -> None:
        if stop is None:
            start, stop = 0, start

        if step == 0:
            raise ValueError("range() arg 3 must not be zero")

        self._start = start
        self._stop = stop
        self._step = step
        self._length = max(0, (stop - start + (step - 1 if step > 0 else step + 1)) // step)

    def __iter__(self) -> "RangeIterator":
        return RangeIterator(self._start, self._stop, self._step)

    def __len__(self) -> int:
        return self._length

    def __repr__(self) -> str:
        if self._step == 1:
            return f"Range({self._start}, {self._stop})"
        return f"Range({self._start}, {self._stop}, {self._step})"


class RangeIterator:
    def __init__(self, start: int, stop: int, step: int) -> None:
        self._current = start
        self._stop = stop
        self._step = step

    def __iter__(self) -> "RangeIterator":
        return self

    def __next__(self) -> int:
        if (self._step > 0 and self._current >= self._stop) or (
            self._step < 0 and self._current <= self._stop
        ):
            raise StopIteration
        value = self._current
        self._current += self._step
        return value


if __name__ == "__main__":
    print(list(Range(5)))  # [0, 1, 2, 3, 4]
    print(list(Range(1, 5)))  # [1, 2, 3, 4]
    print(list(Range(0, 10, 2)))  # [0, 2, 4, 6, 8]
    print(list(Range(10, 0, -2)))  # [10, 8, 6, 4, 2]
    print(len(Range(1, 10, 3)))  # 3
