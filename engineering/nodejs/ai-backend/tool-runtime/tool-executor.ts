import { registry, ToolContext } from './tool-registry';
import { AppError, Errors } from '../../api-design/error-model/app-error';

export async function executeTool(
  name: string,
  args: any,
  ctx: ToolContext
): Promise<any> {
  const tool = registry.get(name);
  if (!tool) throw Errors.notFound(`Tool ${name}`);

  if (tool.requiresAuth && !ctx.userId) {
    throw Errors.unauthorized();
  }

  const parsed = tool.parameters.safeParse(args);
  if (!parsed.success) {
    throw Errors.validation({ parameters: parsed.error.issues });
  }

  const timeout = tool.timeoutMs || 30000;
  const result = await Promise.race([
    tool.handler(parsed.data, ctx),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AppError('TOOL_TIMEOUT', `Tool ${name} exceeded ${timeout}ms`, 504)), timeout)
    ),
  ]);

  return { tool: name, result };
}
