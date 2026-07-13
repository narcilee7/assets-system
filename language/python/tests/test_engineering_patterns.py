import asyncio
import unittest

import tests.common  # noqa: F401
from async_retry import async_retry
from bounded_gather import bounded_gather
from engineering_patterns.config_loader import AppConfig, DatabaseConfig, DictSource, load_config
from engineering_patterns.di_container import DIContainer, Lifetime
from engineering_patterns.event_bus import EventBus
from engineering_patterns.middleware_chain import build_middleware_chain
from engineering_patterns.repository import InMemoryUserRepository, User
from engineering_patterns.retry_with_backoff import RetryPolicy
from engineering_patterns.token_bucket_rate_limiter import PerClientLimiter, TokenBucket
from engineering_patterns.unit_of_work import UnitOfWork, uow_context
from safe_counter import SafeCounter


class MiddlewareChainTest(unittest.TestCase):
    def test_order(self):
        def uppercase(next_handler):
            def wrapper(request):
                return next_handler(request).upper()
            return wrapper

        def exclaim(next_handler):
            def wrapper(request):
                return next_handler(request) + "!"
            return wrapper

        def app(request):
            return f"hello {request}"

        chain = build_middleware_chain(app, uppercase, exclaim)
        self.assertEqual(chain("world"), "HELLO WORLD!")


class RetryWithBackoffTest(unittest.TestCase):
    def test_sync_retry(self):
        attempts = 0

        def flaky():
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise ValueError("fail")
            return "ok"

        policy = RetryPolicy(ValueError, max_attempts=3, base_delay=0.0)
        self.assertEqual(policy.run(flaky), "ok")

    def test_async_retry(self):
        attempts = 0

        async def flaky():
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise ValueError("fail")
            return "ok"

        policy = RetryPolicy(ValueError, max_attempts=3, base_delay=0.0)
        self.assertEqual(asyncio.run(policy.run_async(flaky)), "ok")


class TokenBucketTest(unittest.TestCase):
    def test_burst_then_throttle(self):
        bucket = TokenBucket(rate=10, capacity=2)
        self.assertTrue(bucket.allow())
        self.assertTrue(bucket.allow())
        self.assertFalse(bucket.allow())

    def test_per_client(self):
        limiter = PerClientLimiter(rate=1, capacity=1)
        self.assertTrue(limiter.get_limiter("a").allow())
        self.assertTrue(limiter.get_limiter("b").allow())


class EventBusTest(unittest.TestCase):
    def test_sync_publish(self):
        bus = EventBus()
        received = []
        bus.subscribe("test", lambda x: received.append(x))
        bus.publish("test", "payload")
        self.assertEqual(received, ["payload"])

    def test_unsubscribe(self):
        bus = EventBus()
        received = []
        unsub = bus.subscribe("test", lambda x: received.append(x))
        unsub()
        bus.publish("test", "payload")
        self.assertEqual(received, [])


class ConfigLoaderTest(unittest.TestCase):
    def test_load_config(self):
        source = DictSource({"DEBUG": "true", "DB_HOST": "db.example.com", "DB_PORT": "5433"})
        cfg = load_config(AppConfig, source)
        self.assertTrue(cfg.debug)
        self.assertEqual(cfg.db.host, "db.example.com")
        self.assertEqual(cfg.db.port, 5433)


class RepositoryTest(unittest.TestCase):
    def test_crud(self):
        repo = InMemoryUserRepository()
        repo.add(User(1, "Ada"))
        self.assertEqual(repo.get(1), User(1, "Ada"))
        repo.remove(1)
        self.assertIsNone(repo.get(1))


class UnitOfWorkTest(unittest.TestCase):
    def test_commit(self):
        with uow_context() as uow:
            uow.register_add(User(1, "Ada"))
        self.assertEqual(len(uow.list_users()), 1)

    def test_rollback(self):
        try:
            with uow_context() as uow:
                uow.register_add(User(2, "Bob"))
                raise ValueError("boom")
        except ValueError:
            pass
        self.assertEqual(len(uow.list_users()), 0)


class DIContainerTest(unittest.TestCase):
    def test_auto_wire(self):
        class Database:
            def __init__(self, url: str = "sqlite://") -> None:
                self.url = url

        class Service:
            def __init__(self, db: Database) -> None:
                self.db = db

        container = DIContainer()
        container.register(Database, Database, lifetime=Lifetime.SINGLETON)
        container.register(Service, Service)
        service = container.resolve(Service)
        self.assertEqual(service.db.url, "sqlite://")

    def test_singleton(self):
        class Counter:
            def __init__(self) -> None:
                self.value = 0

        container = DIContainer()
        container.register(Counter, Counter, lifetime=Lifetime.SINGLETON)
        c1 = container.resolve(Counter)
        c2 = container.resolve(Counter)
        self.assertIs(c1, c2)


if __name__ == "__main__":
    unittest.main()
