# AI Agent CLI: Tool Rendering

当 AI Agent 调用工具（函数）时，CLI 需要清晰展示：
1. 模型正在思考
2. 调用了什么工具
3. 传入什么参数
4. 工具执行进度
5. 执行结果如何影响最终回答

## 视觉设计原则

```
🤔 Thinking...
🔧 Calling tool: get_weather
   Arguments:
     city: "Beijing"
     unit: "celsius"
⏳ Executing...
✅ Result: {"temperature": 22, "condition": "Sunny"}
📝 Final answer: It's 22°C and sunny in Beijing.
```

## 基础实现

```ts
// tool-renderer.ts
import pc from 'picocolors';
import ora from 'ora';

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

interface ToolResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  durationMs: number;
}

export class ToolRenderer {
  private spinner?: ora.Ora;

  renderThinking() {
    process.stdout.write(pc.dim('🤔 Thinking...\n'));
  }

  renderToolCall(toolCall: ToolCall) {
    console.log(pc.cyan(`🔧 Calling tool: ${pc.bold(toolCall.name)}`));
    console.log(pc.dim('   Arguments:'));
    for (const [key, value] of Object.entries(toolCall.arguments)) {
      const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
      console.log(pc.dim(`     ${key}: ${display}`));
    }
    this.spinner = ora('   Executing...').start();
  }

  renderToolResult(result: ToolResult) {
    this.spinner?.stop();

    if (result.success) {
      console.log(pc.green(`✅ Completed in ${result.durationMs}ms`));
      const dataStr = typeof result.data === 'object'
        ? JSON.stringify(result.data, null, 2)
        : String(result.data);
      console.log(pc.gray(`   Result: ${dataStr.split('\n').join('\n           ')}`));
    } else {
      console.log(pc.red(`❌ Failed: ${result.error}`));
    }
  }
}
```

## Ink 工具执行面板

```tsx
// ink-tool-panel.tsx
import { Box, Text } from 'ink';

interface ToolExecutionProps {
  toolCalls: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'success' | 'error';
    args: Record<string, any>;
    result?: any;
    error?: string;
  }>;
}

export function ToolExecutionPanel({ toolCalls }: ToolExecutionProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text bold>Tool Calls</Text>
      {toolCalls.map((call) => (
        <Box key={call.id} flexDirection="column" marginY={1}>
          <Box>
            <Text color={statusColor(call.status)}>{statusIcon(call.status)}</Text>
            <Text> </Text>
            <Text bold>{call.name}</Text>
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>{JSON.stringify(call.args)}</Text>
          </Box>
          {call.result && (
            <Box marginLeft={2}>
              <Text color="green">→ {JSON.stringify(call.result)}</Text>
            </Box>
          )}
          {call.error && (
            <Box marginLeft={2}>
              <Text color="red">✗ {call.error}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'pending': return 'yellow';
    case 'running': return 'blue';
    case 'success': return 'green';
    case 'error': return 'red';
    default: return 'white';
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case 'pending': return '○';
    case 'running': return '◐';
    case 'success': return '✓';
    case 'error': return '✗';
    default: return '?';
  }
}
```

## 参数确认模式

对于敏感操作（如删除资源、转账），CLI 应要求用户确认：

```ts
// confirmation.ts
import * as p from '@clack/prompts';

export async function confirmToolExecution(toolCall: ToolCall): Promise<boolean> {
  console.log(pc.yellow('⚠️  AI wants to execute the following tool:'));
  console.log(pc.bold(`  ${toolCall.name}`));
  console.log(pc.dim('  Arguments:'));
  console.log(JSON.stringify(toolCall.arguments, null, 2));

  const confirmed = await p.confirm({
    message: 'Allow this tool execution?',
    initialValue: false,
  });

  return !!confirmed;
}
```

## 工具调用统计

```ts
// tool-stats.ts
interface ToolStats {
  totalCalls: number;
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  byTool: Record<string, { calls: number; avgDurationMs: number }>;
}

export function aggregateToolStats(results: ToolResult[]): ToolStats {
  const stats: ToolStats = {
    totalCalls: results.length,
    successCount: 0,
    errorCount: 0,
    totalDurationMs: 0,
    byTool: {},
  };

  for (const r of results) {
    if (r.success) stats.successCount++;
    else stats.errorCount++;
    stats.totalDurationMs += r.durationMs;
  }

  return stats;
}
```
