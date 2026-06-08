# CJS / ESM Compatibility

Node.js 同时支持 CommonJS（CJS）和 ES Modules（ESM），但混合使用会产生大量陷阱。

## 快速判断

| 文件扩展名 | 模块类型 |
| --- | --- |
| `.cjs` | 强制 CJS |
| `.mjs` | 强制 ESM |
| `.js` | 由 `package.json` 的 `"type"` 字段决定 |

## 互操作规则

| 从 \ 到 | CJS require() | ESM import |
| --- | --- | --- |
| CJS 模块 | ✅ 原生 | ✅ `await import()` |
| ESM 模块 | ❌ 不能直接 require | ✅ 原生 |

## 核心问题与解决

### 1. ESM 无法 require CJS 的命名导出

```js
// named-export.cjs
exports.foo = 'bar';

// main.mjs
import cjs from './named-export.cjs';
console.log(cjs.foo); // ✅ 通过 default 访问
console.log(foo);     // ❌ SyntaxError
```

### 2. Dual Package Hazard

同一个包被同时以 CJS 和 ESM 加载，导致状态两份。

```json
// package.json 解决方案：exports 字段
{
  "name": "my-lib",
  "exports": {
    ".": {
      "require": "./dist/index.cjs",
      "import": "./dist/index.mjs"
    }
  }
}
```

### 3. TypeScript 编译目标

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

> `module: NodeNext` 会根据 `package.json` 的 `type` 自动输出 `.js`（ESM）或 `.cjs`（CJS）。

### 4. 动态 import 类型安全

```ts
// safe-dynamic-import.ts
async function loadPlugin(name: string) {
  const mod = await import(name);
  return mod.default || mod;
}
```

## 迁移 checklist

- [ ] 在 `package.json` 中添加 `"type": "module"`（新项目）或保持默认 `"commonjs"`。
- [ ] 使用 `exports` 字段替代 `main` / `module`。
- [ ] 避免在 ESM 中使用 `__dirname`，改用 `import.meta.dirname`（Node >= 20.11）或 `fileURLToPath`。
- [ ] 测试工具链（Jest / Vitest）的 ESM 支持。
