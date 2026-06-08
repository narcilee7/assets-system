# Package Exports Design

`exports` 字段是现代 Node.js 包的核心门面，它替代了 `main`、`module`、`types` 的混乱历史。

## 推荐结构

```json
{
  "name": "@myorg/api-client",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json",
    "./constants": {
      "types": "./dist/constants.d.ts",
      "import": "./dist/constants.mjs",
      "require": "./dist/constants.cjs"
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18"
  }
}
```

## 关键规则

1. **types 在前**：Node.js 按顺序匹配，`types` 必须在 `import` / `require` 之前。
2. **显式子路径**：避免深层导入如 `my-lib/dist/internal`，通过 `exports` 暴露受控 API。
3. **package.json 暴露**：某些工具需要读取 `package.json`，显式暴露避免被封堵。
4. **条件导出**：支持 `node`、`browser`、`development`、`production` 等条件。

```json
{
  "exports": {
    ".": {
      "browser": "./dist/index.browser.mjs",
      "node": {
        "import": "./dist/index.mjs",
        "require": "./dist/index.cjs"
      }
    }
  }
}
```

## 验证工具

```bash
npx publint        # 检查 package.json 规范
npx @arethetypeswrong/cli  # 检查类型导出是否正确
```
