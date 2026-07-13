import unittest

import tests.common  # noqa: F401
from object_model.chunk import chunk
from object_model.dedup import dedup
from object_model.flatten import flatten
from object_model.group_by import group_by


class FlattenTest(unittest.TestCase):
    def test_flatten_nested_list(self):
        self.assertEqual(flatten([1, [2, [3, 4]], 5]), [1, 2, 3, 4, 5])

    def test_flatten_mixed_containers(self):
        self.assertEqual(flatten([1, (2, 3), {4, 5}, "ab"]), [1, 2, 3, 4, 5, "ab"])

    def test_strings_are_atomic(self):
        self.assertEqual(flatten(["ab", ["cd"]]), ["ab", "cd"])

    def test_depth_limit(self):
        self.assertEqual(flatten([1, [2, [3]]], depth=1), [1, 2, [3]])
        self.assertEqual(flatten([1, [2, [3]]], depth=2), [1, 2, 3])

    def test_depth_zero(self):
        self.assertEqual(flatten([1, [2, 3]], depth=0), [1, [2, 3]])


class DedupTest(unittest.TestCase):
    def test_basic_dedup(self):
        self.assertEqual(dedup([1, 2, 2, 3, 1]), [1, 2, 3])

    def test_key_function(self):
        words = ["Apple", "banana", "apricot"]
        self.assertEqual(dedup(words, key=str.lower), ["Apple", "banana", "apricot"])

    def test_unhashable_with_key(self):
        records = [{"id": 1}, {"id": 2}, {"id": 1}]
        self.assertEqual(
            dedup(records, key=lambda r: r["id"]),
            [{"id": 1}, {"id": 2}],
        )

    def test_empty(self):
        self.assertEqual(dedup([]), [])


class GroupByTest(unittest.TestCase):
    def test_group_by_first_letter(self):
        words = ["apple", "banana", "avocado"]
        self.assertEqual(
            group_by(words, key=lambda w: w[0]),
            {"a": ["apple", "avocado"], "b": ["banana"]},
        )

    def test_group_with_transform(self):
        numbers = [1, 2, 3, 4]
        self.assertEqual(
            group_by(numbers, key=lambda n: n % 2, transform=lambda n: n * 10),
            {1: [10, 30], 0: [20, 40]},
        )

    def test_empty(self):
        self.assertEqual(group_by([], key=lambda x: x), {})


class ChunkTest(unittest.TestCase):
    def test_even_chunks(self):
        self.assertEqual(list(chunk([1, 2, 3, 4, 5, 6], 3)), [[1, 2, 3], [4, 5, 6]])

    def test_last_chunk_shorter(self):
        self.assertEqual(list(chunk([1, 2, 3, 4, 5], 2)), [[1, 2], [3, 4], [5]])

    def test_fill_last_chunk(self):
        self.assertEqual(list(chunk([1, 2, 3, 4, 5], 2, fill=0)), [[1, 2], [3, 4], [5, 0]])

    def test_invalid_size(self):
        with self.assertRaises(ValueError):
            list(chunk([1, 2, 3], 0))

    def test_lazy(self):
        gen = chunk(iter([1, 2, 3, 4]), 2)
        self.assertEqual(next(gen), [1, 2])
        self.assertEqual(next(gen), [3, 4])
        with self.assertRaises(StopIteration):
            next(gen)


if __name__ == "__main__":
    unittest.main()
