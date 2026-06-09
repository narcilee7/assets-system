# CSS 基础工程化

## 1. 命名规范

### BEM（Block Element Modifier）

```css
/* Block */
.button { }

/* Element */
.button__icon { }
.button__text { }

/* Modifier */
.button--primary { }
.button--large { }
.button--disabled { }

/* 组合 */
.button--primary .button__icon { }
```

```html
<button class="button button--primary button--large">
  <span class="button__icon">→</span>
  <span class="button__text">Submit</span>
</button>
```

| 原则 | 说明 |
|------|------|
| 无嵌套选择器 | `.button--primary` 而非 `.button.primary` |
| 无元素标签 | `.button` 而非 `button.button` |
| 无 ID 选择器 | 始终使用 class |
| Modifier 单独存在 | 必须配合 Block：`.button.button--primary` |

### OOCSS（Object Oriented CSS）

```css
/* 结构（Skeleton）与 皮肤（Skin）分离 */
.btn {
  display: inline-block;
  padding: 0.5em 1em;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

/* 容器与内容分离 */
.media {
  display: flex;
  gap: 1rem;
}
.media__img { flex-shrink: 0; }
.media__body { flex: 1; }
```

### SMACSS（Scalable and Modular Architecture）

```
smacss/
├── base/           # 重置、元素默认样式
│   ├── _reset.css
│   └── _typography.css
├── layout/         # 大尺度布局（Header/Sidebar/Main）
│   ├── _grid.css
│   └── _header.css
├── module/         # 可复用组件
│   ├── _button.css
│   └── _card.css
├── state/          # 状态（is-active, is-hidden）
│   └── _states.css
└── theme/          # 主题变量
    └── _theme.css
```

```css
/* layout/_grid.css */
.l-grid { display: grid; }
.l-grid--3col { grid-template-columns: repeat(3, 1fr); }

/* module/_button.css */
.btn { }

/* state/_states.css */
.is-hidden { display: none !important; }
.is-active { }
```

## 2. CSS 变量（自定义属性）

```css
:root {
  /* 色彩体系 */
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-900: #1e3a8a;

  /* 语义化 Token */
  --color-text-primary: var(--color-primary-900);
  --color-text-secondary: #6b7280;
  --color-surface: #ffffff;
  --color-border: #e5e7eb;

  /* 间距体系 */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-8: 2rem;      /* 32px */

  /* 字体体系 */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  --font-mono: 'SF Mono', Monaco, Consolas, monospace;

  /* 层级体系 */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-popover: 400;
  --z-tooltip: 500;

  /* 动效 */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
}

/* 暗色主题 */
[data-theme="dark"] {
  --color-text-primary: #f3f4f6;
  --color-text-secondary: #9ca3af;
  --color-surface: #111827;
  --color-border: #374151;
}

/* 使用 */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: var(--space-4);
  font-family: var(--font-sans);
  transition: box-shadow var(--duration-fast) var(--ease-out);
}
```

## 3. 预处理器工程化

```scss
// SCSS 工程化最佳实践

// _variables.scss
$breakpoints: (
  sm: 640px,
  md: 768px,
  lg: 1024px,
  xl: 1280px,
);

@mixin respond-to($breakpoint) {
  $value: map-get($breakpoints, $breakpoint);
  @media (min-width: $value) {
    @content;
  }
}

// _functions.scss
@function rem($px, $base: 16px) {
  @return #{$px / $base}rem;
}

// _mixins.scss
@mixin truncate($lines: 1) {
  @if $lines == 1 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  } @else {
    display: -webkit-box;
    -webkit-line-clamp: $lines;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

@mixin focus-ring($color: var(--color-primary-500)) {
  outline: none;
  box-shadow: 0 0 0 2px $color;
}

// _button.scss
@import 'variables';
@import 'mixins';

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--space-1);
  font-size: rem(14px);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);

  &:focus-visible {
    @include focus-ring;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--primary {
    background: var(--color-primary-500);
    color: white;

    &:hover:not(:disabled) {
      background: var(--color-primary-900);
    }
  }

  @include respond-to(md) {
    padding: var(--space-3) var(--space-6);
    font-size: rem(16px);
  }
}
```

## 4. 层叠管理

```css
/* @layer 引入层叠上下文（现代浏览器） */
@layer reset, base, components, utilities, overrides;

@layer reset {
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
  }
}

@layer base {
  body {
    font-family: var(--font-sans);
    line-height: 1.5;
    color: var(--color-text-primary);
  }
}

@layer components {
  .btn { /* ... */ }
  .card { /* ... */ }
}

@layer utilities {
  .text-center { text-align: center; }
  .hidden { display: none; }
}

/* 层外样式优先级最高 */
.critical-override {
  color: red !important;
}
```

```css
/* 不使用 @layer 时的层叠管理 */
/* 通过选择器特异性控制 */

/* 基础：0-1-0 */
.button { }

/* 状态：0-2-0 */
.button.is-active { }

/* 主题覆盖：0-2-0 */
[data-theme="dark"] .button { }

/* JS 动态：1-0-0 */
#js-specific-button { }  /* 避免 */

/* 使用 :where() 降低特异性 */
:where(.button) { }  /* 0-0-1，便于覆盖 */
```
