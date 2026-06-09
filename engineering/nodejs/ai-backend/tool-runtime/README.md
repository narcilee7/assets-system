# AI Tool Runtime

LLM 通过 `function_calling` / `tool_calls` 请求执行外部工具。Node.js 作为 Tool Runtime 需要处理 schema 校验、权限控制、超时和幂等性。

## 核心设计

```
[LLM] --tool_call--> [Gateway] --execute--> [Tool Registry] --> [Tool Handler]
                                               |
                                               v
                                         [Permission Check]
                                         [Timeout / Retry]
                                         [Result Format]
```

## 核心实现

### 1. Tool Registry

```ts
// tool-registry.ts
import { z, ZodSchema } from 'zod';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodSchema<any>;
  handler: (args: any, ctx: ToolContext) => Promise<any>;
  timeoutMs?: number;
  requiresAuth?: boolean;
  idempotent?: boolean;
}

interface ToolContext {
  userId: string;
  sessionId: string;
  traceId: string;
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  toOpenAIFormat() {
    return this.list().map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: zodToJsonSchema(t.parameters),
      },
    }));
  }
}

function zodToJsonSchema(schema: ZodSchema<any>): any {
  // 简化示例，生产环境使用 zod-to-json-schema 库
  return {};
}

export const registry = new ToolRegistry();
```

### 2. Tool Executor

```ts
// tool-executor.ts
import { registry } from './tool-registry';
import { AppError, Errors } from '../../api-design/error-model/app-error';

export async function executeTool(
  name: string,
  args: any,
  ctx: ToolContext
): Promise<any> {
  const tool = registry.get(name);
  if (!tool) throw Errors.notFound(`Tool ${name}`);

  // 权限校验
  if (tool.requiresAuth && !ctx.userId) {
    throw Errors.unauthorized();
  }

  // 参数校验
  const parsed = tool.parameters.safeParse(args);
  if (!parsed.success) {
    throw Errors.validation({ parameters: parsed.error.issues });
  }

  // 超时控制
  const timeout = tool.timeoutMs || 30000;
  const result = await Promise.race([
    tool.handler(parsed.data, ctx),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AppError('TOOL_TIMEOUT', `Tool ${name} exceeded ${timeout}ms`, 504)), timeout)
    ),
  ]);

  return { tool: name, result };
}
```

### 3. 示例 Tool：查询天气

```ts
// tools/weather.tool.ts
import { z } from 'zod';
import { registry } from '../tool-registry';

registry.register({
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: z.object({ city: z.string(), unit: z.enum(['c', 'f']).default('c') }),
  timeoutMs: 5000,
  idempotent: true,
  async handler(args) {
    // 模拟调用天气 API
    const response = await fetch(`https://api.weather.example/v1/current?city=${args.city}&unit=${args.unit}`);
    return response.json();
  },
});
```

## 安全要点

- **沙箱**：Tool 代码在独立进程或 VM 中运行，防止 LLM 注入恶意参数。
- **权限最小化**：每个 Tool 声明所需权限，执行前校验。
- **超时**：所有 Tool 必须设超时，防止 LLM 等待无限期阻塞。
- **幂等**：写操作 Tool 必须幂等，LLM 可能重复调用。
- **审计**：记录所有 Tool 调用的参数、结果、耗时、用户。
