# 手写组件库 CLI

## 核心目标

实现一个简化版 CLI，支持：
1. 根据模板生成新组件目录和文件
2. 自动更新组件库入口索引
3. 同步创建 Storybook 文档

## 实现

```javascript
#!/usr/bin/env node
// cli.js
const fs = require('fs');
const path = require('path');

const SRC = path.resolve('src');

const COMPONENT_TEMPLATE = `import { forwardRef } from 'react';
import type { {{name}}Props } from './{{name}}.types';
import './{{name}}.styles.css';

export const {{Name}} = forwardRef<HTMLDivElement, {{name}}Props>(
  function {{Name}}({ children, ...props }, ref) {
    return (
      <div ref={ref} className="ui-{{kebab}}" {...props}>
        {children}
      </div>
    );
  }
);

{{Name}}.displayName = '{{Name}}';
`;

const TYPES_TEMPLATE = `export interface {{name}}Props {
  /** 组件描述 */
  variant?: 'default' | 'primary';
  /** 是否禁用 */
  disabled?: boolean;
  children?: React.ReactNode;
}
`;

const STYLES_TEMPLATE = `.ui-{{kebab}} {
  display: flex;
}
`;

const STORIES_TEMPLATE = `import type { Meta, StoryObj } from '@storybook/react';
import { {{Name}} } from './{{name}}';

const meta: Meta<typeof {{Name}}> = {
  title: 'Components/{{Name}}',
  component: {{Name}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof {{Name}}>;

export const Default: Story = {
  args: {
    children: 'Hello {{Name}}',
  },
};
`;

const TEST_TEMPLATE = `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { {{Name}} } from './{{name}}';

describe('{{Name}}', () => {
  it('renders correctly', () => {
    render(<{{Name}}>Test</{{Name}}>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
`;

function toPascalCase(str) {
  return str.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase());
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

function generateComponent(name) {
  const Name = toPascalCase(name);
  const camelName = toCamelCase(name);
  const kebab = name.toLowerCase();

  const componentDir = path.join(SRC, kebab);
  if (fs.existsSync(componentDir)) {
    console.error(`Component "${kebab}" already exists.`);
    process.exit(1);
  }

  fs.mkdirSync(componentDir, { recursive: true });

  const files = [
    { name: `${kebab}.tsx`, content: COMPONENT_TEMPLATE },
    { name: `${kebab}.types.ts`, content: TYPES_TEMPLATE },
    { name: `${kebab}.styles.css`, content: STYLES_TEMPLATE },
    { name: `${kebab}.stories.tsx`, content: STORIES_TEMPLATE },
    { name: `${kebab}.test.tsx`, content: TEST_TEMPLATE },
    { name: 'index.ts', content: `export { {{Name}} } from './{{name}}';\nexport type { {{name}}Props } from './{{name}}.types';\n` },
  ];

  for (const file of files) {
    const content = file.content
      .replace(/\{\{Name\}\}/g, Name)
      .replace(/\{\{name\}\}/g, camelName)
      .replace(/\{\{kebab\}\}/g, kebab);

    fs.writeFileSync(path.join(componentDir, file.name), content);
  }

  console.log(`Created ${kebab}/`);
  console.log(`  - ${kebab}.tsx`);
  console.log(`  - ${kebab}.types.ts`);
  console.log(`  - ${kebab}.styles.css`);
  console.log(`  - ${kebab}.stories.tsx`);
  console.log(`  - ${kebab}.test.tsx`);
  console.log(`  - index.ts`);

  // 更新入口索引
  updateIndex(kebab, Name);
}

function updateIndex(kebab, Name) {
  const indexPath = path.join(SRC, 'index.ts');
  let content = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

  const exportLine = `export { ${Name} } from './${kebab}';`;
  const typeLine = `export type { ${kebab}Props } from './${kebab}';`;

  if (!content.includes(exportLine)) {
    content += `${exportLine}\n`;
  }
  if (!content.includes(typeLine)) {
    content += `${typeLine}\n`;
  }

  fs.writeFileSync(indexPath, content);
  console.log(`Updated src/index.ts`);
}

// CLI 解析
const [, , command, name] = process.argv;

if (command === 'generate' && name) {
  generateComponent(name);
} else {
  console.log('Usage: node cli.js generate <component-name>');
  console.log('Example: node cli.js generate date-picker');
}
```

## 使用

```bash
# 生成新组件
node cli.js generate date-picker

# 输出：
# Created date-picker/
#   - date-picker.tsx
#   - date-picker.types.ts
#   - date-picker.styles.css
#   - date-picker.stories.tsx
#   - date-picker.test.tsx
#   - index.ts
# Updated src/index.ts
```
