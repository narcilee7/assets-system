/**
 * 手写 mini agent runtime
 *
 * 考点：
 * - Agent 状态机：idle → thinking → tool_call → observing → done / error。
 * - 工具注册、参数校验、循环调用。
 * - 可观测性：trace / events。
 */

export type AgentState = "idle" | "thinking" | "tool_call" | "observing" | "done" | "error";

export interface Tool<P = unknown, R = unknown> {
  name: string;
  description?: string;
  execute: (params: P) => R | Promise<R>;
}

export interface AgentStep {
  role: "agent" | "tool";
  content: unknown;
  toolName?: string;
}

export interface AgentOptions {
  maxSteps?: number;
  onStep?: (step: AgentStep) => void;
}

export class MiniAgentRuntime {
  private tools = new Map<string, Tool>();
  private state: AgentState = "idle";
  private steps: AgentStep[] = [];

  constructor(private options: AgentOptions = {}) {}

  registerTool<P, R>(tool: Tool<P, R>): void {
    this.tools.set(tool.name, tool as Tool<unknown, unknown>);
  }

  getState(): AgentState {
    return this.state;
  }

  getTrace(): AgentStep[] {
    return [...this.steps];
  }

  async run(prompt: string): Promise<unknown> {
    this.state = "thinking";
    this.steps = [];
    const maxSteps = this.options.maxSteps ?? 10;

    let currentInput: unknown = prompt;

    for (let i = 0; i < maxSteps; i++) {
      this.emit("agent", { thought: `processing: ${currentInput}` });

      const toolCall = this.decideTool(currentInput);
      if (!toolCall) {
        this.state = "done";
        this.emit("agent", { answer: currentInput });
        return currentInput;
      }

      this.state = "tool_call";
      const tool = this.tools.get(toolCall.name);
      if (!tool) {
        this.state = "error";
        throw new Error(`unknown tool: ${toolCall.name}`);
      }

      try {
        const result = await tool.execute(toolCall.params);
        this.emit("tool", { result }, toolCall.name);
        this.state = "observing";
        const nextCall = this.decideTool(result);
        if (!nextCall) {
          this.state = "done";
          this.emit("agent", { answer: result });
          return result;
        }
        currentInput = result;
      } catch (error) {
        this.state = "error";
        throw error;
      }
    }

    this.state = "error";
    throw new Error("max steps exceeded");
  }

  private decideTool(input: unknown): { name: string; params: unknown } | null {
    if (typeof input !== "string") return null;
    const match = input.match(/\btool:(\w+)\b\s*(.*)$/);
    if (!match) return null;
    return { name: match[1], params: match[2].trim() || input };
  }

  private emit(role: AgentStep["role"], content: unknown, toolName?: string): void {
    const step: AgentStep = { role, content, toolName };
    this.steps.push(step);
    this.options.onStep?.(step);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const agent = new MiniAgentRuntime({ maxSteps: 5 });
  agent.registerTool<string, string>({
    name: "echo",
    execute: (params) => `echo:${params}`,
  });
  agent.run("hello tool:echo").then(console.log).catch(console.error);
}
