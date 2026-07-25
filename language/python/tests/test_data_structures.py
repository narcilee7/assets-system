import unittest

import tests.common  # noqa: F401
from data_structures.binary_search import binary_search, lower_bound, upper_bound
from data_structures.graph_search import bfs, dfs, shortest_path
from data_structures.lru_cache import LRUCache
from data_structures.min_stack import MinStack
from data_structures.top_k import top_k
from data_structures.topological_sort import topological_sort
from data_structures.trie import Trie


class LRUCacheTest(unittest.TestCase):
    def test_get_put(self):
        cache: LRUCache[int, str] = LRUCache(2)
        cache.put(1, "a")
        self.assertEqual(cache.get(1), "a")

    def test_eviction(self):
        cache: LRUCache[int, str] = LRUCache(2)
        cache.put(1, "a")
        cache.put(2, "b")
        cache.put(3, "c")
        self.assertNotIn(1, cache)
        self.assertIn(3, cache)

    def test_update_order(self):
        cache: LRUCache[int, str] = LRUCache(2)
        cache.put(1, "a")
        cache.put(2, "b")
        cache.get(1)
        cache.put(3, "c")
        self.assertIn(1, cache)
        self.assertNotIn(2, cache)


class MinStackTest(unittest.TestCase):
    def test_min_tracking(self):
        s: MinStack[int] = MinStack()
        s.push(3)
        s.push(1)
        s.push(2)
        self.assertEqual(s.get_min(), 1)
        s.pop()
        self.assertEqual(s.get_min(), 1)
        s.pop()
        self.assertEqual(s.get_min(), 3)


class TopKTest(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(top_k([3, 1, 5, 2], 2), [3, 5])

    def test_key_function(self):
        words = ["a", "bbb", "cc", "dddd"]
        self.assertEqual(top_k(words, 2, key=len), ["bbb", "dddd"])


class TrieTest(unittest.TestCase):
    def test_insert_search(self):
        t = Trie()
        t.insert("apple")
        self.assertTrue(t.search("apple"))
        self.assertFalse(t.search("app"))

    def test_starts_with(self):
        t = Trie()
        t.insert("apple")
        self.assertTrue(t.starts_with("app"))

    def test_autocomplete(self):
        t = Trie()
        for word in ["app", "apple", "apply"]:
            t.insert(word)
        self.assertEqual(sorted(t.autocomplete("app")), ["app", "apple", "apply"])


class BinarySearchTest(unittest.TestCase):
    def test_found(self):
        self.assertEqual(binary_search([1, 3, 5, 7, 9], 5), 2)

    def test_not_found(self):
        self.assertEqual(binary_search([1, 3, 5], 4), -1)

    def test_lower_bound(self):
        self.assertEqual(lower_bound([1, 3, 5, 7], 4), 2)

    def test_upper_bound(self):
        self.assertEqual(upper_bound([1, 3, 5, 7], 5), 3)


class GraphSearchTest(unittest.TestCase):
    def test_bfs(self):
        graph = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}
        self.assertEqual(list(bfs(graph, "A")), ["A", "B", "C", "D"])

    def test_dfs(self):
        graph = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}
        self.assertEqual(list(dfs(graph, "A")), ["A", "B", "D", "C"])

    def test_shortest_path(self):
        graph = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}
        self.assertEqual(shortest_path(graph, "A", "D"), ["A", "B", "D"])


class TopologicalSortTest(unittest.TestCase):
    def test_valid(self):
        graph = {"A": ["B"], "B": ["C"], "C": []}
        self.assertEqual(topological_sort(graph), ["A", "B", "C"])

    def test_cycle(self):
        with self.assertRaises(ValueError):
            topological_sort({"A": ["B"], "B": ["A"]})


if __name__ == "__main__":
    unittest.main()
