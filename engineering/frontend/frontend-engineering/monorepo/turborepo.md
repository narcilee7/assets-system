# Turborepo

## 1. 核心概念

Turborepo 是一个 monorepo 任务编排器，解决"哪个包需要重新构建"的问题。

```
传统 monorepo：
  pnpm -r run build   # 所有包都 build，即使没变化

Turborepo：
  turbo run build     # 只构建有变化的包及其依赖
                      # + 缓存已构建的结果
                      # + 并行执行无依赖的任务
```

## 2. Pipeline 配置

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],      // 先构建依赖的包
      "outputs": ["dist/**", ".next/**"],
      "env": ["API_URL"]             // 环境变量变化时重新构建
    },
    "test": {
      "dependsOn": ["build"],        // 先 build 再 test
      "outputs": ["coverage/**"],
      "inputs": ["src/**/*.test.ts"] // 只有测试文件变化时重新运行
    },
    "lint": {},
    "dev": {
      "cache": false,                // dev 不缓存
      "persistent": true             // 长期运行的任务
    }
  }
}
```

## 3. 缓存机制

```bash
# 本地缓存（.turbo/cache）
turbo run build

# 远程缓存（Vercel / 自建）
turbo login
turbo link
turbo run build --remote-only   # 只使用远程缓存

# 缓存命中条件：
# 1. 输入文件 hash 未变
# 2. 依赖的任务输出未变
# 3. 环境变量未变
```

## 4. Affected 命令

```bash
# 只运行有变更的包及其依赖
turbo run build --filter=[HEAD^1]

# 常用 filter
--filter=web                    # 只 web 包
--filter=web...                 # web 及被依赖
--filter=...web                 # web 及依赖
--filter={packages/**}[main...]  # main 分支后有变更的包
```
