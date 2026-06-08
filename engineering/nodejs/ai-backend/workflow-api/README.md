# Workflow API

AI 工作流是将多个步骤（LLM 调用、Tool 执行、人工审批）编排成可复用、可观测的流程。

## 核心设计

```
[Trigger] -> [Step 1: LLM] -> [Step 2: Tool] -> [Gate: Condition]
                                              -> [Step 3: Human Approval]
                                              -> [Step 4: LLM Final]
```

## 实现

### 1. 工作流定义

```ts
// workflow.engine.ts
interface Step {
  id: string;
  type: 'llm' | 'tool' | 'condition' | 'approval' | 'wait';
  config: Record<string, any>;
  next?: string | { condition: string; then: string; else: string };
}

interface Workflow {
  id: string;
  steps: Step[];
  initialStep: string;
}

interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'waiting_approval';
  context: Record<string, any>;
  currentStep: string;
  history: Array<{ step: string; input: any; output: any; timestamp: Date }>;
}
```

### 2. 工作流执行器

```ts
// workflow.executor.ts
import OpenAI from 'openai';

const openai = new OpenAI();

export class WorkflowExecutor {
  async execute(instance: WorkflowInstance, workflow: Workflow): Promise<void> {
    while (instance.status === 'running') {
      const step = workflow.steps.find((s) => s.id === instance.currentStep);
      if (!step) {
        instance.status = 'failed';
        break;
      }

      try {
        const output = await this.runStep(step, instance.context);
        instance.history.push({ step: step.id, input: instance.context, output, timestamp: new Date() });
        instance.context[step.id] = output;

        // 确定下一步
        if (typeof step.next === 'string') {
          instance.currentStep = step.next;
        } else if (step.next) {
          const conditionMet = this.evaluateCondition(step.next.condition, instance.context);
          instance.currentStep = conditionMet ? step.next.then : step.next.else;
        } else {
          instance.status = 'completed';
        }
      } catch (err: any) {
        instance.status = 'failed';
        instance.context.error = err.message;
      }
    }
  }

  private async runStep(step: Step, context: any): Promise<any> {
    switch (step.type) {
      case 'llm':
        const response = await openai.chat.completions.create({
          model: step.config.model || 'gpt-4o',
          messages: [
            { role: 'system', content: step.config.systemPrompt },
            { role: 'user', content: this.interpolate(step.config.prompt, context) },
          ],
        });
        return response.choices[0].message.content;

      case 'tool':
        return executeTool(step.config.toolName, step.config.args, context);

      case 'condition':
        return this.evaluateCondition(step.config.expression, context);

      case 'approval':
        // 暂停等待人工审批
        return { waiting: true, approvers: step.config.approvers };

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private interpolate(template: string, context: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  }

  private evaluateCondition(expression: string, context: any): boolean {
    // 简化实现，生产环境使用安全的表达式引擎
    return new Function('ctx', `with(ctx) { return ${expression}; }`)(context);
  }
}
```

## 持久化

- 使用 PostgreSQL / Redis 存储工作流实例状态。
- 每个步骤完成后立即持久化，支持断点续执行。
- 长时间等待（approval）使用 TTL + 轮询或 Webhook 唤醒。

## 工具推荐

- **Temporal**：工业级工作流引擎，支持长时间运行、重试、补偿。
- **Inngest**：Serverless 友好的事件驱动工作流。
- **自研**：适合简单流程，核心就是状态机 + 持久化。
