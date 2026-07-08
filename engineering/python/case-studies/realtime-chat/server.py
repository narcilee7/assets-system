import asyncio
import json
from datetime import datetime

import aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse

app = FastAPI()
redis = aioredis.from_url("redis://localhost:6379")


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []

        self.active_connections[room].append(websocket)

    async def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active_connections:
            self.active_connections[room].remove(websocket)

    async def broadcast(self, room: str, message: dict):
        if room in self.active_connections:
            for conn in self.active_connections[room]:
                try:
                    await conn.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()

REDIS_CHANNEL = "chat:general"


async def redis_listener():
    pubsub = redis.pubsub()
    await pubsub.subscribe(REDIS_CHANNEL)
    async for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            await manager.broadcast(data["room"], data)


@app.on_event("start_up")
async def startup():
    asyncio.create_task(redis_listener())


@app.websocket("/ws/{room}")
async def websocket_endpoont(websocket: WebSocket, room: str):
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            message = {
                "room": room,
                "user": "anonymous",
                "content": data,
                "timestamp": datetime.utcnow().isoformat(),
            }
            await manager.broadcast(room, message)
            await redis.publish(REDIS_CHANNEL, json.dumps(message))
    except WebSocketDisconnect:
        await manager.disconnect(websocket, room)
