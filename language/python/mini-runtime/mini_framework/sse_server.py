"""
手写 SSE server。

考点：
- Server-Sent Events 协议格式。
- asyncio StreamReader/StreamWriter。
- 心跳保活、客户端断开检测。
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any


@dataclass
class SSEEvent:
    event: str | None = None
    data: str = ""
    id: str | None = None
    retry: int | None = None

    def encode(self) -> bytes:
        lines: list[str] = []
        if self.id is not None:
            lines.append(f"id: {self.id}")
        if self.event is not None:
            lines.append(f"event: {self.event}")
        for line in self.data.splitlines():
            lines.append(f"data: {line}")
        if self.retry is not None:
            lines.append(f"retry: {self.retry}")
        lines.append("")
        lines.append("")
        return "\n".join(lines).encode()


class SSEServer:
    """Minimal asyncio SSE server."""

    def __init__(self, host: str = "127.0.0.1", port: int = 8000) -> None:
        self.host = host
        self.port = port
        self._clients: list[asyncio.StreamWriter] = []
        self._broker = asyncio.Queue[SSEEvent]()

    async def broadcast(self, event: SSEEvent) -> None:
        await self._broker.put(event)

    async def json_event(self, event: str, payload: Any) -> None:
        await self.broadcast(SSEEvent(event=event, data=json.dumps(payload)))

    async def _heartbeat(self) -> None:
        while True:
            await asyncio.sleep(15)
            await self.broadcast(SSEEvent(data=":heartbeat"))

    async def _dispatch(self) -> None:
        while True:
            event = await self._broker.get()
            encoded = event.encode()
            dead: list[asyncio.StreamWriter] = []
            for writer in self._clients:
                try:
                    writer.write(encoded)
                    await writer.drain()
                except ConnectionError:
                    dead.append(writer)
            for writer in dead:
                self._clients.remove(writer)

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        writer.write(b"HTTP/1.1 200 OK\r\n")
        writer.write(b"Content-Type: text/event-stream\r\n")
        writer.write(b"Cache-Control: no-cache\r\n")
        writer.write(b"Connection: keep-alive\r\n")
        writer.write(b"\r\n")
        await writer.drain()
        self._clients.append(writer)

        try:
            while True:
                line = await reader.readline()
                if not line:
                    break
        finally:
            self._clients.remove(writer)
            writer.close()

    async def start(self) -> None:
        server = await asyncio.start_server(self._handle_client, self.host, self.port)
        asyncio.create_task(self._dispatch())
        asyncio.create_task(self._heartbeat())
        async with server:
            await server.serve_forever()


if __name__ == "__main__":
    print(SSEEvent(event="message", data="hello").encode().decode())
    # event: message
    # data: hello
    #
    #
