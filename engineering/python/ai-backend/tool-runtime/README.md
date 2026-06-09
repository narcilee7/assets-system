# Python Tool Runtime

Python 的动态类型和反射能力使其非常适合构建灵活的 AI Tool Runtime。

## 核心实现

```python
# tool_runtime.py
from typing import Callable, Awaitable, Any, get_type_hints
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
    
    def tool(self, name: str = None, description: str = None):
        """装饰器注册工具"""
        def decorator(func: Callable):
            tool_name = name or func.__name__
            sig = inspect.signature(func)
            hints = get_type_hints(func)
            
            # 自动生成参数 schema
            properties = {}
            required = []
            for param_name, param in sig.parameters.items():
                if param_name == 'return':
                    continue
                properties[param_name] = {
                    "type": "string",  # 简化处理
                    "description": f"Parameter {param_name}",
                }
                if param.default == inspect.Parameter.empty:
                    required.append(param_name)
            
            parameters = {
                "type": "object",
                "properties": properties,
                "required": required,
            }
            
            self.register(Tool(
                name=tool_name,
                description=description or func.__doc__ or tool_name,
                parameters=parameters,
                handler=func,
            ))
            return func
        return decorator
    
    async def execute(self, name: str, args: dict) -> Any:
        if name not in self.tools:
            raise ValueError(f"Tool '{name}' not found")
        
        tool = self.tools[name]
        
        # 类型转换
        sig = inspect.signature(tool.handler)
        hints = get_type_hints(tool.handler)
        converted_args = {}
        for param_name, param in sig.parameters.items():
            if param_name in args:
                if param_name in hints:
                    try:
                        converted_args[param_name] = hints[param_name](args[param_name])
                    except (ValueError, TypeError):
                        converted_args[param_name] = args[param_name]
                else:
                    converted_args[param_name] = args[param_name]
        
        return await asyncio.wait_for(tool.handler(**converted_args), timeout=tool.timeout)
    
    def list_tools(self) -> list[dict]:
        return [{
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            }
        } for t in self.tools.values()]

# 使用
registry = ToolRegistry()

@registry.tool(name="get_weather", description="Get weather for a city")
async def get_weather(city: str, unit: str = "celsius") -> dict:
    return {"city": city, "temperature": 22, "unit": unit}

@registry.tool(name="calculate", description="Perform calculation")
async def calculate(expression: str) -> float:
    return eval(expression)  # 注意：生产环境需安全沙箱
```
