# 文档规范

## 1. Storybook 文档

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: '按钮组件，用于触发操作或事件。',
      },
    },
  },
  argTypes: {
    variant: {
      description: '按钮样式变体',
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'primary' },
      },
    },
    size: {
      description: '按钮尺寸',
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      description: '是否禁用',
      control: 'boolean',
    },
    onClick: {
      description: '点击回调',
      action: 'clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: 'Button',
    variant: 'primary',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};
```

## 2. 使用指南模板

```markdown
# Button 使用指南

## 概述
按钮用于触发操作或事件。

## 何时使用
- 提交表单
- 打开模态框
- 页面跳转（次要）

## 何时不使用
- 页面主要导航 → 使用 Link
- 纯展示 → 使用 Tag

## 变体选择
| 场景 | 推荐变体 |
|------|----------|
| 主要操作 | primary |
| 次要操作 | secondary |
| 危险操作 | danger |
| 低强调 | ghost |

## 无障碍
- 确保按钮有明确的文本或使用 aria-label
- 禁用状态需明确告知用户原因
```

## 3. 变更日志

```markdown
## @my/design-system@2.3.0

### 🚀 New Features
- **Button**: 新增 `loading` 状态支持
- **Modal**: 新增 `size="fullscreen"` 变体

### 🐛 Bug Fixes
- **Input**: 修复 disabled 状态下仍可聚焦的问题

### 💥 Breaking Changes
- **Theme**: 移除 `--color-accent` Token，请使用 `--color-primary`
```
