# ESLint + Prettier

## 1. ESLint 配置

```javascript
// eslint.config.js (Flat Config)
import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  react.configs.flat.recommended,
  {
    rules: {
      // 错误级别
      'no-console': ['warn', { allow: ['error'] }],
      'no-debugger': 'error',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 自定义
      'no-restricted-imports': ['error', {
        patterns: ['../../*'],  // 禁止跨越层级导入
      }],
    },
  },
];
```

## 2. Prettier 配置

```javascript
// prettier.config.js
export default {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  arrowParens: 'always',
};
```

## 3. 冲突解决

```javascript
// eslint.config.js - 关闭与 Prettier 冲突的规则
import prettier from 'eslint-config-prettier';

export default [
  // ...其他配置
  prettier,  // 放在最后，覆盖冲突规则
];
```

## 4. CI 集成

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

## 5. 自定义 ESLint 规则

```javascript
// eslint-plugin-custom/rules/no-direct-window-access.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止直接访问 window，使用封装后的工具',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.name === 'window') {
          context.report({
            node,
            message: 'Use utils/window instead of direct window access',
          });
        }
      },
    };
  },
};
```
