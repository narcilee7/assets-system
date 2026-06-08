# Python FastAPI LLM Gateway

Python 是 AI 后端的首选语言，FastAPI + asyncio 实现高性能 LLM Gateway。

## SSE 流式网关

```python
# llm_gateway.py
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import httpx
import json
import os

app = FastAPI()
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

async def stream_chat(messages: list[dict]):
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
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
                        if "content" in delta:
                            yield f"data: {json.dumps({'token': delta['content']})}\n\n"
                    except Exception:
                        continue

@app.post("/chat")
async def chat(request: ChatRequest):
    return StreamingResponse(
        stream_chat(request.messages),
        media_type="text/event-stream",
    )
```

## Tool Runtime

```python
# tool_runtime.py
from typing import Callable, Awaitable, Any
from dataclasses import dataclass
import asyncio
import inspect

@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    handler: Callable[..., Awaitable[Any]]
    timeout: float = 30.0

class ToolRegistry:
    def __init__(self):
        self.tools: dict[str, Tool] = {}
    
    def register(self, tool: Tool):
        self.tools[tool.name] = tool
    
    async def execute(self, name: str, args: dict) -> Any:
        if name not in self.tools:
            raise ValueError(f"Tool {name} not found")
        
        tool = self.tools[name]
        
        # 类型检查
        sig = inspect.signature(tool.handler)
        for param_name in sig.parameters:
            if param_name in args:
                param = sig.parameters[param_name]
                if param.annotation != inspect.Parameter.empty:
                    args[param_name] = param.annotation(args[param_name])
        
        return await asyncio.wait_for(tool.handler(**args), timeout=tool.timeout)
    
    def list_tools(self) -> list[dict]:
        return [{
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            }
        } for t in self.tools.values()]
```
