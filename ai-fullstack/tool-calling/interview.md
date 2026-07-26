# Tool Call

## 本质

Tool-Call 不是模型在执行工具，而是模型在"请求"执行工具。
模型输出的是结构化调用指令（工具名 + 参数），由外部 Runtime 解析后执行，执行结果再返回给模型。

**核心流程**：
```plain
用户输入 → LLM 生成 → 检测到 tool_calls → 暂停生成 → 
外部执行工具 → 结果包装为 Observation → 重新送入 LLM → 继续生成
```

### 消息输出模式

#### 流派1：OpenAI Function Calling

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"北京\", \"date\": \"2026-07-26\"}"
      }
    }
  ]
}```

特点：
- 原生支持：模型在训练时就学会了这种格式，遵循率高
- 并行调用：一次可输出多个 tool_calls（比如同时查北京和上海天气）
- ID 追踪：每个 call 有唯一 ID，结果需按 ID 返回

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"temperature\": 32, \"condition\": \"晴\"}"
}
```

#### Claude Tool Use

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_abc",
      "name": "get_weather",
      "input": {"location": "北京", "date": "2026-07-26"}
    }
  ]
}
```

## Parser Layer

| 问题           | 现象                              | 解法                                |
| ------------ | ------------------------------- | --------------------------------- |
| **格式错乱**     | 模型忘了加 `tool_calls`，混在 content 里 | 正则兜底 + 提示重试                       |
| **JSON 不合法** | 参数里有未转义引号、多余逗号                  | JSON 修复库（如 `json-repair`）+ 失败时回退  |
| **参数类型错误**   | 要求 number，模型给了 string "32"      | Schema 校验（Zod/Pydantic）+ 自动类型转换尝试 |
| **调用不存在的工具** | 模型 hallucinate 了一个工具名           | 工具注册表白名单校验                        |
| **参数缺失**     | 必填字段没填                          | Schema 校验失败，返回错误让模型重试             |

## 执行层设计

### Tool Registry

```python
# 装饰器注册
@tool(
    name="get_weather",
    description="查询指定城市的天气",
    schema=WeatherSchema
)
def get_weather(location: str, date: str) -> dict:
    return api_client.query(location, date)

# 自动发现（从模块导入）
registry.auto_discover("tools/")
```
2

### 执行隔离

| 隔离级别    | 实现                     | 适用         |
| ------- | ---------------------- | ---------- |
| **进程内** | 直接调用 Python/Node.js 函数 | 内部工具、低延迟   |
| **子进程** | fork 子进程执行             | 代码执行、文件操作  |
| **容器**  | Docker 运行              | 不可信代码、资源隔离 |
| **沙箱**  | Firecracker / gVisor   | 高安全要求      |
