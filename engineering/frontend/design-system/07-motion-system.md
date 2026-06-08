# 动效系统

## 1. 时长规范

```css
:root {
  /* 时长 Token */
  --duration-instant: 0ms;       /* 无动画 */
  --duration-fast: 100ms;        /* 微交互（hover、focus） */
  --duration-normal: 200ms;      /* 标准过渡（toggle、switch） */
  --duration-slow: 300ms;        /* 显著变化（modal、dropdown） */
  --duration-slower: 500ms;      /* 复杂动画（page transition） */
}
```

## 2. 缓动曲线

```css
:root {
  /* Easing Tokens */
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);           /* 加速 */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);          /* 减速（推荐） */
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);     /* 标准 */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性 */
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

## 3. 标准过渡

```css
/* 通用过渡 */
.transition {
  transition-property: color, background-color, border-color, box-shadow;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-out);
}

/* 尺寸变化 */
.transition-size {
  transition-property: width, height, transform;
  transition-duration: var(--duration-slow);
  transition-timing-function: var(--ease-in-out);
}

/* 透明度 */
.transition-fade {
  transition-property: opacity;
  transition-duration: var(--duration-fast);
  transition-timing-function: var(--ease-linear);
}
```

## 4. 可访问动效

```css
/* 尊重用户偏好 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// React 中检测
const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

function AnimatedModal({ isOpen }) {
  if (prefersReducedMotion) {
    return isOpen ? <Modal /> : null;
  }
  return (
    <AnimatePresence>
      {isOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
    </AnimatePresence>
  );
}
```
