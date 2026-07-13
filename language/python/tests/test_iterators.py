import unittest

import tests.common  # noqa: F401
from iterators.chain import Chain
from iterators.enumerate import Enumerate
from iterators.range import Range
from iterators.zip import Zip


class RangeTest(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(list(Range(5)), [0, 1, 2, 3, 4])

    def test_start_stop(self):
        self.assertEqual(list(Range(1, 5)), [1, 2, 3, 4])

    def test_step(self):
        self.assertEqual(list(Range(0, 10, 2)), [0, 2, 4, 6, 8])

    def test_negative_step(self):
        self.assertEqual(list(Range(10, 0, -2)), [10, 8, 6, 4, 2])

    def test_zero_step_raises(self):
        with self.assertRaises(ValueError):
            Range(1, 5, 0)

    def test_len(self):
        self.assertEqual(len(Range(1, 10, 3)), 3)
        self.assertEqual(len(Range(5)), 5)
        self.assertEqual(len(Range(5, 5)), 0)

    def test_iterator_independence(self):
        r = Range(3)
        self.assertEqual(list(r), [0, 1, 2])
        self.assertEqual(list(r), [0, 1, 2])


class EnumerateTest(unittest.TestCase):
    def test_default_start(self):
        self.assertEqual(list(Enumerate(["a", "b", "c"])), [(0, "a"), (1, "b"), (2, "c")])

    def test_custom_start(self):
        self.assertEqual(list(Enumerate(["a", "b"], start=10)), [(10, "a"), (11, "b")])

    def test_iterator_independence(self):
        e = Enumerate(["x", "y"])
        self.assertEqual(list(e), [(0, "x"), (1, "y")])
        self.assertEqual(list(e), [(0, "x"), (1, "y")])


class ZipTest(unittest.TestCase):
    def test_shortest_default(self):
        self.assertEqual(list(Zip([1, 2, 3], ["a", "b"])), [(1, "a"), (2, "b")])

    def test_strict_equal_length(self):
        self.assertEqual(list(Zip([1, 2], ["a", "b"], strict=True)), [(1, "a"), (2, "b")])

    def test_strict_unequal_length(self):
        with self.assertRaises(ValueError):
            list(Zip([1, 2, 3], ["a", "b"], strict=True))

    def test_empty(self):
        self.assertEqual(list(Zip()), [])


class ChainTest(unittest.TestCase):
    def test_chain_lists(self):
        self.assertEqual(list(Chain([1, 2], [3, 4])), [1, 2, 3, 4])

    def test_chain_mixed_iterables(self):
        self.assertEqual(list(Chain([1, 2], (3, 4), {5})), [1, 2, 3, 4, 5])

    def test_from_iterable(self):
        self.assertEqual(
            list(Chain.from_iterable([["a", "b"], ["c"]])),
            ["a", "b", "c"],
        )

    def test_lazy(self):
        gen = Chain([1, 2], [3, 4])
        it = iter(gen)
        self.assertEqual(next(it), 1)
        self.assertEqual(next(it), 2)
        self.assertEqual(next(it), 3)


if __name__ == "__main__":
    unittest.main()
