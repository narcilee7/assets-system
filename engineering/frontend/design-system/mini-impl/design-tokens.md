# 手写 Design Tokens 生成器

## 1. Token 解析器

```javascript
// token-generator.js

/**
 * 将嵌套的 Token 对象扁平化为 CSS 变量
 */
function flattenTokens(tokens, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(tokens)) {
    const newKey = prefix ? `${prefix}-${key}` : key;

    if (typeof value === 'object' && !value.value) {
      // 嵌套对象，递归处理
      Object.assign(result, flattenTokens(value, newKey));
    } else if (typeof value === 'object' && value.value) {
      // W3C DTCG 格式 { value, type }
      result[newKey] = value.value;
    } else {
      // 简单值
      result[newKey] = value;
    }
  }

  return result;
}

// ============ 使用 ============

const tokens = {
  color: {
    blue: {
      50: '#eff6ff',
      500: '#3b82f6',
      900: '#1e3a8a',
    },
    gray: {
      50: '#f9fafb',
      900: '#111827',
    },
  },
  spacing: {
    1: '4px',
    2: '8px',
    4: '16px',
  },
};

const flat = flattenTokens(tokens);
console.log(flat);
// {
//   'color-blue-50': '#eff6ff',
//   'color-blue-500': '#3b82f6',
//   'color-gray-50': '#f9fafb',
//   'spacing-1': '4px',
//   ...
// }
```

## 2. 多格式输出

```javascript
// 生成 CSS 变量
function toCSSVariables(flatTokens) {
  const lines = Object.entries(flatTokens).map(
    ([key, value]) => `  --${key}: ${value};`
  );
  return `:root {\n${lines.join('\n')}\n}`;
}

// 生成 SCSS 变量
function toSCSSVariables(flatTokens) {
  return Object.entries(flatTokens)
    .map(([key, value]) => `$${key.replace(/-/g, '_')}: ${value};`)
    .join('\n');
}

// 生成 JS 对象
function toJS(flatTokens) {
  const entries = Object.entries(flatTokens).map(
    ([key, value]) => `  '${key}': '${value}'`
  );
  return `export const tokens = {\n${entries.join(',\n')}\n};`;
}

// ============ 完整生成 ============

function generate(tokens) {
  const flat = flattenTokens(tokens);

  return {
    css: toCSSVariables(flat),
    scss: toSCSSVariables(flat),
    js: toJS(flat),
  };
}

// 使用
const outputs = generate(tokens);
console.log(outputs.css);
// :root {
//   --color-blue-50: #eff6ff;
//   --color-blue-500: #3b82f6;
//   --spacing-1: 4px;
// }
```

## 3. Token 引用解析

```javascript
// 支持 {color.blue.500} 引用
function resolveReferences(tokens) {
  const flat = flattenTokens(tokens);
  const resolved = {};

  for (const [key, value] of Object.entries(flat)) {
    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
      // 解析引用 {color.blue.500} → color-blue-500
      const refPath = value.slice(1, -1).replace(/\./g, '-');
      resolved[key] = flat[refPath] || value;
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

const semanticTokens = {
  color: {
    primary: '{color.blue.500}',
    bg: '{color.gray.50}',
  },
};

const resolved = resolveReferences({ ...tokens, ...semanticTokens });
console.log(resolved['color-primary']);  // #3b82f6
```
