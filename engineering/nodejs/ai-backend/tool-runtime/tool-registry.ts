import { z, ZodSchema } from 'zod';

interface ToolContext {
  userId: string;
  sessionId: string;
  traceId: string;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodSchema<any>;
  handler: (args: any, ctx: ToolContext) => Promise<any>;
  timeoutMs?: number;
  requiresAuth?: boolean;
  idempotent?: boolean;
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
        parameters: {}, // simplified; use zod-to-json-schema in production
      },
    }));
  }
}

export const registry = new ToolRegistry();
export type { ToolContext, ToolDefinition };
