# 排版系统

## 1. 字体比例

```
Type Scale（1.25 倍率）：
  xs:    12px  (0.75rem)
  sm:    14px  (0.875rem)
  base:  16px  (1rem)      ← 基准
  lg:    18px  (1.125rem)
  xl:    20px  (1.25rem)
  2xl:   24px  (1.5rem)
  3xl:   30px  (1.875rem)
  4xl:   36px  (2.25rem)
  5xl:   48px  (3rem)
```

```css
:root {
  /* 字体族 */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;

  /* 字体大小 */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* 行高 */
  --line-height-tight: 1.25;
  --line-height-snug: 1.375;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;

  /* 字重 */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* 字间距 */
  --letter-spacing-tight: -0.025em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.025em;
}
```

## 2. 排版组件映射

```tsx
// 语义化排版组件
type TextProps = {
  variant: 'heading-xl' | 'heading-lg' | 'heading-md' | 'body' | 'body-sm' | 'caption';
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'label';
};

const variantStyles = {
  'heading-xl':  { fontSize: '2.25rem', lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.02em' },
  'heading-lg':  { fontSize: '1.875rem', lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.01em' },
  'heading-md':  { fontSize: '1.5rem',  lineHeight: 1.4, fontWeight: 600 },
  'body':        { fontSize: '1rem',     lineHeight: 1.5, fontWeight: 400 },
  'body-sm':     { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 },
  'caption':     { fontSize: '0.75rem',  lineHeight: 1.5, fontWeight: 400, color: 'var(--color-text-muted)' },
};

function Text({ variant, as: Component = 'span', children }: TextProps) {
  return <Component style={variantStyles[variant]}>{children}</Component>;
}

// 使用
<Text variant="heading-xl" as="h1">Page Title</Text>
<Text variant="body">Normal text</Text>
```

## 3. 响应式排版

```css
/* Fluid typography */
:root {
  --font-size-fluid-sm: clamp(0.875rem, 0.8rem + 0.2vw, 1rem);
  --font-size-fluid-base: clamp(1rem, 0.9rem + 0.3vw, 1.125rem);
  --font-size-fluid-lg: clamp(1.25rem, 1rem + 0.8vw, 1.5rem);
  --font-size-fluid-xl: clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem);
}

/* 或使用媒体查询 */
@media (max-width: 640px) {
  .heading-xl { font-size: 1.5rem; }
}
@media (min-width: 641px) and (max-width: 1024px) {
  .heading-xl { font-size: 2rem; }
}
@media (min-width: 1025px) {
  .heading-xl { font-size: 2.5rem; }
}
```
