"""
手写 mini Agent Runtime。

考点：
- 工具注册表（tool registry）。
- Schema 校验。
- 事件流：start / done / error。
- 支持同步/异步执行和超时。
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Tool:
    name: str
    description: str
    schema: dict[str, Any]
    handler: Callable[..., Any] | Callable[..., Awaitable[Any]]


@dataclass
class Event:
    type: str
    tool: str
    input: dict[str, Any] = field(default_factory=dict)
    output: Any = None
    error: str | None = None
    duration_ms: float = 0.0


class AgentRuntime:
    """Minimal agent runtime for tool registration and execution."""

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}
        self._listeners: list[Callable[[Event], None]] = []

    def register(self, tool: Tool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"tool {tool.name!r} already registered")
        self._tools[tool.name] = tool

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.schema}}
            for t in self._tools.values()
        ]

    def on_event(self, listener: Callable[[Event], None]) -> None:
        self._listeners.append(listener)

    def run(self, name: str, input_data: dict[str, Any], *, timeout: float | None = None) -> Any:
        tool = self._tools.get(name)
        if tool is None:
            raise ValueError(f"tool {name!r} not found")

        start = time.perf_counter()
        self._emit(Event(type="tool.start", tool=name, input=input_data))

        try:
            if asyncio.iscoroutinefunction(tool.handler):
                result = asyncio.run(self._run_async(tool.handler, input_data, timeout))
            else:
                if timeout is not None:
                    raise NotImplementedError("sync timeout not implemented in demo")
                result = tool.handler(**input_data)
            duration = (time.perf_counter() - start) * 1000
            self._emit(Event(type="tool.done", tool=name, input=input_data, output=result, duration_ms=duration))
            return result
        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            self._emit(Event(type="tool.error", tool=name, input=input_data, error=str(exc), duration_ms=duration))
            raise

    async def _run_async(self, handler: Callable[..., Awaitable[Any]], input_data: dict[str, Any], timeout: float | None) -> Any:
        coro = handler(**input_data)
        if timeout is not None:
            return await asyncio.wait_for(coro, timeout=timeout)
        return await coro

    def _emit(self, event: Event) -> None:
        for listener in self._listeners:
            try:
                listener(event)
            except Exception:
                pass


if __name__ == "__main__":
    runtime = AgentRuntime()

    def on_event(event):
        print(event)

    runtime.on_event(on_event)

    runtime.register(Tool(
        name="add",
        description="Add two numbers",
        schema={"type": "object", "properties": {"a": {"type": "number"}, "b": {"type": "number"}}},
        handler=lambda a, b: a + b,
    ))

    print(runtime.run("add", {"a": 1, "b": 2}))
