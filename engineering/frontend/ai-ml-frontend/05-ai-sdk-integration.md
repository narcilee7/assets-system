# AI SDK 集成

## 1. OpenAI SDK 流式调用

```typescript
// 基础流式调用
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,  // 浏览器环境需要
});

async function streamChat() {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      appendToUI(content);  // 逐字追加到 UI
    }
  }
}

// SSE 原生实现（不依赖 SDK）
async function streamWithFetch(messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      stream: true,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) appendToUI(content);
        } catch { /* ignore */ }
      }
    }
  }
}
```

## 2. 函数调用（Function Calling）

```typescript
// 定义工具
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: '搜索商品',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['query'],
      },
    },
  },
];

// 工具执行器
const toolExecutors = {
  async get_weather(args: { city: string; unit?: string }) {
    const res = await fetch(`/api/weather?city=${args.city}&unit=${args.unit || 'celsius'}`);
    return res.json();
  },

  async search_products(args: { query: string; category?: string }) {
    const res = await fetch(`/api/products?query=${args.query}`);
    return res.json();
  },
};

// 对话循环
async function chatWithTools(messages: any[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools,
    tool_choice: 'auto',
  });

  const choice = response.choices[0];

  // 如果需要调用工具
  if (choice.finish_reason === 'tool_calls') {
    const toolCall = choice.message.tool_calls[0];
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    // 执行工具
    const result = await toolExecutors[functionName](args);

    // 将结果返回给 LLM
    messages.push(choice.message);  // assistant 的工具调用请求
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    });

    // 递归调用，让 LLM 生成最终回答
    return chatWithTools(messages);
  }

  return choice.message.content;
}
```

## 3. 多模型抽象层

```typescript
// 统一接口，支持多个 provider
interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  streamChat(messages: Message[], options?: ChatOptions): AsyncIterable<ChatChunk>;
}

class OpenAIProvider implements LLMProvider {
  constructor(private client: OpenAI, private model: string) {}

  async chat(messages, options) {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });
    return { content: res.choices[0].message.content };
  }

  async *streamChat(messages, options) {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
      ...options,
    });

    for await (const chunk of stream) {
      yield { content: chunk.choices[0]?.delta?.content || '' };
    }
  }
}

class AnthropicProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string) {}

  async *streamChat(messages, options) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.filter((m) => m.role !== 'system'),
        system: messages.find((m) => m.role === 'system')?.content,
        max_tokens: options?.maxTokens || 1024,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              yield { content: parsed.delta.text };
            }
          } catch { /* ignore */ }
        }
      }
    }
  }
}

// 使用
const provider = new OpenAIProvider(openai, 'gpt-4o-mini');
// const provider = new AnthropicProvider(apiKey, 'claude-3-sonnet');

for await (const chunk of provider.streamChat(messages)) {
  appendToUI(chunk.content);
}
```

## 4. 流式 UI 组件

```tsx
// React 流式聊天组件
function StreamingChat({ provider }: { provider: LLMProvider }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    const assistantMessage: Message = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const stream = provider.streamChat([...messages, userMessage]);
      let fullContent = '';

      for await (const chunk of stream) {
        fullContent += chunk.content;
        setStreamingContent(fullContent);

        // 更新最后一条消息
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: fullContent,
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="content">{msg.content}</div>
            {msg.role === 'assistant' && i === messages.length - 1 && isStreaming && (
              <span className="cursor">▊</span>
            )}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          disabled={isStreaming}
        />
        <button onClick={sendMessage} disabled={isStreaming}>
          {isStreaming ? '生成中...' : '发送'}
        </button>
      </div>
    </div>
  );
}
```
