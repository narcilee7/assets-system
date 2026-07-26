# ReAct

## ReAct深度解析

ReAct = Reasoning（推理）+ Acting（行动）的交替循环。LLM 在每一步先输出内部思考（Thought），再基于思考输出对外行动（Action），行动由外部工具执行后返回观察（Observation），LLM 根据 Observation 修正下一步推理，直到达成目标。

## ReAct vs CoT

| 维度        | CoT（Chain-of-Thought） | ReAct               |
| --------- | --------------------- | ------------------- |
| **核心能力**  | 纯推理，不接触外部世界           | 推理 + 行动，与外部世界交互     |
| **信息来源**  | 仅依赖预训练知识和 Prompt 上下文  | 可实时查询 API、数据库、搜索引擎  |
| **适用场景**  | 数学推理、逻辑谜题、文本分析        | 需要实时数据、多步工具调用的任务    |
| **幻觉风险**  | 高（编造事实）               | 低（Observation 约束推理） |
| **延迟/成本** | 低（单次推理）               | 高（多轮 LLM 调用 + 工具执行） |
| **终止条件**  | 输出即结束                 | 需显式判断任务完成或达到最大步数    |

## 工作实现细节

### Prompt Design

```plain
你是一名智能助手，可以调用以下工具：
{tools_description}

请按照以下格式思考并行动：
Thought: 你的思考过程
Action: 工具名称
Action Input: 工具参数（JSON格式）

外部工具执行后会返回 Observation，你可以继续思考或给出最终答案。

开始！
Question: {user_input}
```

### Parser

LLM输出的是纯文本，需要解析出`Thought`、`Action`和`Action Input`

```python
def parse_react_output(text: str) -> dict:
    thought = extract(text, "Thought:")
    action = extract(text, "Action:")
    action_input = extract(text, "Action Input:")
    return {
        "thought": thought,
        "action": action,
        "action_input": json.loads(action_input)
    }
```

面试点：如果 LLM 输出格式错乱（比如忘了写 Action:，或者 Action Input 不是合法 JSON），怎么处理？
容错策略：正则提取 + 失败时回退到提示重试
更优方案：用 Function Calling / Tool Calling 替代文本解析，直接让 LLM 输出结构化 JSON

### Executor

```python
def execute_action(action: str, action_input: dict) -> str:
    tool = tool_registry.get(action)
    if not tool:
        return f"Error: unknown action {action}"
    try:
        result = tool.run(**action_input)
        return result
    except Exception as e:
        return f"Error: {str(e)}"
```

### 终止条件

ReAct 循环必须在以下情况终止：
1. 显式完成：LLM 输出 Action: finish 或 Final Answer
2. 最大步数限制：防止死循环（如 max_turns=10）
3. 不可恢复错误：连续 3 次解析失败，或工具连续报错

## 比较麻烦的问题

### ReAct死循环

原因：
- LLM 的 Thought 质量不高，反复输出相同的 Action
- Observation 没有提供有效信息，LLM 无法推进
- 任务本身不可解，但 LLM 不知道放弃
解法：
- 最大步数限制：硬兜底
- 重复检测：记录历史 Action，如果连续 2 次相同，强制终止或提示 LLM 换思路
- 反思机制（Self-Reflection）：在 Thought 中加入"我之前的尝试没有成功，让我换个角度"
- Plan-and-Execute 混合：复杂任务先全局规划，再按步骤执行，减少盲目试错

### Observation too long, how to handle?

解法：
1. 截断：保留前 N 个字符，标注"内容已截断"
2. 摘要：用另一个 LLM 调用或规则提取关键信息
3. 分块检索：如果是文档，先嵌入向量库，再 RAG 检索相关片段
4. 结构化过滤：要求工具返回时按字段过滤，只取必要字段

### ReAct vs Plan-and-Execute

| 维度        | ReAct                   | Plan-and-Execute                   |
| --------- | ----------------------- | ---------------------------------- |
| **规划方式**  | 每步即时规划（局部最优）            | 先全局规划，再逐步执行                        |
| **灵活性**   | 高，能根据 Observation 动态调整  | 低，计划一旦生成较难修改                       |
| **适用任务**  | 探索性、信息不确定的任务            | 确定性、步骤明确的任务                        |
| **上下文长度** | 随步数线性增长                 | 计划阶段一次消耗较多 Token                   |
| **典型框架**  | LangChain ReAct、AutoGPT | LangChain Plan-and-Execute、BabyAGI |

### ReAct context too long, how to handle?

每轮循环都要把 Thought + Action + Observation 塞进上下文，10 轮后上下文可能爆炸。
解法：
1. 摘要压缩：每 N 轮对历史对话做摘要，只保留关键结论
2. 滑动窗口：只保留最近 K 轮，丢弃早期内容
3. 关键事件保留：工具调用结果、错误、最终结论永久保留，中间推理过程可丢弃
4. 外部记忆：把历史写入数据库/向量库，需要时 RAG 检索

### 如果不用LangChain，自研ReAct的核心模块

```plain
┌─────────────────────────────────────┐
│           ReAct Engine                │
├─────────────────────────────────────┤
│ 1. Prompt Builder（构建 System + Few-shot + 当前上下文） │
│ 2. LLM Caller（调用模型，流式/非流式）              │
│ 3. Output Parser（解析 Thought/Action/Observation） │
│ 4. Tool Registry（工具注册与发现）                │
│ 5. Tool Executor（工具执行，含超时/错误处理）        │
│ 6. Loop Controller（循环控制，终止判断）            │
│ 7. Memory Manager（历史记录与压缩）               │
│ 8. Callback/Hook（可插拔扩展点）                │
└─────────────────────────────────────┘
```
