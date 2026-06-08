# Python AI Streaming Gateway

FastAPI + asyncio 实现高性能 AI 流式网关。

## OpenAI SSE 代理

```python
# streaming_gateway.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import httpx
import json
import os

app = FastAPI()

async def stream_openai(messages: list[dict]):
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
            json={
                "model": "gpt-4o",
                "messages": messages,
                "stream": True,
            },
            timeout=60.0,
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        yield "data: [DONE]\n\n"
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"]
                        if "content" in delta and delta["content"]:
                            yield f"data: {json.dumps({'token': delta['content']})}\n\n"
                    except Exception:
                        continue

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    return StreamingResponse(
        stream_openai(request.messages),
        media_type="text/event-stream",
    )

# 多模型路由
async def route_to_model(model: str, messages: list[dict]):
    if model.startswith("gpt"):
        return stream_openai(messages)
    elif model.startswith("claude"):
        return stream_anthropic(messages)
    else:
        raise ValueError(f"Unsupported model: {model}")

# 流式工具调用
async def stream_with_tools(messages: list[dict]):
    async for chunk in stream_openai(messages):
        data = json.loads(chunk[6:])
        if "tool_calls" in data:
            # 执行工具
            result = await execute_tool(data["tool_calls"][0])
            messages.append({"role": "tool", "content": result})
            # 继续流式生成
            async for follow_up in stream_openai(messages):
                yield follow_up
        else:
            yield chunk
```
