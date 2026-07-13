import asyncio
import threading
import time
import unittest
from dataclasses import dataclass

import tests.common  # noqa: F401
from mini_framework.mini_agent_runtime import AgentRuntime, Tool
from mini_framework.mini_cache_ttl import MiniCacheTTL
from mini_framework.mini_fastapi import MiniFastAPI, json_response
from mini_framework.mini_orm import InMemoryTable
from mini_framework.mini_pubsub import MiniPubSub
from mini_framework.mini_router import Router
from mini_framework.mini_scheduler import MiniScheduler
from mini_framework.mini_task_queue import MiniTaskQueue


class MiniRouterTest(unittest.TestCase):
    def test_basic_route(self):
        router = Router()
        router.get("/", lambda env: (200, {}, b"home"))
        status, headers, body = router.dispatch("GET", "/")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"home")

    def test_path_param(self):
        router = Router()
        router.get("/users/{user_id}", lambda env: (200, {}, env["router.params"]["user_id"].encode()))
        status, headers, body = router.dispatch("GET", "/users/42")
        self.assertEqual(body, b"42")

    def test_middleware(self):
        router = Router()
        router.get("/", lambda env: (200, {}, b"hello"))
        router.use(lambda h: lambda e: (h(e)[0], h(e)[1], h(e)[2].upper()))
        status, headers, body = router.dispatch("GET", "/")
        self.assertEqual(body, b"HELLO")


class MiniFastAPITest(unittest.TestCase):
    def test_json_response(self):
        @dataclass
        class User:
            id: int
            name: str

        status, headers, body = json_response(User(id=1, name="Ada"))
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(body, b'{"id": 1, "name": "Ada"}')

    def test_post_body(self):
        app = MiniFastAPI()
        app.post("/users", lambda env: (201, {"Content-Type": "application/json"}, b'{"ok": true}'))
        status, headers, body = app.dispatch("POST", "/users", body=b'{"name":"Bob"}')
        self.assertEqual(status, 201)


class MiniORMTest(unittest.TestCase):
    def test_filter_and_order(self):
        table = InMemoryTable()
        table.insert({"id": 1, "name": "Bob", "age": 25})
        table.insert({"id": 2, "name": "Ada", "age": 30})
        results = table.query().filter(age=30).order_by("name").execute()
        self.assertEqual(results, [{"id": 2, "name": "Ada", "age": 30}])


class MiniTaskQueueTest(unittest.TestCase):
    def test_success_and_dead_letter(self):
        processed = []

        def handle(x):
            if x == 2:
                raise ValueError("fail")
            processed.append(x)

        q = MiniTaskQueue(handle, workers=1, max_retries=1, retry_delay=0.01)
        for i in range(4):
            q.submit(i)
        dlq = q.stop()
        self.assertIn(0, processed)
        self.assertIn(1, processed)
        self.assertIn(3, processed)
        self.assertEqual([t.payload for t in dlq], [2])


class MiniAgentRuntimeTest(unittest.TestCase):
    def test_tool_execution(self):
        runtime = AgentRuntime()
        events = []
        runtime.on_event(lambda e: events.append(e.type))
        runtime.register(Tool(name="add", description="", schema={}, handler=lambda a, b: a + b))
        self.assertEqual(runtime.run("add", {"a": 1, "b": 2}), 3)
        self.assertIn("tool.start", events)
        self.assertIn("tool.done", events)


class MiniCacheTTLTest(unittest.TestCase):
    def test_get_and_expire(self):
        cache: MiniCacheTTL[str, int] = MiniCacheTTL(default_ttl=0.1)
        cache.set("a", 1)
        self.assertEqual(cache.get("a"), 1)
        time.sleep(0.15)
        with self.assertRaises(KeyError):
            cache.get("a")
        cache.stop()

    def test_lru_eviction(self):
        cache: MiniCacheTTL[str, int] = MiniCacheTTL(default_ttl=60.0, max_size=2)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        with self.assertRaises(KeyError):
            cache.get("a")
        cache.stop()


class MiniSchedulerTest(unittest.TestCase):
    def test_periodic(self):
        async def main():
            ticks = []
            scheduler = MiniScheduler()
            scheduler.start()
            scheduler.schedule_periodic(0.05, lambda: ticks.append(1) or asyncio.sleep(0))
            await asyncio.sleep(0.13)
            await scheduler.stop()
            return len(ticks)

        self.assertGreaterEqual(asyncio.run(main()), 2)


class MiniPubSubTest(unittest.TestCase):
    def test_publish_subscribe(self):
        async def main():
            pubsub = MiniPubSub()
            queue = pubsub.subscribe("news")
            pubsub.publish("news", "hello")
            pubsub.publish("news", "world")
            return [await queue.get(), await queue.get()]

        self.assertEqual(asyncio.run(main()), ["hello", "world"])


if __name__ == "__main__":
    unittest.main()
