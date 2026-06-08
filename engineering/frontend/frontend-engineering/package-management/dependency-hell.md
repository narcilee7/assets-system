# 依赖治理

## 1. 常见问题

### 幽灵依赖（Phantom Dependencies）

```javascript
// package.json 没有声明 lodash
// 但因为其他依赖带了 lodash，可以直接 import
import _ from 'lodash';  // 在 npm/Yarn 1 中可能工作，但不可靠

// pnpm/Yarn PnP 会报错：
// Error: lodash is not in the dependencies
```

### 依赖重复

```bash
# 同一个包多个版本
npm ls lodash

# pnpm 自动去重（内容寻址）
# npm/yarn 需要手动处理

# 解决方案：resolutions/overrides
{
  "overrides": {
    "lodash": "4.17.21"
  }
}
```

### Peer Dependencies

```json
{
  "peerDependencies": {
    "react": ">=16.8.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  }
}
```

## 2. 依赖检查工具

```bash
# 检查重复依赖
npx npm-why lodash
npx depcheck            # 检查未使用的依赖
npx npm-check-updates   # 检查可更新的依赖

# 包大小分析
npx packagephobia lodash  # 查看包安装大小
npx bundlephobia react    # 查看包打包大小
```

## 3. 最佳实践

```json
{
  "dependencies": {
    "严格版本": "1.2.3",
    "允许补丁": "~1.2.3",
    "允许次要": "^1.2.3"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0"
}
```
