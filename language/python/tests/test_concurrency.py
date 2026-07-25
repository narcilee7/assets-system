import asyncio
import threading
import unittest

import tests.common  # noqa: F401
from concurrency.async_retry import async_retry
from concurrency.bounded_gather import bounded_gather
from concurrency.producer_consumer import ProducerConsumer
from concurrency.safe_counter import SafeCounter


class SafeCounterTest(unittest.TestCase):
    def test_thread_safety(self):
        counter = SafeCounter()
        threads = [
            threading.Thread(target=lambda: [counter.increment() for _ in range(1000)])
            for _ in range(10)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(counter.value, 10000)


class ProducerConsumerTest(unittest.TestCase):
    def test_pool_processing(self):
        pool = ProducerConsumer(lambda x: x * x, num_workers=4)
        pool.submit_many(range(10))
        results = pool.stop()
        self.assertEqual(sorted(results), [i * i for i in range(10)])


class BoundedGatherTest(unittest.TestCase):
    def test_concurrency_limit(self):
        running = 0
        max_running = 0

        async def work(item: int) -> int:
            nonlocal running, max_running
            running += 1
            max_running = max(max_running, running)
            await asyncio.sleep(0.01)
            running -= 1
            return item

        async def main():
            results = await bounded_gather(work, range(10), limit=3)
            return results, max_running

        results, observed_max = asyncio.run(main())
        self.assertEqual(results, list(range(10)))
        self.assertLessEqual(observed_max, 3)

    def test_return_exceptions(self):
        async def fail(item: int) -> int:
            if item == 1:
                raise ValueError("boom")
            return item

        async def main():
            return await bounded_gather(fail, range(3), return_exceptions=True)

        results = asyncio.run(main())
        self.assertEqual(results[0], 0)
        self.assertIsInstance(results[1], ValueError)
        self.assertEqual(results[2], 2)


class AsyncRetryTest(unittest.TestCase):
    def test_retries_then_succeeds(self):
        attempt_count = 0

        @async_retry(ValueError, max_attempts=3, delay=0.0)
        async def flaky() -> str:
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < 3:
                raise ValueError("fail")
            return "ok"

        self.assertEqual(asyncio.run(flaky()), "ok")
        self.assertEqual(attempt_count, 3)

    def test_raises_after_exhaustion(self):
        @async_retry(ValueError, max_attempts=2, delay=0.0)
        async def always_fail() -> None:
            raise ValueError("fail")

        with self.assertRaises(ValueError):
            asyncio.run(always_fail())


if __name__ == "__main__":
    unittest.main()
