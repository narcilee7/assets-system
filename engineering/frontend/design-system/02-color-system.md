# 色彩系统

## 1. 色板结构

```
┌─────────────────────────────────────────────────────────────┐
│                        色板结构                              │
├──────────────┬──────────────────────────────────────────────┤
│  Base        │  基础颜色（无语义）                            │
│  blue-50~950 │  #eff6ff → #172554                            │
├──────────────┼──────────────────────────────────────────────┤
│  Semantic    │  语义化颜色（有用途）                          │
│  primary     │  = blue-500（品牌主色）                        │
│  success     │  = green-500（成功状态）                       │
│  warning     │  = amber-500（警告状态）                       │
│  danger      │  = red-500（危险状态）                         │
├──────────────┼──────────────────────────────────────────────┤
│  Component   │  组件级颜色                                    │
│  button-bg   │  = primary                                    │
│  input-border│  = gray-300                                   │
└──────────────┴──────────────────────────────────────────────┘
```

## 2. CSS 变量实现

```css
:root {
  /* Primitive */
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-500: #3b82f6;
  --color-blue-900: #1e3a8a;

  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-500: #6b7280;
  --color-gray-900: #111827;

  /* Semantic - Light */
  --color-primary: var(--color-blue-500);
  --color-primary-hover: var(--color-blue-600);
  --color-text-default: var(--color-gray-900);
  --color-text-muted: var(--color-gray-500);
  --color-bg-default: #ffffff;
  --color-bg-subtle: var(--color-gray-50);
  --color-border-default: var(--color-gray-200);
}

[data-theme="dark"] {
  /* Semantic - Dark */
  --color-primary: var(--color-blue-400);
  --color-primary-hover: var(--color-blue-300);
  --color-text-default: var(--color-gray-100);
  --color-text-muted: var(--color-gray-400);
  --color-bg-default: var(--color-gray-900);
  --color-bg-subtle: var(--color-gray-800);
  --color-border-default: var(--color-gray-700);
}
```

## 3. 无障碍对比度

```
WCAG 2.1 对比度要求：
├─ AA 级（正常文字）: 4.5:1
├─ AA 级（大文字 18px+/bold 14px+）: 3:1
├─ AAA 级（正常文字）: 7:1
└─ AAA 级（大文字）: 4.5:1
```

```javascript
// 计算对比度
function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// 使用
const ratio = getContrastRatio('#3b82f6', '#ffffff');
console.log(ratio);  // ~3.9（大文字可 AA，正常文字需更暗）
```

## 4. 暗黑模式

```css
/* 系统偏好自动切换 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-default: var(--color-gray-900);
    --color-text-default: var(--color-gray-100);
  }
}

/* 手动切换 */
[data-theme="dark"] {
  --color-bg-default: var(--color-gray-900);
}
```

```javascript
// React 中切换
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('theme') || 'system'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
```
