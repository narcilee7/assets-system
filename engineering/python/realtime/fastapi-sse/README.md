# Python SSE (Server-Sent Events)

SSE 是单向流式推送的轻量方案，适合股票行情、通知推送等场景。

## 核心实现

```python
# sse_server.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
import json
from datetime import datetime

app = FastAPI()

async def event_generator():
    """生成 SSE 事件流"""
    while True:
        data = {
            "timestamp": datetime.utcnow().isoformat(),
            "price": round(100 + asyncio.get_event_loop().time() % 10, 2),
        }
        yield f"data: {json.dumps(data)}\n\n"
        await asyncio.sleep(1)

@app.get("/events")
async def events():
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

# AI 流式输出
async def chat_stream_generator(question: str):
    # 模拟 LLM 逐 token 输出
    tokens = ["Hello", ",", " this", " is", " Python", " SSE", "."]
    for token in tokens:
        await asyncio.sleep(0.1)
        yield f"data: {json.dumps({'token': token})}\n\n"
    yield "data: [DONE]\n\n"

@app.get("/chat")
async def chat(question: str):
    return StreamingResponse(
        chat_stream_generator(question),
        media_type="text/event-stream",
    )
```
