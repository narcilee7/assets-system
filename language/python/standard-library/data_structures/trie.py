"""
手写 Trie（前缀树）。

考点：
- 每个节点维护子节点字典和是否为单词结尾的标记。
- 支持插入、查找、前缀匹配、自动补全。
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any


class TrieNode:
    __slots__ = ("children", "is_end")

    def __init__(self) -> None:
        self.children: dict[str, TrieNode] = {}
        self.is_end = False


class Trie:
    """Teaching implementation of a prefix tree."""

    def __init__(self) -> None:
        self._root = TrieNode()

    def insert(self, word: str) -> None:
        node = self._root
        for char in word:
            node = node.children.setdefault(char, TrieNode())
        node.is_end = True

    def search(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.is_end

    def starts_with(self, prefix: str) -> bool:
        return self._find(prefix) is not None

    def _find(self, word: str) -> TrieNode | None:
        node = self._root
        for char in word:
            node = node.children.get(char)
            if node is None:
                return None
        return node

    def autocomplete(self, prefix: str) -> list[str]:
        """Return all words that start with ``prefix``."""
        node = self._find(prefix)
        if node is None:
            return []
        return [prefix + suffix for suffix in self._collect(node, "")]

    def _collect(self, node: TrieNode, prefix: str) -> Iterator[str]:
        if node.is_end:
            yield prefix
        for char, child in node.children.items():
            yield from self._collect(child, prefix + char)


if __name__ == "__main__":
    t = Trie()
    for word in ["apple", "app", "banana", "band", "bandana"]:
        t.insert(word)

    print(t.search("app"))       # True
    print(t.search("appl"))      # False
    print(t.starts_with("ban"))  # True
    print(t.autocomplete("ban"))  # ['banana', 'band', 'bandana']
