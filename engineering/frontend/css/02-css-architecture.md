# CSS 架构

## 1. ITCSS（Inverted Triangle CSS）

```
倒三角：从通用到具体，特异性递增

Settings      ← 变量、配置（无 CSS 输出）
  ↓
Tools         ← mixins、functions（无 CSS 输出）
  ↓
Generic       ← 重置、normalize（低特异性）
  ↓
Elements      ← 裸元素样式（h1, a, p）
  ↓
Objects       ← OOCSS 对象（布局模式）
  ↓
Components    ← 具体 UI 组件
  ↓
Utilities     ← 辅助类（高特异性，!important）
  ↓
Overrides     ← 临时覆盖（最高特异性）
```

```scss
// 1. Settings
// _settings.colors.scss
$color-primary: #3b82f6;
$color-text: #1f2937;

// 2. Tools
// _tools.mixins.scss
@mixin container($max-width: 1200px) {
  max-width: $max-width;
  margin-inline: auto;
  padding-inline: var(--space-4);
}

// 3. Generic
// _generic.reset.scss
*, *::before, *::after {
  box-sizing: border-box;
}

// 4. Elements
// _elements.headings.scss
h1, h2, h3 {
  font-weight: 700;
  line-height: 1.2;
}

// 5. Objects
// _objects.grid.scss
.o-grid {
  display: grid;
  gap: var(--space-4);
}
.o-grid--2col {
  grid-template-columns: repeat(2, 1fr);
}

// 6. Components
// _components.card.scss
.c-card {
  background: var(--color-surface);
  border-radius: var(--space-2);
  padding: var(--space-4);
}

// 7. Utilities
// _utilities.spacing.scss
.u-mb-4 { margin-bottom: var(--space-4) !important; }
.u-text-center { text-align: center !important; }

// 8. Overrides
// _overrides.shame.scss
// 临时 hack，必须带注释说明原因和移除时间
/*! FIXME: 临时修复 Safari flex bug，2024-06 前移除 */
.safari-flex-fix { }
```

## 2. Utility-first（Tailwind CSS）

```html
<!-- Utility-first：组合原子类 -->
<button class="inline-flex items-center gap-2 px-4 py-2 
               bg-blue-500 text-white rounded-lg
               hover:bg-blue-600 focus:ring-2 focus:ring-blue-300
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors duration-150">
  <svg class="w-4 h-4"><!-- icon --></svg>
  <span>Submit</span>
</button>
```

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

```css
/* @apply 提取组件（谨慎使用） */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg
           transition-colors duration-150;
  }
  .btn-primary {
    @apply btn bg-blue-500 text-white hover:bg-blue-600;
  }
}
```

| 优点 | 缺点 |
|------|------|
| 零运行时（构建时生成） | HTML 类名冗长 |
| 文件体积小（Purging） | 学习曲线陡峭 |
| 不担心命名冲突 | 语义化差（`flex` vs `header`） |
| 设计系统一致性 | 动态值困难（calc） |

## 3. Design Token

```javascript
// tokens.json
{
  "color": {
    "primary": {
      "50": { "value": "#eff6ff", "type": "color" },
      "500": { "value": "#3b82f6", "type": "color" },
      "900": { "value": "#1e3a8a", "type": "color" }
    }
  },
  "font": {
    "size": {
      "sm": { "value": "14px", "type": "fontSize" },
      "base": { "value": "16px", "type": "fontSize" },
      "lg": { "value": "18px", "type": "fontSize" }
    }
  },
  "space": {
    "4": { "value": "16px", "type": "spacing" }
  }
}
```

```javascript
// style-dictionary.config.js
const StyleDictionary = require('style-dictionary');

module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables',
        options: { outputReferences: true }
      }]
    },
    scss: {
      transformGroup: 'scss',
      buildPath: 'build/',
      files: [{
        destination: '_variables.scss',
        format: 'scss/variables'
      }]
    },
    js: {
      transformGroup: 'js',
      buildPath: 'build/',
      files: [{
        destination: 'tokens.js',
        format: 'javascript/es6'
      }]
    }
  }
};
```

```css
/* build/variables.css */
:root {
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --font-size-sm: 14px;
  --space-4: 16px;
}
```

```javascript
// build/tokens.js
export const colorPrimary500 = '#3b82f6';
export const space4 = '16px';
```

## 4. CSS-in-JS

```javascript
// styled-components
import styled from 'styled-components';

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${props => props.theme.space[2]};
  padding: ${props => props.theme.space[2]} ${props => props.theme.space[4]};
  background: ${props => props.variant === 'primary' 
    ? props.theme.colors.primary[500] 
    : props.theme.colors.gray[200]};
  color: ${props => props.variant === 'primary' ? 'white' : props.theme.colors.gray[800]};
  border-radius: ${props => props.theme.radii.md};
  transition: all 150ms ease;

  &:hover:not(:disabled) {
    background: ${props => props.theme.colors.primary[900]};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary[500]}40;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// 使用
<Button variant="primary">Submit</Button>
```

```javascript
// Linaria（零运行时）
import { css } from '@linaria/core';
import { styled } from '@linaria/react';

const title = css`
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text-primary);
`;

const Container = styled.div`
  padding: ${props => props.padded ? '2rem' : '0'};
  background: ${props => props.theme.colors.surface};
`;
```

| 方案 | 运行时 | SSR | 动态样式 | 包大小 |
|------|--------|-----|----------|--------|
| styled-components | 有 | 支持 | 完全 | ~12KB |
| emotion | 有 | 支持 | 完全 | ~7KB |
| Linaria | 无 | 支持 | 编译时 | ~0KB |
| vanilla-extract | 无 | 支持 | TypeScript | ~0KB |
