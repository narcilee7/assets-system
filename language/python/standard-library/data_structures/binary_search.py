"""
手写二分查找。

考点：
- 循环不变量：左闭右开或左闭右闭区间。
- 边界收缩避免死循环和越界。
- 返回插入位置（lower_bound / upper_bound）。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypeVar

T = TypeVar("T")


def binary_search(arr: Sequence[T], target: T) -> int:
    """Return the index of ``target`` in sorted ``arr``, or -1 if not found."""
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1


def lower_bound(arr: Sequence[T], target: T) -> int:
    """Return the first index i such that arr[i] >= target."""
    left, right = 0, len(arr)
    while left < right:
        mid = (left + right) // 2
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid
    return left


def upper_bound(arr: Sequence[T], target: T) -> int:
    """Return the first index i such that arr[i] > target."""
    left, right = 0, len(arr)
    while left < right:
        mid = (left + right) // 2
        if arr[mid] <= target:
            left = mid + 1
        else:
            right = mid
    return left


if __name__ == "__main__":
    arr = [1, 3, 5, 7, 9]
    print(binary_search(arr, 5))   # 2
    print(binary_search(arr, 6))   # -1
    print(lower_bound(arr, 6))     # 3
    print(upper_bound(arr, 5))     # 3
