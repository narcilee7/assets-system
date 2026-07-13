/**
 * 手写 config loader
 *
 * 考点：
 * - 抽象配置源（env、object）。
 * - schema 校验与类型转换。
 */

export interface ConfigSource {
  get(key: string): string | undefined;
}

export class EnvSource implements ConfigSource {
  constructor(private prefix = "") {}

  get(key: string): string | undefined {
    return process.env[this.prefix + key];
  }
}

export class ObjectSource implements ConfigSource {
  constructor(private data: Record<string, string>) {}

  get(key: string): string | undefined {
    return this.data[key];
  }
}

export type Schema<T> = {
  [K in keyof T]: {
    env?: string;
    default?: T[K];
    parser?: (value: string) => T[K];
  };
};

export function loadConfig<T extends Record<string, unknown>>(
  schema: Schema<T>,
  source: ConfigSource
): T {
  const config = {} as T;
  for (const key of Object.keys(schema) as Array<keyof T>) {
    const field = schema[key];
    const envKey = field.env ?? String(key).toUpperCase();
    const raw = source.get(envKey);

    if (raw !== undefined) {
      config[key] = field.parser ? field.parser(raw) : (raw as T[keyof T]);
    } else if (field.default !== undefined) {
      config[key] = field.default;
    }
  }
  return config;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const schema: Schema<{ port: number; debug: boolean }> = {
    port: { parser: Number, default: 3000 },
    debug: { parser: (v) => v === "true", default: false },
  };
  const source = new ObjectSource({ PORT: "8080", DEBUG: "true" });
  console.log(loadConfig(schema, source));
}
