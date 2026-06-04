/**
 * Schema Bridge - 极简运行时 schema 校验 + 类型推导
 */

export class Schema<T> {
  constructor(private validator: (value: unknown) => T) {}

  check(value: unknown): T {
    return this.validator(value);
  }

  // 用于类型提取，运行时无意义
  get infer(): T {
    throw new Error('Schema.infer is for type inference only');
  }
}

export function string(): Schema<string> {
  return new Schema((value) => {
    if (typeof value !== 'string') {
      throw new TypeError(`Expected string, got ${typeof value}`);
    }
    return value;
  });
}

export function number(): Schema<number> {
  return new Schema((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new TypeError(`Expected number, got ${typeof value}`);
    }
    return value;
  });
}

export function boolean(): Schema<boolean> {
  return new Schema((value) => {
    if (typeof value !== 'boolean') {
      throw new TypeError(`Expected boolean, got ${typeof value}`);
    }
    return value;
  });
}

export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return new Schema((value) => {
    if (value === undefined) return undefined;
    return schema.check(value);
  });
}

export function array<T>(itemSchema: Schema<T>): Schema<T[]> {
  return new Schema((value) => {
    if (!Array.isArray(value)) {
      throw new TypeError(`Expected array, got ${typeof value}`);
    }
    return value.map((item, i) => {
      try {
        return itemSchema.check(item);
      } catch (e: any) {
        throw new TypeError(`[${i}] ${e.message}`);
      }
    });
  });
}

type FieldSchemas = Record<string, Schema<unknown>>;

type InferSchema<T extends FieldSchemas> = {
  [K in keyof T]: T[K] extends Schema<infer U> ? U : never;
};

export function object<T extends FieldSchemas>(
  fields: T
): Schema<InferSchema<T>> {
  return new Schema((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TypeError(`Expected object, got ${typeof value}`);
    }
    const result = {} as InferSchema<T>;
    for (const [key, schema] of Object.entries(fields)) {
      const v = (value as Record<string, unknown>)[key];
      try {
        (result as any)[key] = schema.check(v);
      } catch (e: any) {
        throw new TypeError(`.${key} ${e.message}`);
      }
    }
    return result;
  });
}
