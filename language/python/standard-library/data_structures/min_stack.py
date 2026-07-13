"""
手写 MinStack。

考点：
- 主栈保存所有元素。
- 辅助栈同步保存当前最小值，push/pop 均为 O(1)。
"""

from __future__ import annotations

from typing import Generic, TypeVar

T = TypeVar("T")


class MinStack(Generic[T]):
    """Stack that supports O(1) min queries."""

    def __init__(self) -> None:
        self._stack: list[tuple[T, T]] = []

    def push(self, value: T) -> None:
        if self._stack:
            current_min = self._stack[-1][1]
            new_min = value if value < current_min else current_min
        else:
            new_min = value
        self._stack.append((value, new_min))

    def pop(self) -> T:
        if not self._stack:
            raise IndexError("pop from empty stack")
        return self._stack.pop()[0]

    def top(self) -> T:
        if not self._stack:
            raise IndexError("top from empty stack")
        return self._stack[-1][0]

    def get_min(self) -> T:
        if not self._stack:
            raise IndexError("min from empty stack")
        return self._stack[-1][1]

    def __len__(self) -> int:
        return len(self._stack)

    def __bool__(self) -> bool:
        return bool(self._stack)


if __name__ == "__main__":
    s: MinStack[int] = MinStack()
    s.push(3)
    s.push(1)
    s.push(2)
    print(s.get_min())  # 1
    print(s.pop())      # 2
    print(s.get_min())  # 1
    print(s.pop())      # 1
    print(s.get_min())  # 3
