# 组件库架构设计

## 1. Monorepo vs Single Package

```
Single Package（小型组件库 < 30 个）
├── src/
│   ├── components/
│   │   ├── Button/
│   │   ├── Input/
│   │   └── Modal/
│   ├── theme/
│   └── index.ts           # 统一导出
├── package.json            # 一个包
└── vite.config.ts

优点：简单、消费者只需安装一个包
缺点：所有组件同版本发布、无法单独升级

Monorepo（大型组件库 > 50 个）
├── packages/
│   ├── core/               # 核心逻辑（Headless）
│   ├── components/         # 组件实现
│   ├── theme-default/      # 默认主题
│   ├── theme-dark/         # 暗黑主题
│   ├── icons/              # 图标库
│   └── utils/              # 工具函数
├── apps/
│   └── docs/               # 文档站点
└── package.json            # workspace 根

优点：独立版本、按需安装、主题可替换
缺点：复杂度高、需要 Changesets 管理版本
```

## 2. 目录结构规范

```
packages/components/
├── src/
│   ├── button/
│   │   ├── button.tsx           # 组件实现
│   │   ├── button.test.tsx      # 测试
│   │   ├── button.stories.tsx   # Storybook 文档
│   │   ├── button.types.ts      # 类型定义
│   │   ├── button.styles.ts     # 样式（CSS-in-JS）
│   │   ├── index.ts             # 模块导出
│   │   └── style/               # 独立样式文件（CSS Modules）
│   │       └── index.css
│   ├── input/
│   │   └── ...
│   ├── index.ts                 # 统一入口
│   └── theme/                   # 主题配置
│       ├── tokens.ts
│       └── provider.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 3. 包拆分策略

```json
// 消费者可按需安装
{
  "dependencies": {
    "@my-ui/core": "^1.0.0",        // Headless 逻辑（必须）
    "@my-ui/components": "^1.0.0",   // 默认样式组件
    "@my-ui/theme-default": "^1.0.0", // 默认主题
    "@my-ui/icons": "^1.0.0"         // 图标（可选）
  }
}
```

| 包名 | 内容 | 依赖 |
|------|------|------|
| `@my-ui/core` | useButton、useModal 等 Hooks | 无 |
| `@my-ui/components` | 带样式的组件 | core + theme |
| `@my-ui/theme-default` | CSS 变量、Token | 无 |
| `@my-ui/icons` | SVG 图标 | 无 |
| `@my-ui/locale` | 国际化文案 | 无 |
