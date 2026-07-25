"""
手写 group_by。

考点：
- 按键函数把可迭代对象分组为 dict[key, list[item]]。
- 保持组内原始顺序。
- 可选的 value transformer。
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Iterable
from typing import TypeVar

T = TypeVar("T")
K = TypeVar("K")
V = TypeVar("V")


def group_by(
    iterable: Iterable[T],
    key: Callable[[T], K],
    *,
    transform: Callable[[T], V] | None = None,
) -> dict[K, list[V] | list[T]]:
    """Group items by a key function.

    Args:
        iterable: Input sequence.
        key: Function returning the group key for each item.
        transform: Optional function to transform each item before
            appending to its group.

    Returns:
        A dictionary mapping keys to lists of items.
    """
    groups: dict[K, list[V] | list[T]] = defaultdict(list)

    for item in iterable:
        k = key(item)
        if transform is not None:
            groups[k].append(transform(item))  # type: ignore[arg-type]
        else:
            groups[k].append(item)  # type: ignore[arg-type]

    return dict(groups)


if __name__ == "__main__":
    words = ["apple", "apricot", "banana", "cherry", "avocado"]
    print(group_by(words, key=lambda w: w[0]))
    # {'a': ['apple', 'apricot', 'avocado'], 'b': ['banana'], 'c': ['cherry']}

    numbers = [1, 2, 3, 4, 5, 6]
    print(group_by(numbers, key=lambda n: n % 2, transform=lambda n: n * 10))
    # {1: [10, 30, 50], 0: [20, 40, 60]}
