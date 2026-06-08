# 文档工程

## 1. Storybook

```bash
npx storybook@latest init
```

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Components/Button',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Click me',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};
```

## 2. VitePress / Docusaurus

```bash
# VitePress（Vue 风格，轻量）
npx vitepress init

# Docusaurus（React 风格，功能全）
npx create-docusaurus@latest docs classic
```

## 3. 自动化文档

```typescript
// typedoc（从 TS 类型生成文档）
npx typedoc src/index.ts --out docs/api

// API Extractor（微软方案，生成 .d.ts + 文档）
```
