"""
手写拓扑排序。

考点：
- Kahn 算法： repeatedly remove nodes with zero in-degree.
- 检测环：如果结果长度 != 节点数，则存在环。
"""

from __future__ import annotations

from collections import deque
from collections.abc import Mapping
from typing import TypeVar

T = TypeVar("T")


def topological_sort(graph: Mapping[T, list[T]]) -> list[T]:
    """Return a topological ordering of ``graph``.

    Raises:
        ValueError: If the graph contains a cycle.
    """
    # Compute in-degrees.
    in_degree: dict[T, int] = {node: 0 for node in graph}
    for node in graph:
        for neighbor in graph[node]:
            if neighbor not in in_degree:
                in_degree[neighbor] = 0
            in_degree[neighbor] += 1

    queue: deque[T] = deque(node for node, degree in in_degree.items() if degree == 0)
    result: list[T] = []

    while queue:
        node = queue.popleft()
        result.append(node)
        for neighbor in graph.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(in_degree):
        raise ValueError("graph contains a cycle")

    return result


if __name__ == "__main__":
    tasks = {
        "build": ["test"],
        "test": ["deploy"],
        "deploy": [],
        "lint": ["test"],
    }
    print(topological_sort(tasks))
    # ['build', 'lint', 'test', 'deploy'] (order may vary for independent nodes)

    cyclic = {"A": ["B"], "B": ["A"]}
    try:
        topological_sort(cyclic)
    except ValueError as e:
        print("caught:", e)
