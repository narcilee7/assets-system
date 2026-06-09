# Python SSE Server

SSE（Server-Sent Events）是单向服务器推送的标准方案。

## FastAPI SSE

```python
# sse_server.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
import json
from datetime import datetime

app = FastAPI()

async def event_stream():
    while True:
        data = {
            "time": datetime.utcnow().isoformat(),
            "price": round(100 + (datetime.utcnow().timestamp() % 10), 2),
        }
        yield f"data: {json.dumps(data)}\n\n"
        await asyncio.sleep(1)

@app.get("/events")
async def events():
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
        },
    )

# AI 流式输出
async def chat_stream(question: str):
    tokens = ["Hello", ",", " how", " can", " I", " help", "?"]
    for token in tokens:
        await asyncio.sleep(0.1)
        yield f"data: {json.dumps({'token': token})}\n\n"
    yield "data: [DONE]\n\n"

@app.get("/chat")
async def chat(question: str):
    return StreamingResponse(
        chat_stream(question),
        media_type="text/event-stream",
    )
```

## 前端连接

```javascript
const evtSource = new EventSource('/events');
evtSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
};
```
