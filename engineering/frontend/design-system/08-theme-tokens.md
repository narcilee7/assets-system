# 主题与变量

## 1. CSS 变量架构

```css
/* 三层架构 */
:root {
  /* Layer 1: Primitive Tokens */
  --color-white: #ffffff;
  --color-black: #000000;
  --color-blue-50: #eff6ff;
  --color-blue-500: #3b82f6;
  --color-blue-900: #1e3a8a;
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-500: #6b7280;
  --color-gray-900: #111827;

  --radius-none: 0px;
  --radius-sm: 2px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* Layer 2: Semantic Tokens */
  --color-primary: var(--color-blue-500);
  --color-primary-hover: var(--color-blue-600);
  --color-bg-default: var(--color-white);
  --color-bg-subtle: var(--color-gray-50);
  --color-text-default: var(--color-gray-900);
  --color-text-muted: var(--color-gray-500);
  --color-border-default: var(--color-gray-200);

  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

/* Layer 3: Component Tokens */
:root {
  --button-bg: var(--color-primary);
  --button-bg-hover: var(--color-primary-hover);
  --button-color: var(--color-white);
  --button-padding: var(--space-2) var(--space-4);
  --button-radius: var(--radius-md);
  --button-font-size: var(--font-size-sm);
}
```

## 2. 多品牌主题

```css
/* Brand A (默认) */
:root {
  --color-primary: #3b82f6;
}

/* Brand B */
[data-brand="brand-b"] {
  --color-primary: #10b981;
  --color-primary-hover: #059669;
}

/* Brand C */
[data-brand="brand-c"] {
  --color-primary: #f59e0b;
  --color-primary-hover: #d97706;
}
```

## 3. Token 生成工具

```javascript
// tokens.js → CSS 变量
const tokens = {
  color: {
    blue: { 50: '#eff6ff', 500: '#3b82f6', 900: '#1e3a8a' },
    gray: { 50: '#f9fafb', 500: '#6b7280', 900: '#111827' },
  },
  spacing: { 1: '4px', 2: '8px', 4: '16px', 8: '32px' },
};

function generateCSSVariables(tokens, prefix = '') {
  const vars = [];

  for (const [key, value] of Object.entries(tokens)) {
    const varName = prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'object') {
      vars.push(...generateCSSVariables(value, varName));
    } else {
      vars.push(`  --${varName}: ${value};`);
    }
  }

  return vars;
}

// 输出
// --color-blue-50: #eff6ff;
// --color-blue-500: #3b82f6;
// --spacing-1: 4px;
```
