from __future__ import annotations

from collections.abc import Iterable
from typing import Any


def flatten(items: Iterable[Any]) -> list[Any]:
    result: list[Any] = []

    for item in items:
        if isinstance(item, Iterable) and not isinstance(item, (str, bytes)):
            result.extend(flatten(item))
        else:
            result.append(item)

    return result

def _flatten(items: Iterable[Any], depth: int | None) -> list[Any]:
    result: list[Any] = []

    for item in items:
        if depth is not None and depth <= 0:
            result.append(item)
        elif isinstance(item, Iterable) and not isinstance(item, (str, bytes)):
            result.extend(_flatten(item, None if depth is None else depth - 1))
        else:
            result.append(item)

    return result

# test
if __name__ == '__main__':
    # print(flatten([1, 2, [3, 4, [5]]]])))
    # print(flatten([1, [2, 3], [4, [5, 6]]]))

    # print(flatten([]))

    # print(1, [2, (3, 4)])

    # print(flatten([1, [2, [3, [4]]]], depth=1))
    # # [1, 2, [3, [4]]]

    # print(flatten([1, [2, [3, [4]]]], depth=2))
    # # [1, 2, 3, [4]]

    # print(flatten([1, [2, [3, [4]]]], depth=None))
    # # [1, 2, 3, 4]
