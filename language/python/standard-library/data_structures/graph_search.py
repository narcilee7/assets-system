"""
手写 BFS / DFS。

考点：
- BFS 用队列，适合最短路径（无权图）。
- DFS 用栈（或递归），适合拓扑、连通分量。
- visited 集合避免重复访问。
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable, Iterator, Mapping
from typing import TypeVar

T = TypeVar("T")


Graph = Mapping[T, list[T]]


def bfs(graph: Graph[T], start: T) -> Iterator[T]:
    """Breadth-first traversal of ``graph`` starting from ``start``."""
    visited: set[T] = set()
    queue: deque[T] = deque([start])
    visited.add(start)

    while queue:
        node = queue.popleft()
        yield node
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)


def dfs(graph: Graph[T], start: T) -> Iterator[T]:
    """Depth-first traversal of ``graph`` starting from ``start``."""
    visited: set[T] = set()
    stack: list[T] = [start]

    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        yield node
        for neighbor in reversed(graph.get(node, [])):
            if neighbor not in visited:
                stack.append(neighbor)


def shortest_path(graph: Graph[T], start: T, end: T) -> list[T] | None:
    """Return the shortest path from ``start`` to ``end`` using BFS."""
    if start == end:
        return [start]

    visited: set[T] = {start}
    queue: deque[tuple[T, list[T]]] = deque([(start, [start])])

    while queue:
        node, path = queue.popleft()
        for neighbor in graph.get(node, []):
            if neighbor in visited:
                continue
            new_path = path + [neighbor]
            if neighbor == end:
                return new_path
            visited.add(neighbor)
            queue.append((neighbor, new_path))

    return None


if __name__ == "__main__":
    graph = {
        "A": ["B", "C"],
        "B": ["D"],
        "C": ["D"],
        "D": [],
    }
    print(list(bfs(graph, "A")))  # ['A', 'B', 'C', 'D']
    print(list(dfs(graph, "A")))  # ['A', 'B', 'D', 'C']
    print(shortest_path(graph, "A", "D"))  # ['A', 'B', 'D']
