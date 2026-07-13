"""
手写 flatten。

考点：
- 递归展平任意嵌套的可迭代对象。
- 区分"原子"类型与"容器"类型：字符串和字节虽然是可迭代，但通常当作原子值。
- 可选的深度限制，避免无限递归（如循环引用）。
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any


_ATOMIC_TYPES = (str, bytes)


def flatten(
    iterable: Iterable[Any],
    *,
    depth: int | None = None,
) -> list[Any]:
    """Return a flattened list from a possibly nested iterable.

    Args:
        iterable: The nested structure to flatten.
        depth: Maximum recursion depth. ``None`` means no limit.
            ``0`` returns a shallow copy of the top-level iterable.
    """
    result: list[Any] = []
    for item in iterable:
        _flatten(item, result, current_depth=0, max_depth=depth)
    return result


def _flatten(
    obj: Any,
    result: list[Any],
    current_depth: int,
    max_depth: int | None,
) -> None:
    if max_depth is not None and current_depth >= max_depth:
        result.append(obj)
        return

    if isinstance(obj, _ATOMIC_TYPES):
        result.append(obj)
        return

    if isinstance(obj, Iterable):
        for item in obj:
            _flatten(item, result, current_depth + 1, max_depth)
        return

    result.append(obj)


if __name__ == "__main__":
    nested = [1, [2, [3, 4]], "hello", (5, [6, 7])]
    print(flatten(nested))  # [1, 2, 3, 4, 'hello', 5, 6, 7]
    print(flatten(nested, depth=1))  # [1, [2, [3, 4]], 'hello', (5, [6, 7])]
    print(flatten(nested, depth=2))  # [1, 2, [3, 4], 'hello', 5, [6, 7]]
