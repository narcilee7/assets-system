# 样式系统

## 1. 方案对比

| 方案 | 优点 | 缺点 | 适用 |
|------|------|------|------|
| **CSS-in-JS**（styled-components/emotion） | 动态主题、样式隔离、无需构建 | 运行时开销、SSR 复杂 | 高动态主题需求 |
| **CSS Modules** | 构建时处理、无运行时开销 | 全局样式难管理 | 中小型项目 |
| **预处理器 + CSS 变量** | 最轻量、浏览器原生 | 动态能力弱 | 追求性能 |
| **Tailwind + CSS 变量** | 原子化、Tree Shaking | 学习成本、类名冗长 | 现代项目 |

## 2. CSS 变量主题方案

```css
/* theme-default.css */
:root,
[data-theme="light"] {
  --ui-primary: #3b82f6;
  --ui-primary-hover: #2563eb;
  --ui-bg: #ffffff;
  --ui-bg-subtle: #f9fafb;
  --ui-text: #111827;
  --ui-text-muted: #6b7280;
  --ui-border: #e5e7eb;
  --ui-radius-sm: 2px;
  --ui-radius-md: 6px;
  --ui-radius-lg: 8px;
  --ui-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

[data-theme="dark"] {
  --ui-primary: #60a5fa;
  --ui-primary-hover: #3b82f6;
  --ui-bg: #111827;
  --ui-bg-subtle: #1f2937;
  --ui-text: #f9fafb;
  --ui-text-muted: #9ca3af;
  --ui-border: #374151;
}
```

```tsx
// ThemeProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

## 3. 组件样式实现

```tsx
// button.styles.css
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--ui-radius-md);
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
}

.ui-button--primary {
  background: var(--ui-primary);
  color: white;
}

.ui-button--primary:hover {
  background: var(--ui-primary-hover);
}

.ui-button--sm {
  height: 32px;
  padding: 0 12px;
  font-size: 14px;
}

.ui-button--md {
  height: 40px;
  padding: 0 16px;
  font-size: 14px;
}

.ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

```tsx
// button.tsx
import './button.styles.css';

export function Button({ variant = 'primary', size = 'md', loading, children, ...props }: ButtonProps) {
  const className = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    loading && 'ui-button--loading',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={className} disabled={loading} {...props}>
      {children}
    </button>
  );
}
```

## 4. 按需加载样式

```javascript
// 方式 1：组件内 import（构建时自动提取）
import './button.styles.css';

// 方式 2：全量引入（入口文件）
import '@my-ui/components/style.css';

// 方式 3：Babel 插件自动引入
// babel-plugin-import 配置
{
  "libraryName": "@my-ui/components",
  "style": (name) => `@my-ui/components/dist/${name}/style.css`
}
```
