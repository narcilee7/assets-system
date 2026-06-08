# 设计系统基础

## 1. 什么是设计系统

```
设计系统 = 设计规范 + 组件库 + 设计 Tokens + 文档 + 工具

        ┌─────────────────────────────────────┐
        │           设计原则与规范              │
        │   （品牌调性、设计语言、使用指南）      │
        ├─────────────────────────────────────┤
        │           Design Tokens              │
        │   （颜色、间距、字体、圆角、阴影）      │
        ├─────────────────────────────────────┤
        │           组件库                      │
        │   （Button、Input、Modal、Card...）   │
        ├─────────────────────────────────────┤
        │           模式与模板                  │
        │   （页面布局、表单模式、导航模式）      │
        ├─────────────────────────────────────┤
        │           文档与工具                  │
        │   （Storybook、Figma、CLI）           │
        └─────────────────────────────────────┘
```

## 2. 原子设计（Atomic Design）

```
Atoms（原子）        →  不可再分的基础元素
  ├─ 颜色、字体、间距
  ├─ Button、Input、Label
  └─ Icon

Molecules（分子）    →  原子组合
  └─ SearchForm = Input + Button + Icon

Organisms（有机体）  →  分子组合
  └─ Header = Logo + Navigation + SearchForm

Templates（模板）    →  页面布局骨架
  └─ 内容占位符

Pages（页面）        →  真实内容填充的模板
  └─ 实际产品页面
```

## 3. Design Tokens 层次

```json
{
  "primitive": {
    "color": {
      "blue-50": "#eff6ff",
      "blue-500": "#3b82f6",
      "blue-900": "#1e3a8a"
    },
    "spacing": {
      "0": "0px",
      "1": "4px",
      "2": "8px",
      "4": "16px",
      "8": "32px"
    }
  },
  "semantic": {
    "color": {
      "primary": "{color.blue-500}",
      "primary-hover": "{color.blue-600}",
      "text-default": "{color.gray-900}",
      "text-muted": "{color.gray-500}",
      "bg-default": "{color.white}",
      "bg-subtle": "{color.gray-50}"
    }
  },
  "component": {
    "button": {
      "bg": "{semantic.color.primary}",
      "bg-hover": "{semantic.color.primary-hover}",
      "padding": "{spacing.2} {spacing.4}",
      "radius": "{radius.md}"
    }
  }
}
```

## 4. 设计系统 vs 组件库

| 维度 | 设计系统 | 组件库 |
|------|----------|--------|
| 范围 | 设计规范 + 组件 + 流程 | 仅代码组件 |
| 用户 | 设计师 + 开发者 + 产品经理 | 开发者 |
| 产出 | Figma + 代码 + 文档 | 代码 |
| 维护 | 跨团队协作 | 开发团队 |
| 目标 | 一致性 + 效率 + 品牌 | 复用 + 效率 |
