# 环境说明

## 依赖版本要求

| 语言/工具 | 最低版本 | 验证命令 |
|----------|----------|----------|
| Node.js | 18+ | `node --version` |
| TypeScript | 5.0+ | `npx ts-node --version` |
| pnpm | 8.0+ | `pnpm --version` |

## 快速检查

```bash
cd engineering/frontend/patterns
make check    # 检查全局环境
```

## 各语言运行方式

### TypeScript

```bash
cd <topic>/skeleton/ts
npx ts-node main.ts
```

TypeScript 骨架使用 `ts-node` 直接运行，适合验证类型逻辑和浏览器 API 模拟。

### Node.js

```bash
cd <topic>/skeleton/nodejs
node index.js
```

Node.js 骨架模拟浏览器环境（IntersectionObserver 等），专注于核心算法验证。

## 推荐训练路径

1. **先看 README**：理解问题和约束。
2. **运行骨架**：观察失败模式，理解预期行为。
3. **补全 TODO**：先实现核心逻辑，不考虑边界。
4. **运行测试**：验证正确性。
5. **优化边界**：handleSubmit、异步验证等。

## 手写建议

- 准备纸质笔记本，先画出**状态机**或**时序图**，再写代码。
- 不要直接看 `solution/`（若后续补充），先让自己的实现通过 `make test`。
- 记录踩坑点：闭包泄漏、this 绑定、异步状态竞态等。