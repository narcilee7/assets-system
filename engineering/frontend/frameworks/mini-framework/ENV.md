# 环境说明

## 依赖版本要求

| 语言/工具 | 最低版本 | 验证命令 |
|----------|----------|----------|
| Node.js | 18+ | `node --version` |
| TypeScript | 5.0+ | `npx ts-node --version` |

## 快速检查

```bash
cd engineering/frontend/frameworks/mini-framework
make check    # 检查全局环境
```

## 各语言运行方式

### TypeScript

```bash
cd <topic>/skeleton/ts
npx ts-node main.ts
```

## 推荐训练路径

1. **先理解概念**：阅读 README，了解问题的背景和约束。
2. **画状态图**：在纸上画出 observe/notify 的流程。
3. **补全 TODO**：按照提示逐步实现。
4. **运行测试**：用 `make test` 验证正确性。
5. **对比真实框架**：思考真实 React/Vue 是如何实现的。

## 手写建议

- 闭包是核心工具，每个模块都围绕闭包构建状态。
- effect 和 cleanup 的配对是常见踩坑点。
- 不要着急，一步一步来，每步都确保测试通过。