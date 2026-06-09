# 图标系统

## 1. SVG 图标（推荐）

```tsx
// Icon 组件基类
interface IconProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | number;
  color?: string;
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

function Icon({ name, size = 'md', color, className }: IconProps) {
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}

// 使用
<Icon name="search" size="md" />
<Icon name="chevron-right" size="sm" color="var(--color-primary)" />
```

## 2. SVG Sprite

```html
<!-- icons.svg -->
<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
  <symbol id="search" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </symbol>
  <symbol id="heart" viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </symbol>
</svg>
```

## 3. 图标尺寸规范

```css
:root {
  --icon-size-xs: 12px;
  --icon-size-sm: 16px;
  --icon-size-md: 20px;
  --icon-size-lg: 24px;
  --icon-size-xl: 32px;
}

/* 与文本对齐 */
.icon-inline {
  display: inline-block;
  vertical-align: middle;
  width: 1em;
  height: 1em;
}
```

## 4. 无障碍

```tsx
// 装饰性图标（隐藏）
<Icon name="arrow-right" aria-hidden="true" />

// 功能性图标（需有文本说明）
<button>
  <Icon name="trash" aria-hidden="true" />
  <span className="sr-only">Delete</span>
</button>

// 或 aria-label
<button aria-label="Delete item">
  <Icon name="trash" aria-hidden="true" />
</button>
```
