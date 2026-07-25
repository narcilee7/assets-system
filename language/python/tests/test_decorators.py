import time
import unittest
from unittest.mock import patch

import tests.common  # noqa: F401
from decorators.memoize import memoize
from decorators.once import once
from decorators.retry import retry
from decorators.timer import timer


class TimerTest(unittest.TestCase):
    def test_timer_prints_duration(self):
        @timer
        def add(a: int, b: int) -> int:
            return a + b

        with patch("builtins.print") as mock_print:
            result = add(1, 2)

        self.assertEqual(result, 3)
        self.assertTrue(any("took" in call[0][0] for call in mock_print.call_args_list))


class RetryTest(unittest.TestCase):
    def test_succeeds_without_retry(self):
        @retry(ValueError, max_attempts=2)
        def ok() -> str:
            return "ok"

        self.assertEqual(ok(), "ok")

    def test_retries_then_succeeds(self):
        attempts = 0

        @retry(ValueError, max_attempts=3, delay=0.0)
        def flaky() -> str:
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise ValueError("fail")
            return "ok"

        self.assertEqual(flaky(), "ok")
        self.assertEqual(attempts, 3)

    def test_raises_after_exhaustion(self):
        @retry(ValueError, max_attempts=2, delay=0.0)
        def always_fail() -> None:
            raise ValueError("fail")

        with self.assertRaises(ValueError):
            always_fail()

    def test_non_retried_exception(self):
        @retry(ValueError, max_attempts=2)
        def raise_type_error() -> None:
            raise TypeError("fail")

        with self.assertRaises(TypeError):
            raise_type_error()


class MemoizeTest(unittest.TestCase):
    def test_caches_result(self):
        calls = 0

        @memoize(maxsize=None)
        def square(x: int) -> int:
            nonlocal calls
            calls += 1
            return x * x

        self.assertEqual(square(3), 9)
        self.assertEqual(square(3), 9)
        self.assertEqual(calls, 1)

    def test_lru_eviction(self):
        @memoize(maxsize=2)
        def identity(x: int) -> int:
            return x

        identity(1)
        identity(2)
        identity(3)
        self.assertEqual(len(identity.cache), 2)

    def test_typed_cache(self):
        @memoize(maxsize=None, typed=True)
        def stringify(x: object) -> str:
            return str(x)

        self.assertEqual(stringify(1), "1")
        self.assertEqual(stringify(1.0), "1.0")
        # Both entries should be present because types differ.
        self.assertEqual(len(stringify.cache), 2)


class OnceTest(unittest.TestCase):
    def test_runs_once(self):
        calls = 0

        @once
        def init() -> int:
            nonlocal calls
            calls += 1
            return 42

        self.assertEqual(init(), 42)
        self.assertEqual(init(), 42)
        self.assertEqual(calls, 1)

    def test_remembers_exception(self):
        calls = 0

        @once
        def fail() -> int:
            nonlocal calls
            calls += 1
            raise ValueError("boom")

        with self.assertRaises(ValueError):
            fail()
        with self.assertRaises(ValueError):
            fail()
        self.assertEqual(calls, 1)


if __name__ == "__main__":
    unittest.main()
