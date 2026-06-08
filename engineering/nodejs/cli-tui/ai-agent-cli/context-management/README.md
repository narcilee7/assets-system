# AI Agent CLI: Context Management

AI Agent 的上下文管理决定了它能记住多少、理解多深、执行多准。

## 上下文层级

```
System Prompt（最高优先级，始终保留）
    |
    v
Long-term Memory（用户偏好、项目知识）
    |
    v
Conversation History（当前对话）
    |
    v
Working Memory（工具执行结果、中间推理）
    |
    v
Retrieved Documents（RAG 检索结果）
```

## 系统提示词工程

```ts
// system-prompt.ts
interface SystemPromptConfig {
  name: string;
  capabilities: string[];
  constraints: string[];
  outputFormat?: string;
  tone?: string;
}

export function buildSystemPrompt(config: SystemPromptConfig): string {
  return `You are ${config.name}, an AI assistant.

Capabilities:
${config.capabilities.map((c) => `- ${c}`).join('\n')}

Constraints:
${config.constraints.map((c) => `- ${c}`).join('\n')}

${config.outputFormat ? `Output Format:\n${config.outputFormat}\n` : ''}
${config.tone ? `Tone: ${config.tone}\n` : ''}

When you need to use a tool, respond with a tool call in the following format:
<tool_call>
{"name": "tool_name", "arguments": {"arg1": "value1"}}
</tool_call>

Always think step by step before taking action.`;
}

// 使用
const prompt = buildSystemPrompt({
  name: 'DevOps Assistant',
  capabilities: [
    'Deploy applications to Kubernetes',
    'Analyze logs and metrics',
    'Run shell commands in safe mode',
  ],
  constraints: [
    'Never execute destructive commands without confirmation',
    'Always explain your reasoning',
    'Prefer read-only operations unless explicitly authorized',
  ],
  outputFormat: 'Use Markdown. Code blocks must specify language.',
  tone: 'Professional and concise',
});
```

## 长期记忆（向量存储）

```ts
// long-term-memory.ts
interface MemoryEntry {
  id: string;
  content: string;
  embedding: number[];
  category: 'preference' | 'fact' | 'project' | 'conversation';
  timestamp: Date;
}

export class LongTermMemory {
  constructor(private vectorStore: any) {}

  async remember(content: string, category: MemoryEntry['category']) {
    const embedding = await this.embed(content);
    await this.vectorStore.upsert({
      id: crypto.randomUUID(),
      content,
      embedding,
      category,
      timestamp: new Date(),
    });
  }

  async recall(query: string, topK: number = 5): Promise<MemoryEntry[]> {
    const embedding = await this.embed(query);
    return this.vectorStore.similaritySearch(embedding, topK);
  }

  private async embed(text: string): Promise<number[]> {
    // 调用 embedding API
    return [];
  }
}
```

## 工作记忆（当前任务状态）

```ts
// working-memory.ts
interface WorkingMemory {
  currentGoal: string;
  steps: Array<{
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: any;
  }>;
  facts: Record<string, any>;
  pendingQuestions: string[];
}

export class WorkingMemoryManager {
  private memory: WorkingMemory = {
    currentGoal: '',
    steps: [],
    facts: {},
    pendingQuestions: [],
  };

  setGoal(goal: string) {
    this.memory.currentGoal = goal;
  }

  addStep(description: string) {
    this.memory.steps.push({ description, status: 'pending' });
  }

  updateStep(index: number, status: WorkingMemory['steps'][0]['status'], result?: any) {
    if (this.memory.steps[index]) {
      this.memory.steps[index].status = status;
      if (result !== undefined) this.memory.steps[index].result = result;
    }
  }

  addFact(key: string, value: any) {
    this.memory.facts[key] = value;
  }

  toPrompt(): string {
    return `Current Goal: ${this.memory.currentGoal}
Progress:
${this.memory.steps.map((s, i) => `${i + 1}. [${s.status}] ${s.description}`).join('\n')}
Known Facts:
${Object.entries(this.memory.facts).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}`;
  }
}
```

## RAG 上下文注入

```ts
// rag-context.ts
export async function buildContextWithRAG(
  userQuery: string,
  longTermMemory: LongTermMemory,
  documentStore: any,
): Promise<string> {
  const [memories, documents] = await Promise.all([
    longTermMemory.recall(userQuery, 3),
    documentStore.search(userQuery, 5),
  ]);

  const parts: string[] = [];

  if (memories.length) {
    parts.push('## Relevant Memories\n' + memories.map((m) => `- ${m.content}`).join('\n'));
  }

  if (documents.length) {
    parts.push('## Relevant Documents\n' + documents.map((d: any) => `- ${d.content}`).join('\n'));
  }

  return parts.join('\n\n');
}
```

## 动态 Token 预算分配

```ts
// token-budget.ts
export function allocateContextBudget(
  maxTokens: number,
  components: {
    systemPrompt: string;
    memories?: string;
    documents?: string;
    history?: string;
    workingMemory?: string;
  },
): string {
  const budgets = {
    systemPrompt: Math.floor(maxTokens * 0.1),
    memories: Math.floor(maxTokens * 0.1),
    documents: Math.floor(maxTokens * 0.3),
    workingMemory: Math.floor(maxTokens * 0.1),
    history: Math.floor(maxTokens * 0.4),
  };

  const parts: string[] = [];
  parts.push(truncate(components.systemPrompt, budgets.systemPrompt));
  if (components.memories) parts.push(truncate(components.memories, budgets.memories));
  if (components.documents) parts.push(truncate(components.documents, budgets.documents));
  if (components.workingMemory) parts.push(truncate(components.workingMemory, budgets.workingMemory));
  if (components.history) parts.push(truncate(components.history, budgets.history));

  return parts.filter(Boolean).join('\n\n');
}

function truncate(text: string, tokens: number): string {
  // 简化实现
  const chars = tokens * 4;
  return text.length > chars ? text.slice(0, chars) + '...' : text;
}
```
