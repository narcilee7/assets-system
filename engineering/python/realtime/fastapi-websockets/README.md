# Python WebSockets

FastAPI 内置 WebSocket 支持，配合 asyncio 实现高性能实时通信。

## 核心实现

```python
# websocket_server.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)
    
    def disconnect(self, websocket: WebSocket, room: str):
        self.active_connections[room].remove(websocket)
    
    async def broadcast(self, room: str, message: dict):
        if room in self.active_connections:
            disconnected = []
            for conn in self.active_connections[room]:
                try:
                    await conn.send_json(message)
                except Exception:
                    disconnected.append(conn)
            for conn in disconnected:
                self.disconnect(conn, room)

manager = ConnectionManager()

@app.websocket("/ws/{room}")
async def websocket_endpoint(websocket: WebSocket, room: str):
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(room, {
                "room": room,
                "message": data,
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
```

## WebSocket + Redis Pub/Sub

```python
# redis_pubsub.py
import asyncio
import aioredis
from fastapi import FastAPI, WebSocket

redis = aioredis.from_url("redis://localhost")
app = FastAPI()

async def pubsub_listener(channel: str, websocket: WebSocket):
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    async for message in pubsub.listen():
        if message["type"] == "message":
            await websocket.send_text(message["data"])

@app.websocket("/ws/chat/{channel}")
async def chat_ws(websocket: WebSocket, channel: str):
    await websocket.accept()
    listener = asyncio.create_task(pubsub_listener(channel, websocket))
    try:
        while True:
            data = await websocket.receive_text()
            await redis.publish(channel, data)
    finally:
        listener.cancel()
```
