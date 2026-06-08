# TypeScript 严格模式

## 1. 严格配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,               // 启用所有严格选项
    "noImplicitAny": true,        // 禁止隐式 any
    "strictNullChecks": true,     // 严格 null 检查
    "strictFunctionTypes": true,  // 严格函数类型
    "strictBindCallApply": true,  // 严格 bind/call/apply
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,       // 禁止未使用变量
    "noUnusedParameters": true,
    "noImplicitReturns": true,    // 所有路径必须返回
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,  // 可选属性与 undefined 区分
    "noUncheckedIndexedAccess": true,    // 索引访问可能 undefined
  }
}
```

## 2. 类型体操

```typescript
// 实用工具类型
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// 安全的 API 响应类型
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

//  brands 类型（名义类型）
type UserId = string & { __brand: 'UserId' };
type OrderId = string & { __brand: 'OrderId' };

function createUserId(id: string): UserId {
  return id as UserId;
}

// UserId 和 OrderId 不能混用
```

## 3. 类型安全模式

```typescript
//  exhaustive switch
type Status = 'loading' | 'success' | 'error';

function getMessage(status: Status): string {
  switch (status) {
    case 'loading': return 'Loading...';
    case 'success': return 'Done!';
    case 'error': return 'Failed!';
    default:
      // 如果新增 Status 值，这里会报错
      const _exhaustive: never = status;
      return _exhaustive;
  }
}
```
