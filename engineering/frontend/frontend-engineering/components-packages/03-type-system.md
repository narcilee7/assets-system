# 类型系统

## 1. Props 类型导出

```tsx
// button.types.ts
import { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

// 统一导出类型
// src/index.ts
export type { ButtonProps, ButtonVariant, ButtonSize } from './button/button.types';
export type { InputProps } from './input/input.types';
```

## 2. .d.ts 生成

```bash
# 方式 1：vite-plugin-dts（推荐）
npm install -D vite-plugin-dts

# vite.config.ts
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      outDir: 'dist',
      insertTypesEntry: true,     // 在 package.json types 指向的入口插入
      rollupTypes: true,           // 合并所有 .d.ts 为一个文件
      exclude: ['**/*.test.ts', '**/*.stories.ts'],
    }),
  ],
});

# 方式 2：tsc 生成
# tsconfig.types.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "emitDeclarationOnly": true,
    "declaration": true,
    "declarationDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src"]
}

# package.json
"scripts": {
  "build:types": "tsc -p tsconfig.types.json"
}
```

## 3. 类型测试

```tsx
// button.types.test.ts
import type { ButtonProps } from './button.types';
import type { Equal, Expect } from '@type-challenges/utils';

// 验证类型
type cases = [
  // variant 必须是限定值
  Expect<Equal<ButtonProps['variant'], 'primary' | 'secondary' | 'ghost' | 'danger'>>,

  // 包含原生 button 属性
  Expect<Equal<ButtonProps extends { onClick?: any } ? true : false, true>>,

  // loading 是可选布尔值
  Expect<Equal<ButtonProps extends { loading?: boolean } ? true : false, true>>,
];
```

## 4. 泛型组件类型

```tsx
// 支持 as prop 的泛型组件
interface PolymorphicProps<T extends React.ElementType = 'button'> {
  as?: T;
}

type ButtonOwnProps = {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
};

type ButtonProps<T extends React.ElementType = 'button'> =
  PolymorphicProps<T> &
  ButtonOwnProps &
  Omit<React.ComponentPropsWithRef<T>, keyof (PolymorphicProps<T> & ButtonOwnProps)>;

// 使用
const Button = React.forwardRef(function Button<T extends React.ElementType = 'button'>(
  { as, variant, size, ...props }: ButtonProps<T>,
  ref: React.Ref<any>
) {
  const Component = as || 'button';
  return <Component ref={ref} {...props} />;
}) as <T extends React.ElementType = 'button'>(
  props: ButtonProps<T> & { ref?: React.Ref<any> }
) => React.ReactElement;
```
