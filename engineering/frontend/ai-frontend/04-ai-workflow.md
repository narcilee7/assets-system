# AI 工作流

## 1. Agent 模式

```typescript
// Agent = LLM + 工具 + 记忆 + 规划

interface AgentConfig {
  model: LanguageModel;
  tools: Record<string, Tool>;
  maxSteps: number;
  systemPrompt: string;
}

interface AgentStep {
  index: number;
  thought: string;
  action: string;
  observation: string;
}

class Agent {
  private model: LanguageModel;
  private tools: Record<string, Tool>;
  private maxSteps: number;
  private systemPrompt: string;
  private history: Message[] = [];

  constructor(config: AgentConfig) {
    this.model = config.model;
    this.tools = config.tools;
    this.maxSteps = config.maxSteps;
    this.systemPrompt = config.systemPrompt;
  }

  async run(task: string): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    let currentTask = task;

    for (let step = 0; step < this.maxSteps; step++) {
      // 构建提示
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.history,
        { role: 'user', content: this.buildPrompt(currentTask, steps) },
      ];

      // 调用模型
      const response = await generateText({
        model: this.model,
        messages,
      });

      // 解析 Thought-Action-Observation
      const parsed = this.parseResponse(response.text);

      if (parsed.action === 'FINISH') {
        return {
          result: parsed.thought,
          steps,
          toolCalls: steps.filter((s) => s.action !== 'THINK'),
        };
      }

      // 执行工具
      if (parsed.action.startsWith('TOOL:')) {
        const toolName = parsed.action.replace('TOOL:', '').trim();
        const tool = this.tools[toolName];

        if (!tool) {
          steps.push({
            index: step,
            thought: parsed.thought,
            action: parsed.action,
            observation: `Error: Tool ${toolName} not found`,
          });
          continue;
        }

        const observation = await tool.execute(parsed.parameters);
        steps.push({
          index: step,
          thought: parsed.thought,
          action: parsed.action,
          observation: JSON.stringify(observation),
        });

        currentTask = `Observation: ${JSON.stringify(observation)}\nContinue with the task.`;
      }
    }

    return {
      result: 'Max steps reached',
      steps,
      toolCalls: steps.filter((s) => s.action !== 'THINK'),
    };
  }

  private buildPrompt(task: string, steps: AgentStep[]): string {
    let prompt = `Task: ${task}\n\n`;

    if (steps.length > 0) {
      prompt += 'Previous steps:\n';
      for (const step of steps) {
        prompt += `Step ${step.index}: ${step.thought}\n`;
        prompt += `Action: ${step.action}\n`;
        prompt += `Observation: ${step.observation}\n\n`;
      }
    }

    prompt += `Available tools: ${Object.keys(this.tools).join(', ')}\n`;
    prompt += 'Think step by step. Use TOOL:tool_name to call a tool, or FINISH to complete.\n';

    return prompt;
  }

  private parseResponse(text: string) {
    const lines = text.split('\n');
    const thought = lines.find((l) => l.startsWith('Thought:'))?.replace('Thought:', '').trim() || '';
    const action = lines.find((l) => l.startsWith('Action:'))?.replace('Action:', '').trim() || 'THINK';
    const parameters = lines.find((l) => l.startsWith('Parameters:'))?.replace('Parameters:', '').trim() || '{}';

    return { thought, action, parameters: JSON.parse(parameters) };
  }
}
```

## 2. Tool Calling 协议

```typescript
// 标准化的 Tool Calling 接口

interface Tool<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: TParams) => Promise<TResult> | TResult;
}

// 前端工具注册表
class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getSchema(): Record<string, unknown> {
    const schema: Record<string, unknown> = {};
    for (const [name, tool] of this.tools) {
      schema[name] = {
        description: tool.description,
        parameters: tool.parameters,
      };
    }
    return schema;
  }

  async execute(name: string, params: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.execute(params);
  }
}

// 常用前端工具
const tools = new ToolRegistry();

tools.register({
  name: 'getCurrentTime',
  description: '获取当前时间',
  parameters: {
    type: 'object',
    properties: {
      timezone: { type: 'string', description: '时区' },
    },
  },
  execute: ({ timezone = 'UTC' }) => {
    return { time: new Date().toISOString(), timezone };
  },
});

tools.register({
  name: 'searchLocalStorage',
  description: '搜索 localStorage 中的数据',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string' },
    },
    required: ['key'],
  },
  execute: ({ key }) => {
    const value = localStorage.getItem(key);
    return { key, value, exists: value !== null };
  },
});

tools.register({
  name: 'navigateTo',
  description: '导航到指定页面',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '页面路径' },
    },
    required: ['path'],
  },
  execute: ({ path }) => {
    window.location.href = path;
    return { success: true, path };
  },
});

tools.register({
  name: 'showNotification',
  description: '显示浏览器通知',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['title', 'body'],
  },
  execute: async ({ title, body }) => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification(title, { body });
      return { success: true };
    }
    return { success: false, reason: 'Permission denied' };
  },
});
```

## 3. 多轮对话状态管理

```typescript
// 对话状态机

interface ConversationState {
  id: string;
  messages: Message[];
  context: {
    userPreferences: Record<string, unknown>;
    sessionData: Record<string, unknown>;
    toolResults: Record<string, unknown>[];
  };
  status: 'idle' | 'streaming' | 'tool-calling' | 'error';
}

class ConversationManager {
  private conversations = new Map<string, ConversationState>();
  private maxContextLength = 20;  // 保留最近 20 条消息

  createConversation(id: string): ConversationState {
    const state: ConversationState = {
      id,
      messages: [],
      context: {
        userPreferences: {},
        sessionData: {},
        toolResults: [],
      },
      status: 'idle',
    };
    this.conversations.set(id, state);
    return state;
  }

  addMessage(conversationId: string, message: Message) {
    const state = this.conversations.get(conversationId);
    if (!state) throw new Error('Conversation not found');

    state.messages.push(message);

    // 上下文压缩
    if (state.messages.length > this.maxContextLength) {
      state.messages = this.compressContext(state.messages);
    }
  }

  private compressContext(messages: Message[]): Message[] {
    // 保留系统消息、最近的用户-助手对，压缩早期的对话
    const systemMessages = messages.filter((m) => m.role === 'system');
    const recentPairs = messages.slice(-this.maxContextLength + systemMessages.length);

    // 对更早的消息生成摘要（可选）
    // const summary = await this.summarizeMessages(olderMessages);

    return [...systemMessages, ...recentPairs];
  }

  async summarizeMessages(messages: Message[]): Promise<Message> {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Summarize the following conversation:\n${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}`,
    });

    return { role: 'system', content: `Previous conversation summary: ${text}` };
  }

  getMessages(conversationId: string): Message[] {
    return this.conversations.get(conversationId)?.messages || [];
  }

  updateContext(conversationId: string, updates: Partial<ConversationState['context']>) {
    const state = this.conversations.get(conversationId);
    if (state) {
      Object.assign(state.context, updates);
    }
  }

  setStatus(conversationId: string, status: ConversationState['status']) {
    const state = this.conversations.get(conversationId);
    if (state) state.status = status;
  }
}

// React Context 集成
const ConversationContext = createContext<{
  manager: ConversationManager;
  state: ConversationState | null;
} | null>(null);

export function ConversationProvider({ children, conversationId }: { children: React.ReactNode; conversationId: string }) {
  const [manager] = useState(() => new ConversationManager());
  const [state, setState] = useState<ConversationState | null>(null);

  useEffect(() => {
    const conv = manager.createConversation(conversationId);
    setState(conv);
  }, [conversationId]);

  return (
    <ConversationContext.Provider value={{ manager, state }}>
      {children}
    </ConversationContext.Provider>
  );
}
```
