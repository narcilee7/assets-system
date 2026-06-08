# 手写流式响应解析器

## 目标

实现一个简化版流式响应解析器，支持：
1. SSE 格式解析
2. JSON Stream 解析
3. 工具调用流式检测
4. 断点续传

## 实现

```javascript
// streaming-parser.js

class StreamingParser {
  constructor(options = {}) {
    this.format = options.format || 'sse';  // sse | json-stream | raw
    this.onChunk = options.onChunk || (() => {});
    this.onToolCall = options.onToolCall || (() => {});
    this.onDone = options.onDone || (() => {});
    this.onError = options.onError || (() => {});

    this.buffer = '';
    this.toolBuffer = '';
    this.inToolCall = false;
  }

  // ========== 主解析入口 ==========

  parseChunk(chunk) {
    switch (this.format) {
      case 'sse':
        return this.parseSSE(chunk);
      case 'json-stream':
        return this.parseJSONStream(chunk);
      case 'raw':
        return this.parseRaw(chunk);
      default:
        throw new Error(`Unknown format: ${this.format}`);
    }
  }

  // ========== SSE 解析 ==========

  parseSSE(chunk) {
    this.buffer += chunk;

    // SSE 格式：data: {...}\n\n
    const messages = [];
    let boundaryIndex;

    while ((boundaryIndex = this.buffer.indexOf('\n\n')) !== -1) {
      const message = this.buffer.slice(0, boundaryIndex);
      this.buffer = this.buffer.slice(boundaryIndex + 2);

      const parsed = this.parseSSEMessage(message);
      if (parsed) messages.push(parsed);
    }

    return messages;
  }

  parseSSEMessage(raw) {
    const lines = raw.split('\n');
    const result = {};

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          this.onDone();
          return null;
        }
        try {
          Object.assign(result, JSON.parse(data));
        } catch {
          result.raw = data;
        }
      } else if (line.startsWith('id:')) {
        result.id = line.slice(3).trim();
      } else if (line.startsWith('event:')) {
        result.event = line.slice(6).trim();
      }
    }

    // 处理内容
    if (result.content !== undefined) {
      this.onChunk(result.content);
    }

    // 检测工具调用
    this.detectToolCalls(result.content || result.raw || '');

    return result;
  }

  // ========== JSON Stream 解析 ==========

  parseJSONStream(chunk) {
    this.buffer += chunk;
    const results = [];

    // 尝试解析完整 JSON 对象
    while (this.buffer.length > 0) {
      const parsed = this.tryParseJSON(this.buffer);
      if (!parsed) break;

      results.push(parsed.data);
      this.buffer = parsed.remainder;

      if (parsed.data.content !== undefined) {
        this.onChunk(parsed.data.content);
      }
    }

    return results;
  }

  tryParseJSON(buffer) {
    // 查找第一个完整的 JSON 对象
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"' && !inString) {
        inString = true;
        if (start === -1) start = i;
        continue;
      }

      if (char === '"' && inString) {
        inString = false;
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            const jsonStr = buffer.slice(start, i + 1);
            const data = JSON.parse(jsonStr);
            return {
              data,
              remainder: buffer.slice(i + 1).trim(),
            };
          } catch {
            // 不是有效 JSON，继续
          }
        }
      }
    }

    return null;
  }

  // ========== 原始流解析 ==========

  parseRaw(chunk) {
    this.buffer += chunk;

    // 简单策略：按词组输出
    const words = this.extractWords(this.buffer);
    if (words.length > 0) {
      const content = words.join(' ');
      this.buffer = this.buffer.slice(content.length);
      this.onChunk(content);
      return [{ content }];
    }

    return [];
  }

  extractWords(buffer) {
    // 找到完整的词组（以空格/标点结尾）
    const match = buffer.match(/^[\s\S]*?[\s.，。！？!?](?=\S|$)/);
    if (match) {
      return match[0].trim().split(/\s+/);
    }
    return [];
  }

  // ========== 工具调用检测 ==========

  detectToolCalls(content) {
    // 检测工具调用标记：<tool>name</tool> 或 ```tool\n{...}\n```
    const toolPattern = /```tool\n([\s\S]*?)\n```/;
    const match = content.match(toolPattern);

    if (match) {
      try {
        const toolData = JSON.parse(match[1]);
        this.onToolCall(toolData);
        return true;
      } catch {
        // 不是有效 JSON
      }
    }

    // 流式工具调用检测（累积检测）
    this.toolBuffer += content;

    if (this.toolBuffer.includes('<tool_call>')) {
      this.inToolCall = true;
    }

    if (this.inToolCall && this.toolBuffer.includes('</tool_call>')) {
      const toolMatch = this.toolBuffer.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
      if (toolMatch) {
        try {
          const toolData = JSON.parse(toolMatch[1]);
          this.onToolCall(toolData);
          this.toolBuffer = '';
          this.inToolCall = false;
          return true;
        } catch {
          // ignore
        }
      }
    }

    // 防止缓冲区无限增长
    if (this.toolBuffer.length > 10000) {
      this.toolBuffer = this.toolBuffer.slice(-5000);
    }

    return false;
  }

  // ========== 流式消费器 ==========

  static async consumeStream(response, parserOptions) {
    const parser = new StreamingParser(parserOptions);

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        parser.parseChunk(chunk);
      }

      // 处理剩余缓冲区
      if (parser.buffer.trim()) {
        parser.parseChunk(parser.buffer);
      }

      parser.onDone();
    } catch (error) {
      parser.onError(error);
      throw error;
    } finally {
      reader.releaseLock();
    }

    return parser;
  }

  // ========== 断点续传 ==========

  serialize() {
    return {
      buffer: this.buffer,
      toolBuffer: this.toolBuffer,
      inToolCall: this.inToolCall,
      format: this.format,
    };
  }

  restore(state) {
    this.buffer = state.buffer || '';
    this.toolBuffer = state.toolBuffer || '';
    this.inToolCall = state.inToolCall || false;
    this.format = state.format || 'sse';
  }
}

// ========== 使用示例 ==========

const parser = new StreamingParser({
  format: 'sse',
  onChunk: (content) => {
    process.stdout.write(content);
  },
  onToolCall: (tool) => {
    console.log('\n[Tool Call]', tool.name, tool.parameters);
  },
  onDone: () => {
    console.log('\n[Stream Complete]');
  },
});

// 模拟流式输入
const sseChunks = [
  'data: {"content": "Hello"}\n\n',
  'data: {"content": " world"}\n\ndata: {"content": "!"}\n\n',
  'data: {"toolCalls": [{"name": "getWeather", "parameters": {"city": "Beijing"}}]}\n\n',
  'data: [DONE]\n\n',
];

for (const chunk of sseChunks) {
  parser.parseChunk(chunk);
}

module.exports = { StreamingParser };
```
