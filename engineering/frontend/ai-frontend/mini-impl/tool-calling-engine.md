# 手写 Tool Calling 引擎

## 目标

实现一个简化版 Tool Calling 引擎，支持：
1. 工具注册与发现
2. 参数校验（JSON Schema）
3. 工具执行与错误处理
4. 工具结果格式化
5. 工具权限控制

## 实现

```javascript
// tool-calling-engine.js

class ToolCallingEngine {
  constructor(options = {}) {
    this.tools = new Map();
    this.middleware = [];
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 0;
  }

  // ========== 工具注册 ==========

  register(tool) {
    // 验证工具定义
    this.validateToolDefinition(tool);
    this.tools.set(tool.name, {
      ...tool,
      // 规范化参数 schema
      parameters: this.normalizeSchema(tool.parameters),
    });
    return this;
  }

  registerBulk(tools) {
    for (const tool of tools) {
      this.register(tool);
    }
    return this;
  }

  unregister(name) {
    this.tools.delete(name);
    return this;
  }

  // ========== 工具发现 ==========

  getTool(name) {
    return this.tools.get(name);
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }

  getSchema() {
    return {
      type: 'object',
      properties: Object.fromEntries(
        Array.from(this.tools.entries()).map(([name, tool]) => [
          name,
          {
            description: tool.description,
            parameters: tool.parameters,
          },
        ])
      ),
    };
  }

  // 生成 OpenAI 格式的 functions
  toOpenAIFunctions() {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  // ========== 参数校验 ==========

  validateParameters(toolName, params) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool "${toolName}" not found`] };
    }

    const errors = [];
    const schema = tool.parameters;

    // 检查必填字段
    if (schema.required) {
      for (const req of schema.required) {
        if (params[req] === undefined) {
          errors.push(`Missing required parameter: ${req}`);
        }
      }
    }

    // 检查类型
    if (schema.properties) {
      for (const [key, value] of Object.entries(params)) {
        const propSchema = schema.properties[key];
        if (!propSchema) {
          errors.push(`Unknown parameter: ${key}`);
          continue;
        }

        const typeError = this.checkType(key, value, propSchema);
        if (typeError) errors.push(typeError);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  checkType(key, value, schema) {
    const expectedType = schema.type;

    if (expectedType === 'string' && typeof value !== 'string') {
      return `${key}: expected string, got ${typeof value}`;
    }
    if (expectedType === 'number' && typeof value !== 'number') {
      return `${key}: expected number, got ${typeof value}`;
    }
    if (expectedType === 'boolean' && typeof value !== 'boolean') {
      return `${key}: expected boolean, got ${typeof value}`;
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      return `${key}: expected array, got ${typeof value}`;
    }
    if (expectedType === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      return `${key}: expected object, got ${value === null ? 'null' : typeof value}`;
    }

    // 枚举检查
    if (schema.enum && !schema.enum.includes(value)) {
      return `${key}: expected one of [${schema.enum.join(', ')}], got ${value}`;
    }

    // 字符串长度
    if (expectedType === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return `${key}: minimum length is ${schema.minLength}`;
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return `${key}: maximum length is ${schema.maxLength}`;
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        return `${key}: does not match pattern ${schema.pattern}`;
      }
    }

    // 数值范围
    if (expectedType === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `${key}: minimum value is ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `${key}: maximum value is ${schema.maximum}`;
      }
    }

    return null;
  }

  // ========== 工具执行 ==========

  async execute(toolCall) {
    const { name, parameters = {} } = toolCall;
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
        available: Array.from(this.tools.keys()),
      };
    }

    // 参数校验
    const validation = this.validateParameters(name, parameters);
    if (!validation.valid) {
      return {
        success: false,
        error: 'Parameter validation failed',
        details: validation.errors,
      };
    }

    // 执行中间件
    let context = { tool, parameters };
    for (const mw of this.middleware) {
      context = await mw.before?.(context) || context;
    }

    // 执行工具（带超时）
    try {
      const result = await this.executeWithTimeout(
        () => tool.execute(context.parameters),
        this.timeout
      );

      // 后处理中间件
      for (const mw of this.middleware) {
        await mw.after?.(context, result);
      }

      return {
        success: true,
        result: this.formatResult(result, tool),
      };
    } catch (error) {
      // 错误处理中间件
      for (const mw of this.middleware) {
        await mw.onError?.(context, error);
      }

      return {
        success: false,
        error: error.message || 'Tool execution failed',
        stack: error.stack,
      };
    }
  }

  async executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  formatResult(result, tool) {
    // 如果工具定义了格式化器，使用它
    if (tool.formatResult) {
      return tool.formatResult(result);
    }

    // 默认格式化
    if (result === null || result === undefined) {
      return null;
    }

    if (typeof result === 'object') {
      return result;
    }

    return { value: result };
  }

  // ========== 批量执行 ==========

  async executeMultiple(toolCalls) {
    const results = [];

    for (const call of toolCalls) {
      const result = await this.execute(call);
      results.push({ tool: call.name, ...result });

      // 如果有依赖关系，可以串行执行
      if (call.dependsOn) {
        const depResult = results.find((r) => r.tool === call.dependsOn);
        if (!depResult?.success) {
          results.push({
            tool: call.name,
            success: false,
            error: `Dependency "${call.dependsOn}" failed`,
          });
          continue;
        }
      }
    }

    return results;
  }

  // ========== 中间件系统 ==========

  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  // 内置中间件

  static loggingMiddleware(logger = console) {
    return {
      before: (ctx) => {
        logger.log(`[Tool] Executing: ${ctx.tool.name}`, ctx.parameters);
        return ctx;
      },
      after: (ctx, result) => {
        logger.log(`[Tool] Completed: ${ctx.tool.name}`, result);
      },
      onError: (ctx, error) => {
        logger.error(`[Tool] Failed: ${ctx.tool.name}`, error);
      },
    };
  }

  static permissionMiddleware(allowedTools) {
    const allowed = new Set(allowedTools);
    return {
      before: (ctx) => {
        if (!allowed.has(ctx.tool.name)) {
          throw new Error(`Permission denied: ${ctx.tool.name}`);
        }
        return ctx;
      },
    };
  }

  static retryMiddleware(maxRetries = 3, delay = 1000) {
    return {
      onError: async (ctx, error) => {
        let attempts = 0;
        while (attempts < maxRetries) {
          attempts++;
          await new Promise((r) => setTimeout(r, delay * attempts));
          try {
            const result = await ctx.tool.execute(ctx.parameters);
            return result;  // 成功则停止重试
          } catch {
            // 继续重试
          }
        }
        throw error;  // 重试耗尽，抛出原错误
      },
    };
  }

  // ========== 工具定义验证 ==========

  validateToolDefinition(tool) {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a name');
    }
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a description');
    }
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }
    if (tool.parameters && typeof tool.parameters !== 'object') {
      throw new Error('Tool parameters must be an object');
    }
  }

  normalizeSchema(schema) {
    if (!schema) return { type: 'object', properties: {} };
    if (schema.type) return schema;

    // 简写形式：{ city: 'string', unit: 'string' }
    const properties = {};
    const required = [];

    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'string') {
        properties[key] = { type: value };
      } else if (typeof value === 'object') {
        properties[key] = value;
      }

      if (properties[key].required !== false) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }
}

// ========== 使用示例 ==========

const engine = new ToolCallingEngine({ timeout: 10000 });

// 注册工具
engine
  .register({
    name: 'getWeather',
    description: '获取指定城市的天气信息',
    parameters: {
      city: { type: 'string', description: '城市名称' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
    },
    execute: async ({ city, unit = 'celsius' }) => {
      // 模拟 API 调用
      return {
        city,
        temperature: 25,
        condition: 'sunny',
        unit,
      };
    },
  })
  .register({
    name: 'calculate',
    description: '执行数学计算',
    parameters: {
      expression: { type: 'string', description: '数学表达式' },
    },
    execute: ({ expression }) => {
      // 注意：实际使用应使用安全的数学解析库
      return { result: eval(expression) };
    },
  });

// 添加中间件
engine
  .use(ToolCallingEngine.loggingMiddleware())
  .use(ToolCallingEngine.permissionMiddleware(['getWeather', 'calculate']));

// 执行
async function example() {
  const result = await engine.execute({
    name: 'getWeather',
    parameters: { city: 'Beijing', unit: 'celsius' },
  });

  console.log(result);
  // { success: true, result: { city: 'Beijing', temperature: 25, ... } }
}

example();

module.exports = { ToolCallingEngine };
```
