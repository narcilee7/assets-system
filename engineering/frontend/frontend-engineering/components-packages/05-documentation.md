# 文档站点

## 1. Storybook 配置

```javascript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',      // Controls, Actions, Docs
    '@storybook/addon-a11y',             // 可访问性检查
    '@storybook/addon-interactions',     // 交互测试
    '@storybook/addon-coverage',         // 测试覆盖率
    'storybook-dark-mode',               // 暗黑模式切换
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
};

export default config;
```

```tsx
// button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: '按钮样式变体',
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Overview: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};
```

## 2. API 文档自动生成

```bash
# TypeDoc（从 TS 类型生成文档）
npm install -D typedoc

# typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "theme": "default",
  "excludePrivate": true,
  "excludeProtected": true,
  "hideGenerator": true
}
```

## 3. Playground

```tsx
// 在文档中嵌入可编辑的 Playground
// 使用 @storybook/addon-interactions 或自建 Playground

function Playground() {
  const [props, setProps] = useState({ variant: 'primary', size: 'md', loading: false });

  return (
    <div>
      <div className="controls">
        <select value={props.variant} onChange={(e) => setProps({ ...props, variant: e.target.value })}>
          <option>primary</option>
          <option>secondary</option>
          <option>ghost</option>
        </select>
        <label>
          <input type="checkbox" checked={props.loading} onChange={(e) => setProps({ ...props, loading: e.target.checked })} />
          Loading
        </label>
      </div>
      <div className="preview">
        <Button {...props}>Preview</Button>
      </div>
      <pre>{`<Button variant="${props.variant}" size="${props.size}"${props.loading ? ' loading' : ''}>Preview</Button>`}</pre>
    </div>
  );
}
```
