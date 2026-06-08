# 手写组件基类

## 1. 样式合并工具

```javascript
// class-merge.js

/**
 * 合并 className，支持条件、数组、对象
 * 类似 clsx + tailwind-merge
 */
function cx(...inputs) {
  const classes = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      classes.push(cx(...input));
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(' ');
}

// ============ 使用 ============

cx('base', 'active');                          // 'base active'
cx('base', false && 'hidden', 'visible');      // 'base visible'
cx('base', { active: true, disabled: false }); // 'base active'
cx('base', ['a', 'b', { c: true }]);           // 'base a b c'
```

## 2. 变体系统基类

```typescript
// variants.ts

type VariantConfig<T extends Record<string, Record<string, string>>> = {
  base: string;
  variants: T;
  defaultVariants?: { [K in keyof T]?: keyof T[K] };
  compoundVariants?: Array<{
    [K in keyof T]?: keyof T[K] | Array<keyof T[K]>;
  } & { class: string }>;
};

function createVariants<T extends Record<string, Record<string, string>>>(
  config: VariantConfig<T>
) {
  return (props: { [K in keyof T]?: keyof T[K] } & { className?: string }) => {
    const classes = [config.base];

    // 应用变体
    for (const [key, value] of Object.entries(props)) {
      if (key === 'className') continue;
      const variantClass = config.variants[key]?.[value as string];
      if (variantClass) classes.push(variantClass);
    }

    // 应用默认变体
    for (const [key, value] of Object.entries(config.defaultVariants || {})) {
      if (props[key] === undefined) {
        const variantClass = config.variants[key]?.[value as string];
        if (variantClass) classes.push(variantClass);
      }
    }

    // 复合变体
    for (const compound of config.compoundVariants || []) {
      const matches = Object.entries(compound)
        .filter(([key]) => key !== 'class')
        .every(([key, expected]) => {
          const actual = props[key] || config.defaultVariants?.[key];
          if (Array.isArray(expected)) return expected.includes(actual as string);
          return expected === actual;
        });

      if (matches) classes.push(compound.class);
    }

    // 外部 className
    if (props.className) classes.push(props.className);

    return classes.join(' ');
  };
}

// ============ 使用 ============

const buttonVariants = createVariants({
  base: 'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  variants: {
    variant: {
      primary: 'bg-blue-500 text-white hover:bg-blue-600',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      ghost: 'hover:bg-gray-100',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-base',
      lg: 'h-12 px-6 text-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
  compoundVariants: [
    { variant: 'ghost', size: 'sm', class: 'px-2' },
  ],
});

// 生成类名
const className = buttonVariants({ variant: 'secondary', size: 'lg' });
// 'inline-flex items-center ... bg-gray-200 ... h-12 px-6 text-lg'
```

## 3. 通用组件基类

```tsx
// ComponentBase.tsx

import { forwardRef } from 'react';

interface BaseProps {
  as?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
}

function ComponentBase<T extends BaseProps>(
  { as: Component = 'div', className, children, ...props }: T,
  ref: React.Ref<any>
) {
  return (
    <Component ref={ref} className={className} {...props}>
      {children}
    </Component>
  );
}

// 使用 forwardRef
const Box = forwardRef(ComponentBase);

// 使用
<Box as="section" className="p-4">
  Content
</Box>
<Box as="button" className="btn" onClick={handleClick}>
  Click
</Box>
```
