# Streaming UI 面试深度问答

## 核心概念地图

1. **Event Stream**：后端向前端推送结构化事件的流，是 AI 应用的核心数据载体。
2. **SSE**：Server-Sent Events，基于 HTTP，适合单向服务端推送。
3. **Delta**：模型生成的增量文本片段，需要前端拼接渲染。
4. **Cancel**：用户主动停止生成，需要前后端协同中断。
5. **Reconnection**：网络断开后恢复，并继续接收后续事件。
6. **State Synchronization**：前端 UI 状态与后端事件流保持一致。

## 架构与数据流

```text
Backend Agent Runtime
  → Event Stream (AIEvent)
    → SSE Transport
      → Frontend Event Parser
        → State Manager
          → React/Vue Component Render
            → User sees incremental message + tool status
```

事件类型示例：

```text
session.started
plan.created
step.started
tool.call.requested
tool.call.completed
tool.call.failed
message.delta
message.completed
session.completed
session.failed
```

## 关键设计决策

### 1. 用 SSE 还是 WebSocket？

| 维度 | SSE | WebSocket |
| --- | --- | --- |
| 方向 | 服务端单向推送 | 双向 |
| 协议 | HTTP，易穿透防火墙 | 单独协议 |
| 重连 | 原生支持 last-event-id | 需自己实现 |
| 二进制 | 不支持 | 支持 |
| 适用 | AI 流式输出 | 实时协作、游戏 |

**结论**：AI 应用以服务端推送为主，SSE 更简单；需要双向交互时可混合使用。

### 2. Token delta 和结构化事件如何共存？

- 用统一事件信封：`{ type, payload, timestamp }`。
- `message.delta` 的 payload 是文本片段。
- `tool.call.completed` 的 payload 是工具结果。
- 前端根据 type 分发到不同 UI 组件。

### 3. 取消语义怎么设计？

- 前端触发 `AbortController.abort()`，关闭 SSE 连接。
- 后端检测到连接关闭后，取消正在进行的模型调用和工具执行。
- 已生成的内容保留，未生成的内容停止。
- 取消也是一次事件：`session.cancelled`。

### 4. 断线重连怎么做？

- SSE 原生支持 `Last-Event-ID` header。
- 前端记录最后收到的事件 ID，重连时带上。
- 后端根据 last-event-id 从事件缓存中补发后续事件。
- 事件缓存需要有时效和容量限制。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| 连接断开 | 网络波动 | 自动重连，补发 missed events |
| 事件乱序 | 网络或重连导致 | 事件带全局单调 ID 或 timestamp，前端排序 |
| 前端状态丢失 | 页面刷新 | 通过 session API 拉取完整状态快照 |
| 后端事件丢失 | 缓存不足 | 设置合理缓存窗口；超窗口则返回完整快照 |
| 取消不及时 | 模型调用无法中断 | 支持 stream abort 或设置超时 |
| UI 渲染卡顿 | 高频 delta | 节流渲染、虚拟列表 |
| 事件消费延迟 | 前端处理慢 | 批量处理事件，减少重渲染 |

## 面试题与应答脚本

### Q1：AI 应用为什么首选 SSE 而不是 WebSocket？

**答**：
- AI 应用主要是服务端向客户端单向推送流式文本和事件。
- SSE 基于 HTTP，更易穿透防火墙、CDN、负载均衡。
- SSE 原生支持自动重连和 last-event-id。
- WebSocket 更适合高频双向实时场景，复杂度和资源消耗更高。

**追问**：
- 什么时候必须用 WebSocket？（需要客户端主动向服务端发送消息且保持低延迟，如协同编辑、实时游戏。）
- SSE 连接数过多怎么办？（连接保持时间短；或用 HTTP/2 多路复用；必要时切 WebSocket。）

### Q2：如何处理 message.delta 的高频渲染？

**答**：
- 后端按 token 发送 delta，前端批量接收后节流渲染（如 16ms 一帧）。
- 使用 requestAnimationFrame 平滑更新。
- 对 Markdown 渲染要增量解析，避免全量 re-render。
- 长消息使用虚拟滚动，避免 DOM 过大。

**追问**：
- 节流会不会让用户感觉卡顿？（16ms 约 60fps，用户感知不到；若 token 极快可降到 30fps。）
- Markdown 代码块怎么增量渲染？（等代码块闭合后再一次性高亮，中间只显示纯文本。）

### Q3：用户点击停止后，后端如何真正中断？

**答**：
- 前端关闭 SSE 连接或发送 cancel 请求。
- 后端监听连接 close 事件，传播 cancel 信号。
- 模型调用如果支持 stream abort，立即终止；如果不支持，设置 abandon 标志，忽略后续输出。
- 工具执行同样支持 cancel；无法取消的副作用工具需要状态查询。

**追问**：
- 如果模型调用已经产生 token 但未发送，怎么处理？（丢弃，因为用户已取消。）
- 取消后用户再次提问，是新建 session 还是继续？（通常新建；若支持 continuation 可恢复 checkpoint。）

### Q4：last-event-id 重连机制具体怎么实现？

**答**：
- 后端给每个事件分配递增 ID 或 ULID。
- 前端维护 `lastEventId`，重连时通过 HTTP header `Last-Event-ID` 发送。
- 后端维护近期事件缓存（如最近 1000 条或 5 分钟）。
- 若 last-event-id 仍在缓存内，从该 ID 后补发；否则发送完整状态快照。

**追问**：
- 缓存存在哪里？（Redis、内存 + 持久化，视规模和可靠性要求。）
- 如果事件 ID 不连续怎么办？（用时间戳排序，或保证 ID 单调递增。）

### Q5：工具调用状态怎么在 UI 上展示？

**答**：
- 把 tool call 生命周期映射为 UI 状态：pending → running → completed / failed。
- 在消息流中插入「工具卡片」，显示工具名、参数、执行结果。
- 对耗时工具显示 spinner 和预计时间。
- 失败时展示错误信息和重试按钮。

**追问**：
- 多个 tool 并行执行怎么展示？（每个工具独立卡片，状态分别更新。）
- 用户能不能折叠工具卡片？（可以；但首次应默认展开以建立信任。）

### Q6：前端状态和后端事件不一致怎么办？

**答**：
- 前端状态是后端事件流的函数：UI State = f(events)。
- 避免前端本地 optimistic 状态与后端事件冲突；若必须 optimistic，后端事件到达后 merge。
- 页面刷新后从后端拉取完整 session 状态快照。
- 关键操作（如用户确认工具）等待后端确认后再更新 UI。

**追问**：
- 如果用户快速点击多次确认怎么办？（前端 debounce，后端幂等。）
- 后端事件延迟到达怎么办？（事件带 timestamp，按顺序应用；超时可显示 pending 状态。）

### Q7：SSE 的事件格式怎么设计？

**答**：
- 每个 SSE event 包含 `event` 字段（类型）和 `data` 字段（JSON payload）。
- payload 统一结构：`{ id, sessionId, type, payload, timestamp }`。
- 避免在 data 里混合格式；所有业务数据都放 payload。
- 对需要保留的元数据可放 `id` 和 `retry` 字段。

**追问**：
- 一个 SSE event 能不能包含多个业务事件？（可以，用 batch 模式批量推送，减少 IO。）
- 数据里有换行怎么办？（SSE 规范要求 data 字段每行以 `data: ` 开头；库会自动处理。）

### Q8：移动端弱网环境下怎么优化？

**答**：
- 缩短心跳间隔，快速发现断线。
- 事件缓存 + last-event-id 保证不丢。
- 前端显示连接状态和重连进度。
- 对长连接使用 HTTP/2 或 QUIC。
- 允许用户手动刷新拉取快照。

**追问**：
- 心跳会不会增加功耗？（可以动态调整：网络好时心跳长，弱网时心跳短。）
- 应用切到后台再回来怎么处理？（重新连接并拉取 missed events。）

### Q9：如何实现事件回放？

**答**：
- 持久化所有事件到数据库或日志系统。
- 回放时按时间顺序重放事件，重建前端状态。
- 对敏感事件做脱敏。
- 回放速度可调，便于调试。

**追问**：
- 回放和实时流的区别？（实时流是推，回放是拉；回放可以跳过或加速。）
- 事件版本变更后怎么回放？（事件 schema 要向前兼容，或做 migration。）

### Q10：如何保证 SSE 的安全性？

**答**：
- SSE 连接需要认证（cookie / token）。
- 用户只能订阅自己的 session 事件。
- 对敏感 payload 脱敏或加密。
- 防止 SSE 被滥用：限制每个用户的连接数、连接时长。
- 日志中不要记录完整 prompt 和 completion。

**追问**：
- Token 放在 URL 还是 header？（header 更安全；若必须用 URL，要短期且单次有效。）
- 怎么防止连接被中间人窃听？（强制 HTTPS/WSS。）

## 开放设计题

1. **设计一个支持多人协同的 AI 会话 UI**：多个用户同时和一个 Agent 对话，每个人的输入和 Agent 的回复都要同步。说明事件协议、冲突解决、状态同步策略。

2. **设计一个可回放的 AI 会话调试器**：开发者可以查看某次 session 的完整事件流，点击任意事件查看当时的上下文状态。说明事件存储、索引、回放引擎。

3. **设计一个低延迟的语音 AI 交互流**：用户语音输入 → ASR → LLM → TTS → 播放。说明 SSE/WebSocket 选择、缓冲策略、打断机制。

## 与其他模块的关系

- **Agent Runtime**：Agent 产生事件流；Streaming UI 消费事件流。
- **Tool Calling**：Tool call 的生命周期事件需要在 UI 上展示。
- **Observability**：事件流本身就是 observability 的数据来源。
- **Eval**：UI 层面的 latency、cancel success 也是 eval 指标。
- **Safety**：Human confirmation 通过 Streaming UI 展示确认界面。
- **Memory / RAG**：检索结果和记忆更新可作为事件展示。
